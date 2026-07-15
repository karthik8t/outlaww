from __future__ import annotations

from functools import lru_cache

from google.adk.sessions import BaseSessionService, DatabaseSessionService

from app.agents.agent_registry import AgentRegistry
from app.agents.agent_runner import AgentRunner, WorkflowRunner


@lru_cache(maxsize=1)
def _get_session_service() -> DatabaseSessionService:
    """Singleton session service backed by SQLite for persistence."""
    return DatabaseSessionService(db_url="sqlite+aiosqlite:///./my_agent_data.db")


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


def get_workflow_runner(
    session_id: str,
    *,
    action: str | None = None,
) -> WorkflowRunner:
    """Build a per-request WorkflowRunner.

    Args:
        session_id: The project/session ID.
        action: If set, uses the action workflow (skips router).
                If None, uses the full text workflow (router → dispatch → reflection).
    """
    from app.agents.workflow import build_action_workflow, build_text_workflow

    if action:
        workflow = build_action_workflow()
    else:
        workflow = build_text_workflow()

    session_service = _get_session_service()
    return WorkflowRunner(
        session_service=session_service,
        workflow=workflow,
        user_id=user_id_for(session_id),
        session_id=session_id,
    )
