# Product: outlaww

## Vision

An AI-powered architecture design workspace where developers describe systems in natural language and get production-ready diagrams, documentation, and code scaffolding — all versioned, collaborative, and exportable.

## Core Value Proposition

**Describe → Diagram → Document → Deploy**

Instead of drawing boxes manually, developers chat with specialized agents that:
1. **Create diagrams** from requirements (architecture, sequence, ER, class)
2. **Generate documentation** (README, ADR, API specs, runbooks)
3. **Identify gaps** in architecture/docs automatically
4. **Research alternatives** and trade-offs
5. **Maintain persistent memory** of project context

## Target Users

- **Backend engineers** designing microservices, data pipelines, APIs
- **Tech leads/architects** documenting system design decisions
- **DevOps/SRE** creating runbooks, incident diagrams, capacity plans
- **Product managers** visualizing technical architecture for stakeholders

## Key Workflows

### 1. New Architecture Design
```
User: "Design a payment processing system with idempotency, retries, and webhooks"
→ create_diagram agent → architecture diagram (services, queues, DBs)
→ create_markdown agent → ADR + API spec + runbook
→ gap_suggestion agent → identifies missing: circuit breakers, observability
```

### 2. Existing System Documentation
```
User: "Document our current order service"
→ explainer agent → analyzes codebase/context
→ create_diagram → sequence diagram of order flow
→ create_markdown → technical spec + API docs
```

### 3. Incident Response
```
User: "We had a cascade failure in the notification pipeline"
→ create_diagram → sequence diagram of failure
→ gap_suggestion → identifies missing: dead letter queues, retry policies
→ create_markdown → postmortem template + action items
```

## Artifacts Produced

| Artifact | Format | Use Case |
|----------|--------|----------|
| Architecture Diagram | D2 (SVG/PNG) | System overview, service mesh |
| Sequence Diagram | D2 | API flows, async messaging |
| ER Diagram | D2 | Database schema, relationships |
| Class Diagram | D2 | Domain models, DTOs |
| ADR | Markdown | Architecture decisions |
| API Spec | Markdown/OpenAPI | Contract documentation |
| Runbook | Markdown | Operational procedures |
| Postmortem | Markdown | Incident analysis |

## Differentiators

1. **Declarative diagrams (D2)** — Version controllable, diffable, code-reviewable
2. **Agent specialization** — Each agent does one thing perfectly
3. **Persistent memory** — Context survives sessions, learns project conventions
3. **Zero layout burden** — LLM specifies topology; D2 computes layout
4. **Multi-format export** — SVG for docs, PNG for slides, D2 source for Git

## Success Metrics

- Time from requirement → first diagram < 30 seconds
- Diagram edit iteration < 10 seconds
- Zero manual layout adjustments needed
- All artifacts commit-ready without cleanup