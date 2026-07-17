# Specification: tldraw → D2 Migration

**Track ID:** tldraw-to-d2-migration_20260716
**Type:** Refactor
**Created:** 2026-07-16
**Status:** Draft

## Summary

Replace the tldraw-based diagram pipeline (LLM → DiagramGraph → layout engine → tldraw records → tldraw canvas) with a D2-based pipeline (LLM → D2Diagram flat-graph → D2 serializer → D2 render via 3 mechanisms). This eliminates recursive JSON schemas, enables version-controllable diagrams, and provides deterministic rendering.

## Context

Current architecture (from product.md):
- Backend agents output `DiagramGraph` (nodes + edges) via Pydantic `output_schema`
- Python layout engine computes x/y coordinates
- `tldraw_records.py` converts positioned graph to tldraw v5 JSON records
- Frontend loads records into `tldraw` React canvas editor

Problems:
1. **Recursive schemas**: tldraw records require nested structure; LLM structured output fails on deep nesting (OpenAI 5-level limit, Anthropic no recursion)
2. **Layout coupling**: Python layout logic duplicates D2's sophisticated layout engines (dagre/ELK/TALA)
3. **Non-declarative**: tldraw records are imperative canvas state, not version-controllable source
4. **Single render path**: Only interactive tldraw canvas; no static export, no WASM, no SSE streaming

## Acceptance Criteria

- [ ] **AC1**: Backend agents output `D2Diagram` flat-graph model (no coordinates, no nesting)
- [ ] **AC2**: `D2Serializer.to_d2()` produces syntactically valid D2 for all supported shapes
- [ ] **AC3**: Three render mechanisms work: CLI (server), WASM (browser), SSE (streaming)
- [ ] **AC4**: Frontend displays diagrams via `D2DiagramView` component (no tldraw)
- [ ] **AC5**: Chat "create diagram" → agent → render completes in < 3s end-to-end
- [ ] **AC6**: All existing diagram types supported: boxes, containers, SQL tables, UML classes, sequence diagrams, grids
- [ ] **AC7**: Edit/patch agents work with D2 source (complete replacement, not diff)
- [ ] **AC8**: Zero tldraw dependencies in backend; frontend only uses D2 render

## Dependencies

- **External**: `d2` CLI (Go binary) installed on backend; `@d2lang/d2` npm package
- **Internal**: Existing agent registry, workflow, session service unchanged
- **Blocks**: None

## Out of Scope

- Collaborative editing (multi-user cursors, presence) — D2 is declarative source; tldraw handled this
- Diagram version history / git integration — future track
- Custom D2 shape definitions — use built-in shapes only
- Migration of existing tldraw diagrams — start fresh

## Technical Notes

### D2 Flat-Graph Model Design

Based on LLM structured output constraints:
- **No recursion**: `nodes[]` and `edges[]` are flat arrays
- **Hierarchy via `parent_id`**: Container membership by reference
- **Special shapes via `shape` enum**: `sql_table`, `sequence_diagram`, `class`, `grid`, etc.
- **SQL columns as child nodes**: `parent_id = table_id`, `sql_type`, `sql_constraint`
- **Sequence actors via `is_actor`**: Edges with `span_id`/`note_for` for activations/notes
- **CoT field**: `architectural_reasoning` string at root for unconstrained planning

### D2 Serialization Rules

- IDs: alphanumeric + `_` `-` only; quote if spaces/special chars
- Labels: multi-line → `|md` block; single-line → quote if needed
- Styles: kebab-case keys (`stroke-width`), block format `style: { ... }`
- Classes: `class: [class1; class2]` array syntax
- Config: `vars: { d2-config: { layout-engine: elk, theme-id: 100 } }`

### Three Render Mechanisms

| Mechanism | Implementation | Pros | Cons |
|-----------|---------------|------|------|
| **CLI** | `subprocess.run(["d2", "-", "-"], input=d2_source)` | Full fidelity, all formats, themes, layouts | Requires Go binary, ~100-500ms |
| **WASM** | `@d2lang/d2` `render()` in browser | Zero server load, offline, interactive | Larger bundle (~2MB), limited themes |
| **SSE** | FastAPI `StreamingResponse` chunking SVG | Real-time, progressive, collaborative-ready | Complex, requires server connection |

### Agent Instruction Updates

Each diagram agent needs:
1. New `output_schema` = `D2Diagram`
2. Instruction emphasizing flat graph, `parent_id` for containers
3. Shape enum documentation with examples
4. CoT field `architectural_reasoning` explained

### Frontend Component Architecture

```
D2DiagramView (container)
├── D2Toolbar (mode, theme, layout, download, copy)
├── RenderModeSelector (CLI | WASM | SSE)
└── SVGViewport (pan/zoom wrapper around <svg>)
```

## Migration Strategy

1. **Parallel run**: Keep tldraw code, add D2 pipeline alongside
2. **Feature flag**: `USE_D2_RENDER=true` env var switches pipeline
3. **Agent swap**: Update agent registry one at a time (create → edit → patch)
4. **Frontend swap**: Replace `TldrawCanvas` with `D2DiagramView`
5. **Cleanup**: Remove tldraw code after verification