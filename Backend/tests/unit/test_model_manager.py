"""Unit tests for :class:`app.domain.models.manager.ModelManager`.

Uses a fake :class:`~app.domain.models.base.BaseModelBackend` rather than a
real torch model - the manager's own logic (status transitions, locking,
and the switch-without-disruption guarantee) has nothing to do with what a
backend's ``load``/``predict`` actually compute.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
import pytest

from app.core.constants import ModelStatus
from app.core.exceptions import ModelNotLoadedError, ValidationError
from app.domain.models.base import ModelMetadata, RawDetection
from app.domain.models.manager import ModelManager

pytestmark = pytest.mark.unit


class _FakeBackend:
    """A minimal, real (non-torch) stand-in for `BaseModelBackend`."""

    def __init__(self, path: Path, *, fail: bool = False) -> None:
        self._path = path
        self._fail = fail
        self.loaded = False
        self.load_calls = 0

    @property
    def checkpoint_path(self) -> Path:
        return self._path

    def load(self) -> None:
        self.load_calls += 1
        if self._fail:
            raise ModelNotLoadedError("This fake checkpoint was configured to fail.")
        self.loaded = True

    def predict(self, image_rgb: np.ndarray) -> list[RawDetection]:  # noqa: ARG002
        return [RawDetection(label_index=1, score=0.9, x1=0, y1=0, x2=5, y2=5)]

    def metadata(self) -> ModelMetadata:
        return ModelMetadata(architecture="fake", device="cpu", num_classes=3, score_threshold=0.5)


def make_manager(**kwargs: Any) -> tuple[ModelManager, _FakeBackend]:
    initial = _FakeBackend(Path("initial.pth"))
    manager = ModelManager(initial, **kwargs)
    manager.load()
    return manager, initial


class TestSwitchCheckpoint:
    def test_raises_without_a_backend_factory(self) -> None:
        manager, _ = make_manager()

        with pytest.raises(ValidationError):
            manager.switch_checkpoint(Path("other.pth"))

    def test_switches_to_the_new_checkpoint_on_success(self) -> None:
        built: list[_FakeBackend] = []

        def factory(path: Path) -> _FakeBackend:
            backend = _FakeBackend(path)
            built.append(backend)
            return backend

        manager, initial = make_manager(backend_factory=factory)

        metadata = manager.switch_checkpoint(Path("new.pth"))

        assert manager.checkpoint_path == Path("new.pth")
        assert manager.is_loaded
        assert metadata.architecture == "fake"
        assert built[0].loaded is True
        # The old backend was never touched by the switch.
        assert initial.load_calls == 1

    def test_failed_switch_leaves_the_old_backend_active(self) -> None:
        def factory(path: Path) -> _FakeBackend:
            return _FakeBackend(path, fail=True)

        manager, initial = make_manager(backend_factory=factory)

        with pytest.raises(ValidationError):
            manager.switch_checkpoint(Path("bad.pth"))

        assert manager.checkpoint_path == initial.checkpoint_path
        assert manager.is_loaded
        # Inference still works against the untouched original backend.
        assert manager.predict(np.zeros((4, 4, 3), dtype=np.uint8))

    def test_predict_uses_the_newly_active_backend(self) -> None:
        def factory(path: Path) -> _FakeBackend:
            return _FakeBackend(path)

        manager, _ = make_manager(backend_factory=factory)
        manager.switch_checkpoint(Path("new.pth"))

        result = manager.predict(np.zeros((4, 4, 3), dtype=np.uint8))

        assert result[0].label_index == 1


class TestCheckpointPath:
    def test_reports_the_active_backend_path(self) -> None:
        manager, initial = make_manager()

        assert manager.checkpoint_path == initial.checkpoint_path

    def test_reports_path_even_when_not_loaded(self) -> None:
        backend = _FakeBackend(Path("never-loaded.pth"))
        manager = ModelManager(backend)

        assert manager.checkpoint_path == Path("never-loaded.pth")
        assert manager.status is ModelStatus.NOT_LOADED
