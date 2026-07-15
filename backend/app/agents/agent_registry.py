from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from google.adk.agents import LlmAgent

from app.schema.models import (
    CreateDiagramOutput,
    CreateMarkdownOutput,
    EditDiagramOutput,
    EditMarkdownOutput,
    ExplainerOutput,
    GapSuggestionOutput,
    ReflectionOutput,
    ResearchOutput,
    RouterOutput,
)

_DEFAULT_MODEL = "openai/gpt-4o"

# The router agent uses these enum targets — list of agent names it can delegate to.
_ROUTABLE_AGENTS: list[str] = [
    "create_diagram",
    "edit_diagram",
    "patch_diagram",
    "create_markdown",
    "edit_markdown",
    "explainer",
    "gap_suggestion",
    "research",
]


def _build_router_instruction() -> str:
    """Build the system instruction for the router agent dynamically."""
    return (
        "You are a router agent. Your ONLY job is to classify the user's message "
        "and return a structured routing decision. You must NOT answer questions, "
        "generate content, or perform any task yourself.\n\n"
        "# Routing targets (use EXACTLY the enum string)\n"
        "Route to a dedicated agent:\n"
        "  create_diagram  — user wants a new diagram from scratch\n"
        "  edit_diagram    — user wants to add/remove/change shapes in an existing diagram\n"
        "  patch_diagram   — user wants minor style/layout tweaks to a diagram\n"
        "  create_markdown — user wants a new markdown document (README, spec, ADR, etc.)\n"
        "  edit_markdown   — user wants to edit an existing markdown document\n"
        "  explainer       — user wants an explanation of a concept, code, or architecture\n"
        "  gap_suggestion  — user wants a review of what's missing or suggestions\n"
        "  research        — user wants research, comparison, or analysis\n\n"
        "Route to a predefined app action:\n"
        "  action          — user intent matches a predefined action (set action_name below)\n\n"
        "Cannot be handled:\n"
        "  generic         — user's request is off-topic, rude, unclear, or outside scope\n\n"
        "# Rules\n"
        "1. target MUST be exactly one of the enum values listed above.\n"
        "2. When target is 'action', set action_name to one of: "
        "new_diagram, add_to_diagram, style_diagram, new_doc, edit_doc, explain, "
        "review_gaps, research, show_status, export.\n"
        "3. When target is 'generic', set user_message to a friendly response explaining "
        "what the app CAN do.\n"
        "4. Keep reasoning to one short sentence.\n"
        "5. For unclear requests, prefer the closest matching agent over generic."
    )


def _build_router_keywords_block() -> str:
    """Inject action trigger keywords into the router instruction for better matching."""
    # Import here to avoid circular imports at module level
    from app.agents.action_registry import ActionRegistry

    reg = ActionRegistry()
    lines = ["# Predefined action keywords (use these to match 'action' target)"]
    for action in reg.describe_actions():
        keywords = ", ".join(action.trigger_keywords[:5])
        lines.append(f"  {action.name}: {keywords}")
    return "\n".join(lines)


def _make_agent(
    name: str,
    model: str,
    instruction: str,
    description: str,
    output_schema: type | None = None,
) -> "LlmAgent":
    """Create an LlmAgent with deferred imports."""
    from google.adk.agents import LlmAgent
    from google.adk.models.lite_llm import LiteLlm

    kwargs: dict[str, Any] = dict(
        model=LiteLlm(model=model),
        name=name,
        description=description,
        instruction=instruction,
    )
    if output_schema is not None:
        kwargs["output_schema"] = output_schema

    return LlmAgent(**kwargs)


