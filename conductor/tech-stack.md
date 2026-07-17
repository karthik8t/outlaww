# Tech Stack: outlaww

## Backend (Python 3.12+)

| Layer | Technology | Version | Rationale |
|-------|------------|---------|-----------|
| Runtime | Python | 3.12+ | Modern typing, performance |
| Package Manager | uv | 0.4+ | Fast, deterministic, workspace support |
| Web Framework | FastAPI | 0.110+ | Async, OpenAPI, DI |
| LLM Orchestration | Google ADK | Latest | Agent workflows, state, streaming |
| LLM Provider | OpenRouter | - | Multi-model, cost optimization |
| Validation/Serialization | Pydantic | 2.8+ | Strict schemas, constrained decoding |
| JSON | msgspec/orjson | - | Fast serialization |
| Diagrams (New) | D2 (terrastruct/d2) | Latest | Declarative, LLM-friendly, multiple renderers |
| Diagrams (Legacy) | tldraw | v5 | Interactive canvas (being migrated) |
| Session Storage | ADK InMemorySessionService | - | Dev only; swap for PostgreSQL/Redis |
| Logging | structlog | 24+ | Structured JSON logs |

## Frontend (React 18 + TypeScript)

| Layer | Technology | Version | Rationale |
|-------|------------|---------|-----------|
| Framework | React | 18.2+ | Concurrent features, hooks |
| Build | Vite | 5+ | Fast HMR, optimized builds |
| Styling | Tailwind CSS | 3.4+ | Utility-first, dark mode |
| UI Primitives | Radix UI / shadcn/ui | Latest | Accessible, unstyled |
| Icons | Lucide React | Latest | Consistent, tree-shakeable |
| State | React hooks + Context | - | No external deps needed |
| Diagrams (Legacy) | tldraw | v5 | Interactive canvas |
| Diagrams (New) | @d2lang/d2 (WASM) | Latest | Browser rendering |
| Markdown | react-markdown + remark-gfm | - | GFM rendering |
| API Client | fetch + generated types | - | OpenAPI → TypeScript |

## D2 Rendering: Three Mechanisms

| # | Mechanism | Implementation | Use Case | Latency |
|---|-----------|----------------|----------|---------|
| 1 | **Server CLI** | `d2` Go binary via subprocess | Production exports, batch, CI/CD | 100-500ms |
| 2 | **Browser WASM** | `@d2lang/d2` npm package | Interactive preview, offline | 50-200ms |
| 3 | **Server SSE** | FastAPI `StreamingResponse` | Real-time collaborative | ~50ms first frame |

## Agent Models (via OpenRouter)

| Agent | Model | Reasoning |
|-------|-------|-----------|
| Router | `gemma-4-31b-it:free` | Fast classification |
| Create/Edit Diagram | `claude-3.5-sonnet` | Complex topology reasoning |
| Create/Edit Markdown | `claude-3.5-sonnet` | Structured writing |
| Explainer | `gemini-1.5-pro` | Long context |
| Gap Suggestion | `claude-3.5-sonnet` | Cross-artifact analysis |
| Research | `llama-3.1-sonar-large` | Web search + synthesis |
| Reflection | `gemma-4-31b-it:free` | Fast memory updates |

## Project Structure

```
outlaww/
├── conductor/              # Track management
│   ├── product.md
│   ├── tech-stack.md
│   ├── workflow.md
│   └── tracks/
├── backend/
│   ├── app/
│   │   ├── api/            # FastAPI routes
│   │   ├── agents/         # ADK agents + workflow
│   │   ├── schema/         # Pydantic models (D2, DiagramGraph, etc.)
│   │   └── db/             # Session storage
│   ├── pyproject.toml
│   └── uv.lock
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom hooks (useSession)
│   │   ├── lib/            # API client, utilities
│   │   └── App.tsx         # Main app shell
│   ├── package.json
│   └── vite.config.ts
└── pyproject.toml          # uv workspace root
```

## Development Commands

```bash
# Backend
cd backend && uv run uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend && npm run dev

# D2 CLI
d2 input.d2 output.svg
d2 -t 100 -s 2 input.d2 output.svg  # theme, scale
```

## Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| No database in MVP | ADK InMemorySessionService; swap later |
| No auth in MVP | Single-user via URL path `/session/:id` |
| D2 over tldraw | Declarative, version-controllable, LLM-friendly |
| Flat graph models | Avoids JSON schema recursion limits in LLM output |
| Three render paths | Covers static export, interactive, collaborative |
| Pydantic `extra="forbid"` | Required for OpenAI/Anthropic strict JSON mode |
| CoT field in schemas | Mitigates "semantic quality tax" of constrained decoding |