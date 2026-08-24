"""Session repository - reads and writes ``detection_sessions``/``detection_events`` in Supabase.

The client authenticates with the service-role key, which bypasses Row Level
Security, so every method here scopes explicitly to a ``user_id`` - the same
contract :class:`~app.infra.repositories.user_repository.UserRepository`
follows. This repository never returns - or writes - another user's data
because it never queries without the id, and every inserted row carries
``user_id`` explicitly rather than relying on a default or a trigger.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from postgrest import CountMethod

from app.core.exceptions import DatabaseError
from app.core.logging import get_logger

if TYPE_CHECKING:
    from datetime import datetime
    from uuid import UUID

    from supabase import AsyncClient

logger = get_logger(__name__)

SESSIONS_TABLE = "detection_sessions"
EVENTS_TABLE = "detection_events"


class SessionRepository:
    """Reads monitoring sessions and their detection events from Supabase.

    Constructed with an :class:`AsyncClient` (dependency injection). Stateless
    beyond the injected client - safe to create per request.
    """

    def __init__(self, client: AsyncClient) -> None:
        """Store the injected Supabase client.

        Args:
            client: The service-role Supabase client.
        """
        self._client = client

    async def list_sessions(
        self, user_id: UUID, *, page: int, page_size: int
    ) -> tuple[list[dict[str, Any]], int]:
        """Return one page of a user's sessions, newest first.

        Args:
            user_id: The Supabase user id to scope the query to.
            page: 1-based page number.
            page_size: Rows per page.

        Returns:
            The page of raw rows, and the total count of matching rows.

        Raises:
            DatabaseError: The query failed.
        """
        start = (page - 1) * page_size
        end = start + page_size - 1
        try:
            response = (
                await self._client.table(SESSIONS_TABLE)
                .select("*", count=CountMethod.exact)
                .eq("user_id", str(user_id))
                .order("started_at", desc=True)
                .range(start, end)
                .execute()
            )
        except Exception as error:  # noqa: BLE001 - deliberately narrow the SDK's errors to ours
            logger.error("Session list query failed for user %s: %s", user_id, type(error).__name__)
            msg = "Failed to read sessions."
            raise DatabaseError(msg) from error
        return response.data or [], response.count or 0

    async def get_session(self, user_id: UUID, session_id: UUID) -> dict[str, Any] | None:
        """Return one session owned by ``user_id``, or ``None`` if absent.

        Args:
            user_id: The Supabase user id to scope the query to.
            session_id: The session to look up.

        Returns:
            The raw row, or ``None`` when no matching session exists.

        Raises:
            DatabaseError: The query failed.
        """
        try:
            response = (
                await self._client.table(SESSIONS_TABLE)
                .select("*")
                .eq("user_id", str(user_id))
                .eq("id", str(session_id))
                .maybe_single()
                .execute()
            )
        except Exception as error:  # noqa: BLE001 - deliberately narrow the SDK's errors to ours
            logger.error(
                "Session lookup failed for user %s, session %s: %s",
                user_id,
                session_id,
                type(error).__name__,
            )
            msg = "Failed to read the session."
            raise DatabaseError(msg) from error
        return response.data if response is not None else None

    async def list_events(
        self, user_id: UUID, session_id: UUID, *, page: int, page_size: int
    ) -> tuple[list[dict[str, Any]], int]:
        """Return one page of a session's detection events, oldest first.

        Args:
            user_id: The Supabase user id to scope the query to.
            session_id: The session whose events are requested.
            page: 1-based page number.
            page_size: Rows per page.

        Returns:
            The page of raw rows, and the total count of matching rows.

        Raises:
            DatabaseError: The query failed.
        """
        start = (page - 1) * page_size
        end = start + page_size - 1
        try:
            response = (
                await self._client.table(EVENTS_TABLE)
                .select("*", count=CountMethod.exact)
                .eq("user_id", str(user_id))
                .eq("session_id", str(session_id))
                .order("ts", desc=False)
                .range(start, end)
                .execute()
            )
        except Exception as error:  # noqa: BLE001 - deliberately narrow the SDK's errors to ours
            logger.error(
                "Event list query failed for user %s, session %s: %s",
                user_id,
                session_id,
                type(error).__name__,
            )
            msg = "Failed to read detection events."
            raise DatabaseError(msg) from error
        return response.data or [], response.count or 0

    async def list_recent_sessions(
        self, user_id: UUID, *, since: datetime, until: datetime | None = None
    ) -> list[dict[str, Any]]:
        """Return every session started in ``[since, until)``, unpaginated.

        Used for analytics aggregation, where the caller needs the full set of
        recent rows to bucket client-side rather than one page of them.

        Args:
            user_id: The Supabase user id to scope the query to.
            since: Only sessions started at or after this time are returned.
            until: Exclusive upper bound, or ``None`` for no upper bound - lets
                the analytics service fetch a "previous period" window
                (``[since, until)``) for period-over-period deltas with the
                same method used for the current window.

        Returns:
            Raw rows with the columns session-trend aggregation needs.

        Raises:
            DatabaseError: The query failed.
        """
        try:
            query = (
                self._client.table(SESSIONS_TABLE)
                .select(
                    "started_at, final_state, max_fatigue_score, total_alerts, "
                    "yawn_count, eye_closure_seconds, duration_seconds, total_events"
                )
                .eq("user_id", str(user_id))
                .gte("started_at", since.isoformat())
            )
            if until is not None:
                query = query.lt("started_at", until.isoformat())
            response = await query.execute()
        except Exception as error:  # noqa: BLE001 - deliberately narrow the SDK's errors to ours
            logger.error(
                "Session trend query failed for user %s: %s", user_id, type(error).__name__
            )
            msg = "Failed to read session history."
            raise DatabaseError(msg) from error
        return response.data or []

    async def list_recent_events(
        self, user_id: UUID, *, since: datetime, until: datetime | None = None
    ) -> list[dict[str, Any]]:
        """Return every detection event timestamped in ``[since, until)``, unpaginated.

        Used for event-level analytics aggregation (hour/weekday/EAR-MAR
        bucketing) - the same "fetch everything in the window, bucket
        client-side" shape as :meth:`list_recent_sessions`, over
        ``detection_events`` instead. ``(user_id, ts)`` is already indexed.

        Args:
            user_id: The Supabase user id to scope the query to.
            since: Only events timestamped at or after this time are returned.
            until: Exclusive upper bound, or ``None`` for no upper bound.

        Returns:
            Raw rows with the columns event-trend aggregation needs.

        Raises:
            DatabaseError: The query failed.
        """
        try:
            query = (
                self._client.table(EVENTS_TABLE)
                .select("ts, ear, mar, eye_closed, yawning, state, alert_level, metadata")
                .eq("user_id", str(user_id))
                .gte("ts", since.isoformat())
            )
            if until is not None:
                query = query.lt("ts", until.isoformat())
            response = await query.execute()
        except Exception as error:  # noqa: BLE001 - deliberately narrow the SDK's errors to ours
            logger.error("Event trend query failed for user %s: %s", user_id, type(error).__name__)
            msg = "Failed to read detection events."
            raise DatabaseError(msg) from error
        return response.data or []

    async def delete_session(self, user_id: UUID, session_id: UUID) -> None:
        """Delete one session owned by ``user_id``, and its detection events.

        Events are deleted first, explicitly, rather than relied on to
        cascade - this repository makes no assumption about how the schema's
        foreign key is configured. Both deletes are a no-op if nothing
        matches, so calling this on an already-deleted or foreign session id
        is safe; ownership and existence are the service layer's job.

        Args:
            user_id: The Supabase user id to scope the delete to.
            session_id: The session to delete.

        Raises:
            DatabaseError: Either delete failed.
        """
        try:
            await (
                self._client.table(EVENTS_TABLE)
                .delete()
                .eq("user_id", str(user_id))
                .eq("session_id", str(session_id))
                .execute()
            )
            await (
                self._client.table(SESSIONS_TABLE)
                .delete()
                .eq("user_id", str(user_id))
                .eq("id", str(session_id))
                .execute()
            )
        except Exception as error:  # noqa: BLE001 - deliberately narrow the SDK's errors to ours
            logger.error(
                "Session delete failed for user %s, session %s: %s",
                user_id,
                session_id,
                type(error).__name__,
            )
            msg = "Failed to delete the session."
            raise DatabaseError(msg) from error

    async def create_session(self, user_id: UUID, row: dict[str, Any]) -> dict[str, Any]:
        """Insert one completed session and return it as stored.

        Args:
            user_id: The Supabase user id the session belongs to. Merged into
                ``row`` here rather than trusted from the caller, so a
                session can never be created for anyone but the authenticated
                caller.
            row: The remaining ``detection_sessions`` columns - source,
                status, started_at, ended_at, duration_seconds, media_id,
                final_state, max_fatigue_score, total_events, total_alerts,
                yawn_count, eye_closure_seconds.

        Returns:
            The inserted row, including the generated id and timestamps.

        Raises:
            DatabaseError: The insert failed, or returned no row.
        """
        payload = {**row, "user_id": str(user_id)}
        try:
            response = await self._client.table(SESSIONS_TABLE).insert(payload).execute()
        except Exception as error:  # noqa: BLE001 - deliberately narrow the SDK's errors to ours
            logger.error("Session creation failed for user %s: %s", user_id, type(error).__name__)
            msg = "Failed to save the session."
            raise DatabaseError(msg) from error
        if not response.data:
            msg = "Failed to save the session."
            raise DatabaseError(msg)
        return response.data[0]

    async def insert_events(
        self, user_id: UUID, session_id: UUID, rows: list[dict[str, Any]]
    ) -> None:
        """Bulk-insert a session's detection events.

        Args:
            user_id: The Supabase user id every row is stamped with.
            session_id: The session every row is stamped with.
            rows: Per-event columns - ts, ear, mar, eye_closed, yawning,
                state, fatigue_score, alert_level, metadata. ``user_id`` and
                ``session_id`` are added here, not trusted from the caller.

        Raises:
            DatabaseError: The insert failed.
        """
        if not rows:
            return
        payload = [{**row, "user_id": str(user_id), "session_id": str(session_id)} for row in rows]
        try:
            await self._client.table(EVENTS_TABLE).insert(payload).execute()
        except Exception as error:  # noqa: BLE001 - deliberately narrow the SDK's errors to ours
            logger.error(
                "Event insert failed for user %s, session %s: %s",
                user_id,
                session_id,
                type(error).__name__,
            )
            msg = "Failed to save detection events."
            raise DatabaseError(msg) from error
