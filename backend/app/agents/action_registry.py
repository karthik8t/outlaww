from __future__ import annotations

from typing import Any

from app.schema.models import AppAction


_ACTIONS: dict[str, AppAction] = {
    "new_diagram": AppAction(
        name="new_diagram",
        description="Create a brand new diagram from a description.",
        default_agent="create_diagram",
        trigger_keywords=[
            "create diagram", "draw diagram", "new diagram", "make a diagram",
            "diagram of", "create a flowchart", "draw a flowchart",
            "create a chart", "visualize", "architecture diagram",
        ],
        examples=[
            "Create a diagram of a microservices architecture",
            "Draw a flowchart for user login process",
            "Make an ERD for an e-commerce database",
        ],
    ),
    "add_to_diagram": AppAction(
        name="add_to_diagram",
        description="Add shapes or modify an existing diagram.",
        default_agent="edit_diagram",
        trigger_keywords=[
            "add to diagram", "add a shape", "add a box", "add arrow",
            "insert into diagram", "modify diagram", "change diagram",
        ],
        examples=[
            "Add a database node to the architecture diagram",
            "Insert a new step in the flowchart",
        ],
    ),
    "style_diagram": AppAction(
        name="style_diagram",
        description="Change styles, colors, or layout of diagram elements.",
        default_agent="patch_diagram",
        trigger_keywords=[
            "change color", "make it bigger", "resize", "restyle",
            "move shape", "change style", "make it look like",
        ],
        examples=[
            "Make all rectangles blue",
            "Resize the main box to be wider",
        ],
    ),
    "new_doc": AppAction(
        name="new_doc",
        description="Create a new document (README, spec, ADR, etc.).",
        default_agent="create_document",
        trigger_keywords=[
            "create document", "write a doc", "new document", "create readme",
            "write readme", "create a spec", "write adr", "create adr",
            "write documentation", "new page", "write a readme", "make a readme",
            "create a document", "write me a", "write the", "create the",
        ],
        examples=[
            "Create a README for this project",
            "Write an ADR for the database choice",
            "Create API documentation",
        ],
    ),
    "edit_doc": AppAction(
        name="edit_doc",
        description="Edit or update an existing document.",
        default_agent="edit_document",
        trigger_keywords=[
            "edit document", "update readme", "modify doc", "change doc",
            "revise", "add section to", "remove section from", "update doc",
        ],
        examples=[
            "Add a FAQ section to the README",
            "Update the intro paragraph",
        ],
    ),
    "explain": AppAction(
        name="explain",
        description="Explain a concept, diagram, code snippet, or architecture.",
        default_agent="explainer",
        trigger_keywords=[
            "explain", "what is", "how does", "tell me about",
            "describe", "walk me through", "what does this mean",
            "what do you mean", "how do i", "how to",
        ],
        examples=[
            "Explain the authentication flow in the diagram",
            "What does this architecture pattern mean?",
        ],
    ),
    "review_gaps": AppAction(
        name="review_gaps",
        description="Review the project for missing documentation or diagrams.",
        default_agent="gap_suggestion",
        trigger_keywords=[
            "what's missing", "review project", "gaps", "what do i need",
            "suggest", "what should i add", "coverage", "incomplete",
            "am i missing", "missing", "incomplete", "missing anything",
        ],
        examples=[
            "What documentation am I missing?",
            "Review my project for gaps",
        ],
    ),
    "research": AppAction(
        name="research",
        description="Research a topic, compare options, or analyze a question.",
        default_agent="research",
        trigger_keywords=[
            "research", "compare", "analyze", "evaluate", "pros and cons",
            "which is better", "explore options", "investigate",
            "compare vs", "versus", "tradeoffs",
        ],
        examples=[
            "Research the best database for this use case",
            "Compare PostgreSQL vs MySQL for this project",
        ],
    ),
    "show_status": AppAction(
        name="show_status",
        description="Show the current project status, artifacts, and reflections.",
        default_agent="explainer",
        trigger_keywords=[
            "show status", "project status", "what do i have so far",
            "current state", "summarize project", "what's the current",
            "current project", "where are we", "progress",
        ],
        examples=[
            "Show me the current project status",
            "What do I have so far?",
        ],
    ),
    "export": AppAction(
        name="export",
        description="Export diagrams or documents in a specific format.",
        default_agent="explainer",
        trigger_keywords=[
            "export", "download", "save as", "output as",
            "generate png", "generate svg", "export pdf",
        ],
        examples=[
            "Export this diagram as SVG",
            "Generate a PDF of the documentation",
        ],
    ),
}


class ActionRegistry:
    """Registry of predefined app actions for common user intents."""

    def __init__(self) -> None:
        self._actions: dict[str, AppAction] = dict(_ACTIONS)

    def get(self, name: str) -> AppAction | None:
        return self._actions.get(name)

    def list_actions(self) -> list[str]:
        return sorted(self._actions)

    def describe_actions(self) -> list[AppAction]:
        return list(self._actions.values())

    def match_by_keywords(self, text: str) -> AppAction | None:
        """Try to match user input against trigger keywords."""
        lower = text.lower()
        best: AppAction | None = None
        best_score = 0
        for action in self._actions.values():
            score = 0
            for kw in action.trigger_keywords:
                if kw in lower:
                    score += len(kw)
            if score > best_score:
                best_score = score
                best = action
        return best if best_score > 0 else None

    def all_keywords_flat(self) -> dict[str, list[str]]:
        """Return a mapping of action_name -> trigger_keywords for the router."""
        return {a.name: a.trigger_keywords for a in self._actions.values()}

    def __contains__(self, name: str) -> bool:
        return name in self._actions
