"""Translation of exceptions into the standard error envelope.

Four handlers cover every way a request can fail
(03_Backend_Architecture.md §21, Coding Standards §12):

============================  =============================================
Exception                     Outcome
============================  =============================================
:class:`AppError`             Its own status and error code. Expected.
``RequestValidationError``    422 with per-field detail.
``StarletteHTTPException``    Framework 404/405/etc., mapped to an error code.
``Exception``                 500. Logged with traceback, body says nothing.
============================  =============================================

Registering these centrally is what lets routes and services stay free of
``try``/``except`` blocks whose only job is formatting a response. A service
raises ``SessionNotFoundError(session_id)``; the correct 404 envelope is
produced here, once.

Security invariants:
    * No stack trace, SQL fragment or file path ever reaches the client.
    * Validation errors echo the field *location*, never the submitted value -
      Pydantic's ``input`` and ``ctx`` keys are dropped, since a failed login
      would otherwise place the password in the response body and the logs.
"""

from __future__ import annotations

from http import HTTPStatus
from typing import TYPE_CHECKING, Final

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.constants import REQUEST_ID_HEADER, ErrorCode
from app.core.exceptions import AppError
from app.core.logging import get_logger, request_id_ctx
from app.schemas.common import ErrorDetail, ErrorResponse

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable

logger = get_logger(__name__)

_SERVER_ERROR_THRESHOLD: Final[int] = 500

# Framework-raised HTTP errors carry a status but no error code of their own.
_STATUS_ERROR_CODES: Final[dict[int, ErrorCode]] = {
    HTTPStatus.UNAUTHORIZED: ErrorCode.AUTH_REQUIRED,
    HTTPStatus.FORBIDDEN: ErrorCode.FORBIDDEN,
    HTTPStatus.NOT_FOUND: ErrorCode.NOT_FOUND,
    # 405 shares NOT_FOUND deliberately: §23 defines no code for it, and from
    # the caller's perspective this method-and-path combination does not exist.
    # The HTTP status still distinguishes the two for anyone who needs it.
    HTTPStatus.METHOD_NOT_ALLOWED: ErrorCode.NOT_FOUND,
    HTTPStatus.CONFLICT: ErrorCode.CONFLICT,
    HTTPStatus.REQUEST_ENTITY_TOO_LARGE: ErrorCode.FILE_TOO_LARGE,
    HTTPStatus.UNSUPPORTED_MEDIA_TYPE: ErrorCode.UNSUPPORTED_MEDIA,
    HTTPStatus.UNPROCESSABLE_ENTITY: ErrorCode.VALIDATION_ERROR,
    HTTPStatus.TOO_MANY_REQUESTS: ErrorCode.RATE_LIMITED,
    HTTPStatus.SERVICE_UNAVAILABLE: ErrorCode.SERVICE_UNAVAILABLE,
}

_GENERIC_SERVER_ERROR_MESSAGE: Final[str] = (
    "An unexpected error occurred. Please try again or contact support with the request id."
)


def _build_response(
    *,
    status_code: int,
    message: str,
    error_code: ErrorCode,
    errors: list[ErrorDetail] | None = None,
) -> JSONResponse:
    """Serialise an :class:`ErrorResponse` into a JSON reply.

    The correlation header is attached here rather than relying on
    :class:`~app.middleware.request_context.RequestContextMiddleware`. Starlette's
    ``ServerErrorMiddleware`` sits *outside* the user middleware stack and
    dispatches the 500 response through the original ``send`` channel, bypassing
    that middleware's header injection. Setting it here means every error
    response carries an id the user can quote, including the 500s.

    Args:
        status_code: HTTP status to return.
        message: User-safe summary.
        error_code: Stable machine-readable identifier.
        errors: Optional field-level detail.

    Returns:
        A :class:`JSONResponse` in the standard error shape.
    """
    payload = ErrorResponse(
        message=message,
        error_code=error_code,
        errors=errors or [],
    )
    return JSONResponse(
        status_code=status_code,
        content=payload.model_dump(mode="json"),
        headers={REQUEST_ID_HEADER: request_id_ctx.get()},
    )


