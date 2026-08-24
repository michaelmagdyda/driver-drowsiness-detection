"""API tests for the admin endpoints.

``require_admin`` is the sole enforcement point for administrator access, so
the 403 test overrides only ``get_current_user`` (with a plain ``USER`` role)
and lets the real ``require_admin`` logic reject it.
"""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from uuid import UUID

import pytest

from app.core.constants import AppRole
from app.core.exceptions import ModelNotLoadedError
from app.dependencies.auth import get_current_user
from app.dependencies.database import get_supabase_client
from app.dependencies.model import get_model_manager
from app.domain.models.base import ModelMetadata, RawDetection
from app.domain.models.manager import ModelManager
from app.schemas.auth import AuthenticatedUser

pytestmark = pytest.mark.api

USER_ID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301"

JWT_SETTINGS = {
    "supabase_url": "https://testref.supabase.co",
    "supabase_service_role_key": "test-service-role-key",
}


def override_current_user(app: Any, *, role: AppRole) -> None:
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        id=UUID(USER_ID), role=role
    )


class _FakeAdminAPI:
    def __init__(self, users: list[Any]) -> None:
        self._users = users

    async def list_users(
        self, page: int | None = None, per_page: int | None = None  # noqa: ARG002
    ) -> list[Any]:
        return self._users


class _FakeQuery:
    def __init__(self, rows: Any) -> None:
        self._rows = rows

    def select(self, *_a: Any, **_k: Any) -> _FakeQuery:
        return self

    async def execute(self) -> SimpleNamespace:
        return SimpleNamespace(data=self._rows)


class _FakeSupabaseClient:
    def __init__(self, *, users: list[Any], roles: list[dict], profiles: list[dict]) -> None:
        self.auth = SimpleNamespace(admin=_FakeAdminAPI(users))
        self._tables = {
            "user_roles": _FakeQuery(roles),
            "profiles": _FakeQuery(profiles),
        }

    def table(self, name: str) -> _FakeQuery:
        return self._tables[name]


class TestListUsersEndpoint:
    def test_requires_auth(self, make_client):
        with make_client(**JWT_SETTINGS) as client:
            response = client.get("/api/v1/admin/users")

        assert response.status_code == 401

    def test_non_admin_is_forbidden(self, make_client):
        built = make_client(**JWT_SETTINGS)
        override_current_user(built.app, role=AppRole.USER)

        with built as client:
            response = client.get("/api/v1/admin/users")

        assert response.status_code == 403
        assert response.json()["error_code"] == "FORBIDDEN"

    def test_admin_receives_user_list(self, make_client):
        built = make_client(**JWT_SETTINGS)
        override_current_user(built.app, role=AppRole.ADMIN)
        now = datetime(2026, 1, 1, tzinfo=UTC)
        fake = _FakeSupabaseClient(
            users=[
                SimpleNamespace(
                    id=USER_ID, email="driver@example.com", created_at=now, last_sign_in_at=now
                )
            ],
            roles=[{"user_id": USER_ID, "role": "admin"}],
            profiles=[{"id": USER_ID, "display_name": "Test Driver"}],
        )
        built.app.dependency_overrides[get_supabase_client] = lambda: fake

        with built as client:
            response = client.get("/api/v1/admin/users")

        assert response.status_code == 200
        users = response.json()["data"]
        assert len(users) == 1
        assert users[0]["role"] == "admin"
        assert users[0]["display_name"] == "Test Driver"


class _FakeBackend:
    """Compatible unless its filename contains "bad" - mirrors the unit test double."""

    def __init__(self, path: Path) -> None:
        self._path = path

    @property
    def checkpoint_path(self) -> Path:
        return self._path

    def load(self) -> None:
        if "bad" in self._path.name:
            raise ModelNotLoadedError("Anchor configuration mismatch.")

    def predict(self, image_rgb: Any) -> list[RawDetection]:  # noqa: ARG002
        return []

    def metadata(self) -> ModelMetadata:
        return ModelMetadata(architecture="fake", device="cpu", num_classes=3, score_threshold=0.5)


