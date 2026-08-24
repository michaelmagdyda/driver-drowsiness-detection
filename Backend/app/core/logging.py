"""Logging configuration.

Coding Standards §13 requires that logins, uploads, AI predictions, alerts,
report generation and errors are all logged - and that passwords, JWTs and
service keys never are. :class:`SensitiveDataFilter` enforces the second half so
correctness does not depend on every future call site remembering the rule.

Every record carries the id of the request that produced it, propagated through
a :class:`~contextvars.ContextVar` so it survives ``await`` boundaries without
being threaded through call signatures.

Configured once at startup::

    configure_logging(get_settings())

and used through :func:`get_logger` thereafter.
"""

from __future__ import annotations

import logging
import re
import sys
from contextvars import ContextVar
from typing import TYPE_CHECKING, Final

if TYPE_CHECKING:
    from app.core.config import Settings

request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")
"""Correlation id for the in-flight request. Set by the request-context middleware."""

_LOG_FORMAT: Final[str] = "%(asctime)s | %(levelname)-8s | %(request_id)s | %(name)s | %(message)s"
_DATE_FORMAT: Final[str] = "%Y-%m-%d %H:%M:%S"

_REDACTED: Final[str] = "[REDACTED]"

# Matched case-insensitively against the formatted message. Each pattern keeps
# the identifying prefix and replaces only the value, so logs stay useful:
# "password=hunter2" becomes "password=[REDACTED]", not a blank line.
_SENSITIVE_PATTERNS: Final[tuple[re.Pattern[str], ...]] = (
    # key=value / key: value / "key": "value" for sensitive-looking key names
    re.compile(
        r"""(?ix)
        \b(password|passwd|secret|token|api[_-]?key|service[_-]?role[_-]?key
          |jwt[_-]?secret|authorization|access[_-]?token|refresh[_-]?token)
        \b\s*["']?\s*[:=]\s*["']?
        ([^\s,;"'}\)]+)
        """
    ),
    # "Bearer <token>" in any position
    re.compile(r"(?i)\bBearer\s+([A-Za-z0-9._~+/=-]{8,})"),
    # A bare JWT (three base64url segments) appearing anywhere
    re.compile(r"\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b"),
)


class RequestIdFilter(logging.Filter):
    """Attach the current request id to every record.

    The formatter references ``%(request_id)s`` unconditionally, so records
    emitted outside a request - at startup, or from a background task - would
    raise a formatting error without this. They get ``"-"`` instead.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        """Populate ``record.request_id``.

        Args:
            record: The record being emitted.

        Returns:
            Always ``True``; this filter enriches rather than excludes.
        """
        record.request_id = request_id_ctx.get()
        return True


class SensitiveDataFilter(logging.Filter):
    """Redact credentials from log records.

    Acts as a safety net, not a licence to log secrets: call sites should still
    avoid passing them. Redaction is applied to the *formatted* message so it
    also covers values interpolated from ``args``.

    Note:
        This runs a handful of regexes per record. At INFO level in production
        that is negligible; at DEBUG under sustained WebSocket traffic it is
        measurable, which is one more reason production runs at INFO.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        """Rewrite the record's message in place with secrets removed.

        Args:
            record: The record being emitted.

        Returns:
            Always ``True``; this filter redacts rather than excludes.
        """
        message = record.getMessage()
        redacted = self._redact(message)
        if redacted != message:
            # Collapse into msg and clear args: the substitution has already
            # been applied, so re-interpolating would fail or reintroduce the
            # secret.
            record.msg = redacted
            record.args = ()
        return True

    @staticmethod
    def _redact(message: str) -> str:
        """Return ``message`` with any recognised secret replaced.

        Args:
            message: The formatted log message.

        Returns:
            The message with sensitive values replaced by ``[REDACTED]``.
        """
        for pattern in _SENSITIVE_PATTERNS:
            if pattern.groups >= 2:  # noqa: PLR2004 - keyed key=value form
                message = pattern.sub(rf"\1={_REDACTED}", message)
            elif pattern.groups == 1:
                message = pattern.sub(_REDACTED, message)
            else:
                message = pattern.sub(_REDACTED, message)
        return message


def configure_logging(settings: Settings) -> None:
    """Configure the root logger for the application.

    Idempotent: existing handlers are removed first, so calling this twice - as
    uvicorn's reloader can - does not produce duplicated output.

    Args:
        settings: Validated application settings supplying the log level.
    """
    root = logging.getLogger()
    root.setLevel(settings.log_level)

    for existing in root.handlers[:]:
        root.removeHandler(existing)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(fmt=_LOG_FORMAT, datefmt=_DATE_FORMAT))
    handler.addFilter(RequestIdFilter())
    handler.addFilter(SensitiveDataFilter())
    root.addHandler(handler)

    # uvicorn installs its own handlers; clearing them and enabling propagation
    # routes its output through the filters above, so access logs are redacted
    # and carry the request id too.
    for uvicorn_logger in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        target = logging.getLogger(uvicorn_logger)
        target.handlers.clear()
        target.propagate = True

    logging.getLogger(__name__).debug(
        "Logging configured: level=%s env=%s", settings.log_level, settings.app_env
    )


def get_logger(name: str) -> logging.Logger:
    """Return a module-scoped logger.

    Args:
        name: Logger name; pass ``__name__`` from the calling module.

    Returns:
        A configured :class:`logging.Logger`.
    """
    return logging.getLogger(name)
