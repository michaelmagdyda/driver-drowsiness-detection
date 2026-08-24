"""Upload-to-session endpoints (Phase F write path, upload flow).

Transport adapter only, mirroring ``analysis.py``/``sessions.py``: routes
carry no business logic, they resolve dependencies, construct
:class:`~app.services.upload_service.UploadService` inline, and wrap the
result in the standard envelope.

``POST /uploads/video`` and ``POST /uploads/image`` replace the old
"Upload media" page's direct-to-Storage, no-analysis behaviour - an
uploaded file is now run through the same detector as every other entry
point and stored as a real, reviewable session.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.core.config import Settings, get_settings
from app.core.constants import DEFAULT_VIDEO_SAMPLE_RATE_FPS
from app.dependencies.auth import CurrentUserDep
from app.dependencies.database import SupabaseClientDep
from app.dependencies.model import ModelManagerDep
from app.infra.repositories.media_repository import MediaRepository
from app.infra.repositories.session_repository import SessionRepository
from app.schemas.common import ApiResponse
from app.schemas.sessions import SessionDetail
from app.services.upload_service import UploadService

router = APIRouter(prefix="/uploads", tags=["Uploads"])

SettingsDep = Annotated[Settings, Depends(get_settings)]


@router.post(
    "/video",
    summary="Upload And Analyse Video",
    description=(
        "Upload a video (MP4, MOV, AVI or MKV) for one-shot analysis: the "
        "server samples and analyses it exactly like POST /analysis/video, "
        "burns the real detections into an annotated copy, stores it, and "
        "creates a session so it appears in Detection History. Returns 503 "
        "when the model is not loaded, 413 when the file is too large and "
        "415 for an unsupported type."
    ),
    response_model=ApiResponse[SessionDetail],
)
async def upload_video(
    user: CurrentUserDep,
    client: SupabaseClientDep,
    manager: ModelManagerDep,
    settings: SettingsDep,
    file: Annotated[UploadFile, File(description="Video to analyse and store.")],
    sample_rate: Annotated[
        float, Form(gt=0, description="Requested samples per second.")
    ] = DEFAULT_VIDEO_SAMPLE_RATE_FPS,
) -> ApiResponse[SessionDetail]:
    """Analyse and persist one uploaded video as a session.

    Args:
        user: Injected authenticated caller.
        client: Injected Supabase client.
        manager: Injected model manager.
        settings: Injected application settings, for the upload size limit.
        file: The multipart video upload.
        sample_rate: Requested samples per second.

    Returns:
        The standard envelope wrapping the newly created :class:`SessionDetail`.
    """
    content = await file.read()
    service = UploadService(
        manager,
        SessionRepository(client),
        MediaRepository(client),
        client,
        max_video_bytes=settings.max_video_size_bytes,
        max_image_bytes=settings.max_image_size_bytes,
    )
    result = await service.save_video(
        user,
        content=content,
        content_type=file.content_type,
        filename=file.filename,
        sample_rate=sample_rate,
    )
    return ApiResponse.ok(result, message="Video analysed and saved.")


@router.post(
    "/image",
    summary="Upload And Analyse Image",
    description=(
        "Upload a still image (JPEG, PNG or WebP) for one-shot analysis: "
        "the server analyses it exactly like POST /analysis/image, burns "
        "the real detections into an annotated copy, stores it, and "
        "creates a session so it appears in Detection History. Returns 503 "
        "when the model is not loaded, 413 when the file is too large and "
        "415 for an unsupported type."
    ),
    response_model=ApiResponse[SessionDetail],
)
async def upload_image(
    user: CurrentUserDep,
    client: SupabaseClientDep,
    manager: ModelManagerDep,
    settings: SettingsDep,
    file: Annotated[UploadFile, File(description="Image to analyse and store.")],
) -> ApiResponse[SessionDetail]:
    """Analyse and persist one uploaded image as a session.

    Args:
        user: Injected authenticated caller.
        client: Injected Supabase client.
        manager: Injected model manager.
        settings: Injected application settings, for the upload size limit.
        file: The multipart image upload.

    Returns:
        The standard envelope wrapping the newly created :class:`SessionDetail`.
    """
    content = await file.read()
    service = UploadService(
        manager,
        SessionRepository(client),
        MediaRepository(client),
        client,
        max_video_bytes=settings.max_video_size_bytes,
        max_image_bytes=settings.max_image_size_bytes,
    )
    result = await service.save_image(user, content=content, content_type=file.content_type)
    return ApiResponse.ok(result, message="Image analysed and saved.")
