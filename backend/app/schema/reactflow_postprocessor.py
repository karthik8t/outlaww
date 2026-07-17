"""
React Flow Post-Processor - Takes the clean LLM Diagram and produces
enriched ReactFlowDiagramOutput with all post-processed fields:
  - border styles per node type (boundary=dashed, others=solid)
  - extent for parented nodes, expandParent for groups
  - z-index stacking (boundary→swimlane→system→actor)
  - animated flags + marker arrows for edges
  - intelligent edge type selection (smoothstep vs bezier)
  - handle configs computed from edge connections
  - source/target position from layout direction
  - camelCase data for the frontend custom node component
"""
from __future__ import annotations

from typing import Any, Dict, List

from app.schema.reactflow_models import Diagram, DiagramNode, DiagramEdge
from app.schema.reactflow_output import (
    HandleConfig,
    Position,
    ReactFlowNodeOutput,
    ReactFlowEdgeOutput,
    ReactFlowDiagramOutput,
)

# ============================================================================
# Constants
# ============================================================================

BOUNDARY_TYPES = {"c4Boundary", "cloudBoundary"}
SWIMLANE_TYPES = {"flowSwimlane"}
ACTOR_TYPES = {"c4Actor"}
C4_TYPES = {"c4System", "c4Container", "c4Component"}
CLOUD_TYPES = {"cloudCompute", "cloudDatabase", "cloudStorage", "cloudNetwork", "cloudMessaging", "cloudSecurity", "cloudAnalytics", "cloudBoundary"}
FLOW_TYPES = {"flowAction", "flowDecision", "flowScreen"}

# Direction → handle position mapping
LAYOUT_SOURCE: Dict[str, Position] = {"LR": "right", "RL": "left", "TB": "bottom", "BT": "top"}
LAYOUT_TARGET: Dict[str, Position] = {"LR": "left", "RL": "right", "TB": "top", "BT": "bottom"}

HANDLE_POSITIONS: Dict[str, Dict[str, float]] = {
    "top":    {"x": 0.5, "y": 0.0},
    "right":  {"x": 1.0, "y": 0.5},
    "bottom": {"x": 0.5, "y": 1.0},
    "left":   {"x": 0.0, "y": 0.5},
    "true":   {"x": 1.0, "y": 0.25},
    "false":  {"x": 1.0, "y": 0.75},
}

# Category → CSS group class
NODE_GROUP: Dict[str, str] = {
    **{t: "c4" for t in C4_TYPES},
    **{t: "cloud" for t in CLOUD_TYPES},
    **{t: "flow" for t in FLOW_TYPES},
    "c4Actor": "c4",
    "c4Boundary": "c4",
    "flowSwimlane": "flow",
}


def _to_camel(snake: str) -> str:
    """Convert snake_case to camelCase."""
    parts = snake.split("_")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


# ============================================================================
# Node computations
# ============================================================================

def _compute_z_index(node: DiagramNode) -> int:
    if node.type in BOUNDARY_TYPES:
        return 0
    if node.type in SWIMLANE_TYPES:
        return 1
    if node.type in ACTOR_TYPES:
        return 20
    return 10


def _compute_class_name(node: DiagramNode) -> str:
    group = NODE_GROUP.get(node.type, "default")
    short_type = node.type.replace("c4", "c4-").replace("cloud", "cloud-").replace("flow", "flow-")
    return f"rf-group--{group} rf-node--{short_type}"


def _compute_border_style(node: DiagramNode) -> str:
    if node.type in BOUNDARY_TYPES:
        return "dashed"
    return "solid"


def _compute_node_handles(node: DiagramNode, all_edges: List[DiagramEdge]) -> List[HandleConfig]:
    """Build handle configs keyed by the same ID that edges use as sourceHandle/targetHandle.

    Edge sourceHandle/targetHandle values (e.g. "right", "bottom", "true", "false")
    MUST match HandleConfig.id exactly so React Flow can connect them.
    """
    handles: Dict[str, HandleConfig] = {}
    for edge in all_edges:
        if edge.source == node.id:
            pos = edge.sourceHandle or "right"
            h = HandleConfig(
                id=pos,
                type="source",
                position=pos,
                **HANDLE_POSITIONS.get(pos, HANDLE_POSITIONS["right"]),
            )
            handles[pos] = h
        if edge.target == node.id:
            pos = edge.targetHandle or "left"
            h = HandleConfig(
                id=pos,
                type="target",
                position=pos,
                **HANDLE_POSITIONS.get(pos, HANDLE_POSITIONS["left"]),
            )
            handles[pos] = h
    if not handles:
        handles["right"] = HandleConfig(id="right", type="source", position="right", x=1.0, y=0.5)
        handles["left"] = HandleConfig(id="left", type="target", position="left", x=0.0, y=0.5)
    return list(handles.values())


def _build_node_data(node: DiagramNode, border_style: str, handles: List[HandleConfig]) -> Dict[str, Any]:
    nd = node.data
    data: Dict[str, Any] = {
        "id": node.id,
        "label": nd.label,
        "subtitle": nd.subtitle,
        "languageRuntime": nd.language_runtime,
        "frameworkLibrary": nd.framework_library,
        "databaseEngine": nd.database_engine,
        "cloudServiceName": nd.cloud_service_name,
        "cloudTier": nd.cloud_tier,
        "icon": nd.icon,
        "statusState": nd.status_state,
        "layoutOrientation": nd.layout_orientation,
        "tableName": nd.tableName,
        "columns": nd.columns,
        "metadataTags": nd.metadata_tags,
        "reasoning": node.reasoning,
        "purpose": node.purpose,
        "architectureBenefit": node.architecture_benefit,
        "designJustification": node.design_justification,
        "borderStyle": border_style,
        "handles": [h.model_dump(mode="json") for h in handles],
    }
    return data


