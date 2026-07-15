"""Convert a positioned graph into valid tldraw v5 records.

This module is the SINGLE SOURCE OF TRUTH for tldraw record generation.
It guarantees all schema requirements are met:
- Base records: document, page, camera
- Valid fractional index keys
- RichText format for text
- All required shape props with correct types
- Proper branded IDs

The frontend loads these records directly via editor.store.put().
"""
from __future__ import annotations

from typing import Any
from uuid import uuid4

from app.schema.diagram_graph import DiagramGraph
from app.schema.graph_layout import (
    LayoutResult,
    PositionedNode,
    PositionedEdge,
    layout_graph,
)
from app.schema.diagram_graph import DiagramNode, DiagramEdge


# ---------------------------------------------------------------------------
#  Helpers
# ---------------------------------------------------------------------------

def _uid() -> str:
    return uuid4().hex[:16]


def _to_rich_text(text: str) -> dict[str, Any]:
    """Convert plain text to tldraw v5 RichText (TipTap/ProseMirror format)."""
    if not text:
        return {"type": "doc", "content": [{"type": "paragraph"}]}
    lines = text.split("\n")
    content = []
    for line in lines:
        if not line:
            content.append({"type": "paragraph"})
        else:
            content.append({
                "type": "paragraph",
                "content": [{"type": "text", "text": line}],
            })
    return {"type": "doc", "content": content}


# ---------------------------------------------------------------------------
#  Fractional index key generation (ported from @tldraw/utils)
# ---------------------------------------------------------------------------

_DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
_ZERO = "0"


def _digit_index(char: str) -> int:
    return _DIGITS.index(char)


def _get_integer_length(head: str) -> int:
    if "a" <= head <= "z":
        return ord(head) - ord("a") + 2
    elif "A" <= head <= "Z":
        return ord("Z") - ord(head) + 2
    raise ValueError(f"invalid order key head: {head}")


def _get_integer_part(key: str) -> str:
    int_len = _get_integer_length(key[0])
    return key[:int_len]


def _midpoint(a: str, b: str | None) -> str:
    if b is not None and a >= b:
        raise ValueError(f"{a} >= {b}")
    if a.endswith(_ZERO) or (b is not None and b.endswith(_ZERO)):
        raise ValueError("trailing zero")
    if b is not None:
        n = 0
        while (a[n:n+1] or _ZERO) == b[n:n+1]:
            n += 1
        if n > 0:
            return b[:n] + _midpoint(a[n:], b[n:])
    digit_a = _digit_index(a[0]) if a else 0
    digit_b = _digit_index(b[0]) if b is not None else len(_DIGITS)
    if digit_b - digit_a > 1:
        mid = round(0.5 * (digit_a + digit_b))
        return _DIGITS[mid]
    if b is not None and len(b) > 1:
        return b[0]
    return _DIGITS[digit_a] + _midpoint(a[1:], None)


def _increment_integer(x: str) -> str | None:
    head = x[0]
    digs = list(x[1:])
    carry = True
    for i in range(len(digs) - 1, -1, -1):
        d = _digit_index(digs[i]) + 1
        if d == len(_DIGITS):
            digs[i] = _ZERO
        else:
            digs[i] = _DIGITS[d]
            carry = False
            break
    if carry:
        if head == "Z":
            return "a" + _ZERO
        if head == "z":
            return None
        h = chr(ord(head) + 1)
        if h > "a":
            digs.append(_ZERO)
        else:
            digs.pop()
        return h + "".join(digs)
    return head + "".join(digs)


