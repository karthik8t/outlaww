# Implementation Plan: tldraw → D2 Migration

**Track ID:** tldraw-to-d2-migration_20260716
**Spec:** [spec.md](./spec.md)
**Created:** 2026-07-16
**Status:** [ ] Not Started

## Overview

Migrate the entire diagram pipeline from tldraw records to D2 flat-graph models. Four phases:
1. **Backend Models & Serialization** — New Pydantic models, D2Serializer, simplified layout
2. **Agent & Workflow Updates** — Agent instructions, output schemas, persistence
3. **Render Pipeline** — Three render mechanisms (CLI, WASM, SSE)
4. **Frontend Integration** — D2DiagramView component, render mode selector, polish

## Phase 1: Backend Models & Serialization

### Tasks

- [ ] **1.1** Create `backend/app/schema/d2_models.py` with flat-graph models:
  - `D2Style` (all style props, extra="forbid")
  - `D2Class` (reusable style definitions)
  - `D2Node` (id, parent_id, label, shape, style, classes, sql_*)
  - `D2Edge` (source, target, direction, label, style, span_id, note_for)
  - `D2Diagram` (architectural_reasoning, config, classes, nodes, edges)
  - Enums: `ShapeType`, `ConnectionDirection`, `LayoutEngine`, `DiagramDirection`, `SQLConstraint`

- [ ] **1.2** Create `backend/app/schema/d2_serializer.py`:
  - `D2Serializer` class with `to_d2()` method
  - Tree reconstruction from flat nodes via `parent_id`
  - ID escaping (`escape_id`), label escaping (`escape_label`)
  - Markdown block handling (`|md\n...\n|`)
  - Style block serialization (`style: { ... }`)
  - SQL table column formatting
  - Sequence diagram span/note handling
  - Config block (layout, direction, theme, pad, sketch)

- [ ] **1.3** Simplify `backend/app/schema/graph_layout.py`:
  - Remove positioning logic (D2 handles layout)
  - Keep only `_node_size()` for sizing hints
  - Return `LayoutResult` with `w`, `h` per node (optional)

- [ ] **1.4** Create `backend/app/schema/d2_renderer.py` with three render paths:
  - `render_cli(d2_source, format)` — subprocess `d2` binary
  - `render_wasm(d2_source)` — returns WASM bundle info for frontend
  - `render_sse(d2_source)` — async generator yielding SVG chunks

- [ ] **1.5** Update `backend/app/schema/__init__.py` to export new models

- [ ] **1.6** Add tests in `backend/tests/test_d2_models.py`:
  - Round-trip: D2Diagram → serialize → parse → equivalent
  - All shape types serialize correctly
  - ID/label escaping works for special chars
  - SQL table, sequence diagram, grid render

### Verification

- [ ] `cd backend && uv run pytest tests/test_d2_models.py -v` passes
- [ ] `cd backend && uv run python -c "from app.schema.d2_models import D2Diagram; print('imports ok')"`
- [ ] Sample diagram renders via `d2` CLI: `echo 'x -> y' | d2 - output.svg`

## Phase 2: Agent & Workflow Updates

### Tasks

- [ ] **2.1** Update `backend/app/agents/agent_registry.py`:
  - Change `create_diagram` output_schema to `D2Diagram`
  - Change `edit_diagram` output_schema to `D2Diagram`
  - Change `patch_diagram` output_schema to `D2Diagram`
  - Rewrite instructions for D2 flat-graph output:
    - Emphasize `architectural_reasoning` field (CoT)
    - Explain `parent_id` for containers
    - Explain `sql_type`/`sql_constraint` for ER diagrams
    - Explain `is_actor`, `span_id`, `note_for` for sequences
    - List valid shapes from `ShapeType` enum

- [ ] **2.2** Update `backend/app/agents/workflow.py`:
  - `_persist_diagram_output`: Store `D2Diagram` in `Diagram.graph` field
  - `_persist_diagram_edit`: Replace graph with new `D2Diagram`
  - Remove `graph_to_tldraw_records` import
  - Remove `DiagramGraph` import (replace with `D2Diagram`)

- [ ] **2.3** Update `backend/app/schema/models.py`:
  - `Diagram.graph` field type: `Optional[dict]` → holds `D2Diagram` dump
  - Remove `diagram_to_tldraw_records` function
  - Keep `validate_tldraw_records` for backward compat (deprecated)

- [ ] **2.4** Update `backend/app/api/routers/chat.py`:
  - `_diagram_to_records`: Use `D2Serializer.to_d2()` then `render_cli()`
  - Return both D2 source and SVG in response
  - Deprecate `tldraw_records` field (keep for compat)

- [ ] **2.5** Add tests in `backend/tests/test_diagram_agents.py`:
  - Agent outputs valid `D2Diagram` for sample prompts
  - Workflow persists and retrieves D2 source correctly

### Verification

