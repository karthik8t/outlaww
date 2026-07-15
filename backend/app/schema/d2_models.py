"""D2 Flat-Graph Models for LLM Structured Output.

These models are designed for constrained decoding (OpenAI strict, Anthropic tools, Gemini schema).
Key principles:
- Flat structure: NO recursion, max JSON schema depth = 3
- All optional fields explicit with default=None (required for OpenAI strict mode)
- extra="forbid" on all models (required for OpenAI additionalProperties: false)
- Enums as Literal types for FSM compatibility
- CoT field (architectural_reasoning) at root for semantic quality
"""
from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


# ============================================================================
# ENUMS - Strict Literal Types for FSM Compliance
# ============================================================================

ShapeType = Literal[
    "rectangle", "square", "page", "parallelogram", "document",
    "cylinder", "queue", "package", "step", "callout", "stored_data",
    "person", "diamond", "oval", "circle", "hexagon", "cloud",
    "sql_table", "sequence_diagram", "class", "text", "grid",
]

ConnectionDirection = Literal["->", "<-", "<->", "--"]

LayoutEngine = Literal["dagre", "elk", "tala"]

DiagramDirection = Literal["right", "down", "left", "up"]

SQLConstraint = Literal["primary_key", "foreign_key", "unique"]

FillPattern = Literal["dots", "lines", "grain", "none"]

TextTransform = Literal["uppercase", "lowercase", "title", "none"]

FontStyle = Literal["mono"]

ThemeID = int


# ============================================================================
# STYLE MODEL - Flat, No Extra Properties
# ============================================================================

class D2Style(BaseModel):
    """Complete D2 style configuration. All fields optional with explicit None defaults."""
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    # Shape fills
    fill: Optional[str] = None
    fill_pattern: Optional[FillPattern] = Field(None, serialization_alias="fill-pattern")

    # Strokes
    stroke: Optional[str] = None
    stroke_width: Optional[int] = Field(None, serialization_alias="stroke-width", ge=1, le=15)
    stroke_dash: Optional[int] = Field(None, serialization_alias="stroke-dash", ge=0, le=10)

    # Borders
    border_radius: Optional[int] = Field(None, serialization_alias="border-radius", ge=0, le=20)
    double_border: Optional[bool] = Field(None, serialization_alias="double-border")
    shadow: Optional[bool] = None

    # 3D / Multiple
    three_d: Optional[bool] = Field(None, serialization_alias="3d")
    multiple: Optional[bool] = None

    # Typography
    font: Optional[FontStyle] = None
    font_size: Optional[int] = Field(None, serialization_alias="font-size", ge=8, le=100)
    font_color: Optional[str] = Field(None, serialization_alias="font-color")
    bold: Optional[bool] = None
    italic: Optional[bool] = None
    underline: Optional[bool] = None
    text_transform: Optional[TextTransform] = Field(None, serialization_alias="text-transform")

    # Animation
    animated: Optional[bool] = None

    # Root-level styles (diagram background/frame)
    root_fill: Optional[str] = Field(None, serialization_alias="fill")
    root_fill_pattern: Optional[FillPattern] = Field(None, serialization_alias="fill-pattern")
    root_stroke: Optional[str] = Field(None, serialization_alias="stroke")
    root_stroke_width: Optional[int] = Field(None, serialization_alias="stroke-width")
    root_stroke_dash: Optional[int] = Field(None, serialization_alias="stroke-dash")
    root_double_border: Optional[bool] = Field(None, serialization_alias="double-border")

    def to_d2_dict(self) -> dict[str, str | int | bool]:
        """Convert to D2-compatible dict with kebab-case keys, excluding None."""
        data = self.model_dump(exclude_none=True, by_alias=True)
        # Convert bool to lowercase strings for D2
        return {k: (str(v).lower() if isinstance(v, bool) else v) for k, v in data.items()}


# ============================================================================
# CLASS DEFINITION (Reusable Styles)
# ============================================================================

class D2Class(BaseModel):
    """Reusable class definition for applying consistent styles."""
    model_config = ConfigDict(extra="forbid")

    id: str = Field(..., description="Class identifier, e.g. 'service', 'database'")
    label: Optional[str] = None
    style: Optional[D2Style] = None


# ============================================================================
# NODE MODEL - Flat, Relational via parent_id
# ============================================================================

class D2Node(BaseModel):
    """Single node in the diagram. Hierarchy via parent_id reference."""
    model_config = ConfigDict(extra="forbid")

    # Identity
    id: str = Field(..., description="Unique node ID. Alphanumeric + underscore/hyphen only.")
    parent_id: Optional[str] = Field(
        None,
        description="Parent container node ID. None = root level. Creates nesting without recursion."
    )

    # Visual
    label: Optional[str] = Field(None, description="Display label. Supports Markdown. Use |md for blocks.")
    shape: Optional[ShapeType] = Field(None, description="D2 shape type. Defaults to rectangle.")
    style: Optional[D2Style] = None
    classes: Optional[list[str]] = Field(None, description="List of class IDs from diagram.classes")

    # SQL Table columns (only when parent is sql_table)
    sql_type: Optional[str] = Field(
        None,
        description="SQL data type for column nodes. Only valid when parent_id references a sql_table node."
    )
    sql_constraint: Optional[SQLConstraint] = Field(
        None,
        description="SQL constraint: primary_key, foreign_key, unique. Maps to PK, FK, UNQ in D2."
    )

    # Sequence diagram
    is_actor: Optional[bool] = Field(
        None,
        description="Mark as sequence diagram actor/lifeline. Only valid inside sequence_diagram container."
    )

    # Grid diagram
    grid_rows: Optional[list[str]] = Field(None, description="Row labels for grid container")
    grid_columns: Optional[list[str]] = Field(None, description="Column labels for grid container")