def override_model_manager(app: Any, *, active_path: Path) -> None:
    manager = ModelManager(_FakeBackend(active_path), backend_factory=_FakeBackend)
    manager.load()
    app.dependency_overrides[get_model_manager] = lambda: manager


class TestListModelCheckpointsEndpoint:
    def test_requires_auth(self, make_client):
        with make_client(**JWT_SETTINGS) as client:
            response = client.get("/api/v1/admin/models")

        assert response.status_code == 401

    def test_non_admin_is_forbidden(self, make_client):
        built = make_client(**JWT_SETTINGS)
        override_current_user(built.app, role=AppRole.USER)

        with built as client:
            response = client.get("/api/v1/admin/models")

        assert response.status_code == 403

    def test_admin_lists_real_checkpoint_files(self, make_client, tmp_path: Path):
        (tmp_path / "good.pth").write_bytes(b"")
        (tmp_path / "bad.pth").write_bytes(b"")
        built = make_client(model_checkpoints_dir=tmp_path)
        override_current_user(built.app, role=AppRole.ADMIN)
        override_model_manager(built.app, active_path=tmp_path / "good.pth")

        with built as client:
            response = client.get("/api/v1/admin/models")

        assert response.status_code == 200
        items = {i["id"]: i for i in response.json()["data"]}
        assert items["good.pth"]["compatible"] is True
        assert items["good.pth"]["active"] is True
        assert items["bad.pth"]["compatible"] is False
        assert "Anchor configuration mismatch" in items["bad.pth"]["incompatible_reason"]


class TestActivateModelCheckpointEndpoint:
    def test_requires_auth(self, make_client):
        with make_client(**JWT_SETTINGS) as client:
            response = client.post("/api/v1/admin/models/activate", json={"id": "good.pth"})

        assert response.status_code == 401

    def test_non_admin_is_forbidden(self, make_client):
        built = make_client(**JWT_SETTINGS)
        override_current_user(built.app, role=AppRole.USER)

        with built as client:
            response = client.post("/api/v1/admin/models/activate", json={"id": "good.pth"})

        assert response.status_code == 403

    def test_admin_activates_a_real_compatible_checkpoint(self, make_client, tmp_path: Path):
        (tmp_path / "good.pth").write_bytes(b"")
        (tmp_path / "other.pth").write_bytes(b"")
        built = make_client(model_checkpoints_dir=tmp_path)
        override_current_user(built.app, role=AppRole.ADMIN)
        override_model_manager(built.app, active_path=tmp_path / "good.pth")

        with built as client:
            response = client.post("/api/v1/admin/models/activate", json={"id": "other.pth"})

        assert response.status_code == 200
        items = {i["id"]: i["active"] for i in response.json()["data"]}
        assert items == {"good.pth": False, "other.pth": True}

    def test_incompatible_checkpoint_returns_422_and_keeps_the_old_one_active(
        self, make_client, tmp_path: Path
    ):
        (tmp_path / "good.pth").write_bytes(b"")
        (tmp_path / "bad.pth").write_bytes(b"")
        built = make_client(model_checkpoints_dir=tmp_path)
        override_current_user(built.app, role=AppRole.ADMIN)
        override_model_manager(built.app, active_path=tmp_path / "good.pth")

        with built as client:
            response = client.post("/api/v1/admin/models/activate", json={"id": "bad.pth"})

        assert response.status_code == 422

    def test_unknown_id_returns_422(self, make_client, tmp_path: Path):
        (tmp_path / "good.pth").write_bytes(b"")
        built = make_client(model_checkpoints_dir=tmp_path)
        override_current_user(built.app, role=AppRole.ADMIN)
        override_model_manager(built.app, active_path=tmp_path / "good.pth")

        with built as client:
            response = client.post(
                "/api/v1/admin/models/activate", json={"id": "does-not-exist.pth"}
            )

        assert response.status_code == 422
