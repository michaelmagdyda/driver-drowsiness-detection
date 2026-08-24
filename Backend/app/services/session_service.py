"""Session service - history and session-detail use cases (Phase F/H).

Orchestrates :class:`~app.infra.repositories.session_repository.SessionRepository`
and translates raw rows into the wire schemas in :mod:`app.schemas.sessions`.
Every method takes the caller's :class:`~app.schemas.auth.AuthenticatedUser`
and scopes to it - a session id belonging to another user surfaces the same
404 as one that does not exist at all, never a distinguishable "forbidden".
"""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from app.core.exceptions import SessionNotFoundError
from app.infra.storage import delete_object
from app.schemas.common import PaginatedData, PaginationMeta
from app.schemas.sessions import DetectionEvent, SessionDetail, SessionSummary

if TYPE_CHECKING:
    from supabase import AsyncClient

    from app.infra.repositories.media_repository import MediaRepository
    from app.infra.repositories.session_repository import SessionRepository
    from app.schemas.auth import AuthenticatedUser


class SessionService:
    """Business logic for listing, inspecting and deleting monitoring sessions.

    Args:
        repository: Reads session/event rows from Supabase.
        media_repository: Resolves a session's linked recording, for
            :meth:`get_session`. Optional so callers that only ever list
            sessions (never fetch one detail) are not forced to construct
            it - ``get_session`` degrades to omitting ``media`` rather than
            failing when it is absent.
        storage_client: The service-role Supabase client, for the Storage
            delete in :meth:`delete_session`. Only required by callers that
            delete sessions - listing and reading never touch Storage.
    """

    def __init__(
        self,
        repository: SessionRepository,
        media_repository: MediaRepository | None = None,
        storage_client: AsyncClient | None = None,
    ) -> None:
        """Store the injected repositories and storage client."""
        self._repository = repository
        self._media_repository = media_repository
        self._storage_client = storage_client

    async def list_sessions(
        self, user: AuthenticatedUser, *, page: int, page_size: int
    ) -> PaginatedData[SessionSummary]:
        """Return one page of the caller's sessions, newest first.

        Args:
            user: The authenticated caller.
            page: 1-based page number.
            page_size: Rows per page.

        Returns:
            The requested page, wrapped with pagination metadata.

        Raises:
            DatabaseError: Propagated from the repository.
        """
        rows, total = await self._repository.list_sessions(user.id, page=page, page_size=page_size)
        items = [SessionSummary.from_row(row) for row in rows]
        pagination = PaginationMeta.build(page=page, page_size=page_size, total_items=total)
        return PaginatedData(items=items, pagination=pagination)

    async def get_session(self, user: AuthenticatedUser, session_id: UUID) -> SessionDetail:
        """Return one session owned by the caller.

        Args:
            user: The authenticated caller.
            session_id: The session to look up.

        Returns:
            The session detail. ``media`` is populated when the session has
            a ``media_id`` and the lookup succeeds; a failed or skipped
            media lookup degrades to ``media=None`` rather than failing the
            whole request - the session itself is still there to show.

        Raises:
            SessionNotFoundError: No such session, or it belongs to another user.
            DatabaseError: Propagated from the repository.
        """
        row = await self._repository.get_session(user.id, session_id)
        if row is None:
            raise SessionNotFoundError(str(session_id))
        media_row = None
        if row.get("media_id") and self._media_repository is not None:
            media_row = await self._media_repository.get_media(user.id, UUID(row["media_id"]))
        return SessionDetail.from_row(row, media_row)

    async def list_events(
        self, user: AuthenticatedUser, session_id: UUID, *, page: int, page_size: int
    ) -> PaginatedData[DetectionEvent]:
        """Return one page of a session's detection events, oldest first.

        Args:
            user: The authenticated caller.
            session_id: The session whose events are requested.
            page: 1-based page number.
            page_size: Rows per page.

        Returns:
            The requested page, wrapped with pagination metadata.

        Raises:
            SessionNotFoundError: No such session, or it belongs to another user.
            DatabaseError: Propagated from the repository.
        """
        await self.get_session(user, session_id)
        rows, total = await self._repository.list_events(
            user.id, session_id, page=page, page_size=page_size
        )
        items = [DetectionEvent.from_row(row) for row in rows]
        pagination = PaginationMeta.build(page=page, page_size=page_size, total_items=total)
        return PaginatedData(items=items, pagination=pagination)

    async def delete_session(self, user: AuthenticatedUser, session_id: UUID) -> None:
        """Delete one session owned by the caller, its events, and its recording.

        Order matters for a clean failure mode: the linked recording (Storage
        object + ``uploaded_media`` row) is removed before the session row
        itself, so a crash partway through never leaves a session that looks
        deleted from the list view but still points at deleted media - it
        leaves an orphaned recording instead, which is merely wasted storage,
        not a broken reference.

        Args:
            user: The authenticated caller.
            session_id: The session to delete.

        Raises:
            SessionNotFoundError: No such session, or it belongs to another user.
            DatabaseError: A delete failed.
            StorageError: Deleting the recording object failed.
        """
        row = await self._repository.get_session(user.id, session_id)
        if row is None:
            raise SessionNotFoundError(str(session_id))
        media_id = row.get("media_id")
        if media_id and self._media_repository is not None:
            media_row = await self._media_repository.get_media(user.id, UUID(media_id))
            if media_row is not None:
                if self._storage_client is not None:
                    await delete_object(
                        self._storage_client,
                        bucket=media_row["bucket"],
                        path=media_row["storage_path"],
                    )
                await self._media_repository.delete_media(user.id, UUID(media_id))
        await self._repository.delete_session(user.id, session_id)
