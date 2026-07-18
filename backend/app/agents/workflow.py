"""Dynamic workflow for the outlaww application.

Uses ADK's @node / FunctionNode / Workflow API to build a pipeline:
  START → router → dispatch → reflection

Data flows via ctx.state between nodes. Each node reads what it needs
from state and writes its output back to state for the next node.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any

from google.adk import Context
from google.adk.workflow import Workflow
from google.adk.workflow import node

from app.agents.action_registry import ActionRegistry
from app.agents.agent_registry import AgentRegistry
from app.schema.reactflow_models import Diagram as DiagramSchema
from app.schema.models import (
    Diagram,
    MarkdownArtifact,
    MarkdownEditOperation,
    MarkdownFrontmatter,
    MarkdownSection,
    ReflectionOutput,
    Reflections,
    RouteTarget,
    RouterOutput,
    StateSchema,
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
#  Safe node runner with logging
# ---------------------------------------------------------------------------

async def safe_run_node(ctx: Context, agent: Any, node_input: Any) -> Any:
    """Run an agent node. ADK handles output_schema → dict conversion.

    Logs the raw and final result for debugging.
    """
    agent_name = getattr(agent, "name", "unknown")
    logger.info(f"[{agent_name}] running with input length={len(str(node_input))}")

    try:
        result = await ctx.run_node(agent, node_input)
    except Exception as exc:
        logger.error(f"[{agent_name}] LLM call failed: {exc}", exc_info=True)
        raise

    # Convert Pydantic models to JSON-serializable dicts
    if hasattr(result, "model_dump"):
        result = result.model_dump(mode="json")

    # ADK should return a dict when output_schema is set — log if it didn't
    if isinstance(result, dict):
        logger.info(f"[{agent_name}] output (dict, keys={list(result.keys())})")
    elif isinstance(result, str):
        logger.warning(f"[{agent_name}] output is str (len={len(result)}), ADK did not convert — attempting fallback parse")
        try:
            result = json.loads(result)
            logger.info(f"[{agent_name}] fallback parse succeeded")
        except (json.JSONDecodeError, ValueError):
            logger.error(f"[{agent_name}] fallback parse failed, returning raw string")
    else:
        logger.info(f"[{agent_name}] output (type={type(result).__name__})")

    return result


# ---------------------------------------------------------------------------
#  State helpers
# ---------------------------------------------------------------------------

_STATE_KEY = "reflection"
_INITIAL = Reflections().model_dump(mode="json")


def _extract_title(output: dict, fallback: str) -> str:
    """Extract a meaningful title from the Diagram output."""
    if isinstance(output, dict):
        # Try common title fields, then fall back to first node label
        title = output.get("name", "") or output.get("title", "")
        if title:
            return title
        nodes = output.get("nodes", [])
        if nodes and isinstance(nodes, list) and len(nodes) > 0:
            first = nodes[0]
            if isinstance(first, dict):
                data = first.get("data", {}) or {}
                return data.get("label", fallback) if isinstance(data, dict) else fallback
    return fallback


def _extract_description(output: dict) -> str:
    """Extract a description from the Diagram output."""
    if isinstance(output, dict):
        desc = output.get("description", "")
        if desc:
            return desc
    return ""


def _load_reflection(state: dict[str, Any]) -> Reflections:
    raw = state.get(_STATE_KEY, _INITIAL)
    if isinstance(raw, dict):
        return Reflections.model_validate(raw)
    return raw


def _save_reflection(state: dict[str, Any], ref: Reflections) -> None:
    state[_STATE_KEY] = ref.model_dump(mode="json")


# ---------------------------------------------------------------------------
#  Diagram artifact helpers
# ---------------------------------------------------------------------------

_DIAGRAMS_KEY = "diagrams"


def _load_diagrams(state: dict[str, Any]) -> list["Diagram"]:
    raw = state.get(_DIAGRAMS_KEY, [])
    return [Diagram.model_validate(d) if isinstance(d, dict) else d for d in raw]


def _save_diagrams(state: dict[str, Any], diagrams: list[Diagram]) -> None:
    state[_DIAGRAMS_KEY] = [d.model_dump(mode="json") for d in diagrams]


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
    state[_MARKDOWN_KEY] = [d.model_dump(mode="json") for d in docs]


# ---------------------------------------------------------------------------
#  Active artifact tracking
# ---------------------------------------------------------------------------

_ACTIVE_IDS_KEY = "active_ids"


def _load_active_ids(state: dict[str, Any]) -> dict[str, str]:
    raw = state.get(_ACTIVE_IDS_KEY, {})
    return raw if isinstance(raw, dict) else {}


def _save_active_ids(state: dict[str, Any], ids: dict[str, str]) -> None:
    state[_ACTIVE_IDS_KEY] = ids


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
    """Create a new Diagram from the LLM schema and persist to state."""
    diagrams = _load_diagrams(ctx.state)
    active = _load_active_ids(ctx.state)

    # Parse the LLM's output as the clean Diagram schema
    graph_data = output
    try:
        rf_schema = DiagramSchema.model_validate(graph_data)
    except Exception:
        logger.warning(f"[persist] failed to parse Diagram: {graph_data}")
        return

    # Store the schema dict in the Diagram model
    diagram = Diagram(
        name=_extract_title(output, user_message),
        description=_extract_description(output),
        graph=rf_schema.model_dump(mode="json"),
    )

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
    """Replace the active diagram with the new Diagram from edit/patch agents."""
    diagrams = _load_diagrams(ctx.state)
    active = _load_active_ids(ctx.state)
    diagram_id = active.get("active_diagram_id", "")

    if not diagram_id:
        return

    target = None
    target_idx = -1
    for i, d in enumerate(diagrams):
        if d.id == diagram_id:
            target = d
            target_idx = i
            break
    if target is None:
        return

    # Parse the LLM's Diagram output (complete replacement)
    try:
        rf_schema = DiagramSchema.model_validate(output)
    except Exception:
        logger.warning(f"[persist] failed to parse Diagram for edit: {output}")
        return

    # Update the diagram with the new schema
    target.graph = rf_schema.model_dump(mode="json")
    target.name = _extract_title(output, target.name)
    target.description = _extract_description(output) or target.description
    target.updated_at = datetime.utcnow()
    diagrams[target_idx] = target
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
    logger.info(f"[router] classifying: {node_input[:200]}")

    registry = get_agent_registry()
    router_agent = registry.get("router")

    ref = _load_reflection(ctx.state)
    context_block = ref.snapshot_summary()
    if context_block and context_block != "No context yet.":
        ctx.state["router_context"] = context_block

    result = await safe_run_node(ctx, router_agent, node_input)

    # Try to parse as RouterOutput
    if isinstance(result, RouterOutput):
        routing = result.model_dump(mode="json")
        logger.info(f"[router] classified as RouterOutput: target={routing.get('target')}, action={routing.get('action_name', '')}")
    elif isinstance(result, dict):
        routing = result
        # Validate target is a known RouteTarget
        target = routing.get("target", "generic")
        if target not in [e.value for e in RouteTarget]:
            logger.warning(f"[router] unknown target '{target}', falling back to generic")
            routing["target"] = "generic"
        logger.info(f"[router] classified as dict: target={routing.get('target')}, action={routing.get('action_name', '')}")
    else:
        logger.warning(f"[router] unexpected result type {type(result).__name__}, falling back to generic")
        routing = {"target": "generic", "reasoning": "Could not classify"}

    logger.info(f"[router] final routing: {routing}")
    ctx.state["routing"] = routing
    ctx.state["routing_target"] = routing.get("target", "generic")


# ===========================================================================
#  Node 2: Dispatch
# ===========================================================================

@node(name="dispatch", rerun_on_resume=True)
async def dispatch_node(ctx: Context, node_input: Any) -> None:
    """Run the appropriate agent → store result + artifacts in ctx.state.

    Handles two entry paths:
      1. Predefined action: action_name is set in state (router skipped)
      2. Free-form text: routing_target is set by the router node
    """
    registry = get_agent_registry()
    user_message = ctx.state.get("user_message", "")
    ref = _load_reflection(ctx.state)

    # --- Path 1: Predefined action (router was skipped) ---
    action_name = ctx.state.get("action_name", "")

    if action_name:
        logger.info(f"[dispatch] predefined action: {action_name}")
        action = _action_registry.get(action_name)
        if action is None:
            logger.warning(f"[dispatch] unknown action '{action_name}'")
            ctx.state["dispatch_result"] = {
                "agent_name": "none",
                "output": f"Unknown action: {action_name}",
                "text": f"I don't recognize the action '{action_name}'.",
            }
            return
        agent_name = action.default_agent
        ctx.state["routing_target"] = RouteTarget.ACTION.value
    else:
        # --- Path 2: Free-form text (router classified it) ---
        routing = ctx.state.get("routing", {})
        target = routing.get("target", "generic")
        logger.info(f"[dispatch] router target: {target}")

        if target == RouteTarget.GENERIC.value or target == "generic":
            logger.info("[dispatch] generic response — no agent needed")
            ctx.state["dispatch_result"] = {
                "agent_name": "generic",
                "output": (
                    "I can help you create diagrams, write documentation, "
                    "explain concepts, review project gaps, or research topics. "
                    "Try something like 'create a flowchart' or 'write a README'."
                ),
                "text": (
                    "I can help you create diagrams, write documentation, "
                    "explain concepts, review project gaps, or research topics. "
                    "Try something like 'create a flowchart' or 'write a README'."
                ),
            }
            return

        if target == RouteTarget.ACTION.value or target == "action":
            # Router decided it's an action — look up action_name from routing
            action_name = routing.get("action_name", "")
            logger.info(f"[dispatch] router selected action: {action_name}")
            action = _action_registry.get(action_name)
            if action is None:
                logger.warning(f"[dispatch] unknown action '{action_name}' from router")
                ctx.state["dispatch_result"] = {
                    "agent_name": "none",
                    "output": f"Unknown action: {action_name}",
                    "text": f"I don't recognize the action '{action_name}'.",
                }
                return
            agent_name = action.default_agent
        else:
            agent_name = target

    # --- Run the agent ---
    logger.info(f"[dispatch] running agent: {agent_name}")
    try:
        agent = registry.get(agent_name)
    except KeyError:
        logger.error(f"[dispatch] agent '{agent_name}' not found in registry")
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

    result = await safe_run_node(ctx, agent, augmented)

    # Extract text and output
    text = ""
    structured_output = None
    if isinstance(result, dict):
        structured_output = result
        # Extract human-readable text from common fields
        text = (
            result.get("explanation", "")
            or result.get("summary", "")
            or result.get("reasoning", "")
            or result.get("text", "")
            or result.get("description", "")
        )
    elif isinstance(result, str):
        text = result
    else:
        text = str(result) if result else ""

    ctx.state["dispatch_result"] = {
        "agent_name": agent_name,
        "output": structured_output or result,
        "text": text,
    }
    logger.info(f"[dispatch] result from {agent_name}: text_len={len(text)} output_type={type(structured_output).__name__}")

    # ----- Persist artifacts to state via StateDelta -------------------------
    # Diagram agents
    if agent_name == "create_diagram" and isinstance(structured_output, dict):
        _persist_diagram_output(ctx, structured_output, user_message)
    elif agent_name == "edit_diagram" and isinstance(structured_output, dict):
        _persist_diagram_edit(ctx, structured_output)
    elif agent_name == "patch_diagram" and isinstance(structured_output, dict):
        _persist_diagram_edit(ctx, structured_output)

    # Markdown agents
    elif agent_name == "create_markdown" and isinstance(structured_output, dict):
        _persist_markdown_output(ctx, structured_output)
    elif agent_name == "edit_markdown" and isinstance(structured_output, dict):
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

    logger.info(f"[reflection] updating memory after agent={agent_name}")

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
    result = await safe_run_node(ctx, reflection_agent, reflection_context)

    if isinstance(result, ReflectionOutput):
        ro = result
        logger.info("[reflection] parsed ReflectionOutput directly")
    elif isinstance(result, dict):
        try:
            ro = ReflectionOutput.model_validate(result)
            logger.info("[reflection] parsed ReflectionOutput from dict")
        except Exception as exc:
            logger.warning(f"[reflection] failed to validate dict as ReflectionOutput: {exc}")
            ro = ReflectionOutput()
    else:
        logger.warning(f"[reflection] unexpected result type {type(result).__name__}")
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
        ref.decide(
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
    logger.info(f"[reflection] memory updated: interactions={ref.total_interactions}")


# ===========================================================================
#  Main Workflow
# ===========================================================================

def build_text_workflow() -> Workflow:
    """Full pipeline: START → router → dispatch → reflection

    Used for free-form text messages where intent classification is needed.
    """
    return Workflow(
        name="outlaww_text_workflow",
        state_schema=StateSchema,
        edges=[
            ("START", router_node),
            (router_node, dispatch_node),
            (dispatch_node, reflection_node),
        ],
    )


def build_action_workflow() -> Workflow:
    """Action pipeline: START → dispatch → reflection

    Used for predefined actions (UI action buttons).
    Skips the router — the action name is already known.
    """
    return Workflow(
        name="outlaww_action_workflow",
        state_schema=StateSchema,
        edges=[
            ("START", dispatch_node),
            (dispatch_node, reflection_node),
        ],
    )


def build_workflow() -> Workflow:
    """Backward-compat alias → build_text_workflow()."""
    return build_text_workflow()
