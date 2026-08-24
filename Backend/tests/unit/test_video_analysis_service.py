"""Unit tests for :mod:`app.services.video_analysis_service`.

The sampling-stride math is tested directly (no I/O). The end-to-end decode
path is tested against a real, tiny video written to disk with OpenCV's own
``VideoWriter`` - synthetic frames, but a genuine container and codec, so the
test exercises the real ``cv2.VideoCapture`` path rather than a mock of it.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest

from app.core.constants import MAX_VIDEO_SAMPLED_FRAMES
from app.core.exceptions import (
    FileTooLargeError,
    ModelNotLoadedError,
    UnsupportedMediaError,
    VideoProcessingError,
)
from app.domain.models.base import RawDetection
from app.services import preview_store
from app.services.video_analysis_service import VideoAnalysisService

pytestmark = pytest.mark.unit


@pytest.fixture(autouse=True)
def _clear_preview_registry() -> None:
    """Isolate each test's annotated-preview registrations from the others."""
    preview_store._entries.clear()  # noqa: SLF001 - test-only reach into module state


class _FakeManager:
    """Stands in for ModelManager: no torch, no lock, canned detections."""

    def __init__(self, detections: list[RawDetection] | Exception | None = None) -> None:
        self._detections = detections
        self.calls = 0

    def predict(self, _image_rgb: np.ndarray) -> list[RawDetection]:
        self.calls += 1
        if isinstance(self._detections, Exception):
            raise self._detections
        return self._detections or []


def _write_test_video(path: Path, *, frame_count: int, fps: float, size: tuple[int, int]) -> None:
    import cv2

    width, height = size
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), fps, (width, height))
    assert writer.isOpened(), "Test fixture could not open a VideoWriter - codec unavailable."
    for i in range(frame_count):
        frame = np.full((height, width, 3), fill_value=i % 256, dtype=np.uint8)
        writer.write(frame)
    writer.release()


@pytest.fixture
def video_bytes(tmp_path: Path) -> bytes:
    path = tmp_path / "clip.mp4"
    _write_test_video(path, frame_count=40, fps=10.0, size=(64, 48))
    return path.read_bytes()


class TestSamplingStep:
    def test_uses_rate_alone_when_within_cap(self) -> None:
        step = VideoAnalysisService._sampling_step(
            source_fps=30.0, frame_count=300, requested_rate=2.0
        )
        assert step == 15  # 30 / 2

    def test_widens_step_to_respect_frame_cap(self) -> None:
        step = VideoAnalysisService._sampling_step(
            source_fps=30.0, frame_count=30_000, requested_rate=5.0
        )
        # rate_step = 6, but 30000 frames / 120 cap needs a step of >= 250.
        assert step >= 250

    def test_falls_back_to_rate_step_when_frame_count_unknown(self) -> None:
        step = VideoAnalysisService._sampling_step(
            source_fps=25.0, frame_count=0, requested_rate=5.0
        )
        assert step == 5

    def test_never_returns_less_than_one(self) -> None:
        step = VideoAnalysisService._sampling_step(
            source_fps=1.0, frame_count=10, requested_rate=5.0
        )
        assert step >= 1


class TestValidate:
    def test_rejects_wrong_mime_type_and_extension(self) -> None:
        service = VideoAnalysisService(_FakeManager(), max_video_bytes=10_000_000)
        with pytest.raises(UnsupportedMediaError):
            service._validate(
                content=b"not a video", content_type="text/plain", filename="clip.txt"
            )

    def test_rejects_missing_mime_type_and_extension(self) -> None:
        service = VideoAnalysisService(_FakeManager(), max_video_bytes=10_000_000)
        with pytest.raises(UnsupportedMediaError):
            service._validate(content=b"data", content_type=None, filename=None)

    def test_accepts_correct_mime_type_with_no_filename(self) -> None:
        service = VideoAnalysisService(_FakeManager(), max_video_bytes=10_000_000)
        service._validate(content=b"data", content_type="video/mp4", filename=None)

    def test_accepts_wrong_mime_type_via_extension_fallback(self) -> None:
        # Browsers frequently mislabel .avi/.mkv as application/octet-stream
        # (or send no type at all) when the OS has no registered file
        # association - the filename extension is what saves a real upload.
        service = VideoAnalysisService(_FakeManager(), max_video_bytes=10_000_000)
        service._validate(
            content=b"data", content_type="application/octet-stream", filename="clip.mkv"
        )

    def test_accepts_missing_mime_type_via_extension_fallback(self) -> None:
        service = VideoAnalysisService(_FakeManager(), max_video_bytes=10_000_000)
        service._validate(content=b"data", content_type=None, filename="clip.avi")

    def test_extension_match_is_case_insensitive(self) -> None:
        service = VideoAnalysisService(_FakeManager(), max_video_bytes=10_000_000)
        service._validate(content=b"data", content_type=None, filename="CLIP.MP4")

    def test_rejects_oversized_upload(self) -> None:
        service = VideoAnalysisService(_FakeManager(), max_video_bytes=4)
        with pytest.raises(FileTooLargeError):
            service._validate(content=b"12345", content_type="video/mp4", filename="clip.mp4")

    def test_rejects_empty_upload(self) -> None:
        service = VideoAnalysisService(_FakeManager(), max_video_bytes=10_000_000)
        with pytest.raises(UnsupportedMediaError):
            service._validate(content=b"", content_type="video/mp4", filename="clip.mp4")