async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
    """Handle a deliberately raised application error.

    These are expected outcomes, not defects, so 4xx cases log at WARNING and
    carry no traceback. A 5xx ``AppError`` - a storage or database failure -
    does get a traceback, because it indicates something genuinely broken.

    Args:
        request: The incoming request, used for log context.
        exc: The raised error.

    Returns:
        The error envelope described by the exception.
    """
    is_server_error = exc.status_code >= _SERVER_ERROR_THRESHOLD
    log = logger.error if is_server_error else logger.warning
    log(
        "%s on %s %s -> %d %s: %s",
        type(exc).__name__,
        request.method,
        request.url.path,
        exc.status_code,
        exc.error_code.value,
        exc.message,
        exc_info=is_server_error,
    )
    return _build_response(
        status_code=exc.status_code,
        message=exc.message,
        error_code=exc.error_code,
        errors=[ErrorDetail(**item) for item in exc.errors] if exc.errors else None,
    )


async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handle a request that failed schema validation.

    Only ``loc``, ``msg`` and ``type`` are copied out of Pydantic's report.
    ``input`` and ``ctx`` are discarded: they contain the rejected value, which
    for a login or profile update would be a credential.

    Args:
        request: The incoming request, used for log context.
        exc: The validation failure raised by FastAPI.

    Returns:
        A 422 envelope listing the offending fields.
    """
    details = [
        ErrorDetail(
            field=".".join(str(part) for part in error.get("loc", ())) or None,
            message=str(error.get("msg", "Invalid value.")),
            type=str(error.get("type")) if error.get("type") else None,
        )
        for error in exc.errors()
    ]
    # Field names only - never the values that failed.
    logger.warning(
        "Validation failed on %s %s: %s",
        request.method,
        request.url.path,
        [detail.field for detail in details],
    )
    return _build_response(
        status_code=HTTPStatus.UNPROCESSABLE_ENTITY,
        message="The submitted data failed validation.",
        error_code=ErrorCode.VALIDATION_ERROR,
        errors=details,
    )


async def handle_http_exception(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Handle a framework-raised HTTP error such as 404 or 405.

    Without this, an unmatched route would return Starlette's default
    ``{"detail": "Not Found"}``, which does not match the envelope every other
    response uses.

    Args:
        request: The incoming request, used for log context.
        exc: The framework exception.

    Returns:
        The error envelope for this status.
    """
    error_code = _STATUS_ERROR_CODES.get(exc.status_code, ErrorCode.INTERNAL_SERVER_ERROR)
    message = str(exc.detail) if exc.detail else HTTPStatus(exc.status_code).phrase

    if exc.status_code >= _SERVER_ERROR_THRESHOLD:
        logger.error("HTTP %d on %s %s", exc.status_code, request.method, request.url.path)
    else:
        logger.info("HTTP %d on %s %s", exc.status_code, request.method, request.url.path)

    return _build_response(
        status_code=exc.status_code,
        message=message,
        error_code=error_code,
    )


async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    """Handle any exception the application did not anticipate.

    This is the last line of defence. The traceback goes to the log with the
    request id; the client receives a fixed message and nothing else. Leaking
    ``str(exc)`` here is the classic route by which connection strings and file
    paths escape into a browser.

    Args:
        request: The incoming request, used for log context.
        exc: The unhandled exception.

    Returns:
        A generic 500 envelope.
    """
    logger.error(
        "Unhandled %s on %s %s",
        type(exc).__name__,
        request.method,
        request.url.path,
        exc_info=exc,
    )
    return _build_response(
        status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
        message=_GENERIC_SERVER_ERROR_MESSAGE,
        error_code=ErrorCode.INTERNAL_SERVER_ERROR,
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Attach every handler to the application.

    Called once from the application factory. Keeping registration in one
    function means ``main.py`` does not need to know which exception types
    exist, so adding a handler never requires editing the factory.

    Args:
        app: The FastAPI application to configure.
    """
    # Starlette's type stubs describe handlers as accepting the base Exception;
    # ours narrow that to the specific type they are registered against, which
    # is safe at runtime but not expressible in the stub signature.
    handlers: list[tuple[type[Exception], Callable[..., Awaitable[JSONResponse]]]] = [
        (AppError, handle_app_error),
        (RequestValidationError, handle_validation_error),
        (StarletteHTTPException, handle_http_exception),
        (Exception, handle_unexpected_error),
    ]
    for exception_type, handler in handlers:
        app.add_exception_handler(exception_type, handler)  # type: ignore[arg-type]

    logger.debug("Registered %d exception handlers", len(handlers))
