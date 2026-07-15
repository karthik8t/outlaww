from __future__ import annotations

from typing import Any, AsyncGenerator

from google.adk.agents import LlmAgent
from google.adk.events import Event
from google.adk.runners import Runner
from google.adk.sessions import BaseSessionService, Session
from google.adk.workflow import Workflow
from google.genai import types


_APP_NAME = "outlaww"


class AgentRunner:
    """Per-request runner for direct agent invocation.

    Used by the POST /chat endpoint when the caller knows which agent
    to target. For auto-routed requests, use WorkflowRunner instead.
    """

    def __init__(
        self,
        session_service: BaseSessionService,
        agent: LlmAgent,
        user_id: str,
        session_id: str,
    ) -> None:
        self._session_service = session_service
        self._agent = agent
        self._user_id = user_id
        self._session_id = session_id
        self._runner: Runner | None = None

    async def _ensure_session(self) -> Session:
        """Return existing session or create a new one."""
        session = await self._session_service.get_session(
            app_name=_APP_NAME,
            user_id=self._user_id,
            session_id=self._session_id,
        )
        if session is None:
            session = await self._session_service.create_session(
                app_name=_APP_NAME,
                user_id=self._user_id,
                session_id=self._session_id,
            )
        return session

    def _get_runner(self) -> Runner:
        if self._runner is None:
            self._runner = Runner(
                app_name=_APP_NAME,
                agent=self._agent,
                session_service=self._session_service,
            )
        return self._runner

    async def send(self, message: str) -> AsyncGenerator[Event, None]:
        """Send a user message and yield all agent events."""
        await self._ensure_session()
        runner = self._get_runner()

        content = types.Content(
            role="user",
            parts=[types.Part.from_text(text=message)],
        )

        async for event in runner.run_async(
            user_id=self._user_id,
            session_id=self._session_id,
            new_message=content,
        ):
            yield event

    async def get_session(self) -> Session | None:
        return await self._session_service.get_session(
            app_name=_APP_NAME,
            user_id=self._user_id,
            session_id=self._session_id,
        )

    async def list_events(self, num_recent: int = 50) -> list[Event]:
        session = await self.get_session()
        if session is None:
            return []
        return session.events[-num_recent:]


# ===========================================================================
#  WorkflowRunner – dynamic workflow with router + reflection
# ===========================================================================

class WorkflowRunner:
    """Runs the full outlaww workflow: router → dispatch → reflection.

    Each instance is per-request and shares the session service singleton.
    The Workflow (with @node nodes) handles all internal routing, agent
    dispatch, and post-interaction reflection automatically.
    """

    def __init__(
        self,
        session_service: BaseSessionService,
        workflow: Workflow,
        user_id: str,
        session_id: str,
    ) -> None:
        self._session_service = session_service
        self._workflow = workflow
        self._user_id = user_id
        self._session_id = session_id
        self._runner: Runner | None = None

    async def _ensure_session(self) -> Session:
        """Return existing session or create a new one."""
        session = await self._session_service.get_session(
            app_name=_APP_NAME,
            user_id=self._user_id,
            session_id=self._session_id,
        )
        if session is None:
            session = await self._session_service.create_session(
                app_name=_APP_NAME,
                user_id=self._user_id,
                session_id=self._session_id,
            )
        return session

    def _get_runner(self) -> Runner:
        if self._runner is None:
            self._runner = Runner(
                app_name=_APP_NAME,
                agent=self._workflow,
                session_service=self._session_service,
            )
        return self._runner

    async def run(self, message: str) -> AsyncGenerator[Event, None]:
        """Send a user message through the full workflow pipeline.

        Yields events from every node: router, dispatch, reflection.
        The user message is injected into state via state_delta so it
        is properly persisted through ADK's append_event flow.
        """
        await self._ensure_session()
        runner = self._get_runner()

        content = types.Content(
            role="user",
            parts=[types.Part.from_text(text=message)],
        )

        async for event in runner.run_async(
            user_id=self._user_id,
            session_id=self._session_id,
            new_message=content,
            state_delta={"user_message": message},
        ):
            yield event

    async def get_session(self) -> Session | None:
        return await self._session_service.get_session(
            app_name=_APP_NAME,
            user_id=self._user_id,
            session_id=self._session_id,
        )

    async def list_events(self, num_recent: int = 50) -> list[Event]:
        session = await self.get_session()
        if session is None:
            return []
        return session.events[-num_recent:]

    async def get_reflection(self) -> dict[str, Any] | None:
        """Return the current reflection state from the session."""
        session = await self.get_session()
        if session is None:
            return None
        return session.state.get("reflection")

    async def get_diagrams(self) -> list[dict[str, Any]]:
        """Return all persisted diagrams from the session."""
        session = await self.get_session()
        if session is None:
            return []
        return session.state.get("diagrams", [])

    async def get_markdown_docs(self) -> list[dict[str, Any]]:
        """Return all persisted markdown docs from the session."""
        session = await self.get_session()
        if session is None:
            return []
        return session.state.get("markdown_docs", [])

    async def get_active_ids(self) -> dict[str, str]:
        """Return active artifact IDs from the session."""
        session = await self.get_session()
        if session is None:
            return {}
        return session.state.get("active_ids", {})

    async def get_full_state(self) -> dict[str, Any]:
        """Return all state keys for debugging / inspection."""
        session = await self.get_session()
        if session is None:
            return {}
        return dict(session.state)
