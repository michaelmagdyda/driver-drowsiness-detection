"""Session history endpoints (Phase F/H).

Transport adapter only, mirroring the ``analysis.py`` pattern: routes carry no
business logic, they resolve dependencies, construct the service inline, and
wrap the result in the standard envelope.
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, File, Form, Query, UploadFile
from pydantic import ValidationError as PydanticValidationError

from app.core.exceptions import ValidationError
from app.dependencies.auth import CurrentUserDep
from app.dependencies.database import SupabaseClientDep
from app.infra.repositories.media_repository import MediaRepository
from app.infra.repositories.session_repository import SessionRepository
from app.schemas.common import ApiResponse, EmptyResponse, PaginatedData
from app.schemas.sessions import (
    DetectionEvent,
    DetectionEventInput,
    SessionDetail,
    SessionSummary,
)
from app.services.session_recording_service import SessionRecordingService
from app.services.session_service import SessionService

router = APIRouter(prefix="/sessions", tags=["Sessions"])

PageParam = Annotated[int, Query(ge=1, description="1-based page number.")]
PageSizeParam = Annotated[int, Query(ge=1, le=100, description="Items per page.")]


@router.get(
    "",
    summary="List Sessions",
    description="List the caller's monitoring sessions, newest first.",
    response_model=ApiResponse[PaginatedData[SessionSummary]],
)
async def list_sessions(
    user: CurrentUserDep,
    client: SupabaseClientDep,
    page: PageParam = 1,
    page_size: PageSizeParam = 20,
) -> ApiResponse[PaginatedData[SessionSummary]]:
    """List the caller's sessions.

    Args:
        user: Injected authenticated caller.
        client: Injected Supabase client.
        page: 1-based page number.
        page_size: Rows per page.

    Returns:
        The standard envelope wrapping a page of :class:`SessionSummary`.
    """
    service = SessionService(SessionRepository(client))
    result = await service.list_sessions(user, page=page, page_size=page_size)
    return ApiResponse.ok(result, message="Sessions retrieved.")


@router.get(
    "/{session_id}",
    summary="Get Session",
    description="Return one session owned by the caller. 404 if it does not exist or belongs to another user.",
    response_model=ApiResponse[SessionDetail],
)
async def get_session(
    user: CurrentUserDep,
    client: SupabaseClientDep,
    session_id: UUID,
) -> ApiResponse[SessionDetail]:
    """Return one session.

    Args:
        user: Injected authenticated caller.
        client: Injected Supabase client.
        session_id: The session to look up.

    Returns:
        The standard envelope wrapping a :class:`SessionDetail`.
    """
    service = SessionService(SessionRepository(client), MediaRepository(client))
    result = await service.get_session(user, session_id)
    return ApiResponse.ok(result, message="Session retrieved.")


@router.get(
    "/{session_id}/events",
    summary="List Session Events",
    description="List a session's detection events, oldest first.",
    response_model=ApiResponse[PaginatedData[DetectionEvent]],
)
async def list_session_events(
    user: CurrentUserDep,
    client: SupabaseClientDep,
    session_id: UUID,
    page: PageParam = 1,
    page_size: PageSizeParam = 100,
) -> ApiResponse[PaginatedData[DetectionEvent]]:
    """List a session's detection events.

    Args:
        user: Injected authenticated caller.
        client: Injected Supabase client.
        session_id: The session whose events are requested.
        page: 1-based page number.
        page_size: Rows per page.

    Returns:
        The standard envelope wrapping a page of :class:`DetectionEvent`.
    """
    service = SessionService(SessionRepository(client))
    result = await service.list_events(user, session_id, page=page, page_size=page_size)
    return ApiResponse.ok(result, message="Detection events retrieved.")


@router.delete(
    "/{session_id}",
    summary="Delete Session",
    description=(
        "Permanently delete one session owned by the caller - its detection "
        "events, its linked recording, and the session row itself. 404 if it "
        "does not exist or belongs to another user."
    ),
    response_model=EmptyResponse,
)
async def delete_session(
    user: CurrentUserDep,
    client: SupabaseClientDep,
    session_id: UUID,
) -> EmptyResponse:
    """Delete one session and everything it owns.

    Args:
        user: Injected authenticated caller.
        client: Injected Supabase client.
        session_id: The session to delete.

    Returns:
        The standard envelope with an empty payload.

    Raises:
        SessionNotFoundError: No such session, or it belongs to another user.
    """
    service = SessionService(SessionRepository(client), MediaRepository(client), client)
    await service.delete_session(user, session_id)
    return ApiResponse.ok({}, message="Session deleted.")


@router.post(
    "",
    summary="Complete Webcam Session",
    description=(
        "Submit a finished webcam monitoring session in one request: the "
        "MediaRecorder recording plus every event the client collected "
        "locally via POST /analysis/image. The server burns each frame with "
        "its nearest event's detections and a state/fatigue HUD, uploads "
        "the annotated result, and creates the session and event rows. "
        "There is no separate start/append/finish lifecycle - a session "
        "either lands whole, or not at all."
    ),
    response_model=ApiResponse[SessionDetail],
)
async def complete_session(
    user: CurrentUserDep,
    client: SupabaseClientDep,
    recording: Annotated[UploadFile, File(description="The MediaRecorder output.")],
    events: Annotated[
        str, Form(description="JSON-encoded array of DetectionEventInput, oldest first.")
    ],
    started_at: Annotated[
        datetime, Form(description="Wall-clock time the session began, ISO 8601.")
    ],
) -> ApiResponse[SessionDetail]:
    """Persist one completed webcam session.

    Args:
        user: Injected authenticated caller.
        client: Injected Supabase client.
        recording: The multipart recording upload.
        events: JSON-encoded array of per-tick events.
        started_at: When the session began.

    Returns:
        The standard envelope wrapping the newly created :class:`SessionDetail`.

    Raises:
        ValidationError: ``events`` is not valid JSON, or does not match
            :class:`DetectionEventInput`.
    """
    try:
        parsed_events = [DetectionEventInput(**item) for item in json.loads(events)]
    except (json.JSONDecodeError, PydanticValidationError, TypeError) as error:
        raise ValidationError("The submitted events could not be parsed.") from error

    content = await recording.read()
    service = SessionRecordingService(SessionRepository(client), MediaRepository(client), client)
    result = await service.complete_session(
        user,
        recording=content,
        recording_content_type=recording.content_type,
        started_at=started_at,
        events=parsed_events,
    )
    return ApiResponse.ok(result, message="Session saved.")