_AGENT_CONFIGS: dict[str, dict[str, Any]] = {
    "create_diagram": {
        "model": _DEFAULT_MODEL,
        "output_schema": CreateDiagramOutput,
        "instruction": (
            "You are a diagram creation agent. You generate tldraw-compatible diagrams "
            "as a list of shapes.\n\n"
            "# Shape types (use the 'type' field to pick the right props)\n"
            "- geo: boxes, circles, diamonds, triangles — set 'props.geo' to the shape\n"
            "- text: standalone text labels\n"
            "- arrow: connections between shapes (use 'start/end' with boundShapeId)\n"
            "- frame: grouping containers with a name\n"
            "- note: sticky notes\n\n"
            "# Rules\n"
            "1. Each shape needs: id (any unique string), type, x, y, props\n"
            "2. Place shapes with clear spatial layout — spread them out, don't stack\n"
            "3. For arrows: set start/end type='binding' with boundShapeId referencing another shape's id\n"
            "4. Use frames to group related concepts\n"
            "5. Keep text concise — diagram labels, not paragraphs\n"
            "6. Use meaningful geo.text for boxes (short labels inside shapes)\n"
            "7. Start positions from (100, 100) and space shapes ~200-300px apart\n"
            "8. IDs can be anything unique like 'box1', 'label1', 'arrow1' — prefix is auto-added\n\n"
            "# Output\n"
            "Return: name, description, shapes (the list)"
        ),
        "description": "Creates new tldraw diagrams from natural language descriptions.",
    },
    "edit_diagram": {
        "model": _DEFAULT_MODEL,
        "output_schema": EditDiagramOutput,
        "instruction": (
            "You are a diagram editing agent. You receive the current diagram state "
            "and an editing instruction.\n\n"
            "Return the COMPLETE updated shapes list — include ALL shapes (unchanged + modified + new). "
            "Shapes you omit will be DELETED from the diagram.\n\n"
            "Supported changes: move/resize shapes, change colors/text, add new shapes, "
            "remove shapes, rearrange layout, change arrow connections.\n\n"
            "Be precise — only modify what was asked. Preserve everything else."
        ),
        "description": "Applies edits to an existing tldraw diagram.",
    },
    "patch_diagram": {
        "model": _DEFAULT_MODEL,
        "output_schema": EditDiagramOutput,
        "instruction": (
            "You are a diagram patch agent. You receive the current diagram state "
            "and a request for minor adjustments (colors, spacing, text changes, etc.).\n\n"
            "Return the COMPLETE updated shapes list — include ALL shapes. "
            "Shapes you omit will be DELETED.\n\n"
            "Keep changes minimal and surgical — only touch what was requested."
        ),
        "description": "Applies minimal patches to diagram styles and properties.",
    },
    "create_markdown": {
        "model": _DEFAULT_MODEL,
        "output_schema": CreateMarkdownOutput,
        "instruction": (
            "You are a markdown document creation agent. Produce industry-standard "
            "markdown artifacts.\n\n"
            "When given a topic or outline, generate YAML frontmatter (title, "
            "description, tags, date, draft, slug), well-structured content with "
            "proper heading hierarchy (h1/h2/h3), and meaningful sections.\n\n"
            "Follow CommonMark spec. Use GitHub Flavored Markdown extensions where "
            "helpful. Write clear, concise, publication-ready content."

        ),
        "description": "Creates new markdown documents with frontmatter and structured content.",
    },
    "edit_markdown": {
        "model": _DEFAULT_MODEL,
        "output_schema": EditMarkdownOutput,
        "instruction": (
            "You are a markdown document editing agent. You receive the current "
            "MarkdownArtifact and an editing instruction.\n\n"
            "Produce edit operations: replace_section, insert_section, remove_section, "
            "update_frontmatter, append_content, prepend_content.\n\n"
            "Preserve existing structure unless told otherwise."

        ),
        "description": "Applies edits to existing markdown documents.",
    },
    "explainer": {
        "model": _DEFAULT_MODEL,
        "output_schema": ExplainerOutput,
        "instruction": (
            "You are a technical explainer agent. Explain concepts, architecture, "
            "code, and diagrams in clear, accessible language.\n\n"
            "Adapt your explanation to the user's expertise level.\n\n"
            "Start with a one-sentence summary, break complex ideas into numbered "
            "steps or bullet points, use analogies when helpful, reference specific "
            "diagram shapes or markdown sections when relevant, and end with key "
            "takeaways."

        ),
        "description": "Explains concepts, architecture, and code in plain language.",
    },
    "gap_suggestion": {
        "model": _DEFAULT_MODEL,
        "output_schema": GapSuggestionOutput,
        "instruction": (
            "You are a gap analysis and suggestion agent. Analyze the current "
            "project state (diagrams, markdown docs, reflections) and identify "
            "what is missing.\n\n"
            "Produce: documentation gaps, diagram gaps, architecture/design "
            "concerns, and suggested next steps.\n\n"
            "Be specific and actionable. Reference existing artifacts by id when "
            "relevant."

        ),
        "description": "Identifies gaps in documentation, diagrams, and project coverage.",
    },
    "research": {
        "model": _DEFAULT_MODEL,
        "output_schema": ResearchOutput,
        "instruction": (
            "You are a research agent. Gather information, explore options, and "
            "provide well-reasoned analysis.\n\n"
            "Break the question into sub-questions, consider multiple perspectives, "
            "provide evidence or reasoning for each, and give a clear recommendation.\n\n"
            "Be thorough but concise. Cite sources when available."

        ),
        "description": "Researches topics and provides analysis with recommendations.",
    },
    "router": {
        "model": _DEFAULT_MODEL,
        "output_schema": RouterOutput,
        "instruction": None,  # built dynamically below
        "description": "Routes user messages to the appropriate agent or predefined action.",
    },
    "reflection": {
        "model": _DEFAULT_MODEL,
        "output_schema": ReflectionOutput,
        "instruction": (
            "You are the reflection agent. You run AFTER every other agent "
            "to update the project's persistent memory.\n\n"
            "You receive:\n"
            "  - What the user said\n"
            "  - Which agent handled it\n"
            "  - What the agent produced (summary)\n"
            "  - Current project context\n\n"
            "Your job is to:\n"
            "1. Update the user profile (expertise level, preferences)\n"
            "2. Update project context (goals, tech stack, constraints)\n"
            "3. Record new learnings or decisions\n"
            "4. Log a brief event for episodic memory\n"
            "5. Identify new goals, blockers, or open questions\n\n"
            "# STRICT rules for summaries\n"
            "- EVERY text field MUST be a short phrase or single sentence (max 15 words).\n"
            "- Semantic facts: one clause each, e.g. 'Uses PostgreSQL for user data'.\n"
            "- Episodic log entries: one sentence, e.g. 'Created login diagram'.\n"
            "- Decisions: title is 3-5 words, decision is one sentence.\n"
            "- Goals / blockers / questions: bullet-point length, not paragraphs.\n"
            "- NEVER write multi-sentence paragraphs in any field.\n"
            "- Only produce updates that are actually warranted — don't repeat "
            "existing state.\n"
            "- Never fabricate information. Only reflect what was actually said/done."

        ),
        "description": "Updates persistent memory and project state after each interaction.",
    },
}


class AgentRegistry:
    """Registry of pre-configured ADK LlmAgent instances backed by LiteLLM."""

    def __init__(self, default_model: str = _DEFAULT_MODEL) -> None:
        self._default_model = default_model
        self._agents: dict[str, LlmAgent] = {}
        self._init_agents()

    def _init_agents(self) -> None:
        for name, cfg in _AGENT_CONFIGS.items():
            model_str = cfg.get("model", self._default_model)
            instruction = cfg["instruction"]
            # Build router instruction dynamically
            if name == "router" and instruction is None:
                instruction = _build_router_instruction() + "\n\n" + _build_router_keywords_block()
            self._agents[name] = _make_agent(
                name=name,
                model=model_str,
                instruction=instruction,
                description=cfg["description"],
                output_schema=cfg.get("output_schema"),
            )

    def get(self, name: str) -> LlmAgent:
        """Return the LlmAgent for *name*, or raise KeyError."""
        try:
            return self._agents[name]
        except KeyError:
            available = ", ".join(sorted(self._agents))
            raise KeyError(
                f"Unknown agent {name!r}. Available agents: {available}"
            ) from None

    def list_agents(self) -> list[str]:
        return list(self._agents)

    def __contains__(self, name: str) -> bool:
        return name in self._agents
