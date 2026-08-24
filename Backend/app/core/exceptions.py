"""Application exception hierarchy.

Every failure the backend raises deliberately is an :class:`AppError`. Each one
carries the HTTP status and the machine-readable :class:`~app.core.constants.ErrorCode`
that belong with it, so the exception handler can serialise any of them without
a lookup table (03_Backend_Architecture.md §21, Coding Standards §12).

Services raise these; they never build HTTP responses themselves::

    raise SessionNotFoundError(session_id)

The middleware turns that into the standard error envelope. Anything *not*
derived from ``AppError`` is treated as a bug: it is logged with a traceback and
reported to the client as a generic 500 with no internal detail.
"""

from __future__ import annotations

from http import HTTPStatus
from typing import Any

from app.core.constants import ErrorCode


class AppError(Exception):
    """Base class for every deliberately raised application error.

    Attributes:
        message: Human-readable text, safe to show a user.
        error_code: Stable machine-readable identifier for the frontend.
        status_code: HTTP status to respond with.
        errors: Optional field-level detail, used for validation failures.
    """

    error_code: ErrorCode = ErrorCode.INTERNAL_SERVER_ERROR
    status_code: int = HTTPStatus.INTERNAL_SERVER_ERROR
    message: str = "An unexpected error occurred."

    def __init__(
        self,
        message: str | None = None,
        *,
        error_code: ErrorCode | None = None,
        status_code: int | None = None,
        errors: list[dict[str, Any]] | None = None,
    ) -> None:
        """Initialise the error, falling back to the class-level defaults.

        Args:
            message: Overrides the class default message.
            error_code: Overrides the class default error code.
            status_code: Overrides the class default HTTP status.
            errors: Optional list of field-level error details.
        """
        self.message = message or self.__class__.message
        self.error_code = error_code or self.__class__.error_code
        self.status_code = status_code or self.__class__.status_code
        self.errors = errors or []
        super().__init__(self.message)

    def __repr__(self) -> str:
        """Return a debugging representation including code and status."""
        return (
            f"{type(self).__name__}(message={self.message!r}, "
            f"error_code={self.error_code.value!r}, status_code={self.status_code})"
        )


# =============================================================================
# Authentication & authorisation (Phase E)
# =============================================================================


class AuthenticationError(AppError):
    """Credentials are missing, malformed or expired."""

    error_code = ErrorCode.AUTH_REQUIRED
    status_code = HTTPStatus.UNAUTHORIZED
    message = "Authentication is required to access this resource."


class InvalidTokenError(AuthenticationError):
    """A JWT was supplied but failed signature, audience or expiry validation."""

    error_code = ErrorCode.INVALID_TOKEN
    status_code = HTTPStatus.UNAUTHORIZED
    message = "The provided authentication token is invalid or has expired."


class AuthorizationError(AppError):
    """The caller is authenticated but lacks the required role.

    Distinct from :class:`AuthenticationError`: re-authenticating will not help,
    so the frontend must not redirect to the login page.
    """

    error_code = ErrorCode.FORBIDDEN
    status_code = HTTPStatus.FORBIDDEN
    message = "You do not have permission to perform this action."


# =============================================================================
# Resources
# =============================================================================


class NotFoundError(AppError):
    """A requested resource does not exist, or is not visible to this caller."""

    error_code = ErrorCode.NOT_FOUND
    status_code = HTTPStatus.NOT_FOUND
    message = "The requested resource was not found."


class SessionNotFoundError(NotFoundError):
    """A monitoring session does not exist or belongs to another user."""

    error_code = ErrorCode.SESSION_NOT_FOUND
    message = "The requested monitoring session was not found."

    def __init__(self, session_id: str | None = None) -> None:
        """Initialise the error, naming the session when one was supplied.

        Args:
            session_id: Identifier of the missing session, included in the
                message to aid debugging. Safe to expose: ownership is checked
                before this is raised, so it leaks nothing the caller may not
                already reference.
        """
        message = (
            f"Monitoring session '{session_id}' was not found."
            if session_id
            else self.__class__.message
        )
        super().__init__(message)


