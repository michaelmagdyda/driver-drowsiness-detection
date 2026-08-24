"""API tests for ``POST /analysis/video``.

The 503 case runs against the real dependency chain (no model checkpoint at
the default path in a test environment), matching how ``test_sessions.py``
exercises the real auth 401. The validation and success cases override
``get_model_manager`` directly, following the existing
``app.dependency_overrides`` pattern.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import cv2
import numpy as np
import pytest

from app.dependencies.model import get_model_manager
from app.domain.models.base import RawDetection

pytestmark = pytest.mark.api


class _FakeManager:
    def __init__(self, detections: list[RawDetection] | None = None) -> None:
        self._detections = detections or []

    def predict(self, _image_rgb: np.ndarray) -> list[RawDetection]:
        return self._detections


def _write_test_video(path: Path, *, frame_count: int, fps: float, size: tuple[int, int]) -> None:
    width, height = size
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), fps, (width, height))
    assert writer.isOpened()
    for i in range(frame_count):
        writer.write(np.full((height, width, 3), fill_value=i % 256, dtype=np.uint8))
    writer.release()


@pytest.fixture
def video_file(tmp_path: Path) -> Path:
    path = tmp_path / "clip.mp4"
    _write_test_video(path, frame_count=20, fps=10.0, size=(64, 48))
    return path


def override_manager(app: Any, manager: _FakeManager) -> None:
    app.dependency_overrides[get_model_manager] = lambda: manager


class TestAnalyzeVideoRoute:
    def test_model_not_loaded_returns_503(self, make_client: Any, video_file: Path) -> None:
        built = make_client(model_path=Path("/nonexistent/checkpoint.pth"))
        with built as active_client, video_file.open("rb") as fh:
            response = active_client.post(
                "/api/v1/analysis/video",
                files={"file": ("clip.mp4", fh, "video/mp4")},
            )
        assert response.status_code == 503
        assert response.json()["error_code"] == "MODEL_NOT_LOADED"

    def test_rejects_unsupported_mime_type(self, make_client: Any, video_file: Path) -> None:
        built = make_client()
        override_manager(built.app, _FakeManager())
        with built as active_client, video_file.open("rb") as fh:
            response = active_client.post(
                "/api/v1/analysis/video",
                files={"file": ("clip.txt", fh, "text/plain")},
            )
        assert response.status_code == 415
        assert response.json()["error_code"] == "UNSUPPORTED_MEDIA"

    def test_accepts_mislabelled_video_via_extension_fallback(
        self, make_client: Any, video_file: Path
    ) -> None:
        # Browsers commonly send application/octet-stream (or no type at all)
        # for .avi/.mkv when the OS has no registered file association - the
        # upload must still succeed on the filename extension alone.
        built = make_client()
        override_manager(built.app, _FakeManager())
        with built as active_client, video_file.open("rb") as fh:
            response = active_client.post(
                "/api/v1/analysis/video",
                files={"file": ("clip.mkv", fh, "application/octet-stream")},
            )
        assert response.status_code == 200

    def test_rejects_oversized_upload(self, make_client: Any) -> None:
        built = make_client(max_video_size_mb=1)
        override_manager(built.app, _FakeManager())
        oversized = b"0" * (2 * 1024 * 1024)
        with built as active_client:
            response = active_client.post(
                "/api/v1/analysis/video",
                files={"file": ("clip.mp4", oversized, "video/mp4")},
            )
        assert response.status_code == 413
        assert response.json()["error_code"] == "FILE_TOO_LARGE"

    def test_analyzes_a_real_uploaded_video(self, make_client: Any, video_file: Path) -> None:
        built = make_client()
        override_manager(
            built.app,
            _FakeManager([RawDetection(label_index=2, score=0.75, x1=1, y1=1, x2=5, y2=5)]),
        )
        with built as active_client, video_file.open("rb") as fh:
            response = active_client.post(
                "/api/v1/analysis/video",
                files={"file": ("clip.mp4", fh, "video/mp4")},
                data={"sample_rate": "2"},
            )
        assert response.status_code == 200
        payload = response.json()
        assert payload["success"] is True
        data = payload["data"]
        assert data["source_frame_count"] == 20
        assert data["sampled_frame_count"] > 0
        assert data["video_width"] == 64
        assert data["video_height"] == 48
        assert "summary" in data
        assert data["summary"]["driver_state"] in {
            "AWAKE",
            "YAWNING",
            "DROWSY",
            "SLEEPING",
            "UNKNOWN",
        }
        assert isinstance(data["frames"], list)
        assert isinstance(data["timeline"], list)
        assert isinstance(data["distribution"], list)

    def test_annotated_preview_is_generated_and_fetchable(
        self, make_client: Any, video_file: Path
    ) -> None:
        built = make_client()
        override_manager(
            built.app,
            _FakeManager([RawDetection(label_index=2, score=0.75, x1=1, y1=1, x2=5, y2=5)]),
        )
        with built as active_client, video_file.open("rb") as fh:
            response = active_client.post(
                "/api/v1/analysis/video",
                files={"file": ("clip.mp4", fh, "video/mp4")},
            )
            data = response.json()["data"]
            assert data["preview_video_url"] is not None
            assert data["preview_video_url"].startswith("/analysis/video/preview/")

            preview_response = active_client.get(f"/api/v1{data['preview_video_url']}")
        assert preview_response.status_code == 200
        assert preview_response.headers["content-type"] == "video/mp4"
        assert len(preview_response.content) > 0

    def test_preview_route_404s_for_unknown_token(self, client: Any) -> None:
        response = client.get("/api/v1/analysis/video/preview/does-not-exist")
        assert response.status_code == 404
        assert response.json()["error_code"] == "NOT_FOUND"
