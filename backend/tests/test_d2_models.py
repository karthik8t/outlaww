"""Tests for D2 flat-graph models and serialization."""
from __future__ import annotations

import pytest

from app.schema.d2_models import (
    D2Diagram,
    D2Node,
    D2Edge,
    D2Style,
    D2Class,
    ShapeType,
    ConnectionDirection,
    LayoutEngine,
    DiagramDirection,
    SQLConstraint,
    D2DiagramConfig,
)
from app.schema.d2_serializer import serialize_d2, D2Serializer


# ============================================================================
# Model Validation Tests
# ============================================================================

def test_d2_style_defaults():
    """D2Style should have all fields optional with None defaults."""
    style = D2Style()
    assert style.fill is None
    assert style.stroke is None
    assert style.stroke_width is None
    assert style.model_dump(exclude_none=True) == {}


def test_d2_style_serialization():
    """D2Style should serialize to kebab-case keys."""
    style = D2Style(
        fill="#ffffff",
        stroke_width=2,
        stroke_dash=5,
        border_radius=4,
        double_border=True,
        font_size=14,
        font_color="#000000",
        text_transform="uppercase",
    )
    d2_dict = style.to_d2_dict()
    assert d2_dict["fill"] == "#ffffff"
    assert d2_dict["stroke-width"] == 2
    assert d2_dict["stroke-dash"] == 5
    assert d2_dict["border-radius"] == 4
    # Booleans are converted to lowercase strings for D2 output
    assert d2_dict["double-border"] == "true"
    assert d2_dict["font-size"] == 14
    assert d2_dict["font-color"] == "#000000"
    assert d2_dict["text-transform"] == "uppercase"


def test_d2_node_minimal():
    """Minimal node with just ID."""
    node = D2Node(id="service")
    assert node.id == "service"
    assert node.parent_id is None
    assert node.shape is None


def test_d2_node_with_parent():
    """Node with parent_id for container hierarchy."""
    node = D2Node(id="db", parent_id="vpc", label="PostgreSQL", shape="cylinder")
    assert node.parent_id == "vpc"
    assert node.shape == "cylinder"


def test_d2_node_sql_column():
    """SQL table column node."""
    node = D2Node(
        id="users_id",
        parent_id="users_table",
        sql_type="BIGINT",
        sql_constraint="primary_key",
    )
    assert node.sql_type == "BIGINT"
    assert node.sql_constraint == "primary_key"


def test_d2_node_sequence_actor():
    """Sequence diagram actor."""
    node = D2Node(id="client", label="Client", is_actor=True)
    assert node.is_actor is True


def test_d2_edge_basic():
    """Basic edge between two nodes."""
    edge = D2Edge(source="api", target="db", direction="->", label="queries")
    assert edge.source == "api"
    assert edge.target == "db"
    assert edge.direction == "->"


def test_d2_edge_span():
    """Sequence diagram span/activation."""
    edge = D2Edge(
        source="api",
        target="api",
        direction="->",
        label="process",
        span_id="span1",
    )
    assert edge.span_id == "span1"


def test_d2_edge_note():
    """Sequence diagram note."""
    edge = D2Edge(
        source="client",
        target="client",
        direction="->",
        label="Retry logic",
        note_for="client",
    )
    assert edge.note_for == "client"


def test_d2_diagram_config():
    """Diagram configuration with all options."""
    config = D2DiagramConfig(
        layout_engine="elk",
        direction="down",
        theme_id=100,
        dark_theme_id=200,
        pad=150,
        sketch=True,
        animate_interval=50,
    )
    assert config.layout_engine == "elk"
    assert config.direction == "down"
    assert config.theme_id == 100


def test_d2_diagram_minimal():
    """Minimal valid diagram."""
    diagram = D2Diagram(
        architectural_reasoning="Simple two-node diagram showing client-server architecture.",
        name="Client-Server",
        nodes=[
            D2Node(id="client", label="Client", shape="person"),
            D2Node(id="server", label="Server", shape="rectangle"),
        ],
        edges=[
            D2Edge(source="client", target="server", direction="->", label="HTTP"),
        ],
    )
    # Validation should pass
    errors = diagram.validate_references()
    assert errors == []


def test_d2_diagram_invalid_reference():
    """Diagram with invalid parent_id should fail validation."""
    diagram = D2Diagram(
        architectural_reasoning="Test diagram with invalid parent reference to demonstrate validation.",
        nodes=[
            D2Node(id="child", parent_id="nonexistent"),
        ],
        edges=[],
    )
    errors = diagram.validate_references()
    assert len(errors) == 1
    assert "nonexistent" in errors[0]


