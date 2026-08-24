"""Video analysis service (Phase G2).

Orchestrates one video analysis: validate the upload, decode it frame by
frame with OpenCV, run inference on a bounded sample of frames off the event
loop, and hand each frame's detections to the same pure domain classifier the
image path uses, then aggregate the sequence into a whole-clip summary.

Sampling, not full-rate decoding, is what keeps this inside one HTTP request:
a CPU forward pass per frame at the source frame rate would take minutes for
a typical clip. See :mod:`app.core.constants` for the sampling bounds.
"""

from __future__ import annotations

import contextlib
import dataclasses
import os
import tempfile
import time
from pathlib import Path
from typing import TYPE_CHECKING

import numpy as np
from fastapi.concurrency import run_in_threadpool

from app.core.constants import (
    ALLOWED_VIDEO_EXTENSIONS,
    ALLOWED_VIDEO_MIME_TYPES,
    DEFAULT_VIDEO_FALLBACK_FPS,
    MAX_ANNOTATED_VIDEO_FRAMES,
    MAX_VIDEO_SAMPLE_RATE_FPS,
    MAX_VIDEO_SAMPLED_FRAMES,
    MIN_VIDEO_SAMPLE_RATE_FPS,
)
from app.core.exceptions import (
    FileTooLargeError,
    ModelNotLoadedError,
    UnsupportedMediaError,
    VideoProcessingError,
)
from app.core.logging import get_logger
from app.domain.analysis import analyze_frame
from app.domain.video_analysis import FrameSample, VideoAnalysis, aggregate_video
from app.infra.video_encoder import FrameEncoder
from app.services import preview_store
from app.services.video_overlay import draw_overlay

if TYPE_CHECKING:
    from app.domain.models.manager import ModelManager

logger = get_logger(__name__)


