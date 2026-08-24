"""Unit tests for :mod:`app.infra.video_encoder`.

Runs the real bundled ffmpeg binary end-to-end (no mocking) - the whole
point of this module is producing a file every browser can actually decode,
so the test re-opens the output with OpenCV and asserts on real frame count
and dimensions rather than trusting a zero exit code alone.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest

from app.core.exceptions import VideoProcessingError
from app.infra.video_encoder import FrameEncoder

pytestmark = pytest.mark.unit


def _frame(width: int, height: int, value: int) -> np.ndarray:
    return np.full((height, width, 3), fill_value=value, dtype=np.uint8)


class TestFrameEncoder:
    def test_encodes_real_decodable_h264_video(self, tmp_path: Path) -> None:
        output = tmp_path / "out.mp4"
        encoder = FrameEncoder()
        encoder.start(output, width=64, height=48, fps=10.0)
        for i in range(20):
            encoder.write(_frame(64, 48, i % 256))
        encoder.finish()

        assert output.exists()
        assert output.stat().st_size > 0

        import cv2

        capture = cv2.VideoCapture(str(output))
        try:
            assert capture.isOpened()
            assert int(capture.get(cv2.CAP_PROP_FRAME_WIDTH)) == 64
            assert int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT)) == 48
            decoded = 0
            while True:
                ok, _ = capture.read()
                if not ok:
                    break
                decoded += 1
            assert decoded > 0
        finally:
            capture.release()

    def test_finish_without_start_is_a_no_op(self) -> None:
        FrameEncoder().finish()  # must not raise

    def test_write_without_start_raises(self) -> None:
        encoder = FrameEncoder()
        with pytest.raises(VideoProcessingError):
            encoder.write(_frame(8, 8, 0))

    def test_write_after_finish_raises(self, tmp_path: Path) -> None:
        output = tmp_path / "out.mp4"
        encoder = FrameEncoder()
        encoder.start(output, width=32, height=32, fps=5.0)
        encoder.write(_frame(32, 32, 1))
        encoder.finish()
        with pytest.raises(VideoProcessingError):
            encoder.write(_frame(32, 32, 1))

    def test_start_with_unwritable_output_path_raises(self, tmp_path: Path) -> None:
        # A directory used as the output path is never a valid file target.
        bad_output = tmp_path / "not-a-file-dir"
        bad_output.mkdir()
        encoder = FrameEncoder()
        with pytest.raises(VideoProcessingError):
            encoder.start(bad_output, width=32, height=32, fps=5.0)
            encoder.write(_frame(32, 32, 1))
            encoder.finish()
