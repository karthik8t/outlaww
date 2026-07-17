"""
React Flow Transformer - Converts LLM diagram output to React Flow compatible model.
Uses the post-processor to enrich clean LLM Diagram with computed rendering data.
Returns typed ReactFlowDiagramOutput — never raw dicts.
"""
from __future__ import annotations

from typing import Any, Dict, Optional

from app.schema.reactflow_models import Diagram
from app.schema.reactflow_output import ReactFlowDiagramOutput
from app.schema.reactflow_postprocessor import postprocess, postprocess_from_dict


def transform_diagram(schema: Diagram) -> ReactFlowDiagramOutput:
    """Post-process a Diagram and return the typed ReactFlowDiagramOutput."""
    return postprocess(schema)


def validate_and_transform(schema: Diagram) -> ReactFlowDiagramOutput:
    """Validate references and transform to typed ReactFlowDiagramOutput."""
    errors = schema.validate_references()
    if errors:
        raise ValueError(f"Diagram validation failed: {'; '.join(errors)}")
    return transform_diagram(schema)


def extract_reactflow_from_diagram(diagram_data: dict) -> Optional[ReactFlowDiagramOutput]:
    """Extract React Flow typed model from a stored Diagram's graph field.

    The graph field should contain a Diagram dict (clean LLM schema).
    Returns ReactFlowDiagramOutput or None if extraction fails.
    """
    graph = diagram_data.get("graph") or {}
    if not graph:
        return None

    if "nodes" in graph and "edges" in graph:
        try:
            schema = Diagram.model_validate(graph)
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