def _key_between(a: str | None, b: str | None) -> str:
    if a is not None and b is not None and a >= b:
        raise ValueError(f"{a} >= {b}")
    if a is None:
        if b is None:
            return "a0"
        ib = _get_integer_part(b)
        fb = b[len(ib):]
        if ib < b:
            return ib
        res = _increment_integer(ib)
        if res is None:
            raise ValueError("cannot increment")
        return res
    if b is None:
        ia = _get_integer_part(a)
        fa = a[len(ia):]
        i = _increment_integer(ia)
        return ia + _midpoint(fa, None) if i is None else i
    ia = _get_integer_part(a)
    fa = a[len(ia):]
    ib = _get_integer_part(b)
    fb = b[len(ib):]
    if ia == ib:
        return ia + _midpoint(fa, fb)
    i = _increment_integer(ia)
    if i is None:
        raise ValueError("cannot increment")
    if i < b:
        return i
    return ia + _midpoint(fa, None)


def _get_first_indices(n: int) -> list[str]:
    """Generate n valid IndexKeys starting from the beginning."""
    if n <= 0:
        return []
    result = ["a1"]
    c = "a1"
    for _ in range(n - 1):
        c = _key_between(c, None)
        result.append(c)
    return result


# ---------------------------------------------------------------------------
#  Node → shape conversion
# ---------------------------------------------------------------------------

def _node_to_shape(
    node: PositionedNode,
    page_id: str,
    index: str,
) -> dict[str, Any]:
    """Convert a positioned node into a tldraw shape record dict."""
    shape_id = f"shape:{node.id}"

    if node.shape == "frame":
        return {
            "id": shape_id,
            "typeName": "shape",
            "type": "frame",
            "x": node.x,
            "y": node.y,
            "rotation": 0,
            "isLocked": False,
            "opacity": 1,
            "meta": {},
            "props": {
                "name": node.label,
                "color": "black",
                "w": node.w,
                "h": node.h,
            },
            "parentId": page_id,
            "index": index,
        }

    if node.shape == "note":
        return {
            "id": shape_id,
            "typeName": "shape",
            "type": "note",
            "x": node.x,
            "y": node.y,
            "rotation": 0,
            "isLocked": False,
            "opacity": 1,
            "meta": {},
            "props": {
                "color": "yellow",
                "labelColor": "black",
                "size": "m",
                "font": "draw",
                "fontSizeAdjustment": 1,
                "align": "middle",
                "verticalAlign": "middle",
                "growY": 0,
                "url": "",
                "richText": _to_rich_text(node.label),
                "scale": 1,
                "textLastEditedBy": None,
            },
            "parentId": page_id,
            "index": index,
        }

    if node.shape == "ellipse":
        return {
            "id": shape_id,
            "typeName": "shape",
            "type": "geo",
            "x": node.x,
            "y": node.y,
            "rotation": 0,
            "isLocked": False,
            "opacity": 1,
            "meta": {},
            "props": {
                "geo": "ellipse",
                "color": "black",
                "labelColor": "black",
                "fill": "none",
                "dash": "draw",
                "size": "m",
                "font": "draw",
                "align": "middle",
                "verticalAlign": "middle",
                "growY": 0,
                "scale": 1,
                "url": "",
                "richText": _to_rich_text(node.label),
                "w": node.w,
                "h": node.h,
            },
            "parentId": page_id,
            "index": index,
        }

    if node.shape == "diamond":
        return {
            "id": shape_id,
            "typeName": "shape",
            "type": "geo",
            "x": node.x,
            "y": node.y,
            "rotation": 0,
            "isLocked": False,
            "opacity": 1,
            "meta": {},
            "props": {
                "geo": "diamond",
                "color": "black",
                "labelColor": "black",
                "fill": "none",
                "dash": "draw",
                "size": "m",
                "font": "draw",
                "align": "middle",
                "verticalAlign": "middle",
                "growY": 0,
                "scale": 1,
                "url": "",
                "richText": _to_rich_text(node.label),
                "w": node.w,
                "h": node.h,
            },
            "parentId": page_id,
            "index": index,
        }

    # Default: box (rectangle geo shape)
    return {
        "id": shape_id,
        "typeName": "shape",
        "type": "geo",
        "x": node.x,
        "y": node.y,
        "rotation": 0,
        "isLocked": False,
        "opacity": 1,
        "meta": {},
        "props": {
            "geo": "rectangle",
            "color": "black",
            "labelColor": "black",
            "fill": "none",
            "dash": "draw",
            "size": "m",
            "font": "draw",
            "align": "middle",
            "verticalAlign": "middle",
            "growY": 0,
            "scale": 1,
            "url": "",
            "richText": _to_rich_text(node.label),
            "w": node.w,
            "h": node.h,
        },
        "parentId": page_id,
        "index": index,
    }