class ConflictError(AppError):
    """The request conflicts with current state, such as a duplicate record."""

    error_code = ErrorCode.CONFLICT
    status_code = HTTPStatus.CONFLICT
    message = "The request conflicts with the current state of the resource."


# =============================================================================
# Validation & uploads (Phase G)
# =============================================================================


class ValidationError(AppError):
    """Request payload failed validation."""

    error_code = ErrorCode.VALIDATION_ERROR
    status_code = HTTPStatus.UNPROCESSABLE_ENTITY
    message = "The submitted data failed validation."


class FileTooLargeError(AppError):
    """An uploaded file exceeds the configured size limit."""

    error_code = ErrorCode.FILE_TOO_LARGE
    status_code = HTTPStatus.REQUEST_ENTITY_TOO_LARGE
    message = "The uploaded file exceeds the maximum allowed size."


class UnsupportedMediaError(AppError):
    """An uploaded file has an unsupported MIME type or is unreadable."""

    error_code = ErrorCode.UNSUPPORTED_MEDIA
    status_code = HTTPStatus.UNSUPPORTED_MEDIA_TYPE
    message = "The uploaded file type is not supported."


# =============================================================================
# AI engine (Phases G & H)
# =============================================================================


class ModelNotLoadedError(AppError):
    """Inference was requested before the model finished loading, or after it failed.

    Deployment §23 requires the service to stay up and report this rather than
    crash, so the operator can trigger a reload.
    """

    error_code = ErrorCode.MODEL_NOT_LOADED
    status_code = HTTPStatus.SERVICE_UNAVAILABLE
    message = "The AI model is not currently available."


class InferenceError(AppError):
    """The model was loaded but the forward pass failed."""

    error_code = ErrorCode.INFERENCE_ERROR
    status_code = HTTPStatus.INTERNAL_SERVER_ERROR
    message = "AI inference failed for the supplied input."


class VideoProcessingError(AppError):
    """A video could not be decoded or its frames could not be analysed."""

    error_code = ErrorCode.VIDEO_PROCESSING_ERROR
    status_code = HTTPStatus.INTERNAL_SERVER_ERROR
    message = "The video could not be processed."


# =============================================================================
# Infrastructure (Phases F & J)
# =============================================================================


class StorageError(AppError):
    """An object-storage operation failed."""

    error_code = ErrorCode.STORAGE_ERROR
    status_code = HTTPStatus.INTERNAL_SERVER_ERROR
    message = "A storage operation failed."


class DatabaseError(AppError):
    """A database operation failed."""

    error_code = ErrorCode.DATABASE_ERROR
    status_code = HTTPStatus.INTERNAL_SERVER_ERROR
    message = "A database operation failed."


class ServiceUnavailableError(AppError):
    """A required external dependency is unreachable or not configured."""

    error_code = ErrorCode.SERVICE_UNAVAILABLE
    status_code = HTTPStatus.SERVICE_UNAVAILABLE
    message = "A required service is temporarily unavailable."


class ConfigurationError(AppError):
    """The application is misconfigured.

    Raised at startup rather than per request. The message must never echo the
    offending value, only the variable name (Coding Standards §13).
    """

    error_code = ErrorCode.INTERNAL_SERVER_ERROR
    status_code = HTTPStatus.INTERNAL_SERVER_ERROR
    message = "The application is not correctly configured."


# =============================================================================
# Rate limiting (Phase E)
# =============================================================================


class RateLimitError(AppError):
    """The caller exceeded their allowed request rate."""

    error_code = ErrorCode.RATE_LIMITED
    status_code = HTTPStatus.TOO_MANY_REQUESTS
    message = "Too many requests. Please try again shortly."
