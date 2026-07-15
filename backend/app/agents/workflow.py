"""Dynamic workflow for the outlaww application.

Uses ADK's @node / FunctionNode / Workflow API to build a pipeline:
  START → router → dispatch → reflection

Data flows via ctx.state between nodes. Each node reads what it needs
from state and writes its output back to state for the next node.
"""

from __future__ import annotations

import logging
from typing import Any

from google.adk import Context
from google.adk.workflow import Workflow
from google.adk.workflow import node

from app.agents.action_registry import ActionRegistry
from app.agents.agent_registry import AgentRegistry
from app.schema.models import (
    Diagram,
    DiagramOperation,
    MarkdownArtifact,
    MarkdownEditOperation,
    MarkdownFrontmatter,
    MarkdownSection,
    ReflectionOutput,
    Reflections,
    RouteTarget,
    RouterOutput,
    StateSchema,
    TLShape,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
#  Shared singletons
# ---------------------------------------------------------------------------
_action_registry = ActionRegistry()
_agent_registry: AgentRegistry | None = None


def get_agent_registry() -> AgentRegistry:
    global _agent_registry
    if _agent_registry is None:
        _agent_registry = AgentRegistry()
    return _agent_registry


# ---------------------------------------------------------------------------
#  State helpers
# ---------------------------------------------------------------------------

_STATE_KEY = "reflection"
_INITIAL = Reflections().model_dump()


def _load_reflection(state: dict[str, Any]) -> Reflections:
    raw = state.get(_STATE_KEY, _INITIAL)
    if isinstance(raw, dict):
        return Reflections.model_validate(raw)
    return raw


def _save_reflection(state: dict[str, Any], ref: Reflections) -> None:
    state[_STATE_KEY] = ref.model_dump()


# ---------------------------------------------------------------------------
#  Diagram artifact helpers
# ---------------------------------------------------------------------------

_DIAGRAMS_KEY = "diagrams"


def _load_diagrams(state: dict[str, Any]) -> list[Diagram]:
    raw = state.get(_DIAGRAMS_KEY, [])
    return [Diagram.model_validate(d) if isinstance(d, dict) else d for d in raw]


def _save_diagrams(state: dict[str, Any], diagrams: list[Diagram]) -> None:
    state[_DIAGRAMS_KEY] = [d.model_dump() for d in diagrams]


# ---------------------------------------------------------------------------
#  Markdown artifact helpers
# ---------------------------------------------------------------------------

_MARKDOWN_KEY = "markdown_docs"


def _load_markdown_docs(state: dict[str, Any]) -> list[MarkdownArtifact]:
    raw = state.get(_MARKDOWN_KEY, [])
    return [
        MarkdownArtifact.model_validate(d) if isinstance(d, dict) else d
        for d in raw
    ]


def _save_markdown_docs(
    state: dict[str, Any], docs: list[MarkdownArtifact]
) -> None:
    state[_MARKDOWN_KEY] = [d.model_dump() for d in docs]


# ---------------------------------------------------------------------------
#  Active artifact tracking
# ---------------------------------------------------------------------------

_ACTIVE_IDS_KEY = "active_ids"


def _load_active_ids(state: dict[str, Any]) -> dict[str, str]:
    raw = state.get(_ACTIVE_IDS_KEY, {})
    return raw if isinstance(raw, dict) else {}


def _save_active_ids(state: dict[str, Any], ids: dict[str, str]) -> None:
    state[_ACTIVE_IDS_KEY] = ids


def _apply_diagram_operations(
    diagram: Diagram, operations: list[DiagramOperation]
) -> Diagram:
    """Apply a list of DiagramOperation patches to an existing diagram."""
    for op in operations:
        if op.op == "add_shape" and op.shape:
            diagram.add_shape(op.shape, page_id=op.page_id or None)
        elif op.op == "remove_shape":
            diagram.remove_shape(op.shape_id)
        elif op.op == "update_shape" and op.shape_id in diagram.store.shape:
            shape = diagram.store.shape[op.shape_id]
            for k, v in op.patch.items():
                if hasattr(shape, k):
                    setattr(shape, k, v)
                elif isinstance(shape.props, dict):
                    shape.props[k] = v
        elif op.op == "move_shape" and op.shape_id in diagram.store.shape:
            shape = diagram.store.shape[op.shape_id]
            shape.x = op.x
            shape.y = op.y
        elif op.op == "add_page":
            diagram.add_page(name=op.name or "Page")
        elif op.op == "remove_page" and op.page_id in diagram.store.page:
            del diagram.store.page[op.page_id]
    return diagram


def _apply_markdown_edits(
    doc: MarkdownArtifact, edits: list[MarkdownEditOperation]
) -> MarkdownArtifact:
    """Apply a list of MarkdownEditOperation patches to an existing doc."""
    for edit in edits:
        if edit.op == "update_frontmatter" and edit.patch:
            for k, v in edit.patch.items():
                if hasattr(doc.frontmatter, k):
                    setattr(doc.frontmatter, k, v)
        elif edit.op == "replace_section" and edit.section:
            # Find section by heading id and replace content
            for i, sec in enumerate(doc.sections):
                if sec.heading.id == edit.heading_id:
                    doc.sections[i] = edit.section
                    break
        elif edit.op == "insert_section" and edit.section:
            inserted = False
            for i, sec in enumerate(doc.sections):
                if sec.heading.id == edit.after_heading_id:
                    doc.sections.insert(i + 1, edit.section)
                    inserted = True
                    break
            if not inserted:
                doc.sections.append(edit.section)
        elif edit.op == "remove_section":
            doc.sections = [
                s for s in doc.sections if s.heading.id != edit.heading_id
            ]
        elif edit.op == "append_content":
            doc.content += "\n\n" + edit.new_content
        elif edit.op == "prepend_content":
            doc.content = edit.new_content + "\n\n" + doc.content
    # Rebuild raw from frontmatter + content
    doc.updated_at = doc.updated_at.__class__.utcnow()
    return doc


# ---------------------------------------------------------------------------
#  Artifact persistence helpers (called from dispatch_node)
# ---------------------------------------------------------------------------

def _persist_diagram_output(
    ctx: Context, output: dict[str, Any], user_message: str
) -> None:
    """Create a new Diagram from CreateDiagramOutput and persist to state."""
    diagrams = _load_diagrams(ctx.state)
    active = _load_active_ids(ctx.state)

    # Build shapes list
    shapes_raw = output.get("shapes", [])
    shapes = []
    for s in shapes_raw:
        if isinstance(s, dict):
            shapes.append(TLShape.model_validate(s))
        elif isinstance(s, TLShape):
            shapes.append(s)

    diagram = Diagram(
        name=output.get("page_name", "") or user_message[:80],
        description=output.get("description", ""),
    )
    # Add a default page
    page = diagram.add_page(name=output.get("page_name", "Page 1"))
    for shape in shapes:
        diagram.add_shape(shape, page_id=page.id)

    diagrams.append(diagram)
    _save_diagrams(ctx.state, diagrams)

    # Track as active diagram
    active["active_diagram_id"] = diagram.id
    _save_active_ids(ctx.state, active)

    # Update reflection artifact tracking
    ref = _load_reflection(ctx.state)
    ref.artifacts_created.append(diagram.id)
    _save_reflection(ctx.state, ref)


def _persist_diagram_edit(ctx: Context, output: dict[str, Any]) -> None:
    """Apply edit operations to the active diagram and persist to state."""
    diagrams = _load_diagrams(ctx.state)
    active = _load_active_ids(ctx.state)
    diagram_id = active.get("active_diagram_id", "")

    if not diagram_id:
        return

    # Find the target diagram
    target = None
    for d in diagrams:
        if d.id == diagram_id:
            target = d
            break
    if target is None:
        return

    # Parse operations
    ops_raw = output.get("operations", [])
    operations = []
    for op in ops_raw:
        if isinstance(op, dict):
            operations.append(DiagramOperation.model_validate(op))
        elif isinstance(op, DiagramOperation):
            operations.append(op)

    _apply_diagram_operations(target, operations)
    _save_diagrams(ctx.state, diagrams)

    # Update reflection
    ref = _load_reflection(ctx.state)
    if diagram_id not in ref.artifacts_edited:
        ref.artifacts_edited.append(diagram_id)
    _save_reflection(ctx.state, ref)


def _persist_markdown_output(
    ctx: Context, output: dict[str, Any]
) -> None:
    """Create a new MarkdownArtifact and persist to state."""
    docs = _load_markdown_docs(ctx.state)
    active = _load_active_ids(ctx.state)

    frontmatter = output.get("frontmatter", {})
    if isinstance(frontmatter, dict):
        frontmatter = MarkdownFrontmatter.model_validate(frontmatter)

    sections_raw = output.get("sections", [])
    sections = []
    for s in sections_raw:
        if isinstance(s, dict):
            sections.append(MarkdownSection.model_validate(s))
        elif isinstance(s, MarkdownSection):
            sections.append(s)

    doc = MarkdownArtifact(
        title=output.get("title", ""),
        frontmatter=frontmatter,
        content=output.get("content", ""),
        sections=sections,
    )
    docs.append(doc)
    _save_markdown_docs(ctx.state, docs)

    active["active_markdown_id"] = doc.id
    _save_active_ids(ctx.state, active)

    ref = _load_reflection(ctx.state)
    ref.artifacts_created.append(doc.id)
    _save_reflection(ctx.state, ref)


def _persist_markdown_edit(ctx: Context, output: dict[str, Any]) -> None:
    """Apply edit operations to the active markdown doc and persist to state."""
    docs = _load_markdown_docs(ctx.state)
    active = _load_active_ids(ctx.state)
    doc_id = active.get("active_markdown_id", "")

    if not doc_id:
        return

    target = None
    for d in docs:
        if d.id == doc_id:
            target = d
            break
    if target is None:
        return

    edits_raw = output.get("edits", [])
    edits = []
    for e in edits_raw:
        if isinstance(e, dict):
            edits.append(MarkdownEditOperation.model_validate(e))
        elif isinstance(e, MarkdownEditOperation):
            edits.append(e)

    _apply_markdown_edits(target, edits)
    _save_markdown_docs(ctx.state, docs)

    ref = _load_reflection(ctx.state)
    if doc_id not in ref.artifacts_edited:
        ref.artifacts_edited.append(doc_id)
    _save_reflection(ctx.state, ref)


def _apply_updates(ref: Reflections, updates: list[Any]) -> None:
    for u in updates:
        if not isinstance(u, dict):
            continue
        field_path = u.get("field", "")
        action = u.get("action", "set")
        value = u.get("value")
        if not field_path:
            continue
        parts = field_path.split(".")
        obj: Any = ref
        for p in parts[:-1]:
            obj = getattr(obj, p, None)
            if obj is None:
                break
        if obj is None:
            continue
        last = parts[-1]
        current = getattr(obj, last, None)
        if action == "set":
            setattr(obj, last, value)
        elif action == "append" and isinstance(current, list):
            if value not in current:
                current.append(value)
        elif action == "remove" and isinstance(current, list):
            if value in current:
                current.remove(value)


# ===========================================================================
#  Node 1: Router
# ===========================================================================

@node(name="router", rerun_on_resume=True)
async def router_node(ctx: Context, node_input: str) -> None:
    """Classify user intent → store routing in ctx.state."""
    registry = get_agent_registry()
    router_agent = registry.get("router")

    ref = _load_reflection(ctx.state)
    context_block = ref.snapshot_summary()
    if context_block and context_block != "No context yet.":
        ctx.state["router_context"] = context_block

    result = await ctx.run_node(router_agent, node_input)

    if isinstance(result, RouterOutput):
        routing = result.model_dump()
    elif isinstance(result, dict):
        routing = result
    else:
        routing = {"target": "generic", "reasoning": "Could not classify"}

    ctx.state["routing"] = routing
    ctx.state["routing_target"] = routing.get("target", "generic")


# ===========================================================================
#  Node 2: Dispatch
# ===========================================================================

@node(name="dispatch", rerun_on_resume=True)
async def dispatch_node(ctx: Context, node_input: Any) -> None:
    """Run the appropriate agent → store result + artifacts in ctx.state."""
    routing = ctx.state.get("routing", {})
    target = routing.get("target", "generic")
    action_name = routing.get("action_name", "")

    registry = get_agent_registry()
    user_message = ctx.state.get("user_message", "")
    ref = _load_reflection(ctx.state)

    # Resolve which agent to run
    if target == RouteTarget.GENERIC.value or target == "generic":
        ctx.state["dispatch_result"] = {
            "agent_name": "generic",
            "output": routing.get("user_message", ""),
            "text": routing.get("user_message", ""),
        }
        return

    if target == RouteTarget.ACTION.value or target == "action":
        action = _action_registry.get(action_name)
        if action is None:
            ctx.state["dispatch_result"] = {
                "agent_name": "none",
                "output": f"Unknown action: {action_name}",
                "text": f"I don't recognize the action '{action_name}'.",
            }
            return
        agent_name = action.default_agent
    else:
        agent_name = target

    # Run the target agent
    try:
        agent = registry.get(agent_name)
    except KeyError:
        ctx.state["dispatch_result"] = {
            "agent_name": "error",
            "output": f"Agent '{agent_name}' not available.",
            "text": f"Routing error: agent '{agent_name}' is not available.",
        }
        return

    # Build context-augmented message
    context_summary = ref.snapshot_summary()
    augmented = (
        f"[Project context: {context_summary}]\n\n{user_message}"
        if context_summary != "No context yet."
        else user_message
    )

    result = await ctx.run_node(agent, augmented)

    # Extract text and output
    text = ""
    structured_output = None
    if isinstance(result, dict):
        text = (
            result.get("explanation", "")
            or result.get("summary", "")
            or result.get("reasoning", "")
        )
        structured_output = result
    elif isinstance(result, str):
        text = result
    else:
        text = str(result) if result else ""

    ctx.state["dispatch_result"] = {
        "agent_name": agent_name,
        "output": structured_output or result,
        "text": text,
    }

    # ----- Persist artifacts to state via StateDelta -------------------------
    # Diagram agents
    if agent_name == "diagram_agent" and isinstance(structured_output, dict):
        _persist_diagram_output(ctx, structured_output, user_message)
    elif agent_name == "diagram_editor" and isinstance(structured_output, dict):
        _persist_diagram_edit(ctx, structured_output)

    # Markdown agents
    elif agent_name == "markdown_agent" and isinstance(structured_output, dict):
        _persist_markdown_output(ctx, structured_output)
    elif agent_name == "markdown_editor" and isinstance(structured_output, dict):
        _persist_markdown_edit(ctx, structured_output)


# ===========================================================================
#  Node 3: Reflection
# ===========================================================================

@node(name="reflection", rerun_on_resume=True)
async def reflection_node(ctx: Context, node_input: Any) -> None:
    """Update persistent memory after the main agent ran."""
    dispatch_result = ctx.state.get("dispatch_result", {})
    registry = get_agent_registry()
    ref = _load_reflection(ctx.state)
    user_message = ctx.state.get("user_message", "")
    agent_name = dispatch_result.get("agent_name", "")
    agent_output = dispatch_result.get("output", "")

    # Build artifact context for the reflection agent
    diagrams = _load_diagrams(ctx.state)
    docs = _load_markdown_docs(ctx.state)
    active = _load_active_ids(ctx.state)
    artifact_summary = (
        f"Diagrams in session: {len(diagrams)} | "
        f"Markdown docs in session: {len(docs)} | "
        f"Active diagram: {active.get('active_diagram_id', 'none')[:12]} | "
        f"Active doc: {active.get('active_markdown_id', 'none')[:12]} | "
        f"Total artifacts created: {len(ref.artifacts_created)} | "
        f"Total artifacts edited: {len(ref.artifacts_edited)}"
    )

    reflection_context = (
        f"User said: {user_message}\n"
        f"Agent used: {agent_name}\n"
        f"Agent output summary: {str(agent_output)[:500]}\n"
        f"Current project: {ref.project.name or 'unknown'}\n"
        f"Current goals: {', '.join(ref.current_goals[:5]) or 'none'}\n"
        f"Recent events: {', '.join(e.content[:40] for e in ref.recent_events(5)) or 'none'}\n"
        f"Artifacts state: {artifact_summary}\n"
    )

    reflection_agent = registry.get("reflection")
    result = await ctx.run_node(reflection_agent, reflection_context)

    if isinstance(result, ReflectionOutput):
        ro = result
    elif isinstance(result, dict):
        ro = ReflectionOutput.model_validate(result)
    else:
        ro = ReflectionOutput()

    _apply_updates(ref, ro.updates)

    for g in ro.new_goals:
        if g not in ref.current_goals:
            ref.current_goals.append(g)
    for b in ro.new_blockers:
        if b not in ref.active_blockers:
            ref.active_blockers.append(b)
    for q in ro.new_open_questions:
        if q not in ref.open_questions:
            ref.open_questions.append(q)
    for fact in ro.learnings:
        ref.learn(fact)
    for d in ro.decisions_made:
        ref.declare(
            title=d.get("title", "Decision"),
            decision=d.get("decision", ""),
            context=d.get("context", ""),
        )
    for entry in ro.log_entries:
        ref.log(entry, tags=[agent_name])

    ref.last_agent_used = agent_name
    ref.last_intent_classified = ctx.state.get("routing_target", "")
    ref.total_interactions += 1

    _save_reflection(ctx.state, ref)


# ===========================================================================
#  Main Workflow
# ===========================================================================

def build_workflow() -> Workflow:
    """Pipeline: START → router → dispatch → reflection"""
    return Workflow(
        name="outlaww_workflow",
        state_schema=StateSchema,
        edges=[
            ("START", router_node),
            (router_node, dispatch_node),
            (dispatch_node, reflection_node),
        ],
    )
