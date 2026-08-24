"""Schemas layer - Pydantic request, response and transfer models.

Every endpoint declares a ``response_model`` from this package and validates its
input through it; raw dictionaries are never accepted or returned
(03_Backend_Architecture.md §11, Coding Standards §8).

This package defines the wire contract and nothing else. It holds no business
logic, performs no I/O, and imports only from :mod:`app.core` - which is what
keeps it safe for every layer to depend on.

The shared envelopes are re-exported here so call sites can use the short form::

    from app.schemas import ApiResponse

Feature-specific models stay in their own module and are imported by path, e.g.
``from app.schemas.health import HealthData``.
"""

from app.schemas.common import (
    DEFAULT_SUCCESS_MESSAGE,
    ApiResponse,
    EmptyResponse,
    ErrorDetail,
    ErrorResponse,
    PaginatedData,
    PaginationMeta,
)

__all__ = [
    "DEFAULT_SUCCESS_MESSAGE",
    "ApiResponse",
    "EmptyResponse",
    "ErrorDetail",
    "ErrorResponse",
    "PaginatedData",
    "PaginationMeta",
]