- [ ] `cd backend && uv run pytest tests/test_diagram_agents.py -v` passes
- [ ] Manual test: Chat "Create a 3-tier architecture" → returns D2 source + SVG
- [ ] Manual test: Edit diagram → "Add load balancer" → returns updated D2

## Phase 3: Render Pipeline

### Tasks

- [ ] **3.1** Install D2 CLI in backend environment:
  - Add to `backend/pyproject.toml` optional dependency or install script
  - Verify `d2 --version` works in container

- [ ] **3.2** Implement `backend/app/schema/d2_renderer.py` fully:
  - `render_cli()`: subprocess with timeout, error handling, format selection
  - `render_wasm()`: Return `{wasm_url: "/wasm/d2.wasm", js_url: "/wasm/d2.js"}` for frontend
  - `render_sse()`: FastAPI `StreamingResponse` yielding SVG fragments

- [ ] **3.3** Add API endpoints in `backend/app/api/routers/diagrams.py` (new file):
  - `POST /api/diagrams/render` — body: `{d2_source, format}` → returns SVG
  - `GET /api/diagrams/render/stream` — SSE endpoint for real-time
  - `GET /api/diagrams/wasm` — Returns WASM asset URLs

- [ ] **3.4** Copy D2 WASM assets to frontend public:
  - Download `@d2lang/d2` npm package
  - Extract `d2.wasm` and `d2.js` to `frontend/public/wasm/`

- [ ] **3.5** Add tests in `backend/tests/test_d2_renderer.py`:
  - CLI renders valid SVG for sample diagrams
  - SSE yields chunks that concatenate to valid SVG
  - Error handling for invalid D2 source

### Verification

- [ ] `cd backend && uv run pytest tests/test_d2_renderer.py -v` passes
- [ ] `curl -X POST localhost:8000/api/diagrams/render -d '{"d2_source":"x -> y"}'` returns SVG
- [ ] SSE endpoint streams SVG chunks
- [ ] WASM assets served at `/wasm/d2.wasm` and `/wasm/d2.js`

## Phase 4: Frontend Integration

### Tasks

- [ ] **4.1** Install `@d2lang/d2` in frontend:
  - `cd frontend && npm install @d2lang/d2`

- [ ] **4.2** Create `frontend/src/components/D2DiagramView.tsx`:
  - Props: `d2Source: string`, `renderMode: 'cli' | 'wasm' | 'sse'`
  - Mode selector dropdown in toolbar
  - SVG display with pan/zoom (wheel zoom, drag pan)
  - Download buttons (SVG, PNG, D2 source)
  - Error boundary for render failures
  - Loading states per mode

- [ ] **4.3** Implement three render modes in component:
  - **CLI**: `fetch('/api/diagrams/render', {method: 'POST', body: JSON.stringify({d2_source, format: 'svg'})})`
  - **WASM**: `import { render } from '@d2lang/d2'; const svg = await render(d2Source, {layout: 'elk'})`
  - **SSE**: `EventSource('/api/diagrams/render/stream?d2=' + encodeURIComponent(d2Source))` append chunks

- [ ] **4.4** Update `frontend/src/App.tsx`:
  - Replace `TldrawCanvas` with `D2DiagramView`
  - Pass `selectedDiagram.graph` (D2 source) as `d2Source`
  - Add render mode to session state

- [ ] **4.5** Add Monaco editor (optional) for live D2 editing:
  - `npm install @monaco-editor/react`
  - Side-by-side: editor left, preview right
  - Debounced re-render on edit

- [ ] **4.6** Style polish:
  - Dark mode SVG (CSS filter or D2 dark theme)
  - Toolbar with theme selector (D2 themes: 0, 1, 2, 100, 200, 300)
  - Layout engine selector (dagre/elk/tala)
  - Responsive layout

- [ ] **4.7** Add E2E tests in `frontend/e2e/d2-diagram.test.ts`:
  - Create diagram via chat → renders in all 3 modes
  - Edit diagram → preview updates
  - Download SVG works
  - Theme/layout changes apply

### Verification

- [ ] `cd frontend && npm run dev` — no TypeScript errors
- [ ] Manual: Chat "Create a microservices diagram" → renders in CLI mode
- [ ] Manual: Switch to WASM mode → renders instantly
- [ ] Manual: Switch to SSE mode → streams progressively
- [ ] Manual: Change theme → re-renders with new colors
- [ ] Manual: Download SVG → valid file opens in browser
- [ ] `cd frontend && npm run test:e2e` passes

## Final Verification

- [ ] All acceptance criteria from spec.md met
- [ ] Backend tests: `cd backend && uv run pytest -v` all pass
- [ ] Frontend tests: `cd frontend && npm run test && npm run test:e2e` all pass
- [ ] No tldraw imports remain in backend (grep -r "tldraw" backend/app --include="*.py")
- [ ] Documentation updated in track directory
- [ ] Ready for review

---

_Generated by Conductor. Tasks will be marked [~] in progress and [x] complete._