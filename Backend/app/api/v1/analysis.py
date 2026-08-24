"""AI analysis endpoints (Phase G).

Transport adapter only: accept the upload, delegate to
:class:`~app.services.analysis_service.AnalysisService`, and wrap the result in
the standard envelope. No business logic lives here (Coding Standards §6) - the
route neither validates the image nor interprets detections, it just moves data
across the HTTP boundary.

``POST /analysis/image``
    Analyse a single still image and return the driver state, alert level,
    fatigue score, detections and derived metrics.

``POST /analysis/video``
    Analyse an uploaded video by sampling frames through the same detector
    and return a whole-clip summary, per-frame trend and event timeline.

``GET /analysis/video/preview/{token}``
    Fetch the burned-in annotated video a prior ``POST /analysis/video``
    call generated, if any.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import FileResponse

from app.core.config import Settings, get_settings
from app.core.constants import DEFAULT_VIDEO_SAMPLE_RATE_FPS
from app.core.exceptions import NotFoundError
from app.dependencies.model import ModelManagerDep
from app.schemas.analysis import ImageAnalysisData, VideoAnalysisData
from app.schemas.common import ApiResponse
from app.services import preview_store
from app.services.analysis_service import AnalysisService
from app.services.video_analysis_service import VideoAnalysisService

router = APIRouter(prefix="/analysis", tags=["AI Analysis"])

SettingsDep = Annotated[Settings, Depends(get_settings)]


@router.post(
    "/image",
    summary="Analyse Image",
    description=(
        "Run drowsiness detection on a single uploaded image (JPEG, PNG or "
        "WebP). Returns the classified driver state, alert level, a 0-100 "
        "fatigue score, the detector's bounding boxes and derived eye/mouth "
        "metrics. Returns 503 when the model is not loaded, 413 when the file "
        "is too large and 415 for an unsupported type."
    ),
    response_model=ApiResponse[ImageAnalysisData],
)
async def analyze_image(
    manager: ModelManagerDep,
    settings: SettingsDep,
    file: Annotated[UploadFile, File(description="Image to analyse.")],
) -> ApiResponse[ImageAnalysisData]:
    """Analyse one uploaded image.

    Args:
        manager: Injected model manager.
        settings: Injected application settings, for the upload size limit.
        file: The multipart image upload.

    Returns:
        The standard envelope wrapping :class:`ImageAnalysisData`.
    """
    content = await file.read()
    service = AnalysisService(manager, max_image_bytes=settings.max_image_size_bytes)
    analysis = await service.analyze_image(content=content, content_type=file.content_type)
    return ApiResponse.ok(
        ImageAnalysisData.from_domain(analysis),
        message="Image analysed successfully.",
    )


@router.post(
    "/video",
    summary="Analyse Video",
    description=(
        "Run drowsiness detection on an uploaded video (MP4, MOV, AVI or "
        "MKV) by sampling frames through the same detector used for images. "
        "Returns a whole-clip summary, the per-frame trend and an event "
        "timeline. Long or high-frame-rate clips are sampled down to a "
        "bounded number of frames; the response reports the sample rate "
        "actually used, which may differ from the requested one. Returns "
        "503 when the model is not loaded, 413 when the file is too large "
        "and 415 for an unsupported type."
    ),
    response_model=ApiResponse[VideoAnalysisData],
)
async def analyze_video(
    manager: ModelManagerDep,
    settings: SettingsDep,
    file: Annotated[UploadFile, File(description="Video to analyse.")],
    sample_rate: Annotated[
        float,
        Form(
            gt=0,
            description="Requested samples per second. Clamped and possibly "
            "widened server-side; see the response for the rate actually used.",
        ),
    ] = DEFAULT_VIDEO_SAMPLE_RATE_FPS,
) -> ApiResponse[VideoAnalysisData]:
    """Analyse one uploaded video.

    Args:
        manager: Injected model manager.
        settings: Injected application settings, for the upload size limit.
        file: The multipart video upload.
        sample_rate: Requested samples per second.

    Returns:
        The standard envelope wrapping :class:`VideoAnalysisData`.
    """
    content = await file.read()
    service = VideoAnalysisService(manager, max_video_bytes=settings.max_video_size_bytes)
    analysis = await service.analyze_video(
        content=content,
        content_type=file.content_type,
        filename=file.filename,
        sample_rate=sample_rate,
    )
    return ApiResponse.ok(
        VideoAnalysisData.from_domain(analysis),
        message="Video analysed successfully.",
    )


@router.get(
    "/video/preview/{token}",
    summary="Fetch Annotated Video Preview",
    description=(
        "Stream the burned-in annotated MP4 produced by a prior video "
        "analysis, identified by the token in that response's "
        "`preview_video_url`. Previews expire after a short time and are not "
        "guaranteed to exist - a client should treat a 404 here as 'no "
        "longer available', not as an error to retry. Returns raw video "
        "bytes, not the standard JSON envelope."
    ),
    response_class=FileResponse,
)
async def get_video_preview(token: str) -> FileResponse:
    """Serve a previously generated annotated video preview.

    Args:
        token: The opaque id from ``VideoAnalysisData.preview_video_url``.

    Returns:
        The MP4 file. ``FileResponse`` supports HTTP Range requests, which is
        what lets the frontend's ``<video>`` element seek.

    Raises:
        NotFoundError: The token is unknown, or its preview has expired.
    """
    path = preview_store.resolve(token)
    if path is None or not path.exists():
        raise NotFoundError("This video preview is no longer available.")
    return FileResponse(path, media_type="video/mp4")