class VideoAnalysisService:
    """Runs an uploaded video through validation, sampled inference and aggregation.

    Args:
        manager: The loaded model manager. Injected, never constructed here.
        max_video_bytes: Hard upper bound on an accepted upload.
    """

    def __init__(self, manager: ModelManager, *, max_video_bytes: int) -> None:
        """Bind the shared model manager and the upload size limit."""
        self._manager = manager
        self._max_video_bytes = max_video_bytes

    async def analyze_video(
        self,
        *,
        content: bytes,
        content_type: str | None,
        filename: str | None,
        sample_rate: float,
    ) -> VideoAnalysis:
        """Validate, decode and analyse one uploaded video.

        Args:
            content: Raw bytes of the uploaded file.
            content_type: Declared MIME type, or ``None``.
            filename: Original filename, used as a fallback when the declared
                MIME type is missing or wrong (see :data:`ALLOWED_VIDEO_EXTENSIONS`).
            sample_rate: Requested samples-per-second. Clamped to the
                configured bounds and further widened if the clip is long
                enough that honouring it would exceed the frame-count cap.

        Returns:
            The domain :class:`~app.domain.video_analysis.VideoAnalysis`.

        Raises:
            UnsupportedMediaError: Neither the MIME type nor the filename
                extension is an accepted video type, or the bytes cannot be
                decoded as a video.
            FileTooLargeError: The upload exceeds the configured size limit.
            VideoProcessingError: Decoding succeeded but no frame could be
                analysed, or the forward pass failed.
        """
        self._validate(content=content, content_type=content_type, filename=filename)
        requested_rate = min(MAX_VIDEO_SAMPLE_RATE_FPS, max(MIN_VIDEO_SAMPLE_RATE_FPS, sample_rate))

        with tempfile.NamedTemporaryFile(suffix=".bin", delete=False) as handle:
            handle.write(content)
            temp_path = Path(handle.name)

        try:
            return await run_in_threadpool(self._process_sync, temp_path, requested_rate)
        finally:
            temp_path.unlink(missing_ok=True)

    def _validate(self, *, content: bytes, content_type: str | None, filename: str | None) -> None:
        """Enforce MIME type or extension, and size, before spending work on decoding.

        Browsers are unreliable at sniffing a video's MIME type - particularly
        for ``.avi`` and ``.mkv`` on a host with no registered file
        association - so a file is accepted when *either* its declared MIME
        type or its filename extension is one the backend supports, matching
        the frontend's own pre-screening logic.

        Args:
            content: Raw upload bytes.
            content_type: Declared MIME type.
            filename: Original filename, for the extension fallback.

        Raises:
            UnsupportedMediaError: Neither check passes.
            FileTooLargeError: Over the configured size limit.
        """
        mime_ok = (
            content_type is not None
            and content_type.split(";")[0].strip() in ALLOWED_VIDEO_MIME_TYPES
        )
        extension_ok = filename is not None and Path(filename).suffix.lower() in (
            ALLOWED_VIDEO_EXTENSIONS
        )
        if not mime_ok and not extension_ok:
            raise UnsupportedMediaError("Upload must be an MP4, MOV, AVI or MKV video.")
        if len(content) > self._max_video_bytes:
            raise FileTooLargeError()
        if not content:
            raise UnsupportedMediaError("The uploaded video is empty.")

    def _process_sync(self, path: Path, requested_rate: float) -> VideoAnalysis:
        """Decode, sample, analyse and annotate the video. Runs in a worker thread.

        Every frame is decoded (annotation needs the full clip), but the
        model only ever runs on the sampled subset - drawing a box and
        encoding a frame costs nothing like a forward pass, so annotating
        every frame stays cheap even though inference stays bounded.

        Args:
            path: Filesystem path to the video, already written to disk.
            requested_rate: Clamped samples-per-second to aim for.

        Returns:
            The aggregated :class:`~app.domain.video_analysis.VideoAnalysis`,
            with ``preview_token`` set when an annotated preview was produced.

        Raises:
            UnsupportedMediaError: The file could not be opened as a video.
            VideoProcessingError: No frame could be decoded or analysed.
        """
        import cv2

        capture = cv2.VideoCapture(str(path))
        if not capture.isOpened():
            capture.release()
            raise UnsupportedMediaError("The uploaded file could not be decoded as a video.")

        preview_path: Path | None = None
        encoder: FrameEncoder | None = None
        try:
            source_fps = capture.get(cv2.CAP_PROP_FPS) or DEFAULT_VIDEO_FALLBACK_FPS
            frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
            width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
            height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)

            step_frames = self._sampling_step(
                source_fps=source_fps, frame_count=frame_count, requested_rate=requested_rate
            )
            actual_sample_fps = source_fps / step_frames

            preview_path, encoder = self._start_annotated_preview(
                width=width, height=height, fps=source_fps
            )

            samples: list[FrameSample] = []
            last_sample: FrameSample | None = None
            index = 0
            while True:
                if encoder is None and len(samples) >= MAX_VIDEO_SAMPLED_FRAMES:
                    break
                ok, frame_bgr = capture.read()
                if not ok:
                    break

                if index % step_frames == 0 and len(samples) < MAX_VIDEO_SAMPLED_FRAMES:
                    last_sample = self._analyze_one(frame_bgr, index / source_fps)
                    samples.append(last_sample)

                if encoder is not None:
                    if index >= MAX_ANNOTATED_VIDEO_FRAMES:
                        self._abort_annotated_preview(encoder, preview_path)
                        encoder, preview_path = None, None
                    else:
                        annotated = frame_bgr.copy()
                        draw_overlay(annotated, last_sample)
                        try:
                            encoder.write(annotated)
                        except VideoProcessingError:
                            logger.warning(
                                "Aborting annotated video preview: encoder write failed."
                            )
                            self._abort_annotated_preview(encoder, preview_path)
                            encoder, preview_path = None, None

                index += 1

            if not samples:
                raise VideoProcessingError("No frames could be decoded from the uploaded video.")

            preview_token = self._finish_annotated_preview(encoder, preview_path)
            # Ownership of the encoder/file is gone either way by this point
            # (registered, or already deleted on failure) - clearing these
            # stops the outer `finally` from touching them again.
            encoder, preview_path = None, None

            if frame_count <= 0:
                frame_count = index
            duration_sec = frame_count / source_fps if source_fps > 0 else 0.0

            result = aggregate_video(
                samples,
                duration_sec=round(duration_sec, 2),
                width=width,
                height=height,
                source_fps=round(source_fps, 2),
                source_frame_count=frame_count,
                sample_fps=round(actual_sample_fps, 3),
            )
            return dataclasses.replace(result, preview_token=preview_token)
        finally:
            capture.release()
            # Only non-None here if an exception propagated before the
            # encoder was finished above - e.g. inference failing mid-loop.
            # Without this, a failed analysis would leak the ffmpeg
            # subprocess and its partial output file.
            if encoder is not None and preview_path is not None:
                self._abort_annotated_preview(encoder, preview_path)

    @staticmethod
    def _start_annotated_preview(
        *, width: int, height: int, fps: float
    ) -> tuple[Path | None, FrameEncoder | None]:
        """Best-effort start of the annotated-preview encoder.

        Never raises: an uploaded clip failing analysis because the optional
        preview feature could not start would be a worse outcome than simply
        not offering a preview for it.

        Args:
            width: Source frame width, pixels. No preview is attempted when
                this (or ``height``) is unknown.
            height: Source frame height, pixels.
            fps: Frame rate to encode the preview at.

        Returns:
            A ``(path, encoder)`` pair, or ``(None, None)`` if annotation was
            not attempted or failed to start.
        """
        if width <= 0 or height <= 0:
            return None, None
        fd, name = tempfile.mkstemp(suffix=".mp4")
        os.close(fd)  # ffmpeg opens the path itself; -y lets it overwrite this empty file
        preview_path = Path(name)
        encoder = FrameEncoder()
        try:
            encoder.start(
                preview_path, width=width, height=height, fps=fps or DEFAULT_VIDEO_FALLBACK_FPS
            )
        except VideoProcessingError:
            logger.warning("Skipping annotated video preview: ffmpeg failed to start.")
            preview_path.unlink(missing_ok=True)
            return None, None
        return preview_path, encoder

    @staticmethod
    def _abort_annotated_preview(encoder: FrameEncoder, preview_path: Path) -> None:
        """Discard an in-progress annotated preview without raising.

        Args:
            encoder: The encoder to close.
            preview_path: The partial output file to delete.
        """
        with contextlib.suppress(VideoProcessingError):
            encoder.finish()
        preview_path.unlink(missing_ok=True)

    @staticmethod
    def _finish_annotated_preview(
        encoder: FrameEncoder | None, preview_path: Path | None
    ) -> str | None:
        """Flush the encoder and register the finished preview, if any.

        Args:
            encoder: The active encoder, or ``None`` if no preview was started.
            preview_path: The encoder's output path, matching ``encoder``.

        Returns:
            A lookup token for :mod:`app.services.preview_store`, or ``None``
            when there is no preview to serve.
        """
        if encoder is None or preview_path is None:
            return None
        try:
            encoder.finish()
        except VideoProcessingError:
            logger.warning("Discarding annotated video preview: ffmpeg failed to finish cleanly.")
            preview_path.unlink(missing_ok=True)
            return None
        return preview_store.register(preview_path)

    @staticmethod
    def _sampling_step(*, source_fps: float, frame_count: int, requested_rate: float) -> int:
        """Choose a frame stride that respects both the rate and the frame cap.

        The stride is only ever widened beyond what ``requested_rate`` alone
        would need, never narrowed - the response reports the rate this
        produces, so the frontend never displays a rate that was not applied.

        Args:
            source_fps: Source video's own frame rate.
            frame_count: Total frames in the source video, or ``0`` if unknown.
            requested_rate: Clamped samples-per-second to aim for.

        Returns:
            The number of source frames to advance between samples, at
            least 1.
        """
        rate_step = max(1, round(source_fps / requested_rate))
        if frame_count <= 0:
            return rate_step
        cap_step = -(-frame_count // MAX_VIDEO_SAMPLED_FRAMES)  # ceiling division
        return max(rate_step, cap_step)

    def _analyze_one(self, frame_bgr: np.ndarray, t_sec: float) -> FrameSample:
        """Run one decoded frame through the detector and the domain classifier.

        Args:
            frame_bgr: One decoded frame, OpenCV's native ``H x W x 3`` BGR array.
            t_sec: Offset of this frame from the start of the video, seconds.

        Returns:
            The timestamped :class:`~app.domain.video_analysis.FrameSample`.

        Raises:
            VideoProcessingError: The forward pass failed for this frame.
        """
        import cv2

        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        height, width = rgb.shape[0], rgb.shape[1]
        try:
            started = time.perf_counter()
            detections = self._manager.predict(rgb)
            inference_ms = (time.perf_counter() - started) * 1000.0
        except ModelNotLoadedError:
            raise
        except Exception as error:  # noqa: BLE001 - re-raised as a domain error below
            raise VideoProcessingError(
                f"AI inference failed on the frame at {t_sec:.2f}s."
            ) from error

        analysis = analyze_frame(
            detections,
            image_width=width,
            image_height=height,
            inference_ms=round(inference_ms, 2),
        )
        return FrameSample(t=round(t_sec, 3), analysis=analysis)
