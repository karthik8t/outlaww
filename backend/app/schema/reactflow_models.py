"""
React Flow Diagram Models - Pure LLM-generated architecture schema.
These are the CLEAN models that the LLM generates — NO post-processed fields.
Post-processed fields live in reactflow_output.py.
"""
from __future__ import annotations

from typing import List, Literal, Optional
from pydantic import BaseModel, Field, ConfigDict


# ============================================================================
# 1. COMPONENT TYPES - C4, Flow, Cloud Infrastructure, Groups
# ============================================================================

StandardComponentType = Literal[
    "c4Actor", "c4System", "c4Container", "c4Component", "c4Boundary",
    "flowAction", "flowDecision", "flowScreen", "flowSwimlane"
]

CloudComponentType = Literal[
    "cloudCompute", "cloudDatabase", "cloudStorage", "cloudNetwork",
    "cloudMessaging", "cloudSecurity", "cloudAnalytics", "cloudBoundary"
]

# ── Dedicated grouping/container types ───────────────────────────────────────
# These are VISUAL CONTAINERS only — they have NO tech-stack fields.
# Use them to wrap related leaf nodes and give the diagram hierarchical structure.
# They must be declared BEFORE their children in the nodes array.
#
#  deploymentGroup — Top-level zone: cloud provider (AWS/GCP/Azure), browser,
#                    mobile, or on-prem. One per environment.
#  serviceGroup    — A cluster of 2-6 co-deployed microservices or containers.
#                    Use when services share a subnet, autoscaling group, or
#                    Kubernetes namespace.
#  domainGroup     — Bounded context or team-ownership area (DDD / org boundary).
#                    Cuts across deployment zones.
#  dataGroup       — Data tier: wraps databases, caches, queues, and object
#                    storage that belong to the same data domain.
#  networkGroup    — Network segment: VPC, subnet, DMZ, CDN edge, or firewall
#                    zone. Annotates infrastructure-level topology.
GroupComponentType = Literal[
    "deploymentGroup",
    "serviceGroup",
    "domainGroup",
    "dataGroup",
    "networkGroup",
]

ComponentType = Literal[StandardComponentType, CloudComponentType, GroupComponentType, "group"]


# ============================================================================
# 2. EDGE TYPES - React Flow Native
# ============================================================================

EdgeType = Literal["default", "straight", "step", "smoothstep", "simplebezier"]


# ============================================================================
# 3. VISUAL TOKENS - Hallucination-proof strict enums
# ============================================================================

IconLiteral = Literal[
    "user", "browser", "mobile", "server", "database", "queue",
    "microservice", "router", "load-balancer", "shield", "gear",
    "cloud", "file", "terminal", "none"
]

LogicVariantLiteral = Literal["conditional_true", "conditional_false", "standard_flow"]

StatusStateLiteral = Literal["normal", "warning", "error", "proposed"]

CloudTierLiteral = Literal["serverless", "managed", "vm", "container", "none"]

LayoutOrientationLiteral = Literal["vertical", "horizontal", "none"]


# ============================================================================
# 4. NODE DATA - Software Stack + Cloud Blueprint + Structural UI
# ============================================================================

class NodeData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Core Identity
    label: str = Field(description="Primary node label (e.g., 'Payment Workers API').")
    subtitle: str = Field(description="Secondary descriptive line. Use empty string if not needed.", default="")

    # Software Stack Blueprint
    language_runtime: str = Field(description="Core language/execution environment (e.g., 'Go 1.26', 'Node.js v24'). 'none' if N/A.", default="none")
    framework_library: str = Field(description="Primary app framework (e.g., 'Gin', 'FastAPI'). 'none' if N/A.", default="none")
    database_engine: str = Field(description="Underlying engine if this is a storage node (e.g., 'Redis', 'DynamoDB'). 'none' if N/A.", default="none")

    # Cloud Blueprint Specs
    cloud_service_name: str = Field(description="Commercial name of cloud resource (e.g., 'AWS ECS', 'GCP Pub/Sub'). 'none' if N/A.", default="none")
    cloud_tier: CloudTierLiteral = Field(description="Compute/Deployment architectural tier.", default="none")

    # Structural UI Enforcements
    icon: IconLiteral = Field(description="Strict icon string token.", default="none")
    status_state: StatusStateLiteral = Field(description="Highlights visual urgency/lifecycle flags.", default="normal")
    layout_orientation: LayoutOrientationLiteral = Field(description="Dictates axis layout for flowSwimlane components.", default="none")

    # Enforced Empty Fields (Deterministic schema)
    tableName: str = Field(description="Database table reference string. Enforced empty for non-db nodes.", default="")
    columns: List[str] = Field(description="List of columns or metadata keys. Empty array if not applicable.", default_factory=list)
    metadata_tags: List[str] = Field(description="Up to 3 design tags (e.g., ['Encrypted', 'Multi-AZ']). Empty array if none.", default_factory=list)


