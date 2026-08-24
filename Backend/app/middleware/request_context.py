"""Request correlation, timing and access logging.

Gives every request an id, records how long it took, and emits one access log
line per exchange (03_Backend_Architecture.md §13, Coding Standards §13).

Implemented as **pure ASGI middleware** rather than subclassing Starlette's
``BaseHTTPMiddleware``. That base class wraps each request in an anyio task
group, which costs measurably more per request and interferes with streaming
responses. Coding Standards §24 sets a sub-200 ms API budget and a 10-15 FPS
WebSocket target, so the cheaper form is the right default here. The trade-off
is roughly twenty extra lines of ``send`` plumbing, contained in this file.

Scope handling:
    ``http``
        Fully instrumented.
    ``websocket``
        Passed through untouched. WebSocket connections are long-lived, so
        per-message timing belongs in the WebSocket handler itself (Phase H).
    ``lifespan``
        Passed through untouched.
"""

from __future__ import annotations

import re
import time
import uuid
from typing import TYPE_CHECKING, Final

from app.core.constants import REQUEST_ID_HEADER
from app.core.logging import get_logger, request_id_ctx

if TYPE_CHECKING:
    from starlette.types import ASGIApp, Message, Receive, Scope, Send

logger = get_logger(__name__)

# A client may supply its own correlation id so a trace can span the frontend
# and the backend. It is validated before use: an unvalidated header would let
# a caller inject newlines into the log stream and forge log entries, or push
# an unbounded string through every record.
_SAFE_REQUEST_ID: Final[re.Pattern[str]] = re.compile(r"^[A-Za-z0-9._-]{1,64}$")

_HEADER_NAME_BYTES: Final[bytes] = REQUEST_ID_HEADER.lower().encode("latin-1")

# Health probes fire continuously and would otherwise dominate the log volume.
_QUIET_PATHS: Final[frozenset[str]] = frozenset({"/health", "/ready"})

_SLOW_REQUEST_MS: Final[float] = 200.0
"""Coding Standards §24 budget for an API response. Slower requests log a warning."""


class RequestContextMiddleware:
    """Attach a correlation id to each request and log its outcome.

    The id is stored in a :class:`~contextvars.ContextVar` rather than passed as
    an argument, so any code in the call stack - including code several layers
    down that has no access to the request - is logged against the right
    request without threading a parameter through every signature.
    """

    def __init__(self, app: ASGIApp) -> None:
        """Store the next application in the ASGI chain.

        Args:
            app: The downstream ASGI application.
        """
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        """Instrument one ASGI exchange.

        Args:
            scope: Connection scope.
            receive: ASGI receive channel.
            send: ASGI send channel.
        """
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = self._resolve_request_id(scope)
        token = request_id_ctx.set(request_id)
        started = time.perf_counter()

        # Captured from the response-start message so the access log can record
        # the status code the client actually received.
        status_holder: dict[str, int] = {}

        async def send_with_request_id(message: Message) -> None:
            """Inject the correlation header and capture the response status.

            Args:
                message: Outgoing ASGI message.
            """
            if message["type"] == "http.response.start":
                status_holder["status"] = message["status"]
                headers = message.setdefault("headers", [])
                headers.append((_HEADER_NAME_BYTES, request_id.encode("latin-1")))
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        finally:
            # `finally`, not `except`: an unhandled exception must keep
            # propagating to Starlette's ServerErrorMiddleware, which owns the
            # 500 response. Swallowing it here would break error handling.
            # The access line is still emitted either way.
            duration_ms = (time.perf_counter() - started) * 1000
            self._log_access(scope, status_holder.get("status", 500), duration_ms)
            request_id_ctx.reset(token)

    @staticmethod
    def _resolve_request_id(scope: Scope) -> str:
        """Return a validated inbound correlation id, or mint a new one.

        Args:
            scope: Connection scope carrying the raw headers.

        Returns:
            A safe correlation id, at most 64 characters.
        """
        for raw_name, raw_value in scope.get("headers", []):
            if raw_name == _HEADER_NAME_BYTES:
                candidate = raw_value.decode("latin-1", errors="replace")
                if _SAFE_REQUEST_ID.match(candidate):
                    return candidate
                break  # present but malformed - fall through and generate one
        return uuid.uuid4().hex

    @staticmethod
    def _log_access(scope: Scope, status: int, duration_ms: float) -> None:
        """Emit a single access log line.

        The query string is deliberately excluded. Phase H authenticates
        WebSocket handshakes via a ``?token=`` parameter, and filters must never
        be the only thing standing between a JWT and the log file
        (Coding Standards §13).

        Args:
            scope: Connection scope.
            status: HTTP status code sent to the client.
            duration_ms: Wall-clock duration in milliseconds.
        """
        path = scope.get("path", "")
        if path in _QUIET_PATHS and status < 400:  # noqa: PLR2004
            return

        method = scope.get("method", "-")
        client = scope.get("client")
        client_host = client[0] if client else "-"

        if status >= 500:  # noqa: PLR2004
            level = logger.error
        elif status >= 400 or duration_ms > _SLOW_REQUEST_MS:  # noqa: PLR2004
            level = logger.warning
        else:
            level = logger.info

        level(
            "%s %s -> %d in %.1fms (client=%s)",
            method,
            path,
            status,
            duration_ms,
            client_host,
        )
