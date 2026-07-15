# Workflow: Outlaww Development

## TDD Approach

**Mandatory**: All new code follows Red-Green-Refactor.

### Test Levels

1. **Unit** (pytest): Schema validation, serialization, layout algorithms
2. **Integration** (pytest): Agent workflow end-to-end, API endpoints
3. **Contract** (pytest): D2 output matches expected SVG structure
4. **E2E** (Playwright): Frontend chat → diagram render → export

### Test Commands

```bash
# Backend unit/integration
cd backend && uv run pytest -v

# Backend with coverage
cd backend && uv run pytest --cov=app --cov-report=term-missing

# Frontend unit
cd frontend && npm run test

# E2E (requires running servers)
cd frontend && npm run test:e2e
```

## Git Workflow

### Branch Naming

```
feature/{track-id}-{short-description}
bugfix/{track-id}-{short-description}
chore/{track-id}-{short-description}
refactor/{track-id}-{short-description}
```

### Commit Convention (Conventional Commits)

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`, `ci`

Scopes: `schema`, `agent`, `workflow`, `api`, `ui`, `render`, `layout`

Examples:
```
feat(schema): add D2Diagram flat-graph models
fix(layout): handle cycles in layered layout
refactor(agent): migrate create_diagram to D2 output
```

### PR Process

1. Create feature branch from `main`
2. Implement with tests (TDD)
3. Run full test suite locally
4. Push branch, create PR
5. CI runs: lint, typecheck, unit, integration, e2e
6. Code review (1 approval minimum)
7. Squash merge to `main`

## Conductor Track Lifecycle

### Track States

```
pending → in_progress → review → done
                    ↘ blocked
```

### Commands

```bash
# Create new track (interactive)
/conductor:new

# Start implementation
/conductor:implement <track-id>

# Check status
/conductor:status

# Archive completed track
/conductor:archive <track-id>
```

### Track Structure

```
conductor/tracks/{track-id}/
├── spec.md          # Requirements (WHAT)
├── plan.md          # Phased plan (HOW)
├── metadata.json    # Status, progress
└── index.md         # Navigation
```

## Code Quality Gates

### Pre-commit (local)

```bash
# Backend
cd backend && uv run ruff check . && uv run ruff format . && uv run mypy app/

# Frontend
cd frontend && npm run lint && npm run typecheck
```

### CI Pipeline (GitHub Actions)

```yaml
jobs:
  backend:
    - ruff check
    - ruff format --check
    - mypy
    - pytest (unit + integration)
  frontend:
    - eslint
    - tsc --noEmit
    - vitest
    - playwright (e2e)
  contract:
    - D2 schema validation
    - SVG snapshot testing
```

## Agent Development Workflow

### Adding/Modifying Agents

1. Update `agent_registry.py`:
   - Add/modify `_AGENT_CONFIGS` entry
   - Define `output_schema` (Pydantic model)
   - Write clear `instruction` with examples

2. Create/update output schema in `schema/models.py`:
   - Use flat models (no recursion)
   - Add `model_config = ConfigDict(extra="forbid")`
   - Include `architectural_reasoning` field for CoT

3. Test agent in isolation:
   ```python
   # scripts/test_agent.py
   from app.agents.agent_registry import AgentRegistry
   registry = AgentRegistry()
   agent = registry.get("create_diagram")
   result = await agent.run("Create a 3-tier web app diagram")
   print(result)
   ```

4. Run workflow integration test:
   ```bash
   cd backend && uv run pytest app/agents/test_workflow.py -v
   ```

## D2 Diagram Pipeline

### Adding New Shape Types

1. Add to `ShapeType` enum in `schema/d2_models.py`
2. Add serialization logic in `D2Serializer._serialize_node()`
3. Update agent instruction with new shape guidance
4. Test: `d2 test.d2 test.svg`

### Layout Engine Selection

- **dagre** (default): Fast, hierarchical, good for flowcharts
- **elk**: Best for complex enterprise graphs, orthogonal edges
- **tala**: Architecture diagrams, per-container direction

Set via `vars.d2-config.layout-engine` in D2 source or `--layout` CLI flag.

## Frontend Rendering: Three Mechanisms

### 1. Server-Side (CLI) - Primary Export

```typescript
// API call
const response = await fetch('/api/diagrams/render', {
  method: 'POST',
  body: JSON.stringify({ d2_source: source, format: 'svg' })
})
const svg = await response.text()
```

Backend: `subprocess.run(['d2', '-', '-'], input=source, capture_output=True)`

### 2. WASM (Browser) - Interactive Preview

```typescript
import { render } from '@d2lang/d2'
const svg = await render(d2Source, { layout: 'elk' })
```

Use in `<DiagramPreview />` component for instant feedback.

### 3. SSE Stream - Collaborative

```typescript
const eventSource = new EventSource(`/api/diagrams/stream/${diagramId}`)
eventSource.onmessage = (e) => {
  const { svg_chunk, done } = JSON.parse(e.data)
  // Append to SVG DOM
}
```

Backend: FastAPI `StreamingResponse` yielding SVG fragments.

## Definition of Done

For each task:
- [ ] Tests written first (Red)
- [ ] Implementation makes tests pass (Green)
- [ ] Refactored for clarity (Refactor)
- [ ] Type hints complete, mypy clean
- [ ] Ruff format/check clean
- [ ] Docstrings for public functions
- [ ] No `Any` types without justification
- [ ] No `print()` in production code (use structlog)