# ============================================================================
# 5. DIAGRAM NODE - Pure LLM topology (NO post-processed fields)
# ============================================================================

class DiagramNode(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(description="Unique node identifier (e.g., 'payment-api', 'user-db').")
    type: ComponentType = Field(description="Component classification.")
    data: NodeData = Field(description="Visual and technical specification.")

    # Deep Token Reasoning (Architecture Chain of Thought)
    reasoning: str = Field(min_length=20, description="Why this component is structurally necessary.")
    purpose: str = Field(min_length=20, description="The specific operational responsibility of this node.")
    architecture_benefit: str = Field(min_length=20, description="How adding this node improves the broader system design.")
    design_justification: str = Field(min_length=20, description="Justification for choosing this specific node type and boundary hierarchy.")

    # Hierarchy Link
    parentNode: Optional[str] = Field(default=None, description="Parent node ID for nested boundaries.")


# ============================================================================
# 6. DIAGRAM EDGE - Pure LLM connection (NO post-processed fields)
# ============================================================================

class DiagramEdge(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(description="Unique edge identifier.")
    source: str = Field(description="Source node ID.")
    target: str = Field(description="Target node ID.")
    type: EdgeType = Field(default="default", description="React Flow edge renderer type.")
    label: str = Field(description="Edge label (protocol, action, etc.).", default="")

    # Network Layer Metrics
    protocol: str = Field(description="Communication system/medium (e.g., 'HTTPS', 'gRPC', 'AMQP'). 'none' if N/A.", default="none")
    flow_direction: Literal["forward", "reverse", "bidirectional", "none"] = Field(description="Dictates arrowhead placement at path terminals.", default="forward")
    logic_variant: LogicVariantLiteral = Field(description="Tells frontend code if this handles branching logic routing paths.", default="standard_flow")

    # Handle Targets (Returned to the LLM to map structural branched flow handles)
    sourceHandle: str = Field(description="The handle ID origin vector (e.g., 'right', 'bottom', 'true', 'false').", default="right")
    targetHandle: str = Field(description="The target handle arrival vector (e.g., 'top', 'left').", default="left")

    # Network Layer Token Reasoning
    reasoning: str = Field(min_length=20, description="Why this specific communication path or dependency must exist.")
    purpose: str = Field(min_length=20, description="The operational interaction happening across this connection.")
    dependency_benefit: str = Field(min_length=20, description="How this connection benefits data flow or system integration.")
    coupling_justification: str = Field(min_length=20, description="Why these two components need to be coupled through this edge.")


# ============================================================================
# 7. METADATA
# ============================================================================

class DiagramMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid")

    layout_direction: Literal["TB", "LR", "BT", "RL"] = Field(
        default="LR",
        description="Directly drives the ELK Engine mathematical axis. Use TB for logical flows, LR for structural cloud/C4."
    )


# ============================================================================
# 8. ROOT DIAGRAM SCHEMA (LLM-generated, clean — no post_ fields)
# ============================================================================

class Diagram(BaseModel):
    model_config = ConfigDict(extra="forbid")

    metadata: DiagramMetadata
    nodes: List[DiagramNode]
    edges: List[DiagramEdge]

    def validate_references(self) -> List[str]:
        """Validate that all edge references point to existing nodes.

        Returns a list of error messages (empty if valid).
        """
        errors: List[str] = []
        node_ids = {n.id for n in self.nodes}
        for edge in self.edges:
            if edge.source not in node_ids:
                errors.append(f"Edge '{edge.id}' references unknown source node '{edge.source}'.")
            if edge.target not in node_ids:
                errors.append(f"Edge '{edge.id}' references unknown target node '{edge.target}'.")
        for node in self.nodes:
            if node.parentNode and node.parentNode not in node_ids:
                errors.append(f"Node '{node.id}' references unknown parent node '{node.parentNode}'.")
        return errors