# ---------------------------------------------------------------------------
#  Edge → arrow conversion
# ---------------------------------------------------------------------------

def _edge_to_arrow(
    edge: PositionedEdge,
    page_id: str,
    index: str,
) -> dict[str, Any]:
    """Convert a positioned edge into a tldraw arrow shape record dict."""
    arrow_id = f"shape:{edge.id}"

    return {
        "id": arrow_id,
        "typeName": "shape",
        "type": "arrow",
        "x": edge.start_x,
        "y": edge.start_y,
        "rotation": 0,
        "isLocked": False,
        "opacity": 1,
        "meta": {},
        "props": {
            "kind": "arc",
            "labelColor": "black",
            "color": "black",
            "fill": "none",
            "dash": "draw",
            "size": "m",
            "arrowheadStart": "none",
            "arrowheadEnd": "arrow",
            "font": "draw",
            "start": {"type": "point", "x": 0, "y": 0},
            "end": {"type": "point", "x": edge.end_x - edge.start_x, "y": edge.end_y - edge.start_y},
            "bend": 0,
            "richText": _to_rich_text(edge.label),
            "labelPosition": 0.5,
            "scale": 1,
            "elbowMidPoint": 0.5,
        },
        "parentId": page_id,
        "index": index,
    }


# ---------------------------------------------------------------------------
#  Public API: graph → tldraw records
# ---------------------------------------------------------------------------

def graph_to_tldraw_records(graph: DiagramGraph) -> dict[str, Any]:
    """Convert a DiagramGraph into a complete, valid tldraw record set.

    Returns a dict with:
    - records: list of tldraw record dicts (for editor.store.put())
    - canvas_w, canvas_h: canvas dimensions

    This is the ONLY function that creates tldraw records.
    All schema requirements are guaranteed here.
    """
    page_id = "page:page"

    # Compute layout
    layout = layout_graph(graph)

    # Generate index keys for all shapes
    total_shapes = len(layout.nodes) + len(layout.edges)
    indices = _get_first_indices(total_shapes)

    records: list[dict[str, Any]] = []

    # 1. Document record
    records.append({
        "id": "document:document",
        "typeName": "document",
        "gridSize": 10,
        "name": graph.name or "Untitled",
        "meta": {},
    })

    # 2. Page record
    records.append({
        "id": page_id,
        "typeName": "page",
        "name": "Page 1",
        "index": "a0",
        "meta": {},
    })

    # 3. Camera record — MISSING in our old implementation!
    records.append({
        "id": f"camera:{page_id}",
        "typeName": "camera",
        "x": 0,
        "y": 0,
        "z": 1,
    })

    # 4. Shape records
    idx = 0

    # Nodes → shapes
    for node in layout.nodes:
        records.append(_node_to_shape(node, page_id, indices[idx]))
        idx += 1

    # Edges → arrows
    for edge in layout.edges:
        records.append(_edge_to_arrow(edge, page_id, indices[idx]))
        idx += 1

    return {
        "records": records,
        "canvas_w": layout.canvas_w,
        "canvas_h": layout.canvas_h,
    }


def graph_to_tldraw_records_flat(graph: DiagramGraph) -> list[dict[str, Any]]:
    """Convert a DiagramGraph into a flat list of tldraw record dicts.

    Convenience wrapper — returns just the records list.
    Use this for editor.store.put().
    """
    result = graph_to_tldraw_records(graph)
    return result["records"]
