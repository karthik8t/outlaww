"""
React Flow Transformer - Converts LLM diagram output to React Flow compatible JSON.
Handles the transformation from UltimateDiagramGraphSchema to xyflow React Flow format.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from app.schema.reactflow_models import (
    UltimateDiagramGraphSchema,
    ReactFlowNode,
    ReactFlowEdge,
    ComponentType,
    EdgeType,
    NodeData,
)


NODE_TYPE_MAPPING: Dict[ComponentType, str] = {
    "c4Actor": "c4Actor",
    "c4System": "c4System",
    "c4Container": "c4Container",
    "c4Component": "c4Component",
    "c4Boundary": "c4Boundary",
    "flowAction": "flowAction",
    "flowDecision": "flowDecision",
    "flowScreen": "flowScreen",
    "flowSwimlane": "flowSwimlane",
    "cloudCompute": "cloudCompute",
    "cloudDatabase": "cloudDatabase",
    "cloudStorage": "cloudStorage",
    "cloudNetwork": "cloudNetwork",
    "cloudMessaging": "cloudMessaging",
    "cloudSecurity": "cloudSecurity",
    "cloudAnalytics": "cloudAnalytics",
    "cloudBoundary": "cloudBoundary",
}

EDGE_TYPE_MAPPING: Dict[EdgeType, str] = {
    "default": "default",
    "straight": "straight",
    "step": "step",
    "smoothstep": "smoothstep",
    "simplebezier": "simplebezier",
}

HANDLE_POSITIONS = {
    "top": {"x": 0.5, "y": 0},
    "right": {"x": 1, "y": 0.5},
    "bottom": {"x": 0.5, "y": 1},
    "left": {"x": 0, "y": 0.5},
    "true": {"x": 1, "y": 0.25},
    "false": {"x": 1, "y": 0.75},
}


def transform_node(node: ReactFlowNode) -> Dict[str, Any]:
    """Transform a ReactFlowNode to React Flow node format."""
    rf_type = NODE_TYPE_MAPPING.get(node.type, "default")

    data = {
        "label": node.data.label,
        "subtitle": node.data.subtitle,
        "languageRuntime": node.data.language_runtime,
        "frameworkLibrary": node.data.framework_library,
        "databaseEngine": node.data.database_engine,
        "cloudServiceName": node.data.cloud_service_name,
        "cloudTier": node.data.cloud_tier,
        "icon": node.data.icon,
        "statusState": node.data.status_state,
        "layoutOrientation": node.data.layout_orientation,
        "tableName": node.data.tableName,
        "columns": node.data.columns,
        "metadataTags": node.data.metadata_tags,
        "reasoning": node.reasoning,
        "purpose": node.purpose,
        "architectureBenefit": node.architecture_benefit,
        "designJustification": node.design_justification,
        "postExtent": node.post_extent,
        "postBorderStyle": node.post_borderStyle,
    }

    rf_node: Dict[str, Any] = {
        "id": node.id,
        "type": rf_type,
        "data": data,
    }

    if node.parentNode:
        rf_node["parentNode"] = node.parentNode
        rf_node["extent"] = "parent"

    return rf_node


def transform_edge(edge: ReactFlowEdge) -> Dict[str, Any]:
    """Transform a ReactFlowEdge to React Flow edge format."""
    rf_type = EDGE_TYPE_MAPPING.get(edge.type, "default")

    source_handle = edge.sourceHandle if edge.sourceHandle else None
    target_handle = edge.targetHandle if edge.targetHandle else None

    rf_edge: Dict[str, Any] = {
        "id": edge.id,
        "source": edge.source,
        "target": edge.target,
        "type": rf_type,
        "label": edge.label,
        "labelStyle": {"fontSize": 12, "fill": "#6b7280"},
        "labelBgStyle": {"fill": "rgba(255,255,255,0.8)", "padding": 2, "borderRadius": 3},
        "animated": edge.post_animated,
        "data": {
            "protocol": edge.protocol,
            "flowDirection": edge.flow_direction,
            "logicVariant": edge.logic_variant,
            "reasoning": edge.reasoning,
            "purpose": edge.purpose,
            "dependencyBenefit": edge.dependency_benefit,
            "couplingJustification": edge.coupling_justification,
        },
    }

    if source_handle:
        rf_edge["sourceHandle"] = source_handle
    if target_handle:
        rf_edge["targetHandle"] = target_handle

    return rf_edge


def transform_diagram(schema: UltimateDiagramGraphSchema) -> Dict[str, Any]:
    """Transform UltimateDiagramGraphSchema to React Flow compatible format."""
    nodes = [transform_node(n) for n in schema.nodes]
    edges = [transform_edge(e) for e in schema.edges]

    return {
        "nodes": nodes,
        "edges": edges,
        "metadata": {
            "layoutDirection": schema.metadata.layout_direction,
        },
    }


def validate_and_transform(schema: UltimateDiagramGraphSchema) -> Dict[str, Any]:
    """Validate references and transform to React Flow format."""
    errors = schema.validate_references()
    if errors:
        raise ValueError(f"Diagram validation failed: {'; '.join(errors)}")
    return transform_diagram(schema)


def extract_reactflow_from_diagram(diagram_data: dict) -> Optional[Dict[str, Any]]:
    """Extract React Flow data from a stored Diagram's graph field.

    The graph field may contain:
    - UltimateDiagramGraphSchema (new) — transformed directly
    - D2Diagram dict (old / fallback) — return None

    Returns { nodes, edges, metadata } or None if extraction fails.
    """
    graph = diagram_data.get("graph") or {}
    if not graph:
        return None

    # Check if it has nodes/edges (React Flow schema)
    if "nodes" in graph and "edges" in graph:
        try:
            schema = UltimateDiagramGraphSchema.model_validate(graph)
            return validate_and_transform(schema)
        except Exception:
            return None

    return None


def create_empty_diagram(layout_direction: str = "TB") -> Dict[str, Any]:
    """Create an empty React Flow diagram structure."""
    return {
        "nodes": [],
        "edges": [],
        "metadata": {"layoutDirection": layout_direction},
    }


def merge_diagrams(base: Dict[str, Any], overlay: Dict[str, Any]) -> Dict[str, Any]:
    """Merge two React Flow diagrams (overlay onto base)."""
    node_map = {n["id"]: n for n in base["nodes"]}
    for n in overlay["nodes"]:
        node_map[n["id"]] = n

    edge_map = {e["id"]: e for e in base["edges"]}
    for e in overlay["edges"]:
        edge_map[e["id"]] = e

    return {
        "nodes": list(node_map.values()),
        "edges": list(edge_map.values()),
        "metadata": overlay.get("metadata") or base.get("metadata", {}),
    }
