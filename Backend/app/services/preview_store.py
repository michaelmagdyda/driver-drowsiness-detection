"""In-memory registry for generated annotated-video previews (Phase G2).

The video analysis endpoint is unauthenticated and stateless - there is no
per-user table this could live in, and adding one would mean giving an
anonymous endpoint write access to permanent storage. A small process-wide
registry mapping an opaque token to a temp file, bounded by count and age, is
the honest amount of persistence this feature actually needs: a preview is
useful for the few minutes after it was generated, never again after the
process restarts.

Not a cache in the performance sense - nothing is ever recomputed from a
miss. A miss just means "generate a new preview by re-analysing," which is
the caller's job, not this module's.
"""

from __future__ import annotations

import threading
import time
import uuid
from pathlib import Path

from app.core.constants import PREVIEW_STORE_MAX_ENTRIES, PREVIEW_STORE_TTL_SECONDS
from app.core.logging import get_logger

logger = get_logger(__name__)

_lock = threading.Lock()
_entries: dict[str, tuple[Path, float]] = {}


def register(path: Path) -> str:
    """Register a generated preview file and return its lookup token.

    Evicts expired entries and, if still over capacity, the oldest surviving
    one - each call is what keeps the registry bounded, since there is no
    background sweeper.

    Args:
        path: Filesystem path of the encoded preview. Ownership passes to
            this module: it will be deleted on eviction or expiry.

    Returns:
        An opaque token that resolves back to ``path`` via :func:`resolve`.
    """
    token = uuid.uuid4().hex
    now = time.monotonic()
    with _lock:
        _evict_expired_locked(now)
        _entries[token] = (path, now)
        while len(_entries) > PREVIEW_STORE_MAX_ENTRIES:
            oldest = min(_entries, key=lambda t: _entries[t][1])
            _delete_locked(oldest)
    return token


def resolve(token: str) -> Path | None:
    """Return the file path registered under ``token``, if it still exists.

    Args:
        token: The token returned by :func:`register`.

    Returns:
        The preview's path, or ``None`` if the token is unknown or its entry
        has expired (in which case the underlying file is also deleted here).
    """
    with _lock:
        entry = _entries.get(token)
        if entry is None:
            return None
        path, created_at = entry
        if time.monotonic() - created_at > PREVIEW_STORE_TTL_SECONDS:
            _delete_locked(token)
            return None
        return path


def _evict_expired_locked(now: float) -> None:
    """Delete every entry older than the TTL. Caller must hold ``_lock``.

    Args:
        now: Current :func:`time.monotonic` reading, so every entry is
            checked against the same instant.
    """
    expired = [
        token
        for token, (_, created_at) in _entries.items()
        if now - created_at > PREVIEW_STORE_TTL_SECONDS
    ]
    for token in expired:
        _delete_locked(token)


def _delete_locked(token: str) -> None:
    """Remove one entry and best-effort delete its file. Caller holds ``_lock``.

    Args:
        token: The entry to remove.
    """
    path, _ = _entries.pop(token)
    try:
        path.unlink(missing_ok=True)
    except OSError:
        logger.warning("Failed to delete expired video preview file: %s", path)
