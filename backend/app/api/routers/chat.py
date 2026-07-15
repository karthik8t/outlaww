from __future__ import annotations

import json
from typing import Any, AsyncGenerator
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, model_validator

from app.agents.action_registry import ActionRegistry
from app.agents.agent_registry import AgentRegistry
from app.agents.agent_runner import WorkflowRunner
from app.api.dependencies import (
    get_agent_registry,
    get_session_service,
    get_workflow_runner,
    user_id_for,
)

router = APIRouter(prefix="/chat", tags=["chat"])


# ---------------------------------------------------------------------------
#  Request / Response models
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    """Unified chat request.

    The user provides:
      - session_id (optional) — if absent a new session is created
      - text OR action — exactly one must be provided

    The client never provides user_id; it is derived internally.
    """
    session_id: str = Field(default_factory=lambda: uuid4().hex)
    text: str | None = None
    action: str | None = None

    @model_validator(mode="after")
    def _check_exactly_one(self) -> "ChatRequest":
        if not self.text and not self.action:
            raise ValueError("Provide either 'text' or 'action'.")
        if self.text and self.action:
            raise ValueError("Provide only one of 'text' or 'action', not both.")
        return self


class ChatResponse(BaseModel):
    session_id: str
    routed_to: str = ""
    action_name: str = ""
    reasoning: str = ""
    events: list[dict[str, Any]] = []
    final_text: str = ""
    structured_output: Any = None
    reflection: Any = None
    diagrams: list[Any] = []
    markdown_docs: list[Any] = []
    active_ids: dict[str, str] = {}


class SessionDetailResponse(BaseModel):
    session_id: str
    event_count: int = 0
    events: list[dict[str, Any]] = []
    state: dict[str, Any] = {}


class DiagramsResponse(BaseModel):
    session_id: str
    diagrams: list[Any] = []
    active_diagram_id: str = ""


class MarkdownDocsResponse(BaseModel):
    session_id: str
    markdown_docs: list[Any] = []
    active_markdown_id: str = ""


class AgentsResponse(BaseModel):
    agents: list[str] = []


class ActionsResponse(BaseModel):
    actions: list[dict[str, Any]] = []


# ---------------------------------------------------------------------------
#  Helpers
# ---------------------------------------------------------------------------

def _event_to_dict(event: Any) -> dict[str, Any]:
    text = ""
    if hasattr(event, "content") and event.content is not None:
        parts = getattr(event.content, "parts", []) or []
        for p in parts:
            text += getattr(p, "text", "") or ""

    return {
        "id": getattr(event, "id", ""),
        "author": getattr(event, "author", ""),
        "text": text,
        "output": getattr(event, "output", None),
        "timestamp": getattr(event, "timestamp", 0.0),
    }


# ---------------------------------------------------------------------------
#  Routes
# ---------------------------------------------------------------------------

@router.post("", response_model=ChatResponse)
async def chat(req: ChatRequest) -> ChatResponse:
    """Send a message or predefined action through the workflow pipeline.

    Free-form text:  START → router → dispatch → reflection
    Predefined action: START → dispatch → reflection (router skipped)

    Session is created automatically if session_id is new.
    """
    session_id = req.session_id
    runner = get_workflow_runner(session_id=session_id, action=req.action)

    message = req.text or ""

    # For actions, inject action_name into state so dispatch_node picks it up
    state_delta = {"action_name": req.action} if req.action else None

    events_out: list[dict[str, Any]] = []
    final_text = ""
    structured_output = None
    routed_to = ""
    action_name = req.action or ""

    async for event in runner.run(message, state_delta=state_delta):
        out = _event_to_dict(event)
        events_out.append(out)
        if out["text"]:
            final_text = out["text"]
        if out["output"] is not None:
            structured_output = out["output"]
        # Detect which agent handled it
        author = event.author or ""
        if author and author not in ("router", "user", "reflection"):
            routed_to = author

    reflection = await runner.get_reflection()
    diagrams = await runner.get_diagrams()
    docs = await runner.get_markdown_docs()
    active = await runner.get_active_ids()

    return ChatResponse(
        session_id=session_id,
        routed_to=routed_to or "generic",
        action_name=action_name,
        events=events_out,
        final_text=final_text,
        structured_output=structured_output,
        reflection=reflection,
        diagrams=diagrams,
        markdown_docs=docs,
        active_ids=active,
    )


