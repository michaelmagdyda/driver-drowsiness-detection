"""Shared response envelopes.

Every endpoint in the system returns one of the two shapes defined by the API
Specification §3 - there are no exceptions and no raw dictionaries anywhere
(Coding Standards §8, 03_Backend_Architecture.md §11).

Success::

    {"success": true, "message": "...", "data": {...}}

Error::

    {"success": false, "message": "...", "error_code": "...", "errors": []}

The ``success`` discriminator is typed as ``Literal[True]`` / ``Literal[False]``
rather than ``bool``. That is what lets a TypeScript client narrow the union on
that one field and know which branch it is holding, and it makes the two shapes
distinguishable in the generated OpenAPI schema.

Endpoints build success responses through :meth:`ApiResponse.ok`; error
responses are produced centrally by the exception handlers (Step D4), never by
hand in a route.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.core.constants import ErrorCode

DEFAULT_SUCCESS_MESSAGE: str = "Operation completed successfully."


class ApiResponse[T](BaseModel):
    """Standard envelope for a successful response.

    ``T`` is the payload type carried in ``data``.

    Parameterise with the payload type so both the OpenAPI schema and the type
    checker know what ``data`` contains::

        @router.get("/dashboard", response_model=ApiResponse[DashboardData])

    Attributes:
        success: Always ``True``. Discriminates this shape from :class:`ErrorResponse`.
        message: Human-readable summary, safe to display to a user.
        data: The payload. ``None`` for operations that return no content.
    """

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": DEFAULT_SUCCESS_MESSAGE,
                "data": {},
            }
        }
    )

    success: Literal[True] = True
    message: str = DEFAULT_SUCCESS_MESSAGE
    data: T | None = None

    @classmethod
    def ok(cls, data: T | None = None, message: str = DEFAULT_SUCCESS_MESSAGE) -> ApiResponse[T]:
        """Build a successful response.

        Args:
            data: Payload to return, if any.
            message: Human-readable summary. Override it with something specific
                to the operation - "Session started." beats the default.

        Returns:
            A populated :class:`ApiResponse`.
        """
        return cls(message=message, data=data)


class ErrorDetail(BaseModel):
    """A single field-level error.

    Populated from Pydantic validation failures so the frontend can attach a
    message to the input that caused it, rather than showing one banner for the
    whole form.

    Attributes:
        field: Dotted path to the offending field, e.g. ``"body.email"``.
            ``None`` when the error is not attributable to one field.
        message: What is wrong with this field.
        type: Machine-readable validation failure type, e.g. ``"missing"``.
    """

    field: str | None = None
    message: str
    type: str | None = None


class ErrorResponse(BaseModel):
    """Standard envelope for a failed response.

    Never constructed inside a route. The exception handlers translate every
    :class:`~app.core.exceptions.AppError` into this shape, which is what keeps
    error formatting consistent across the whole API and guarantees no internal
    detail leaks (03_Backend_Architecture.md §21).

    Attributes:
        success: Always ``False``.
        message: Human-readable summary, safe to display. Never contains a
            stack trace, SQL, or a file path.
        error_code: Stable identifier the frontend may branch on.
        errors: Field-level detail. Empty for errors that are not validation
            failures.
    """

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": False,
                "message": "The submitted data failed validation.",
                "error_code": ErrorCode.VALIDATION_ERROR.value,
                "errors": [
                    {
                        "field": "body.email",
                        "message": "value is not a valid email address",
                        "type": "value_error",
                    }
                ],
            }
        }
    )

    success: Literal[False] = False
    message: str
    error_code: ErrorCode
    errors: list[ErrorDetail] = Field(default_factory=list)


class PaginationMeta(BaseModel):
    """Pagination metadata for a collection response.

    Attributes:
        page: Current page number, 1-based.
        page_size: Number of items requested per page.
        total_items: Total matching items across all pages.
        total_pages: Total number of pages available.
    """

    page: int = Field(ge=1, description="Current page number, 1-based.")
    page_size: int = Field(ge=1, description="Items per page.")
    total_items: int = Field(ge=0, description="Total items matching the query.")
    total_pages: int = Field(ge=0, description="Total number of pages.")

    # Declared as computed fields, not plain properties, so they appear in the
    # JSON payload and in the *serialization* schema - which is the one FastAPI
    # publishes for a response_model. A bare @property would be visible on the
    # Python object but silently absent from the response: exactly the kind of
    # model/wire mismatch that costs a frontend developer an afternoon.
    @computed_field  # type: ignore[prop-decorator]
    @property
    def has_next(self) -> bool:
        """Whether a following page exists."""
        return self.page < self.total_pages

    @computed_field  # type: ignore[prop-decorator]
    @property
    def has_previous(self) -> bool:
        """Whether a preceding page exists."""
        return self.page > 1

    @classmethod
    def build(cls, *, page: int, page_size: int, total_items: int) -> PaginationMeta:
        """Derive pagination metadata, computing ``total_pages``.

        Args:
            page: Current page number, 1-based.
            page_size: Items per page; must be positive.
            total_items: Total items matching the query.

        Returns:
            Populated :class:`PaginationMeta`.
        """
        total_pages = -(-total_items // page_size)  # ceiling division
        return cls(
            page=page,
            page_size=page_size,
            total_items=total_items,
            total_pages=total_pages,
        )


class PaginatedData[ItemT](BaseModel):
    """Payload for a paginated collection.

    ``ItemT`` is the element type of the collection.

    Nests inside the standard envelope rather than replacing it, so a list
    endpoint returns the same outer shape as everything else::

        response_model=ApiResponse[PaginatedData[SessionSummary]]

    Attributes:
        items: The page of results.
        pagination: Metadata describing the slice.
    """

    items: list[ItemT]
    pagination: PaginationMeta


EmptyResponse = ApiResponse[dict[str, Any]]
"""Envelope for operations that return no payload, e.g. a delete.

Preferred over a bare 204 so the frontend can always parse a body and read
``message``, matching every other endpoint.
"""
