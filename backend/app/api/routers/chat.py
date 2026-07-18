from __future__ import annotations

import asyncio
import base64
import json
import logging
import time
from typing import Any, AsyncGenerator, Literal, Optional
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
from app.schema.reactflow_models import Diagram
from app.schema.reactflow_output import ReactFlowDiagramOutput
from app.schema.models import DecodedEvent, decode_adk_event

router = APIRouter(prefix="/chat", tags=["chat"])
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
#  Helper: Diagram → ReactFlowDiagramOutput
# ---------------------------------------------------------------------------

def _diagram_to_reactflow(diagram_data: dict[str, Any]) -> ReactFlowDiagramOutput | None:
    """Convert a stored Diagram dict to typed ReactFlowDiagramOutput."""
    from app.schema.reactflow_transformer import extract_reactflow_from_diagram

    return extract_reactflow_from_diagram(diagram_data)


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
    """Consolidated chat response.

    Raw ADK events stay in the backend session. The frontend receives
    a clean turn with the agents involved, the main response text
    (interaction_summary from reflection), and any structured outputs.
    """
    session_id: str
    routed_to: str = ""
    action_name: str = ""
    agents_involved: list[str] = []
    final_text: str = ""
    dispatch_text: str = ""
    structured_outputs: list[dict[str, Any]] = []
    reflection: dict[str, Any] | None = None
    diagrams: list[dict[str, Any]] = []
    rf_data: dict[str, ReactFlowDiagramOutput] = Field(default_factory=dict, description="diagram_id -> post-processed ReactFlowDiagramOutput")
    markdown_docs: list[dict[str, Any]] = []
    active_ids: dict[str, str] = {}


class SessionDetailResponse(BaseModel):
    session_id: str
    event_count: int = 0
    events: list[DecodedEvent] = []
    state: dict[str, Any] = {}


class SessionListItem(BaseModel):
    session_id: str
    user_id: str = ""
    last_update_time: float = 0.0


class SessionsListResponse(BaseModel):
    sessions: list[SessionListItem] = []


class DiagramsResponse(BaseModel):
    session_id: str
    diagrams: list[Any] = []
    rf_data: dict[str, ReactFlowDiagramOutput] = Field(default_factory=dict)
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

def _event_to_dto(event: Any) -> DecodedEvent:
    """Convert a raw ADK Event into a typed DecodedEvent DTO."""
    return decode_adk_event(event)


# ---------------------------------------------------------------------------
#  Routes
# ---------------------------------------------------------------------------

