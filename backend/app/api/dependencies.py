from __future__ import annotations

from functools import lru_cache

from google.adk.sessions import BaseSessionService, InMemorySessionService

from app.agents.agent_registry import AgentRegistry
from app.agents.agent_runner import AgentRunner, WorkflowRunner


@lru_cache(maxsize=1)
def _get_session_service() -> InMemorySessionService:
    """Singleton session service.

    Swap this function body for a DatabaseSessionService-backed one when
    you need MySQL persistence — the AgentRunner depends only on the
    BaseSessionService interface, so the rest of the code stays unchanged.
    """
    return InMemorySessionService()


@lru_cache(maxsize=1)
def _get_agent_registry() -> AgentRegistry:
    """Singleton agent registry."""
    return AgentRegistry()


def get_session_service() -> BaseSessionService:
    """FastAPI-compatible dependency (sync callable)."""
    return _get_session_service()


def get_agent_registry() -> AgentRegistry:
    """FastAPI-compatible dependency (sync callable)."""
    return _get_agent_registry()


def user_id_for(session_id: str) -> str:
    """Derive a stable internal user_id from a session_id.

    The client never sees or provides user_id — it is derived from
    the session_id so each session maps to exactly one internal user.
    """
    return f"outlaww_{session_id}"


def get_agent_runner(
    session_id: str,
    agent_name: str,
) -> AgentRunner:
    """Build a per-request AgentRunner for direct agent invocation."""
    registry = _get_agent_registry()
    agent = registry.get(agent_name)
    session_service = _get_session_service()
    return AgentRunner(
        session_service=session_service,
        agent=agent,
        user_id=user_id_for(session_id),
        session_id=session_id,
    )


def get_workflow_runner(session_id: str) -> WorkflowRunner:
    """Build a per-request WorkflowRunner for the full pipeline.

    The workflow handles routing -> agent dispatch -> reflection automatically.
    user_id is derived internally from session_id.
    """
    from app.agents.workflow import build_workflow

    workflow = build_workflow()
    session_service = _get_session_service()
    return WorkflowRunner(
        session_service=session_service,
        workflow=workflow,
        user_id=user_id_for(session_id),
        session_id=session_id,
    )
