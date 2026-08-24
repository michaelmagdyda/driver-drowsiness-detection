"""Raw-frame-to-H.264 encoder, backed by a real ffmpeg binary (Phase G2).

OpenCV's own ``cv2.VideoWriter`` cannot produce H.264 on a host with no
OpenH264 library installed - the common case for a fresh machine - so it is
not used here at all. Instead, annotated frames are piped as raw bytes into
``ffmpeg``'s stdin, which encodes them to a browser-playable MP4. The binary
itself comes from ``imageio-ffmpeg``, which bundles a portable, statically
linked build - no system package, no separate download, identical behaviour
on every machine the app runs on.

This is a thin subprocess wrapper and nothing else: it has no opinion about
what the frames contain, and callers are responsible for producing ``H x W x
3`` BGR ``uint8`` arrays (OpenCV's native layout) at the declared resolution.
"""

from __future__ import annotations

import subprocess
from pathlib import Path
from typing import TYPE_CHECKING

from app.core.exceptions import VideoProcessingError
from app.core.logging import get_logger

if TYPE_CHECKING:
    import numpy as np

logger = get_logger(__name__)

_ENCODE_TIMEOUT_SECONDS = 120
"""Upper bound on the final ffmpeg flush-and-exit wait.

Frames are written incrementally as they are produced, so this only bounds
ffmpeg's own encoder flush after the last frame - not the whole video's
processing time.
"""


def _ffmpeg_path() -> str:
    """Return the path to the bundled ffmpeg binary.

    Imported lazily so a host without the optional annotated-preview feature
    working (see :func:`FrameEncoder.start`) never pays the import cost, and
    so the dependency's absence surfaces as a clean, catchable error rather
    than a module-level import failure.

    Returns:
        Absolute path to the ``imageio-ffmpeg``-bundled executable.
    """
    import imageio_ffmpeg

    return imageio_ffmpeg.get_ffmpeg_exe()


class FrameEncoder:
    """Encodes a sequence of raw BGR frames to an H.264 MP4 file.

    Usage::

        encoder = FrameEncoder()
        encoder.start(output_path, width=640, height=480, fps=30.0)
        for frame in frames:
            encoder.write(frame)
        encoder.finish()

    Args:
        None. Configuration is supplied to :meth:`start`.
    """

    def __init__(self) -> None:
        """Create an encoder with no active process."""
        self._process: subprocess.Popen[bytes] | None = None

    def start(self, output_path: Path, *, width: int, height: int, fps: float) -> None:
        """Launch the ffmpeg subprocess, ready to receive raw frames on stdin.

        Args:
            output_path: Destination for the encoded MP4. Overwritten if it
                already exists.
            width: Frame width, pixels. Must match every frame passed to
                :meth:`write` exactly - ffmpeg has no way to detect a
                mismatch from raw video and will produce corrupt output.
            height: Frame height, pixels.
            fps: Output frame rate. Matched to the source video's own rate so
                the annotated clip plays back at the same real-world speed.

        Raises:
            VideoProcessingError: The ffmpeg binary could not be located or
                launched.
        """
        try:
            binary = _ffmpeg_path()
        except Exception as error:  # noqa: BLE001 - reported as a domain error
            raise VideoProcessingError(
                "The annotated video preview could not be generated."
            ) from error

        command = [
            binary,
            "-y",
            "-f",
            "rawvideo",
            "-vcodec",
            "rawvideo",
            "-pix_fmt",
            "bgr24",
            "-s",
            f"{width}x{height}",
            "-r",
            f"{fps:.3f}",
            "-i",
            "-",
            "-an",
            "-vcodec",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "23",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(output_path),
        ]
        try:
            self._process = subprocess.Popen(  # noqa: S603 - fixed argv, no shell, no user-controlled binary path
                command,
                stdin=subprocess.PIPE,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
            )
        except OSError as error:
            raise VideoProcessingError(
                "The annotated video preview could not be generated."
            ) from error

    def write(self, frame_bgr: np.ndarray) -> None:
        """Send one frame to the encoder.

        Args:
            frame_bgr: ``H x W x 3`` uint8 BGR array matching the dimensions
                passed to :meth:`start`.

        Raises:
            VideoProcessingError: ffmpeg exited (or its pipe closed) before
                this frame was written - usually because it rejected the
                configuration in :meth:`start`.
        """
        if self._process is None or self._process.stdin is None:
            raise VideoProcessingError("The annotated video preview could not be generated.")
        try:
            self._process.stdin.write(frame_bgr.tobytes())
        except (BrokenPipeError, OSError) as error:
            raise VideoProcessingError(
                "The annotated video preview could not be generated."
            ) from error

    def finish(self) -> None:
        """Close the input stream and wait for ffmpeg to flush the output file.

        Raises:
            VideoProcessingError: ffmpeg exited with a non-zero status.
        """
        if self._process is None:
            return
        stderr_tail = b""
        try:
            if self._process.stdin is not None:
                self._process.stdin.close()
            _, stderr_tail = self._process.communicate(timeout=_ENCODE_TIMEOUT_SECONDS)
        except subprocess.TimeoutExpired as error:
            self._process.kill()
            self._process.communicate()
            raise VideoProcessingError(
                "The annotated video preview could not be generated."
            ) from error
        finally:
            returncode = self._process.returncode
            self._process = None

        if returncode != 0:
            logger.warning(
                "ffmpeg exited with status %s while encoding an annotated preview: %s",
                returncode,
                stderr_tail[-2000:].decode("utf-8", errors="replace"),
            )
            raise VideoProcessingError("The annotated video preview could not be generated.")
