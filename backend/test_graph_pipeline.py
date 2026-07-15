"""Test the new graph-based diagram pipeline."""
from app.schema.diagram_graph import DiagramGraph, DiagramNode, DiagramEdge
from app.schema.graph_layout import layout_graph
from app.schema.tldraw_records import graph_to_tldraw_records_flat

# Build a test graph
graph = DiagramGraph(
    name="System Architecture",
    description="A simple client-server diagram",
    nodes=[
        DiagramNode(id="client", label="Client", shape="box"),
        DiagramNode(id="server", label="API Server", shape="box"),
        DiagramNode(id="db", label="Database", shape="ellipse"),
        DiagramNode(id="cache", label="Cache", shape="diamond"),
        DiagramNode(id="note", label="Note: uses Redis", shape="note"),
    ],
    edges=[
        DiagramEdge(id="e1", from_node="client", to_node="server", label="HTTP"),
        DiagramEdge(id="e2", from_node="server", to_node="db", label="SQL"),
        DiagramEdge(id="e3", from_node="server", to_node="cache", label="GET/SET"),
    ],
)

# Test layout
layout = layout_graph(graph)
print("=== Layout ===")
for n in layout.nodes:
    print(f"  {n.id}: ({n.x:.0f}, {n.y:.0f}) {n.w:.0f}x{n.h:.0f}")
for e in layout.edges:
    print(f"  {e.from_node} -> {e.to_node}: ({e.start_x:.0f},{e.start_y:.0f}) -> ({e.end_x:.0f},{e.end_y:.0f})")

# Test record generation
records = graph_to_tldraw_records_flat(graph)
print(f"\n=== Records ({len(records)}) ===")
for r in records:
    tn = r["typeName"]
    rid = r["id"]
    if tn == "shape":
        print(f"  {tn}: {rid} type={r['type']} index={r['index']}")
        # Check required fields based on shape type
        if r["type"] in ("geo", "frame"):
            assert "w" in r["props"], f"Missing 'w' in {rid}"
            assert "h" in r["props"], f"Missing 'h' in {rid}"
    else:
        print(f"  {tn}: {rid}")

# Verify all required records exist
type_names = [r["typeName"] for r in records]
assert "document" in type_names, "Missing document record"
assert "page" in type_names, "Missing page record"
assert "camera" in type_names, "Missing camera record"

# Verify no None values in props
for r in records:
    if r["typeName"] == "shape":
        for k, v in r["props"].items():
            if v is None and k != "textLastEditedBy":
                print(f"  WARNING: {r['id']}.{k} is None")

print("\nAll tests passed!")
