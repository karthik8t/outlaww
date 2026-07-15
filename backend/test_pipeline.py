"""Smoke test for the new graph-based diagram pipeline."""
from app.schema.diagram_graph import DiagramGraph, DiagramNode, DiagramEdge
from app.schema.tldraw_records import graph_to_tldraw_records_flat, graph_to_tldraw_records
from app.schema.models import _is_valid_index_key

# Simulate LLM output
graph = DiagramGraph(
    name="Auth Flow",
    description="User authentication flow",
    nodes=[
        DiagramNode(id="n1", label="Start", shape="ellipse"),
        DiagramNode(id="n2", label="Login Form", shape="box"),
        DiagramNode(id="n3", label="Valid?", shape="diamond"),
        DiagramNode(id="n4", label="Dashboard", shape="box"),
        DiagramNode(id="n5", label="Error", shape="note"),
    ],
    edges=[
        DiagramEdge(id="e1", from_node="n1", to_node="n2", label="opens"),
        DiagramEdge(id="e2", from_node="n2", to_node="n3", label="submit"),
        DiagramEdge(id="e3", from_node="n3", to_node="n4", label="yes"),
        DiagramEdge(id="e4", from_node="n3", to_node="n5", label="no"),
    ],
)

# Test full conversion
result = graph_to_tldraw_records(graph)
records = result["records"]

# Verify base records exist
record_ids = [r["id"] for r in records]
assert "document:document" in record_ids, "Missing document record"
assert "page:page" in record_ids, "Missing page record"
assert "camera:page:page" in record_ids, "Missing camera record"

# Verify shapes exist
shape_records = [r for r in records if r.get("typeName") == "shape"]
assert len(shape_records) == 9, f"Expected 9 shapes (5 nodes + 4 edges), got {len(shape_records)}"

# Verify index keys are valid
for shape in shape_records:
    idx = shape.get("index", "")
    assert _is_valid_index_key(idx), f"Invalid index key: {idx}"

print(f"ALL TESTS PASSED: {len(records)} records, canvas {result['canvas_w']}x{result['canvas_h']}")
print(f"Record types: {set(r.get('typeName', r.get('type', '?')) for r in records)}")
print(f"Shapes: {[(r['id'], r['type'], r['props'].get('geo', r['type'])) for r in shape_records]}")