# ============================================================================
# EDGE MODEL - Flat Connections
# ============================================================================

class D2Edge(BaseModel):
    """Single connection between two nodes. Chronological order matters for sequence diagrams."""
    model_config = ConfigDict(extra="forbid")

    source: str = Field(..., description="Source node ID (must exist in nodes)")
    target: str = Field(..., description="Target node ID (must exist in nodes)")
    direction: ConnectionDirection = Field(
        default="->",
        description="Arrow direction: '->' | '<-' | '<->' | '--'"
    )
    label: Optional[str] = Field(None, description="Edge label. Supports Markdown.")
    style: Optional[D2Style] = None

    # Sequence diagram specific
    span_id: Optional[str] = Field(
        None,
        description="Activation span ID. Serialized as source.span_id -> target.span_id in D2."
    )
    note_for: Optional[str] = Field(
        None,
        description="Attach note to actor. Serialized as actor: 'note text' in D2 sequence diagram."
    )


# ============================================================================
# RENDER OPTIONS (for API endpoints)
# ============================================================================

class RenderOptions(BaseModel):
    """Options for rendering D2 diagrams via API endpoints."""
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    format: Literal["svg", "png", "pdf", "gif", "pptx"] = "svg"
    theme_id: Optional[int] = Field(None, serialization_alias="theme-id")
    dark_theme_id: Optional[int] = Field(None, serialization_alias="dark-theme-id")
    layout_engine: Optional[LayoutEngine] = Field(None, serialization_alias="layout-engine")
    direction: Optional[DiagramDirection] = None
    pad: int = Field(default=100, ge=0)
    sketch: bool = False
    animate_interval: Optional[int] = Field(None, serialization_alias="animate-interval", ge=0)
    scale: float = Field(default=1.0, gt=0)


# ============================================================================
# ROOT DIAGRAM MODEL - With CoT Field
# ============================================================================

class D2DiagramConfig(BaseModel):
    """Diagram-level configuration (maps to vars.d2-config)."""
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    layout_engine: LayoutEngine = Field(default="dagre", serialization_alias="layout-engine")
    direction: DiagramDirection = Field(default="right")
    theme_id: Optional[ThemeID] = Field(None, serialization_alias="theme-id")
    dark_theme_id: Optional[ThemeID] = Field(None, serialization_alias="dark-theme-id")
    pad: int = Field(default=100, ge=0)
    sketch: bool = Field(default=False)
    animate_interval: Optional[int] = Field(None, serialization_alias="animate-interval", ge=0)


class D2Diagram(BaseModel):
    """
    Complete D2 diagram. Flat arrays of nodes and edges.
    LLM MUST populate architectural_reasoning FIRST (CoT) before nodes/edges.
    """
    model_config = ConfigDict(extra="forbid")

    # Chain-of-Thought: Unconstrained reasoning space before FSM-constrained arrays
    architectural_reasoning: str = Field(
        ...,
        min_length=50,
        description="REQUIRED: Explain the architecture, component relationships, and design decisions "
                    "before declaring nodes and edges. This space is NOT constrained by the JSON schema FSM."
    )

    # Metadata
    name: str = Field(default="Diagram", description="Diagram title")
    description: str = Field(default="", description="Brief description of what the diagram shows")

    # Configuration
    config: D2DiagramConfig = Field(default_factory=D2DiagramConfig)

    # Reusable styles
    classes: list[D2Class] = Field(default_factory=list)

    # Flat topology
    nodes: list[D2Node] = Field(default_factory=list)
    edges: list[D2Edge] = Field(default_factory=list)

    # Validation
    def get_node_ids(self) -> set[str]:
        return {n.id for n in self.nodes}

    def get_class_ids(self) -> set[str]:
        return {c.id for c in self.classes}

    def validate_references(self) -> list[str]:
        """Check all references are valid. Returns list of errors (empty if valid)."""
        errors = []
        node_ids = self.get_node_ids()
        class_ids = self.get_class_ids()

        # Node parent_id references
        for node in self.nodes:
            if node.parent_id and node.parent_id not in node_ids:
                errors.append(f"Node '{node.id}': parent_id '{node.parent_id}' does not exist")
            for cls in node.classes or []:
                if cls not in class_ids:
                    errors.append(f"Node '{node.id}': references unknown class '{cls}'")

        # Edge references
        for edge in self.edges:
            if edge.source not in node_ids:
                errors.append(f"Edge: source '{edge.source}' does not exist")
            if edge.target not in node_ids:
                errors.append(f"Edge: target '{edge.target}' does not exist")
            # span_id is a sequence diagram activation suffix (e.g., 'auth.gen'), not a node ID
            # note_for must reference an existing node (actor)
            if edge.note_for and edge.note_for not in node_ids:
                errors.append(f"Edge: note_for '{edge.note_for}' does not exist")

        return errors