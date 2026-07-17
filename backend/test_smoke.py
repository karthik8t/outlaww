"""Smoke test: verify new post-processor behavior."""
from app.schema.reactflow_models import (
    Diagram, DiagramNode, DiagramEdge, DiagramMetadata, NodeData,
)
from app.schema.reactflow_postprocessor import postprocess

diagram = Diagram(
    metadata=DiagramMetadata(layout_direction='LR'),
    nodes=[
        DiagramNode(id='user', type='c4Actor',
                    data=NodeData(label='User', subtitle='End user'),
                    reasoning='user interaction with system via web browser',
                    purpose='user initiates http requests from browser',
                    architecture_benefit='separates frontend concerns from backend logic',
                    design_justification='standard actor pattern with decoupled frontend'),
        DiagramNode(id='api', type='c4System',
                    data=NodeData(label='API Gateway'),
                    reasoning='api gateway for routing backend service requests',
                    purpose='routes incoming requests to appropriate services',
                    architecture_benefit='centralized routing reduces service coupling',
                    design_justification='api gateway pattern for microservices architecture'),
        DiagramNode(id='decision', type='flowDecision',
                    data=NodeData(label='Validate'),
                    reasoning='decision point for input validation before processing',
                    purpose='validates request payload before passing downstream',
                    architecture_benefit='early error detection reduces downstream failures',
                    design_justification='decision node pattern for validation logic'),
    ],
    edges=[
        DiagramEdge(id='e1', source='user', target='api',
                    sourceHandle='right', targetHandle='left',
                    label='HTTPS',
                    reasoning='user communicates with api over encrypted https',
                    purpose='user sends authenticated http request to api',
                    dependency_benefit='enables secure communication between layers',
                    coupling_justification='api designed for direct user access'),
        DiagramEdge(id='e2', source='api', target='decision',
                    sourceHandle='right', targetHandle='top',
                    label='validate',
                    reasoning='api passes incoming request to validation module',
                    purpose='validate request payload structure and content',
                    dependency_benefit='catches malformed requests before processing',
                    coupling_justification='validation before any business logic'),
        DiagramEdge(id='e3', source='decision', target='api',
                    sourceHandle='true', targetHandle='top',
                    label='valid',
                    reasoning='validated request continues to next processing stage',
                    purpose='continue processing pipeline with validated data',
                    dependency_benefit='reduces error handling complexity downstream',
                    coupling_justification='decision routing based on validation result'),
        DiagramEdge(id='e4', source='decision', target='user',
                    sourceHandle='false', targetHandle='top',
                    label='invalid',
                    reasoning='invalid request is returned to user with error details',
                    purpose='notify user of validation failure with message',
                    dependency_benefit='provides immediate user feedback on errors',
                    coupling_justification='error response routing back to caller'),
    ],
)

output = postprocess(diagram)

print("=== Node data.handles ===")
for node in output.nodes:
    nid = node.id
    hids = [(h['id'], h['type'], h['position']) for h in node.data.get('handles', [])]
    print(f"  {nid} ({node.type}): {hids}")

print("\n=== Edge animated (all should be True) ===")
for edge in output.edges:
    animated = edge.animated
    status = "OK" if animated else "FAIL"
    print(f"  {edge.id}: animated={animated} [{status}]")

print("\n=== Layout direction in node data ===")
for node in output.nodes[:1]:
    ld = node.data.get('layoutDirection')
    print(f"  layoutDirection = {ld!r}")

print("\n=== Verifications ===")
errors = []

# No style-related fields in backend output
for node in output.nodes:
    if 'borderStyle' in node.data:
        errors.append(f"  FAIL: {node.id} should not have borderStyle in data")
    if node.className is not None:
        errors.append(f"  FAIL: {node.id} should not have className set")

for edge in output.edges:
    if edge.style is not None:
        errors.append(f"  FAIL: {edge.id} should not have style set")
    if edge.labelStyle is not None:
        errors.append(f"  FAIL: {edge.id} should not have labelStyle set")
    if edge.labelBgStyle is not None:
        errors.append(f"  FAIL: {edge.id} should not have labelBgStyle set")

# Decision node should have 'true' and 'false' handles
dec = [n for n in output.nodes if n.id == 'decision'][0]
dec_hids = [h['id'] for h in dec.data.get('handles', [])]
if 'true' not in dec_hids:
    errors.append(f"  FAIL: decision node missing 'true' handle")
if 'false' not in dec_hids:
    errors.append(f"  FAIL: decision node missing 'false' handle")
if 'right' in dec_hids:
    errors.append(f"  FAIL: decision node should NOT have 'right' handle")
    errors.append(f"    handles: {dec_hids}")
if 'left' in dec_hids:
    errors.append(f"  FAIL: decision node should NOT have 'left' handle")
    errors.append(f"    handles: {dec_hids}")

# All edges animated
for edge in output.edges:
    if not edge.animated:
        errors.append(f"  FAIL: {edge.id} not animated")

if errors:
    for e in errors:
        print(e)
    exit(1)
else:
    print("  ALL CHECKS PASSED")
