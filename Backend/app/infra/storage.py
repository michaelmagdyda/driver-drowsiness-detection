"""Supabase Storage upload helper (Phase F write path).

The service-role client already used for every table read/write also exposes
the Storage API, so no separate client or credential is needed - this module
is a thin wrapper for one reason: to give upload failures a single place to
turn into the domain's :class:`~app.core.exceptions.StorageError` rather than
leaking the SDK's own exception type into callers.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.core.exceptions import StorageError
from app.core.logging import get_logger

if TYPE_CHECKING:
    from supabase import AsyncClient

logger = get_logger(__name__)


async def upload_bytes(
    client: AsyncClient, *, bucket: str, path: str, content: bytes, content_type: str
) -> None:
    """Upload bytes to a private Supabase Storage bucket.

    Args:
        client: The service-role Supabase client. Required for buckets like
            ``session-clips`` whose RLS grants no ``authenticated`` INSERT
            policy - only the service role can write there.
        bucket: Destination bucket name.
        path: Object path within the bucket, e.g. ``"{user_id}/{uuid}.mp4"``.
        content: Raw file bytes.
        content_type: MIME type to store alongside the object.

    Raises:
        StorageError: The upload failed.
    """
    try:
        await client.storage.from_(bucket).upload(path, content, {"content-type": content_type})
    except Exception as error:  # noqa: BLE001 - deliberately narrow the SDK's errors to ours
        logger.error(
            "Storage upload failed for bucket %s, path %s: %s",
            bucket,
            path,
            type(error).__name__,
        )
        msg = "Failed to store the file."
        raise StorageError(msg) from error


async def delete_object(client: AsyncClient, *, bucket: str, path: str) -> None:
    """Delete one object from a private Supabase Storage bucket.

    Best-effort by design at the call site (see
    :meth:`~app.services.session_service.SessionService.delete_session`): a
    missing object is not treated as an error here either - Storage's own
    remove call does not fail on an absent key, so this raises only on a real
    transport/permission failure.

    Args:
        client: The service-role Supabase client.
        bucket: Bucket the object lives in.
        path: Object path within the bucket.

    Raises:
        StorageError: The delete request failed.
    """
    try:
        await client.storage.from_(bucket).remove([path])
    except Exception as error:  # noqa: BLE001 - deliberately narrow the SDK's errors to ours
        logger.error(
            "Storage delete failed for bucket %s, path %s: %s",
            bucket,
            path,
            type(error).__name__,
        )
        msg = "Failed to delete the file."
        raise StorageError(msg) from error
