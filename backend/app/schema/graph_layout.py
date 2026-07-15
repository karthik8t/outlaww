"""Deterministic graph layout engine.

Takes a DiagramGraph (nodes + edges) and computes x/y coordinates.
No LLM involved — pure algorithmic layout.

Implements two strategies:
1. Grid layout — simple rows/columns for general diagrams
2. Layered layout (Sugiyama-style) — for directed graphs with clear flow
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

from app.schema.diagram_graph import DiagramGraph, DiagramEdge


# ---------------------------------------------------------------------------
#  Layout constants
# ---------------------------------------------------------------------------

NODE_W = 180          # default node width
NODE_H = 60           # default node height
NOTE_W = 180
NOTE_H = 80
DIAMOND_W = 100
DIAMOND_H = 80
ELLIPSE_W = 120
ELLIPSE_H = 80
FRAME_PAD = 40        # padding inside frames
LAYER_GAP_X = 120     # horizontal gap between layers
ROW_GAP_Y = 100       # vertical gap between rows in a layer
MARGIN = 60           # canvas margin


# ---------------------------------------------------------------------------
#  Positioned results
# ---------------------------------------------------------------------------

@dataclass
class PositionedNode:
    id: str
    label: str
    shape: str
    x: float
    y: float
    w: float
    h: float

    @property
    def cx(self) -> float:
        return self.x + self.w / 2

    @property
    def cy(self) -> float:
        return self.y + self.h / 2


@dataclass
class PositionedEdge:
    id: str
    from_node: str
    to_node: str
    label: str
    start_x: float = 0.0
    start_y: float = 0.0
    end_x: float = 0.0
    end_y: float = 0.0


@dataclass
class LayoutResult:
    nodes: list[PositionedNode] = field(default_factory=list)
    edges: list[PositionedEdge] = field(default_factory=list)
    canvas_w: float = 0.0
    canvas_h: float = 0.0


# ---------------------------------------------------------------------------
#  Shape sizing
# ---------------------------------------------------------------------------

def _node_size(shape: str, label: str) -> tuple[float, float]:
    """Return (w, h) for a node based on its shape and label."""
    if shape == "frame":
        # Frames are sized by their contents — use a generous default
        return 400, 300
    if shape == "note":
        return NOTE_W, NOTE_H
    if shape == "diamond":
        return DIAMOND_W, DIAMOND_H
    if shape == "ellipse":
        return ELLIPSE_W, ELLIPSE_H
    # box (default) — scale width by label length
    char_w = 9
    label_w = max(len(label) * char_w + 40, NODE_W)
    return min(label_w, 300), NODE_H


# ---------------------------------------------------------------------------
#  Graph analysis helpers
# ---------------------------------------------------------------------------

def _build_adjacency(nodes: list[str], edges: list[DiagramEdge]) -> dict[str, list[str]]:
    """Build adjacency list (children) from edges."""
    adj: dict[str, list[str]] = {n: [] for n in nodes}
    for e in edges:
        if e.from_node in adj:
            adj[e.from_node].append(e.to_node)
    return adj


def _build_in_degree(nodes: list[str], edges: list[DiagramEdge]) -> dict[str, int]:
    """Count incoming edges per node."""
    indeg = {n: 0 for n in nodes}
    for e in edges:
        if e.to_node in indeg:
            indeg[e.to_node] += 1
    return indeg


def _topological_layers(nodes: list[str], edges: list[DiagramEdge]) -> list[list[str]]:
    """Assign nodes to layers using topological sort (Kahn's algorithm).

    Returns a list of layers, where each layer is a list of node IDs.
    Nodes in layer i have no edges from nodes in layer i or later.
    """
    adj = _build_adjacency(nodes, edges)
    indeg = _build_in_degree(nodes, edges)

    layers: list[list[str]] = []
    remaining = set(nodes)

    while remaining:
        # Find all nodes with in-degree 0 among remaining
        layer = [n for n in remaining if indeg[n] == 0]
        if not layer:
            # Cycle detected — put all remaining in one layer
            layer = list(remaining)
        layers.append(sorted(layer))  # sort for deterministic output
        for n in layer:
            remaining.discard(n)
            for child in adj[n]:
                if child in indeg:
                    indeg[child] -= 1

    return layers


# ---------------------------------------------------------------------------
#  Grid layout (simple, always works)
# ---------------------------------------------------------------------------

def _layout_grid(graph: DiagramGraph) -> LayoutResult:
    """Place nodes in a grid: fill rows left-to-right, top-to-bottom."""
    result = LayoutResult()
    if not graph.nodes:
        return result

    cols = max(1, math.ceil(math.sqrt(len(graph.nodes))))
    x = MARGIN
    y = MARGIN
    col = 0

    node_map: dict[str, PositionedNode] = {}

    for node in graph.nodes:
        w, h = _node_size(node.shape, node.label)
        pn = PositionedNode(
            id=node.id, label=node.label, shape=node.shape,
            x=x, y=y, w=w, h=h,
        )
        node_map[node.id] = pn
        result.nodes.append(pn)

        col += 1
        if col >= cols:
            col = 0
            x = MARGIN
            y += max(h, NODE_H) + ROW_GAP_Y
        else:
            x += max(w, NODE_W) + LAYER_GAP_X

    # Compute edge positions
    for edge in graph.edges:
        src = node_map.get(edge.from_node)
        dst = node_map.get(edge.to_node)
        if src and dst:
            pe = PositionedEdge(
                id=edge.id, from_node=edge.from_node, to_node=edge.to_node,
                label=edge.label,
                start_x=src.cx, start_y=src.cy,
                end_x=dst.cx, end_y=dst.cy,
            )
            result.edges.append(pe)

    # Compute canvas size
    if result.nodes:
        result.canvas_w = max(n.x + n.w for n in result.nodes) + MARGIN
        result.canvas_h = max(n.y + n.h for n in result.nodes) + MARGIN

    return result


# ---------------------------------------------------------------------------
#  Layered layout (Sugiyama-style, better for directed graphs)
# ---------------------------------------------------------------------------

def _layout_layered(graph: DiagramGraph) -> LayoutResult:
    """Place nodes in layers based on edge direction (top-to-bottom flow)."""
    result = LayoutResult()
    if not graph.nodes:
        return result

    # Assign nodes to layers
    layers = _topological_layers(
        [n.id for n in graph.nodes],
        graph.edges,
    )

    # Build node lookup
    node_lookup = {n.id: n for n in graph.nodes}

    # Compute layer positions
    node_map: dict[str, PositionedNode] = {}
    layer_y = MARGIN

    for layer in layers:
        # Compute sizes for this layer
        sizes = []
        for nid in layer:
            node = node_lookup[nid]
            w, h = _node_size(node.shape, node.label)
            sizes.append((nid, w, h))

        # Total width of this layer
        total_w = sum(s for _, _, s in sizes) + LAYER_GAP_X * (len(sizes) - 1)
        # Center the layer
        layer_x = MARGIN + max(0, (total_w - total_w) / 2)

        max_h = 0
        for nid, w, h in sizes:
            node = node_lookup[nid]
            pn = PositionedNode(
                id=nid, label=node.label, shape=node.shape,
                x=layer_x, y=layer_y, w=w, h=h,
            )
            node_map[nid] = pn
            result.nodes.append(pn)
            layer_x += w + LAYER_GAP_X
            max_h = max(max_h, h)

        layer_y += max_h + ROW_GAP_Y

    # Compute edge positions
    for edge in graph.edges:
        src = node_map.get(edge.from_node)
        dst = node_map.get(edge.to_node)
        if src and dst:
            pe = PositionedEdge(
                id=edge.id, from_node=edge.from_node, to_node=edge.to_node,
                label=edge.label,
                start_x=src.cx, start_y=src.cy,
                end_x=dst.cx, end_y=dst.cy,
            )
            result.edges.append(pe)

    # Compute canvas size
    if result.nodes:
        result.canvas_w = max(n.x + n.w for n in result.nodes) + MARGIN
        result.canvas_h = max(n.y + n.h for n in result.nodes) + MARGIN

    return result


# ---------------------------------------------------------------------------
#  Public API
# ---------------------------------------------------------------------------

def layout_graph(graph: DiagramGraph) -> LayoutResult:
    """Compute layout for a diagram graph.

    Uses layered layout for directed acyclic graphs, falls back to grid.
    """
    if not graph.nodes:
        return LayoutResult()

    # Check if graph has edges (use layered layout) or is just nodes (use grid)
    if graph.edges and len(graph.edges) >= len(graph.nodes) * 0.3:
        return _layout_layered(graph)
    return _layout_grid(graph)