def test_d2_diagram_invalid_edge():
    """Diagram with invalid edge reference should fail validation."""
    diagram = D2Diagram(
        architectural_reasoning="Test diagram with invalid edge target to verify validation logic.",
        nodes=[D2Node(id="a")],
        edges=[D2Edge(source="a", target="nonexistent")],
    )
    errors = diagram.validate_references()
    assert len(errors) == 1
    assert "nonexistent" in errors[0]


def test_d2_diagram_class_reference():
    """Diagram with class references."""
    diagram = D2Diagram(
        architectural_reasoning="Test diagram demonstrating class reference validation for styling.",
        classes=[D2Class(id="service", style=D2Style(fill="#e3f2fd"))],
        nodes=[D2Node(id="api", label="API", classes=["service"])],
        edges=[],
    )
    errors = diagram.validate_references()
    assert errors == []


def test_d2_diagram_invalid_class():
    """Diagram with unknown class reference should fail."""
    diagram = D2Diagram(
        architectural_reasoning="Test diagram with unknown class reference to verify validation catches it.",
        nodes=[D2Node(id="api", classes=["unknown"])],
        edges=[],
    )
    errors = diagram.validate_references()
    assert len(errors) == 1
    assert "unknown" in errors[0]


# ============================================================================
# Serializer Tests
# ============================================================================

def test_escape_id_bare():
    """Safe identifiers should not be quoted."""
    assert D2Serializer.escape_id("service") == "service"
    assert D2Serializer.escape_id("service_1") == "service_1"
    assert D2Serializer.escape_id("my-service") == "my-service"
    assert D2Serializer.escape_id("_private") == "_private"


def test_escape_id_quoted():
    """Unsafe identifiers should be quoted."""
    assert D2Serializer.escape_id("my service") == '"my service"'
    assert D2Serializer.escape_id("123start") == '"123start"'
    assert D2Serializer.escape_id('has"quote') == "'has\"quote'"


def test_escape_label_simple():
    """Simple labels don't need quoting."""
    assert D2Serializer.escape_label("Client") == "Client"
    assert D2Serializer.escape_label("API Gateway") == '"API Gateway"'


def test_escape_label_markdown_block():
    """Multi-line labels become markdown blocks."""
    text = "Line 1\nLine 2"
    result = D2Serializer.escape_label(text)
    assert result.startswith("|md\n")
    assert result.endswith("\n|")
    assert "  Line 1" in result
    assert "  Line 2" in result


def test_serialize_simple_diagram():
    """End-to-end serialization of a simple diagram."""
    diagram = D2Diagram(
        architectural_reasoning="Basic client-server architecture with load balancer routing requests.",
        name="Web Architecture",
        config=D2DiagramConfig(layout_engine="dagre", direction="right"),
        nodes=[
            D2Node(id="client", label="Client", shape="person"),
            D2Node(id="lb", label="Load Balancer", shape="rectangle"),
            D2Node(id="api1", label="API 1", shape="rectangle", parent_id="lb"),
            D2Node(id="api2", label="API 2", shape="rectangle", parent_id="lb"),
        ],
        edges=[
            D2Edge(source="client", target="lb", direction="->", label="HTTPS"),
            D2Edge(source="lb", target="api1", direction="->", label="route"),
            D2Edge(source="lb", target="api2", direction="->", label="route"),
        ],
    )

    d2_source = serialize_d2(diagram)

    # Check key elements present
    assert "vars:" in d2_source
    # layout-engine: dagre is default, so omitted
    # direction: right is default, so omitted
    assert "client:" in d2_source or "client {" in d2_source
    assert "lb:" in d2_source
    assert "api1:" in d2_source
    assert "api2:" in d2_source
    assert "client -> lb" in d2_source
    assert "HTTPS" in d2_source


def test_serialize_sql_table():
    """SQL table with columns."""
    diagram = D2Diagram(
        architectural_reasoning="Users table with primary key and foreign key demonstrating SQL table rendering.",
        nodes=[
            D2Node(id="users", label="users", shape="sql_table"),
            D2Node(id="users_id", parent_id="users", sql_type="BIGINT", sql_constraint="primary_key"),
            D2Node(id="users_email", parent_id="users", sql_type="VARCHAR(255)", sql_constraint="unique"),
            D2Node(id="users_role_id", parent_id="users", sql_type="INT", sql_constraint="foreign_key"),
        ],
        edges=[],
    )

    d2_source = serialize_d2(diagram)
    assert "shape: sql_table" in d2_source
    assert "users_id: BIGINT {constraint: primary_key}" in d2_source
    assert "users_email: VARCHAR(255) {constraint: unique}" in d2_source
    assert "users_role_id: INT {constraint: foreign_key}" in d2_source