class TestAnalyzeVideo:
    async def test_decodes_and_aggregates_a_real_video(self, video_bytes: bytes) -> None:
        manager = _FakeManager([RawDetection(label_index=2, score=0.8, x1=0, y1=0, x2=10, y2=10)])
        service = VideoAnalysisService(manager, max_video_bytes=10_000_000)

        result = await service.analyze_video(
            content=video_bytes, content_type="video/mp4", filename="clip.mp4", sample_rate=2.0
        )

        assert result.source_frame_count == 40
        assert result.sampled_frame_count > 0
        assert result.sampled_frame_count <= MAX_VIDEO_SAMPLED_FRAMES
        assert result.width == 64
        assert result.height == 48
        assert manager.calls == result.sampled_frame_count

    async def test_produces_a_working_annotated_preview(self, video_bytes: bytes) -> None:
        manager = _FakeManager([RawDetection(label_index=2, score=0.8, x1=0, y1=0, x2=10, y2=10)])
        service = VideoAnalysisService(manager, max_video_bytes=10_000_000)

        result = await service.analyze_video(
            content=video_bytes, content_type="video/mp4", filename="clip.mp4", sample_rate=2.0
        )

        assert result.preview_token is not None
        path = preview_store.resolve(result.preview_token)
        assert path is not None
        assert path.exists()

        import cv2

        capture = cv2.VideoCapture(str(path))
        try:
            assert capture.isOpened()
            assert int(capture.get(cv2.CAP_PROP_FRAME_WIDTH)) == 64
            assert int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT)) == 48
        finally:
            capture.release()

    async def test_clamps_out_of_range_sample_rate(self, video_bytes: bytes) -> None:
        manager = _FakeManager([])
        service = VideoAnalysisService(manager, max_video_bytes=10_000_000)

        result = await service.analyze_video(
            content=video_bytes, content_type="video/mp4", filename="clip.mp4", sample_rate=999.0
        )

        # Clamped to MAX_VIDEO_SAMPLE_RATE_FPS before it ever reaches the codec.
        assert result.sample_fps <= 10.0  # cannot exceed the source video's own fps

    async def test_propagates_model_not_loaded(self, video_bytes: bytes) -> None:
        manager = _FakeManager(ModelNotLoadedError())
        service = VideoAnalysisService(manager, max_video_bytes=10_000_000)

        with pytest.raises(ModelNotLoadedError):
            await service.analyze_video(
                content=video_bytes,
                content_type="video/mp4",
                filename="clip.mp4",
                sample_rate=2.0,
            )
        # A failed analysis must not leak the annotated-preview encoder or
        # its temp file - see the outer `finally` in `_process_sync`.
        assert len(preview_store._entries) == 0  # noqa: SLF001

    async def test_wraps_unexpected_inference_failure(self, video_bytes: bytes) -> None:
        manager = _FakeManager(RuntimeError("boom"))
        service = VideoAnalysisService(manager, max_video_bytes=10_000_000)

        with pytest.raises(VideoProcessingError):
            await service.analyze_video(
                content=video_bytes,
                content_type="video/mp4",
                filename="clip.mp4",
                sample_rate=2.0,
            )
        assert len(preview_store._entries) == 0  # noqa: SLF001

    async def test_rejects_undecodable_file(self) -> None:
        manager = _FakeManager([])
        service = VideoAnalysisService(manager, max_video_bytes=10_000_000)

        with pytest.raises(UnsupportedMediaError):
            await service.analyze_video(
                content=b"this is not a real video container",
                content_type="video/mp4",
                filename="clip.mp4",
                sample_rate=2.0,
            )
