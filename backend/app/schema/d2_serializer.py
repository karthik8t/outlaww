"""D2 Serializer: Converts flat D2Diagram model to valid D2 source code.

Handles:
- Tree reconstruction from flat nodes (parent_id references)
- ID/label escaping per D2 syntax rules
- Markdown block formatting (|md ... |)
- Style blocks with kebab-case keys
- Special shapes: sql_table, sequence_diagram, class, grid
- Configuration vars block
"""
from __future__ import annotations

import re
from collections import defaultdict
from typing import Optional

from app.schema.d2_models import (
    D2Diagram,
    D2Node,
    D2Edge,
    D2Class,
    D2Style,
    ShapeType,
    ConnectionDirection,
)


class D2Serializer:
    """Serializes D2Diagram to D2 source code."""

    # D2 unquoted ID pattern: letter/underscore followed by alphanumeric/underscore/hyphen
    _ID_PATTERN = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_-]*$")
    # Characters that require quoting in labels
    _LABEL_QUOTE_PATTERN = re.compile(r'[\s:;.{}\[\]\-><"\'|]')

    def __init__(self, diagram: D2Diagram):
        self.diagram = diagram
        self._node_lookup: dict[str, D2Node] = {n.id: n for n in diagram.nodes}
        self._tree: dict[Optional[str], list[D2Node]] = self._build_tree()

    # -------------------------------------------------------------------------
    # Tree Reconstruction
    # -------------------------------------------------------------------------

    def _build_tree(self) -> dict[Optional[str], list[D2Node]]:
        """Build parent->children adjacency from flat nodes."""
        tree: dict[Optional[str], list[D2Node]] = defaultdict(list)
        for node in self.diagram.nodes:
            tree[node.id] = []  # Ensure entry exists
        for node in self.diagram.nodes:
            parent = node.parent_id if node.parent_id in self._node_lookup else None
            tree[parent].append(node)
        # Sort children for deterministic output (by id)
        for children in tree.values():
            children.sort(key=lambda n: n.id)
        return dict(tree)

    # -------------------------------------------------------------------------
    # Escaping / Quoting
    # -------------------------------------------------------------------------

    @classmethod
    def escape_id(cls, text: str) -> str:
        """Escape an identifier for D2. Quote if not valid unquoted ID."""
        if not text:
            return '""'
        if cls._ID_PATTERN.match(text):
            return text
        if '"' in text:
            return f"'{text}'"
        return f'"{text}"'

    @classmethod
    def escape_label(cls, text: str) -> str:
        """Escape a label for D2. Handles multi-line markdown blocks."""
        if not text:
            return '""'
        # Multi-line -> markdown block
        if "\n" in text:
            lines = text.split("\n")
            indented = "\n".join(f"  {line}" for line in lines)
            return f"|md\n{indented}\n|"
        # Single line: quote if needed
        if cls._LABEL_QUOTE_PATTERN.search(text) or text[0].isdigit():
            if '"' in text:
                return f"'{text}'"
            return f'"{text}"'
        return text

    # -------------------------------------------------------------------------
    # Style Serialization
    # -------------------------------------------------------------------------

    @classmethod
    def _serialize_style(cls, style: Optional[D2Style], indent: int) -> Optional[str]:
        if not style:
            return None
        style_dict = style.model_dump(exclude_none=True, by_alias=True)
        # Filter out empty strings and other falsy values that aren't valid D2 values
        style_dict = {k: v for k, v in style_dict.items() if v not in (None, "", [], {})}
        if not style_dict:
            return None

        ind = "  " * indent
        lines = []
        for key, value in style_dict.items():
            if isinstance(value, bool):
                val_str = "true" if value else "false"
            elif isinstance(value, str):
                # Quote string values (especially colors and keywords)
                val_str = f'"{value}"'
            elif isinstance(value, (int, float)):
                val_str = str(value)
            else:
                val_str = str(value)
            lines.append(f"{ind}{key}: {val_str}")

        if not lines:
            return None

        block_indent = "  " * (indent - 1)
        return f"{block_indent}style {{\n" + "\n".join(lines) + f"\n{block_indent}}}"

    # -------------------------------------------------------------------------
    # Node Serialization
    # -------------------------------------------------------------------------

    def _serialize_node(self, node: D2Node, indent: int = 0) -> list[str]:
        """Serialize a node and its children. Returns list of lines."""
        ind = "  " * indent
        node_id = self.escape_id(node.id)
        children = self._tree.get(node.id, [])

        # Special handling for SQL table columns
        if node.sql_type:
            constraint = f" {{constraint: {node.sql_constraint}}}" if node.sql_constraint else ""
            label_part = f": {self.escape_label(node.label)}" if node.label and node.label != node.id else ""
            return [f"{ind}{node_id}{label_part}: {node.sql_type}{constraint}"]

        # Special handling for grid
        if node.shape == "grid" and (node.grid_rows or node.grid_columns):
            return self._serialize_grid(node, indent)

        # Build header
        header = f"{ind}{node_id}"
        if node.label and node.label != node.id:
            header += f": {self.escape_label(node.label)}"

        # Determine if we need a body block
        has_body = bool(
            node.shape
            or node.style
            or node.classes
            or children
        )

        if not has_body:
            return [header]

        lines = [f"{header} {{"]
        inner_ind = "  " * (indent + 1)

        if node.shape:
            lines.append(f"{inner_ind}shape: {node.shape}")

        if node.classes:
            # Fix: class assignment without brackets
            classes_str = "; ".join(self.escape_id(c) for c in node.classes)
            lines.append(f"{inner_ind}class: {classes_str}")

        style_str = self._serialize_style(node.style, indent + 2)
        if style_str:
            lines.append(style_str)

        # Serialize children
        for child in children:
            lines.extend(self._serialize_node(child, indent + 1))

        lines.append(f"{ind}}}")
        return lines

    def _serialize_grid(self, node: D2Node, indent: int) -> list[str]:
        """Serialize grid diagram container."""
        ind = "  " * indent
        inner_ind = "  " * (indent + 1)
        node_id = self.escape_id(node.id)

        lines = [f"{ind}{node_id} {{"]
        if node.label:
            lines.append(f"{inner_ind}label: {self.escape_label(node.label)}")
        lines.append(f"{inner_ind}shape: grid")

        if node.grid_rows:
            rows_str = ", ".join(self.escape_label(r) for r in node.grid_rows)
            lines.append(f"{inner_ind}grid-rows: [{rows_str}]")
        if node.grid_columns:
            cols_str = ", ".join(self.escape_label(c) for c in node.grid_columns)
            lines.append(f"{inner_ind}grid-columns: [{cols_str}]")

        style_str = self._serialize_style(node.style, indent + 2)
        if style_str:
            lines.append(style_str)

        # Grid children (cells)
        for child in self._tree.get(node.id, []):
            lines.extend(self._serialize_node(child, indent + 1))

        lines.append(f"{ind}}}")
        return lines

    # -------------------------------------------------------------------------
    # Edge Serialization
    # -------------------------------------------------------------------------

    def _serialize_edge(self, edge: D2Edge) -> str:
        """Serialize a single edge."""
        src = self.escape_id(edge.source)
        tgt = self.escape_id(edge.target)

        # Sequence diagram: span activation
        if edge.span_id:
            span = self.escape_id(edge.span_id)
            src = f"{src}.{span}"
            tgt = f"{tgt}.{span}"

        # Sequence diagram: note
        if edge.note_for:
            actor = self.escape_id(edge.note_for)
            note_text = self.escape_label(edge.label or "")
            return f"{actor}: {note_text}"

        # Standard edge - fix reverse arrow direction
        direction = edge.direction
        if direction == "<-":
            # Reverse arrow: swap source and target, use ->
            src, tgt = tgt, src
            direction = "->"
        elif direction == "<->":
            pass  # Bidirectional - keep as is
        elif direction == "--":
            pass  # Undirected

        # Standard edge
        parts = [f"{src} {direction} {tgt}"]
        if edge.label:
            parts.append(f": {self.escape_label(edge.label)}")

        style_str = self._serialize_style(edge.style, 1)
        if style_str:
            parts.append(" {")
            parts.append(style_str)
            parts.append("}")

        return " ".join(parts)

    # -------------------------------------------------------------------------
    # Class Serialization
    # -------------------------------------------------------------------------

    def _serialize_class(self, cls: D2Class) -> list[str]:
        """Serialize a class definition."""
        ind = "  "
        safe_id = self.escape_id(cls.id)
        lines = [f"class {safe_id} {{"]
        if cls.label:
            lines.append(f"{ind}label: {self.escape_label(cls.label)}")
        style_str = self._serialize_style(cls.style, 2)
        if style_str:
            # Fix: style { not style: {
            lines.append(style_str.replace("style: {", "style {"))
        lines.append("}")
        return lines

    # -------------------------------------------------------------------------
    # Config Serialization
    # -------------------------------------------------------------------------

    def _serialize_config(self) -> list[str]:
        """Serialize vars.d2-config block."""
        cfg = self.diagram.config
        lines = ["vars: {", "  d2-config: {"]
        inner = "    "

        # Only include non-default values
        if cfg.layout_engine != "dagre":
            lines.append(f"{inner}layout-engine: {cfg.layout_engine}")
        if cfg.direction != "right":
            lines.append(f"{inner}direction: {cfg.direction}")
        if cfg.theme_id is not None and cfg.theme_id != 0:
            lines.append(f"{inner}theme-id: {cfg.theme_id}")
        if cfg.dark_theme_id is not None and cfg.dark_theme_id != 0:
            lines.append(f"{inner}dark-theme-id: {cfg.dark_theme_id}")
        if cfg.pad != 100:
            lines.append(f"{inner}pad: {cfg.pad}")
        if cfg.sketch:
            lines.append(f"{inner}sketch: true")
        if cfg.animate_interval is not None and cfg.animate_interval != 0:
            lines.append(f"{inner}animate-interval: {cfg.animate_interval}")

        lines.append("  }")
        lines.append("}")
        return lines

    # -------------------------------------------------------------------------
    # Main Entry Point
    # -------------------------------------------------------------------------

    def to_d2(self) -> str:
        """Generate complete D2 source code."""
        # Validate references before serializing
        errors = self.diagram.validate_references()
        if errors:
            raise ValueError(f"Diagram validation failed: {'; '.join(errors)}")

        sections: list[str] = []

        # 1. Architectural reasoning (as comment)
        if self.diagram.architectural_reasoning:
            reasoning_lines = self.diagram.architectural_reasoning.strip().split("\n")
            sections.append("# Architectural Reasoning")
            for line in reasoning_lines:
                sections.append(f"# {line}")
            sections.append("")

        # 2. Config
        sections.extend(self._serialize_config())
        sections.append("")

        # 3. Classes
        if self.diagram.classes:
            for cls in self.diagram.classes:
                sections.extend(self._serialize_class(cls))
            sections.append("")

        # 4. Page declaration - only add if no page nodes exist
        page_nodes = [n for n in self.diagram.nodes if n.shape == "page"]
        if not page_nodes:
            sections.append("# Page declaration (required by D2)")
            sections.append("page: page1 {")
            sections.append("  layout: auto")
            sections.append("}")
            sections.append("")

        # 4. Root nodes (tree traversal)
        for root_node in self._tree.get(None, []):
            sections.extend(self._serialize_node(root_node))

        # 5. Edges
        if self.diagram.edges:
            sections.append("\n# Connections")
            for edge in self.diagram.edges:
                sections.append(self._serialize_edge(edge))

        # Join and clean up trailing whitespace
        return "\n".join(line.rstrip() for line in sections if line is not None)


# -------------------------------------------------------------------------
# Convenience Function
# -------------------------------------------------------------------------


def serialize_d2(diagram: D2Diagram) -> str:
    """Serialize a D2Diagram to D2 source code."""
    return D2Serializer(diagram).to_d2()