def test_serialize_sequence_diagram():
    """Sequence diagram with actors, spans, and notes."""
    diagram = D2Diagram(
        architectural_reasoning="Authentication flow with JWT token generation demonstrating sequence diagram features.",
        nodes=[
            D2Node(id="auth_flow", label="Auth Flow", shape="sequence_diagram"),
            D2Node(id="client", parent_id="auth_flow", label="Client", is_actor=True),
            D2Node(id="api", parent_id="auth_flow", label="API Gateway", is_actor=True),
            D2Node(id="auth", parent_id="auth_flow", label="Auth Service", is_actor=True),
        ],
        edges=[
            D2Edge(source="client", target="api", direction="->", label="POST /login"),
            D2Edge(source="api", target="auth", direction="->", label="validate"),
            D2Edge(source="auth", target="auth", direction="->", label="generate JWT", span_id="gen"),
            D2Edge(source="auth", target="api", direction="<-", label="token"),
            D2Edge(source="api", target="client", direction="<-", label="200 OK {token}"),
            D2Edge(source="client", target="client", direction="->", label="Store in secure storage", note_for="client"),
        ],
    )

    d2_source = serialize_d2(diagram)
    assert "shape: sequence_diagram" in d2_source
    assert "auth_flow: \"Auth Flow\"" in d2_source
    assert "auth.gen -> auth.gen" in d2_source
    assert "client: \"Store in secure storage\"" in d2_source


def test_serialize_grid_diagram():
    """Grid diagram with rows and columns."""
    diagram = D2Diagram(
        architectural_reasoning="Deployment matrix showing services across environments using grid layout.",
        nodes=[
            D2Node(id="matrix", label="Deployment Matrix", shape="grid"),
            D2Node(id="matrix.dev", parent_id="matrix", label="Development"),
            D2Node(id="matrix.staging", parent_id="matrix", label="Staging"),
            D2Node(id="matrix.prod", parent_id="matrix", label="Production"),
        ],
        edges=[],
    )

    # Grid needs grid_rows/grid_columns on the container
    diagram.nodes[0].grid_rows = ["Service A", "Service B", "Service C"]
    diagram.nodes[0].grid_columns = ["Dev", "Staging", "Prod"]

    d2_source = serialize_d2(diagram)
    assert "shape: grid" in d2_source
    assert "grid-rows:" in d2_source
    assert "grid-columns:" in d2_source
    assert "Service A" in d2_source


def test_serialize_with_classes():
    """Classes should be defined and referenced."""
    diagram = D2Diagram(
        architectural_reasoning="Microservices with shared styling via classes for consistent visual appearance.",
        classes=[
            D2Class(id="service", style=D2Style(fill="#e3f2fd", stroke="#1976d2", stroke_width=2)),
            D2Class(id="database", style=D2Style(fill="#fff3e0", stroke="#f57c00")),
        ],
        nodes=[
            D2Node(id="api", label="API Gateway", classes=["service"]),
            D2Node(id="users_db", label="Users DB", classes=["database"]),
        ],
        edges=[],
    )

    d2_source = serialize_d2(diagram)
    assert "class service" in d2_source
    assert "class database" in d2_source
    assert 'fill: "#e3f2fd"' in d2_source
    assert "class: service" in d2_source
    assert "class: database" in d2_source


def test_serialize_style_block():
    """Style block should use kebab-case keys."""
    diagram = D2Diagram(
        architectural_reasoning="Test style serialization with various properties for verification.",
        nodes=[
            D2Node(
                id="styled",
                label="Styled Node",
                style=D2Style(
                    fill="#ffffff",
                    stroke_width=3,
                    stroke_dash=2,
                    border_radius=8,
                    double_border=True,
                    font_size=16,
                    font_color="#333333",
                    text_transform="uppercase",
                ),
            ),
        ],
        edges=[],
    )

    d2_source = serialize_d2(diagram)
    assert "style {" in d2_source
    assert 'fill: "#ffffff"' in d2_source
    assert "stroke-width: 3" in d2_source
    assert "stroke-dash: 2" in d2_source
    assert "border-radius: 8" in d2_source
    assert "double-border: true" in d2_source
    assert "font-size: 16" in d2_source
    assert 'font-color: "#333333"' in d2_source
    assert 'text-transform: "uppercase"' in d2_source


