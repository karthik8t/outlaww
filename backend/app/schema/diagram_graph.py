"""Simple graph models for LLM output.

The LLM generates ONLY topology — nodes and edges. No coordinates, no props.
The Python backend computes all layout deterministically.
"""
from __future__ import annotations

from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field


def _short_id() -> str:
    return uuid4().hex[:12]


class DiagramNode(BaseModel):
    """A single node in the diagram graph.

    The LLM provides only a label and shape type.
    All positioning and styling is computed by the layout engine.
    """
    id: str = Field(default_factory=_short_id, description="Unique node ID, e.g. 'node1'")
    label: str = Field(description="Text label for the node")
    shape: Literal["box", "ellipse", "diamond", "note", "frame"] = Field(
        default="box",
        description="Visual shape: box (rectangle), ellipse (circle), diamond (decision), note (sticky), frame (group)",
    )


class DiagramEdge(BaseModel):
    """A directed edge connecting two nodes.

    The LLM provides only the source/target IDs and an optional label.
    Arrow routing is computed by the layout engine.
    """
    id: str = Field(default_factory=_short_id, description="Unique edge ID")
    from_node: str = Field(description="ID of the source node")
    to_node: str = Field(description="ID of the target node")
    label: str = Field(default="", description="Optional label on the arrow")


class DiagramGraph(BaseModel):
    """The complete diagram graph — output schema for LLM agents.

    This is what the LLM generates. The backend converts it to tldraw records.
    """
    name: str = Field(default="Diagram", description="Title of the diagram")
    description: str = Field(default="", description="Brief explanation of what the diagram shows")
    nodes: list[DiagramNode] = Field(default_factory=list, description="All nodes in the diagram")
    edges: list[DiagramEdge] = Field(default_factory=list, description="All connections between nodes")
