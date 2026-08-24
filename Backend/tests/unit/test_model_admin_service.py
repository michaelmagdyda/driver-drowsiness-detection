"""Unit tests for :class:`app.services.model_admin_service.ModelAdminService`.

Runs against a real temporary directory of ``.pth``-named files (empty
placeholders - their *content* is irrelevant, since the fake backend
factory decides compatibility by filename, exactly like the real
`FasterRCNNBackend` decides it by shape-mismatch) so the directory-scanning,
id round-trip and path-escape guarding are exercised for real.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest

from app.core.exceptions import ModelNotLoadedError, ValidationError
from app.domain.models.base import ModelMetadata, RawDetection
from app.domain.models.manager import ModelManager
from app.services.model_admin_service import ModelAdminService

pytestmark = pytest.mark.unit


class _FakeBackend:
    """Compatible unless its filename contains "bad"."""

    def __init__(self, path: Path) -> None:
        self._path = path

    @property
    def checkpoint_path(self) -> Path:
        return self._path

    def load(self) -> None:
        if "bad" in self._path.name:
            raise ModelNotLoadedError("Anchor configuration mismatch.")

    def predict(self, image_rgb: np.ndarray) -> list[RawDetection]:  # noqa: ARG002
        return []

    def metadata(self) -> ModelMetadata:
        return ModelMetadata(architecture="fake", device="cpu", num_classes=3, score_threshold=0.5)


def make_service(checkpoints_dir: Path) -> tuple[ModelAdminService, ModelManager]:
    active_path = checkpoints_dir / "good.pth"
    manager = ModelManager(_FakeBackend(active_path), backend_factory=_FakeBackend)
    manager.load()
    service = ModelAdminService(
        manager, checkpoints_dir=checkpoints_dir, backend_factory=_FakeBackend
    )
    return service, manager


class TestListCheckpoints:
    def test_lists_real_files_with_real_compatibility(self, tmp_path: Path) -> None:
        (tmp_path / "good.pth").write_bytes(b"")
        (tmp_path / "bad.pth").write_bytes(b"")
        (tmp_path / "tuned").mkdir()
        (tmp_path / "tuned" / "good.pth").write_bytes(b"")
        service, _ = make_service(tmp_path)

        results = service.list_checkpoints()

        by_id = {r.id: r for r in results}
        assert set(by_id) == {"good.pth", "bad.pth", "tuned/good.pth"}
        assert by_id["good.pth"].compatible is True
        assert by_id["good.pth"].incompatible_reason is None
        assert by_id["bad.pth"].compatible is False
        assert "Anchor configuration mismatch" in by_id["bad.pth"].incompatible_reason
        assert by_id["tuned/good.pth"].directory == "tuned"
        assert by_id["good.pth"].directory == ""

    def test_marks_the_active_checkpoint(self, tmp_path: Path) -> None:
        (tmp_path / "good.pth").write_bytes(b"")
        (tmp_path / "bad.pth").write_bytes(b"")
        service, _ = make_service(tmp_path)

        results = {r.id: r for r in service.list_checkpoints()}

        assert results["good.pth"].active is True
        assert results["bad.pth"].active is False

    def test_missing_directory_returns_empty_list(self, tmp_path: Path) -> None:
        service, _ = make_service(tmp_path / "does-not-exist")

        assert service.list_checkpoints() == []


class TestActivate:
    def test_activates_a_real_compatible_checkpoint(self, tmp_path: Path) -> None:
        (tmp_path / "good.pth").write_bytes(b"")
        (tmp_path / "other.pth").write_bytes(b"")
        service, manager = make_service(tmp_path)

        results = service.activate("other.pth")

        assert manager.checkpoint_path == (tmp_path / "other.pth")
        assert {r.id: r.active for r in results} == {"good.pth": False, "other.pth": True}

    def test_rejects_an_incompatible_checkpoint_without_disrupting_the_active_one(
        self, tmp_path: Path
    ) -> None:
        (tmp_path / "good.pth").write_bytes(b"")
        (tmp_path / "bad.pth").write_bytes(b"")
        service, manager = make_service(tmp_path)

        with pytest.raises(ValidationError):
            service.activate("bad.pth")

        assert manager.checkpoint_path == (tmp_path / "good.pth")

    def test_rejects_an_unknown_id(self, tmp_path: Path) -> None:
        (tmp_path / "good.pth").write_bytes(b"")
        service, _ = make_service(tmp_path)

        with pytest.raises(ValidationError):
            service.activate("does-not-exist.pth")

    def test_rejects_a_path_escaping_the_checkpoints_directory(self, tmp_path: Path) -> None:
        (tmp_path / "good.pth").write_bytes(b"")
        service, _ = make_service(tmp_path)

        with pytest.raises(ValidationError):
            service.activate("../outside.pth")