@router.post("", response_model=ChatResponse)
async def chat(req: ChatRequest) -> ChatResponse:
    """Send a message or predefined action through the workflow pipeline.

    Free-form text:  START → router → dispatch → reflection
    Predefined action: START → dispatch → reflection (router skipped)

    Session is created automatically if session_id is new.

    The response is a consolidated turn — raw events live in the backend session.
    The frontend receives agents_involved, the interaction_summary as final_text,
    and structured_outputs for rendering artifacts.
    """
    session_id = req.session_id
    pipeline = "action" if req.action else "text"
    logger.info(f"[chat] {pipeline} request session={session_id[:12]} action={req.action or 'none'}")

    runner = get_workflow_runner(session_id=session_id, action=req.action)
    message = req.text or ""

    state_delta = {"action_name": req.action} if req.action else None

    # Track agents and structured outputs as events stream by
    _system_authors = {"user", "router", "reflection", "outlaww_text_workflow", "outlaww_action_workflow"}
    agents_involved: list[str] = []
    structured_outputs: list[dict[str, Any]] = []

    start = time.perf_counter()

    try:
        async for event in runner.run(message, state_delta=state_delta):
            dto = _event_to_dto(event)
            if dto.author and dto.author not in _system_authors:
                if dto.author not in agents_involved:
                    agents_involved.append(dto.author)
                if dto.agent_output and dto.author in dto.agent_output:
                    structured_outputs.append({
                        "agent": dto.author,
                        "output": dto.agent_output[dto.author],
                    })
    except Exception as exc:
        elapsed = (time.perf_counter() - start) * 1000
        logger.error(f"[chat] {pipeline} failed after {elapsed:.0f}ms: {exc}")
        raise

    elapsed = (time.perf_counter() - start) * 1000
    logger.info(f"[chat] {pipeline} done in {elapsed:.0f}ms agents={agents_involved}")

    dispatch_result = await runner.get_dispatch_result()
    reflection: dict[str, Any] | None = await runner.get_reflection()
    diagrams: list[dict[str, Any]] = await runner.get_diagrams()
    docs: list[dict[str, Any]] = await runner.get_markdown_docs()
    active: dict[str, str] = await runner.get_active_ids()

    # Primary response text = interaction_summary from reflection
    # dispatch_text = full dispatch agent text (shown in collapsible if different)
    final_text = ""
    dispatch_text = dispatch_result.get("text", "") if dispatch_result else ""
    if reflection and reflection.get("interaction_summary"):
        final_text = reflection["interaction_summary"]
    if not final_text:
        final_text = dispatch_text

    routed_to = dispatch_result.get("agent_name", "") if dispatch_result else (agents_involved[0] if agents_involved else "")

    # Build typed ReactFlowDiagramOutput for each diagram
    rf_data: dict[str, ReactFlowDiagramOutput] = {}
    for d in diagrams:
        if isinstance(d, dict):
            result = _diagram_to_reactflow(d)
            if result is not None:
                rf_data[d["id"]] = result

    return ChatResponse(
        session_id=session_id,
        routed_to=routed_to or "generic",
        action_name=req.action or "",
        agents_involved=agents_involved,
        final_text=final_text,
        dispatch_text=dispatch_text,
        structured_outputs=structured_outputs,
        reflection=reflection,
        diagrams=diagrams,
        rf_data=rf_data,
        markdown_docs=docs,
        active_ids=active,
    )


