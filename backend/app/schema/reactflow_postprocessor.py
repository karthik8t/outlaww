"""
React Flow Post-Processor - Takes the clean LLM Diagram and produces
enriched ReactFlowDiagramOutput with all post-processed fields:
  - extent for parented nodes, expandParent for groups
  - animated flags + standard arrow markers for edges
  - edge type selection (smoothstep vs bezier)
  - handle configs computed from edge connections
  - source/target position from layout direction
  - camelCase data for the frontend custom node component

NOTE: Style decisions (colors, dashes, z-index) are now the frontend's
responsibility via the NodeTypeConfig registry. The backend only passes
raw data fields so the frontend can make customizable per-type choices.
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

# Direction → handle position mapping
LAYOUT_SOURCE: Dict[str, Position] = {"LR": "right", "RL": "left", "TB": "bottom", "BT": "top"}
LAYOUT_TARGET: Dict[str, Position] = {"LR": "left", "RL": "right", "TB": "top", "BT": "bottom"}

# All group/container node types (visual containers, not leaf components)
GROUP_TYPES = {
    "deploymentGroup", "serviceGroup", "domainGroup", "dataGroup", "networkGroup",
    "c4Boundary", "cloudBoundary", "group",
}

HANDLE_POSITIONS: Dict[str, Dict[str, float]] = {
    "top":    {"x": 0.5, "y": 0.0},
    "right":  {"x": 1.0, "y": 0.5},
    "bottom": {"x": 0.5, "y": 1.0},
    "left":   {"x": 0.0, "y": 0.5},
    "true":   {"x": 1.0, "y": 0.25},
    "false":  {"x": 1.0, "y": 0.75},
}


def _to_camel(snake: str) -> str:
    """Convert snake_case to camelCase."""
    parts = snake.split("_")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


# ============================================================================
# Node computations
# ============================================================================

def _compute_z_index(node: DiagramNode) -> int:
    if node.type in GROUP_TYPES:
        return 0
    if node.type in {"flowSwimlane"}:
        return 1
    if node.type in {"c4Actor"}:
        return 20
    return 10


# Handle position mapping for non-standard positions (decision branches etc.)
NON_STANDARD_POS = {"true": "right", "false": "right"}


def _compute_node_handles(node: DiagramNode, all_edges: List[DiagramEdge]) -> List[HandleConfig]:
    """Build all handle configs (standard + custom) for a node.

    Standard handles use the edge's sourceHandle/targetHandle as the ID
    and position.  Custom handles (e.g. decision branches "true"/"false")
    map to the standard edge they sit on but use absolute x/y for placement.
    """
    handles: Dict[str, HandleConfig] = {}
    for edge in all_edges:
        if edge.source == node.id:
            pos = edge.sourceHandle or "right"
            std_pos = NON_STANDARD_POS.get(pos, pos)
            h = HandleConfig(
                id=pos,
                type="source",
                position=std_pos,
                **HANDLE_POSITIONS.get(pos, HANDLE_POSITIONS["right"]),
            )
            handles[pos] = h
        if edge.target == node.id:
            pos = edge.targetHandle or "left"
            std_pos = NON_STANDARD_POS.get(pos, pos)
            h = HandleConfig(
                id=pos,
                type="target",
                position=std_pos,
                **HANDLE_POSITIONS.get(pos, HANDLE_POSITIONS["left"]),
            )
            handles[pos] = h
    return list(handles.values())


def _build_node_data(node: DiagramNode, handles: List[HandleConfig], layout_direction: str) -> Dict[str, Any]:
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
        "layoutDirection": layout_direction,
        "tableName": nd.tableName,
        "columns": nd.columns,
        "metadataTags": nd.metadata_tags,
        "reasoning": node.reasoning,
        "purpose": node.purpose,
        "architectureBenefit": node.architecture_benefit,
        "designJustification": node.design_justification,
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


def _compute_marker_end() -> Dict[str, Any]:
    return {
        "type": "arrowclosed",
        "width": 16,
        "height": 16,
        "color": "#9ca3af",
    }


def _compute_marker_start(edge: DiagramEdge) -> Dict[str, Any] | None:
    if edge.flow_direction == "reverse":
        return {
            "type": "arrowclosed",
            "width": 16,
            "height": 16,
            "color": "#9ca3af",
        }
    return None


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
        handles = _compute_node_handles(node, all_edges)
        node_data = _build_node_data(node, handles, layout_dir)

        has_parent = bool(node.parentNode)
        is_group = node.type in GROUP_TYPES

        rf_node = ReactFlowNodeOutput(
            id=node.id,
            type=node.type,
            data=node_data,
            parentId=node.parentNode or None,
            extent="parent" if has_parent else None,
            expandParent=has_parent,
            zIndex=_compute_z_index(node),
            ariaLabel=node.data.label,
            draggable=not is_group,
            selectable=True,
            deletable=not is_group,
            sourcePosition=source_pos,
            targetPosition=target_pos,
            origin=[0.0, 0.0],
        )
        nodes_out.append(rf_node)

    for edge in diagram.edges:
        edge_data = _build_edge_data(edge)
        marker_end = _compute_marker_end()
        marker_start = _compute_marker_start(edge)

        rf_edge = ReactFlowEdgeOutput(
            id=edge.id,
            source=edge.source,
            target=edge.target,
            sourceHandle=edge.sourceHandle or None,
            targetHandle=edge.targetHandle or None,
            type=_compute_edge_type(edge),
            animated=True,
            markerEnd=marker_end,
            markerStart=marker_start,
            label=edge.label,
            labelShowBg=True,
            data=edge_data,
            interactionWidth=20,
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