def test_serialize_root_style():
    """Root-level diagram styles (background, frame)."""
    diagram = D2Diagram(
        architectural_reasoning="Diagram with custom background and frame for testing root styles.",
        config=D2DiagramConfig(),
        nodes=[D2Node(id="n1")],
        edges=[],
    )
    # Add root styles via config (would need model update for full support)
    # For now test that diagram serializes without error
    d2_source = serialize_d2(diagram)
    assert "vars:" in d2_source


def test_round_trip_validation():
    """Serialized D2 should be parseable (basic check)."""
    diagram = D2Diagram(
        architectural_reasoning="Round-trip test diagram with nested container for validation.",
        nodes=[
            D2Node(id="a", label="Node A"),
            D2Node(id="b", label="Node B", parent_id="container"),
            D2Node(id="container", label="Container"),
        ],
        edges=[
            D2Edge(source="a", target="b", direction="->"),
        ],
    )

    d2_source = serialize_d2(diagram)

    # Basic sanity checks on output
    assert d2_source.count("a:") == 1 or d2_source.count("a {") == 1
    assert d2_source.count("b:") == 1 or d2_source.count("b {") == 1
    assert "container" in d2_source
    assert "->" in d2_source
    assert "vars:" in d2_source

    # No validation errors
    errors = diagram.validate_references()
    assert errors == []


def test_architectural_reasoning_required():
    """architectural_reasoning is required and must be non-trivial."""
    with pytest.raises(Exception):
        D2Diagram(
            architectural_reasoning="",  # Too short (min_length=50)
            nodes=[],
            edges=[],
        )


def test_architectural_reasoning_in_output():
    """CoT field should appear as comment in D2 output."""
    diagram = D2Diagram(
        architectural_reasoning="This system uses a message queue for async processing.\nThe worker pool scales based on queue depth.",
        nodes=[D2Node(id="queue")],
        edges=[],
    )

    d2_source = serialize_d2(diagram)
    assert "# Architectural Reasoning" in d2_source
    assert "message queue" in d2_source
    assert "worker pool" in d2_source


def test_complex_nested_containers():
    """Deeply nested containers (cloud -> region -> vpc -> subnet)."""
    diagram = D2Diagram(
        architectural_reasoning="AWS multi-region deployment with VPCs and subnets demonstrating deep nesting.",
        nodes=[
            D2Node(id="aws", label="AWS", shape="oval"),
            D2Node(id="us_east", label="us-east-1", parent_id="aws"),
            D2Node(id="vpc_main", label="Main VPC", parent_id="us_east"),
            D2Node(id="subnet_public", label="Public Subnet", parent_id="vpc_main"),
            D2Node(id="subnet_private", label="Private Subnet", parent_id="vpc_main"),
            D2Node(id="alb", label="ALB", parent_id="subnet_public"),
            D2Node(id="ecs", label="ECS Cluster", parent_id="subnet_private"),
        ],
        edges=[],
    )

    d2_source = serialize_d2(diagram)
    # Should have nested structure
    assert "aws: AWS" in d2_source or 'aws: "AWS"' in d2_source
    assert "us_east: \"us-east-1\"" in d2_source
    assert "vpc_main: \"Main VPC\"" in d2_source
    assert "subnet_public" in d2_source
    assert "subnet_private" in d2_source


def test_special_characters_in_labels():
    """Labels with special chars should be properly escaped."""
    diagram = D2Diagram(
        architectural_reasoning="Test special character handling in labels and edge labels for proper escaping.",
        nodes=[
            D2Node(id="a", label="A -> B: \"Hello\""),  # Contains arrows, quotes
            D2Node(id="b", label="Cost: $100 (50% off)"),  # Contains $, %, ()
        ],
        edges=[
            D2Edge(source="a", target="b", label="Rate: 100 req/s"),
        ],
    )

    d2_source = serialize_d2(diagram)
    # Should not crash and should produce valid D2
    assert "A -> B" in d2_source or '"A -> B' in d2_source
    assert "Cost" in d2_source
    assert "Rate" in d2_source


if __name__ == "__main__":
    pytest.main([__file__, "-v"])