@router.get("/sessions", response_model=SessionsListResponse)
async def list_sessions() -> SessionsListResponse:
    """List all sessions for the outlaww app."""
    session_svc = get_session_service()
    resp = await session_svc.list_sessions(app_name="outlaww")
    return SessionsListResponse(
        sessions=[
            SessionListItem(
                session_id=s.id,
                user_id=s.user_id,
                last_update_time=s.last_update_time,
            )
            for s in resp.sessions
        ]
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
        return SessionDetailResponse(session_id=session_id, event_count=0, events=[], state={})

    raw_events = list(session.events)[-num_recent:] if session.events else []
    return SessionDetailResponse(
        session_id=session_id,
        event_count=len(raw_events),
        events=[_event_to_dto(e) for e in raw_events],
        state=dict(session.state),
    )


@router.get("/diagrams/{session_id}", response_model=DiagramsResponse)
async def get_diagrams(session_id: str) -> DiagramsResponse:
    """Get all persisted diagrams for a session."""
    runner = get_workflow_runner(session_id=session_id)
    diagrams = await runner.get_diagrams()
    active = await runner.get_active_ids()

    # Build typed ReactFlowDiagramOutput for each diagram
    rf_data: dict[str, ReactFlowDiagramOutput] = {}
    for d in diagrams:
        if isinstance(d, dict):
            result = _diagram_to_reactflow(d)
            if result is not None:
                rf_data[d["id"]] = result

    return DiagramsResponse(
        session_id=session_id,
        diagrams=diagrams,
        rf_data=rf_data,
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
#  Session management
# ---------------------------------------------------------------------------


class CreateSessionResponse(BaseModel):
    session_id: str


@router.post("/sessions", response_model=CreateSessionResponse, status_code=201)
async def create_session() -> CreateSessionResponse:
    """Create a new blank session and return its ID."""
    from uuid import uuid4

    session_id = uuid4().hex
    session_svc = get_session_service()
    uid = user_id_for(session_id)
    await session_svc.create_session(
        app_name="outlaww",
        user_id=uid,
        session_id=session_id,
    )
    return CreateSessionResponse(session_id=session_id)


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session_route(session_id: str):
    """Delete a session and all its data."""
    session_svc = get_session_service()
    uid = user_id_for(session_id)
    await session_svc.delete_session(
        app_name="outlaww",
        user_id=uid,
        session_id=session_id,
    )


# ---------------------------------------------------------------------------
#  SSE streaming endpoint
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
    pipeline = "action" if action else "text"
    logger.info(f"[stream] {pipeline} request session={session_id[:12]}")

    runner = get_workflow_runner(session_id=session_id, action=action)
    state_delta = {"action_name": action} if action else None

    try:
        async for event in runner.run(message, state_delta=state_delta):
            decoded = decode_adk_event(event)
            yield _sse("agent_event", decoded.model_dump())

        reflection = await runner.get_reflection()
        dispatch_result = await runner.get_dispatch_result()
        diagrams = await runner.get_diagrams()
        docs = await runner.get_markdown_docs()
        active = await runner.get_active_ids()

        # Build React Flow data for each diagram
        rf_data: dict[str, Any] = {}
        for d in diagrams:
            if isinstance(d, dict):
                result = _diagram_to_reactflow(d)
                if result:
                    rf_data[d["id"]] = result

        yield _sse("workflow_complete", {
            "dispatch_result": dispatch_result,
            "reflection": reflection,
            "diagrams": diagrams,
            "rf_data": rf_data,
            "markdown_docs": docs,
            "active_ids": active,
        })

        logger.info(f"[stream] {pipeline} done")

    except Exception as exc:
        logger.error(f"[stream] {pipeline} failed: {exc}")
        yield _sse("error", {"detail": str(exc)})


@router.post("/stream")
async def chat_stream(req: ChatRequest) -> StreamingResponse:
    """Stream the workflow pipeline as Server-Sent Events."""
    message = req.text or ""
    gen = _stream_gen(req.session_id, message, action=req.action)
    return StreamingResponse(gen, media_type="text/event-stream")


# ---------------------------------------------------------------------------
#  React Flow Transform Endpoint
# ---------------------------------------------------------------------------

class ReactFlowTransformRequest(BaseModel):
    """Request to transform Diagram (clean LLM schema) to React Flow format."""
    diagram: Diagram


@router.post("/transform/reactflow", response_model=ReactFlowDiagramOutput)
async def transform_to_reactflow(req: ReactFlowTransformRequest) -> ReactFlowDiagramOutput:
    """Transform clean LLM Diagram to typed ReactFlowDiagramOutput.
    
    Post-processes the LLM-generated diagram schema (computing handles,
    border styles, animated flags, camelCase data) and returns the
    typed model expected by @xyflow/react frontend.
    """
    from app.schema.reactflow_transformer import validate_and_transform
    
    try:
        return validate_and_transform(req.diagram)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"[transform/reactflow] failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
#  React Flow from Diagram Endpoint (for frontend to fetch RF data by diagram_id)
# ---------------------------------------------------------------------------

class ReactFlowFromDiagramRequest(BaseModel):
    session_id: str
    diagram_id: str


@router.post("/transform/reactflow-from-diagram", response_model=ReactFlowDiagramOutput)
async def transform_reactflow_from_diagram(req: ReactFlowFromDiagramRequest) -> ReactFlowDiagramOutput:
    """Extract React Flow data from a stored diagram by diagram_id.

    Frontend calls this to get the React Flow nodes/edges/metadata
    for a specific diagram in a session.
    """
    runner = get_workflow_runner(session_id=req.session_id)
    diagrams = await runner.get_diagrams()

    for d in diagrams:
        if isinstance(d, dict) and d.get("id") == req.diagram_id:
            result = _diagram_to_reactflow(d)
            if result:
                return result
            raise HTTPException(status_code=404, detail=f"Diagram '{req.diagram_id}' has no React Flow data.")

    raise HTTPException(status_code=404, detail=f"Diagram '{req.diagram_id}' not found in session '{req.session_id}'.")