@router.get("/sessions/{session_id}", response_model=SessionDetailResponse)
async def get_session_detail(
    session_id: str,
    num_recent: int = 50,
) -> SessionDetailResponse:
    """Get session history and state for a session."""
    session_svc = get_session_service()
    uid = user_id_for(session_id)
    session = await session_svc.get_session(
        app_name="outlaww",
        user_id=uid,
        session_id=session_id,
    )
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    events = list(session.events)[-num_recent:] if session.events else []
    return SessionDetailResponse(
        session_id=session_id,
        event_count=len(events),
        events=[_event_to_dict(e) for e in events],
        state=dict(session.state),
    )


@router.get("/diagrams/{session_id}", response_model=DiagramsResponse)
async def get_diagrams(session_id: str) -> DiagramsResponse:
    """Get all persisted diagrams for a session."""
    runner = get_workflow_runner(session_id=session_id)
    diagrams = await runner.get_diagrams()
    active = await runner.get_active_ids()
    return DiagramsResponse(
        session_id=session_id,
        diagrams=diagrams,
        active_diagram_id=active.get("active_diagram_id", ""),
    )


@router.get("/markdown/{session_id}", response_model=MarkdownDocsResponse)
async def get_markdown_docs(session_id: str) -> MarkdownDocsResponse:
    """Get all persisted markdown docs for a session."""
    runner = get_workflow_runner(session_id=session_id)
    docs = await runner.get_markdown_docs()
    active = await runner.get_active_ids()
    return MarkdownDocsResponse(
        session_id=session_id,
        markdown_docs=docs,
        active_markdown_id=active.get("active_markdown_id", ""),
    )


@router.get("/actions", response_model=ActionsResponse)
async def list_actions() -> ActionsResponse:
    """List all predefined app actions with their descriptions and keywords."""
    reg = ActionRegistry()
    return ActionsResponse(
        actions=[
            {
                "name": a.name,
                "description": a.description,
                "default_agent": a.default_agent,
                "trigger_keywords": a.trigger_keywords[:5],
                "examples": a.examples,
            }
            for a in reg.describe_actions()
        ]
    )


@router.get("/agents", response_model=AgentsResponse)
async def list_agents() -> AgentsResponse:
    """List all available agent names."""
    registry = get_agent_registry()
    return AgentsResponse(agents=registry.list_agents())


# ---------------------------------------------------------------------------
#  SSE streaming endpoint
# ---------------------------------------------------------------------------

def _sse(event_type: str, data: dict) -> str:
    """Format a dict as a Server-Sent Event string."""
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"


async def _stream_gen(
    session_id: str,
    message: str,
    *,
    action: str | None = None,
) -> AsyncGenerator[str, None]:
    """Yield SSE chunks from the routed workflow pipeline."""
    runner = get_workflow_runner(session_id=session_id, action=action)
    state_delta = {"action_name": action} if action else None

    try:
        async for event in runner.run(message, state_delta=state_delta):
            parts = []
            if hasattr(event, "content") and event.content is not None:
                for p in getattr(event.content, "parts", []) or []:
                    txt = getattr(p, "text", "") or ""
                    if txt:
                        parts.append(txt)

            text = "\n".join(parts) if parts else ""
            author = getattr(event, "author", "unknown")
            output = getattr(event, "output", None)

            yield _sse("agent_event", {
                "author": author,
                "text": text,
                "output": output,
            })

        reflection = await runner.get_reflection()
        diagrams = await runner.get_diagrams()
        docs = await runner.get_markdown_docs()
        active = await runner.get_active_ids()

        yield _sse("workflow_complete", {
            "reflection": reflection,
            "diagrams": diagrams,
            "markdown_docs": docs,
            "active_ids": active,
        })

    except Exception as exc:
        yield _sse("error", {"detail": str(exc)})


@router.post("/stream")
async def chat_stream(req: ChatRequest) -> StreamingResponse:
    """Stream the workflow pipeline as Server-Sent Events."""
    message = req.text or ""
    gen = _stream_gen(req.session_id, message, action=req.action)
    return StreamingResponse(gen, media_type="text/event-stream")
