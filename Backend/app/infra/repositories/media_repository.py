"""Media repository - reads and writes ``public.uploaded_media`` in Supabase.

Same contract as :class:`~app.infra.repositories.session_repository.SessionRepository`:
the client holds the service-role key and bypasses Row Level Security, so
every method here scopes explicitly to a ``user_id``.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from app.core.exceptions import DatabaseError
from app.core.logging import get_logger

if TYPE_CHECKING:
    from uuid import UUID

    from supabase import AsyncClient

logger = get_logger(__name__)

MEDIA_TABLE = "uploaded_media"


class MediaRepository:
    """Reads and writes uploaded-media rows.

    Constructed with an :class:`AsyncClient` (dependency injection).
    Stateless beyond the injected client - safe to create per request.
    """

    def __init__(self, client: AsyncClient) -> None:
        """Store the injected Supabase client.

        Args:
            client: The service-role Supabase client.
        """
        self._client = client

    async def create_media(self, user_id: UUID, row: dict[str, Any]) -> dict[str, Any]:
        """Insert one uploaded-media row and return it as stored.

        Args:
            user_id: The Supabase user id the media belongs to. Merged into
                ``row`` here rather than trusted from the caller.
            row: The remaining columns - bucket, storage_path, mime_type,
                size_bytes, duration_seconds, kind.

        Returns:
            The inserted row, including the generated id.

        Raises:
            DatabaseError: The insert failed, or returned no row.
        """
        payload = {**row, "user_id": str(user_id)}
        try:
            response = await self._client.table(MEDIA_TABLE).insert(payload).execute()
        except Exception as error:  # noqa: BLE001 - deliberately narrow the SDK's errors to ours
            logger.error("Media creation failed for user %s: %s", user_id, type(error).__name__)
            msg = "Failed to save the media record."
            raise DatabaseError(msg) from error
        if not response.data:
            msg = "Failed to save the media record."
            raise DatabaseError(msg)
        return response.data[0]

    async def get_media(self, user_id: UUID, media_id: UUID) -> dict[str, Any] | None:
        """Return one media row owned by ``user_id``, or ``None`` if absent.

        Args:
            user_id: The Supabase user id to scope the query to.
            media_id: The media row to look up.

        Returns:
            The raw row, or ``None`` when no matching row exists.

        Raises:
            DatabaseError: The query failed.
        """
        try:
            response = (
                await self._client.table(MEDIA_TABLE)
                .select("*")
                .eq("user_id", str(user_id))
                .eq("id", str(media_id))
                .maybe_single()
                .execute()
            )
        except Exception as error:  # noqa: BLE001 - deliberately narrow the SDK's errors to ours
            logger.error(
                "Media lookup failed for user %s, media %s: %s",
                user_id,
                media_id,
                type(error).__name__,
            )
            msg = "Failed to read the media record."
            raise DatabaseError(msg) from error
        return response.data if response is not None else None

    async def delete_media(self, user_id: UUID, media_id: UUID) -> None:
        """Delete one media row owned by ``user_id``.

        A no-op if the row does not exist or belongs to another user - the
        ``eq("user_id", ...)`` scope means such a delete simply matches no
        rows rather than raising.

        Args:
            user_id: The Supabase user id to scope the delete to.
            media_id: The media row to delete.

        Raises:
            DatabaseError: The delete failed.
        """
        try:
            await (
                self._client.table(MEDIA_TABLE)
                .delete()
                .eq("user_id", str(user_id))
                .eq("id", str(media_id))
                .execute()
            )
        except Exception as error:  # noqa: BLE001 - deliberately narrow the SDK's errors to ours
            logger.error(
                "Media delete failed for user %s, media %s: %s",
                user_id,
                media_id,
                type(error).__name__,
            )
            msg = "Failed to delete the media record."
            raise DatabaseError(msg) from error
