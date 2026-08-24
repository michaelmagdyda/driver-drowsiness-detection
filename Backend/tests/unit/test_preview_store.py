"""Unit tests for :mod:`app.services.preview_store`.

Time is controlled by monkeypatching ``time.monotonic`` inside the module
under test - the TTL logic is the whole point, and it needs to be exercised
deterministically rather than with real sleeps.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.services import preview_store

pytestmark = pytest.mark.unit


@pytest.fixture(autouse=True)
def _clear_registry() -> None:
    """Every test gets an empty registry, regardless of execution order."""
    preview_store._entries.clear()  # noqa: SLF001 - test-only reach into module state


def _touch(path: Path) -> Path:
    path.write_bytes(b"fake mp4 bytes")
    return path


class TestRegisterAndResolve:
    def test_resolve_returns_the_registered_path(self, tmp_path: Path) -> None:
        path = _touch(tmp_path / "clip.mp4")
        token = preview_store.register(path)
        assert preview_store.resolve(token) == path

    def test_resolve_unknown_token_returns_none(self) -> None:
        assert preview_store.resolve("does-not-exist") is None

    def test_tokens_are_unique(self, tmp_path: Path) -> None:
        a = preview_store.register(_touch(tmp_path / "a.mp4"))
        b = preview_store.register(_touch(tmp_path / "b.mp4"))
        assert a != b


class TestExpiry:
    def test_resolve_after_ttl_returns_none_and_deletes_file(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        path = _touch(tmp_path / "clip.mp4")
        clock = [1000.0]
        monkeypatch.setattr(preview_store.time, "monotonic", lambda: clock[0])

        token = preview_store.register(path)
        clock[0] += preview_store.PREVIEW_STORE_TTL_SECONDS + 1

        assert preview_store.resolve(token) is None
        assert not path.exists()

    def test_resolve_before_ttl_still_works(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        path = _touch(tmp_path / "clip.mp4")
        clock = [1000.0]
        monkeypatch.setattr(preview_store.time, "monotonic", lambda: clock[0])

        token = preview_store.register(path)
        clock[0] += preview_store.PREVIEW_STORE_TTL_SECONDS - 1

        assert preview_store.resolve(token) == path


class TestEviction:
    def test_registering_past_capacity_evicts_the_oldest(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        clock = [0.0]
        monkeypatch.setattr(preview_store.time, "monotonic", lambda: clock[0])
        monkeypatch.setattr(preview_store, "PREVIEW_STORE_MAX_ENTRIES", 3)

        tokens = []
        for i in range(4):
            clock[0] += 1
            tokens.append(preview_store.register(_touch(tmp_path / f"{i}.mp4")))

        assert preview_store.resolve(tokens[0]) is None
        assert preview_store.resolve(tokens[-1]) is not None
        assert len(preview_store._entries) == 3  # noqa: SLF001 - checking internal bound