def _compute_source_position(layout_direction: str) -> Position | None:
    return LAYOUT_SOURCE.get(layout_direction)


def _compute_target_position(layout_direction: str) -> Position | None:
    return LAYOUT_TARGET.get(layout_direction)


# ============================================================================
# Edge computations
# ============================================================================

def _compute_edge_type(edge: DiagramEdge) -> str:
    """Pick the best edge path type based on edge and diagram characteristics."""
    if edge.type == "smoothstep":
        return "smoothstep"
    if edge.type == "step":
        return "step"
    if edge.type == "straight":
        return "straight"
    return "default"


def _compute_edge_style(edge: DiagramEdge) -> Dict[str, Any]:
    style: Dict[str, Any] = {}
    if edge.logic_variant != "standard_flow":
        style["strokeDasharray"] = "5,5"
        style["stroke"] = "#3b82f6"
    else:
        style["stroke"] = "#9ca3af"
    if edge.protocol in ("gRPC", "WebSocket"):
        style["stroke"] = "#8b5cf6"
    return style


def _compute_marker_end(edge: DiagramEdge) -> Dict[str, Any]:
    style = _compute_edge_style(edge)
    return {
        "type": "arrowclosed",
        "width": 16,
        "height": 16,
        "color": style.get("stroke", "#9ca3af"),
    }


def _compute_marker_start(edge: DiagramEdge) -> Dict[str, Any] | None:
    if edge.flow_direction == "reverse":
        style = _compute_edge_style(edge)
        return {
            "type": "arrowclosed",
            "width": 16,
            "height": 16,
            "color": style.get("stroke", "#9ca3af"),
        }
    return None


def _compute_label_style(edge: DiagramEdge) -> Dict[str, Any]:
    return {"fontSize": 11, "fontWeight": 500}


def _compute_label_bg_style(edge: DiagramEdge) -> Dict[str, Any]:
    return {"fill": "#ffffff", "fillOpacity": 0.85}


def _build_edge_data(edge: DiagramEdge) -> Dict[str, Any]:
    return {
        "protocol": edge.protocol,
        "flowDirection": edge.flow_direction,
        "logicVariant": edge.logic_variant,
        "reasoning": edge.reasoning,
        "purpose": edge.purpose,
        "dependencyBenefit": edge.dependency_benefit,
        "couplingJustification": edge.coupling_justification,
    }


# ============================================================================
# Main post-processing entry point
# ============================================================================

def postprocess(diagram: Diagram) -> ReactFlowDiagramOutput:
    """Post-process a clean LLM Diagram into a complete ReactFlowDiagramOutput.

    Computes:
      - z-index stacking (boundaries lowest, actors highest)
      - CSS class names per node group
      - Border styles (dashed for boundaries)
      - Handle positions from edge connections
      - Extent + expandParent for subflows
      - Source/target handle sides from layout direction
      - Arrow markers for edges
      - Edge path types and animation flags
      - Label styling and backgrounds
    """
    layout_dir = diagram.metadata.layout_direction
    all_edges = diagram.edges
    nodes_out: List[ReactFlowNodeOutput] = []
    edges_out: List[ReactFlowEdgeOutput] = []

    source_pos = _compute_source_position(layout_dir)
    target_pos = _compute_target_position(layout_dir)

    for node in diagram.nodes:
        border_style = _compute_border_style(node)
        handles = _compute_node_handles(node, all_edges)
        node_data = _build_node_data(node, border_style, handles)

        has_parent = bool(node.parentNode)
        is_boundary = node.type in BOUNDARY_TYPES

        rf_node = ReactFlowNodeOutput(
            id=node.id,
            type=node.type,
            data=node_data,
            parentId=node.parentNode or None,
            extent="parent" if has_parent else None,
            expandParent=has_parent,
            zIndex=_compute_z_index(node),
            className=_compute_class_name(node),
            ariaLabel=node.data.label,
            draggable=not is_boundary,
            selectable=True,
            deletable=not is_boundary,
            sourcePosition=source_pos,
            targetPosition=target_pos,
            origin=[0.0, 0.0],
        )
        nodes_out.append(rf_node)

    for edge in diagram.edges:
        edge_data = _build_edge_data(edge)
        edge_style = _compute_edge_style(edge)
        is_animated = edge.logic_variant != "standard_flow"
        marker_end = _compute_marker_end(edge)
        marker_start = _compute_marker_start(edge)

        rf_edge = ReactFlowEdgeOutput(
            id=edge.id,
            source=edge.source,
            target=edge.target,
            sourceHandle=edge.sourceHandle or None,
            targetHandle=edge.targetHandle or None,
            type=_compute_edge_type(edge),
            animated=is_animated,
            markerEnd=marker_end,
            markerStart=marker_start,
            label=edge.label,
            labelStyle=_compute_label_style(edge),
            labelShowBg=True,
            labelBgStyle=_compute_label_bg_style(edge),
            labelBgPadding=[4, 4],
            labelBgBorderRadius=4,
            data=edge_data,
            interactionWidth=20,
            style=edge_style if edge_style else None,
            deletable=True,
            selectable=True,
        )
        edges_out.append(rf_edge)

    return ReactFlowDiagramOutput(
        nodes=nodes_out,
        edges=edges_out,
        metadata={
            "layoutDirection": layout_dir,
        },
    )


def postprocess_from_dict(diagram_dict: Dict[str, Any]) -> ReactFlowDiagramOutput:
    """Parse a dict as Diagram and post-process it."""
    schema = Diagram.model_validate(diagram_dict)
    return postprocess(schema)
