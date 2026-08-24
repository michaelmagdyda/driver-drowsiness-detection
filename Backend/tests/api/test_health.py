"""Tests for the health endpoints and the cross-cutting Phase D behaviour.

Health checks are only half of what these cover. Because they were the first
endpoints to exist, they are also the vehicle for verifying the response
envelope, the exception handlers, correlation ids and CORS.

Readiness is covered against a **stubbed** ModelManager rather than the real
one. The real manager loads a 68 MB ONNX checkpoint; making every readiness
assertion pay for that would be slow, and would couple unit tests to a file
that is deliberately not in version control. The stub reports a status and
raises if anything tries to load or infer through it.
"""

from __future__ import annotations

from http import HTTPStatus
from pathlib import Path
from typing import TYPE_CHECKING, Any

import pytest

from app.core.constants import REQUEST_ID_HEADER, ModelStatus
from app.dependencies.model import get_optional_model_manager

if TYPE_CHECKING:
    from collections.abc import Callable

    from fastapi.testclient import TestClient

pytestmark = pytest.mark.api

VERSIONED_PREFIX = "/api/v1"


def assert_success_envelope(payload: dict[str, Any]) -> None:
    """Assert a payload matches the success envelope from API Specification §3.

    Args:
        payload: Decoded JSON response body.
    """
    assert set(payload) == {"success", "message", "data"}
    assert payload["success"] is True
    assert isinstance(payload["message"], str)
    assert payload["message"]


def assert_error_envelope(payload: dict[str, Any], expected_code: str) -> None:
    """Assert a payload matches the error envelope from API Specification §3.

    Args:
        payload: Decoded JSON response body.
        expected_code: The ``error_code`` the response must carry.
    """
    assert set(payload) == {"success", "message", "error_code", "errors"}
    assert payload["success"] is False
    assert payload["error_code"] == expected_code
    assert isinstance(payload["errors"], list)


class _StubModelManager:
    """Minimal stand-in for :class:`~app.domain.models.manager.ModelManager`.

    The health endpoints read exactly one thing - ``status`` - so a stub is
    enough, and it keeps the real 68 MB ONNX checkpoint out of unit tests.

    ``load`` and ``predict`` exist only to fail loudly. A readiness probe is
    called every few seconds for the life of a pod, so "it does not load or
    infer" is worth asserting rather than assuming.
    """

    def __init__(self, status: ModelStatus) -> None:
        """Record the status this stub reports."""
        self._status = status
        self.load_calls = 0
        self.predict_calls = 0

    @property
    def status(self) -> ModelStatus:
        """The configured status."""
        return self._status

    @property
    def is_loaded(self) -> bool:
        """Mirror the real manager's derivation rather than storing it twice."""
        return self._status is ModelStatus.LOADED

    def load(self, **_kwargs: object) -> None:
        """Fail: a health check must never (re)load the model."""
        self.load_calls += 1
        msg = "readiness must not load the model"
        raise AssertionError(msg)

    def predict(self, *_args: object, **_kwargs: object) -> None:
        """Fail: a health check must never run inference."""
        self.predict_calls += 1
        msg = "readiness must not run inference"
        raise AssertionError(msg)


@pytest.fixture
def stub_model_client(
    make_client: Callable[..., TestClient],
) -> Callable[[ModelStatus], tuple[TestClient, _StubModelManager]]:
    """Return a factory building a client whose model manager is stubbed.

    The client is intentionally *not* entered as a context manager, so the
    lifespan hook never runs and no real checkpoint is touched. The manager the
    endpoints see comes from the dependency override, following the same
    ``app.dependency_overrides`` pattern as the uploads and video tests.

    Args:
        make_client: Client factory.

    Returns:
        A callable taking a :class:`ModelStatus` and returning the client
        together with the stub, so a test can assert on the stub afterwards.
    """

    def _make(status: ModelStatus) -> tuple[TestClient, _StubModelManager]:
        client = make_client()
        manager = _StubModelManager(status)
        client.app.dependency_overrides[get_optional_model_manager] = lambda: manager
        return client, manager

    return _make


class TestLiveness:
    """``GET /health``."""

    def test_returns_success_envelope(self, client: TestClient) -> None:
        """Liveness responds 200 in the standard envelope."""
        response = client.get(f"{VERSIONED_PREFIX}/health")

        assert response.status_code == HTTPStatus.OK
        assert_success_envelope(response.json())

    def test_reports_version_and_environment(self, client: TestClient) -> None:
        """The payload identifies the running build."""
        data = client.get(f"{VERSIONED_PREFIX}/health").json()["data"]

        assert data["status"] == "ok"
        assert data["environment"] == "development"
        assert data["version"]
        assert data["timestamp"].endswith("Z")

    def test_survives_broken_dependencies(self, make_client: Callable[..., TestClient]) -> None:
        """Liveness stays 200 even when a dependency is unusable.

        This is the whole reason liveness and readiness are separate endpoints.
        An orchestrator restarts the container when liveness fails, so a missing
        model checkpoint must not be able to trigger a restart loop.
        """
        client = make_client(model_path=Path("/definitely/not/here.pth"))

        assert client.get(f"{VERSIONED_PREFIX}/health").status_code == HTTPStatus.OK

    @pytest.mark.parametrize(
        "status",
        [ModelStatus.FAILED, ModelStatus.NOT_LOADED, ModelStatus.LOADING],
    )
    def test_stays_healthy_while_the_model_is_not_ready(
        self,
        stub_model_client: Callable[..., tuple[TestClient, _StubModelManager]],
        status: ModelStatus,
    ) -> None:
        """A model that failed to load must not make the process look dead.

        Restarting the container cannot fix a bad checkpoint, so liveness must
        not report failure and invite a restart loop. This is the exact scenario
        where ``/health`` and ``/ready`` are required to disagree.

        Args:
            stub_model_client: Stubbed-manager client factory.
            status: Manager state under test.
        """
        client, _ = stub_model_client(status)

        health = client.get(f"{VERSIONED_PREFIX}/health")
        ready = client.get(f"{VERSIONED_PREFIX}/ready")

        assert health.status_code == HTTPStatus.OK
        assert ready.status_code == HTTPStatus.SERVICE_UNAVAILABLE

    def test_stays_healthy_with_no_manager_at_all(
        self, make_client: Callable[..., TestClient]
    ) -> None:
        """Liveness does not depend on the model manager existing."""
        client = make_client()

        assert client.get(f"{VERSIONED_PREFIX}/health").status_code == HTTPStatus.OK


class TestReadiness:
    """``GET /ready`` - reflects the real ModelManager, and says so in the status code."""

    def test_ready_when_model_is_loaded(
        self, stub_model_client: Callable[..., tuple[TestClient, _StubModelManager]]
    ) -> None:
        """A loaded model means 200 and ``ready: true``."""
        client, _ = stub_model_client(ModelStatus.LOADED)

        response = client.get(f"{VERSIONED_PREFIX}/ready")

        assert response.status_code == HTTPStatus.OK
        assert_success_envelope(response.json())
        assert response.json()["data"]["ready"] is True

    def test_unconfigured_supabase_does_not_block_readiness(
        self, stub_model_client: Callable[..., tuple[TestClient, _StubModelManager]]
    ) -> None:
        """Absent Supabase credentials report not_configured but stay ready.

        A deployment without database credentials still serves anonymous image
        analysis, so "deliberately absent" must not be reported as "broken".
        """
        client, _ = stub_model_client(ModelStatus.LOADED)

        response = client.get(f"{VERSIONED_PREFIX}/ready")
        data = response.json()["data"]
        statuses = {item["name"]: item["status"] for item in data["dependencies"]}

        assert response.status_code == HTTPStatus.OK
        assert data["ready"] is True
        assert statuses == {
            "database": "not_configured",
            "storage": "not_configured",
            "ai_model": "online",
        }

    @pytest.mark.parametrize(
        ("status", "expected_dependency_status"),
        [
            (ModelStatus.FAILED, "offline"),
            (ModelStatus.NOT_LOADED, "offline"),
            (ModelStatus.LOADING, "degraded"),
        ],
    )
    def test_unloaded_model_is_not_ready(
        self,
        stub_model_client: Callable[..., tuple[TestClient, _StubModelManager]],
        status: ModelStatus,
        expected_dependency_status: str,
    ) -> None:
        """Anything short of LOADED returns 503, because inference would 503 too.

        Args:
            stub_model_client: Stubbed-manager client factory.
            status: Manager state under test.
            expected_dependency_status: How that state is reported per-dependency.
        """
        client, _ = stub_model_client(status)

        response = client.get(f"{VERSIONED_PREFIX}/ready")
        data = response.json()["data"]
        model = next(item for item in data["dependencies"] if item["name"] == "ai_model")

        assert response.status_code == HTTPStatus.SERVICE_UNAVAILABLE
        assert data["ready"] is False
        assert model["status"] == expected_dependency_status

    def test_missing_manager_is_not_ready(self, make_client: Callable[..., TestClient]) -> None:
        """No manager on app.state at all returns 503.

        Uses a client that was never entered as a context manager, so the
        lifespan hook genuinely did not run. That exercises the real
        ``get_optional_model_manager`` lookup rather than an override.
        """
        client = make_client()

        response = client.get(f"{VERSIONED_PREFIX}/ready")
        data = response.json()["data"]
        model = next(item for item in data["dependencies"] if item["name"] == "ai_model")

        assert response.status_code == HTTPStatus.SERVICE_UNAVAILABLE
        assert data["ready"] is False
        assert model["status"] == "offline"

    def test_body_keeps_the_envelope_on_503(
        self, stub_model_client: Callable[..., tuple[TestClient, _StubModelManager]]
    ) -> None:
        """A not-ready response is still the standard envelope with a full payload.

        The status code is what an orchestrator reads; the body is what a human
        or a dashboard reads. Both have to work.
        """
        client, _ = stub_model_client(ModelStatus.FAILED)

        payload = client.get(f"{VERSIONED_PREFIX}/ready").json()

        assert_success_envelope(payload)
        assert payload["message"] == "Service is not ready."
        assert payload["data"]["ready"] is False
        assert len(payload["data"]["dependencies"]) == 3  # noqa: PLR2004 - db, storage, model

    def test_never_loads_or_infers(
        self, stub_model_client: Callable[..., tuple[TestClient, _StubModelManager]]
    ) -> None:
        """Readiness only observes the manager - it does not drive it.

        The stub raises on either call, so a regression would surface here as a
        500 rather than as a slow probe nobody notices.
        """
        client, manager = stub_model_client(ModelStatus.LOADED)

        assert client.get(f"{VERSIONED_PREFIX}/ready").status_code == HTTPStatus.OK
        assert manager.load_calls == 0
        assert manager.predict_calls == 0

    @pytest.mark.parametrize(
        "status", [ModelStatus.LOADED, ModelStatus.FAILED, ModelStatus.NOT_LOADED]
    )
    def test_detail_never_leaks_the_model_path(
        self, make_client: Callable[..., TestClient], status: ModelStatus
    ) -> None:
        """Frontend Integration §11 forbids exposing the model path, in any state.

        Args:
            make_client: Client factory.
            status: Manager state under test.
        """
        secret_path = Path("/srv/secret-models/best.onnx")
        client = make_client(model_path=secret_path)
        client.app.dependency_overrides[get_optional_model_manager] = lambda: _StubModelManager(
            status
        )

        body = client.get(f"{VERSIONED_PREFIX}/ready").text

        assert "secret-models" not in body
        assert "best.onnx" not in body
        assert "/srv" not in body


class TestSystemHealth:
    """``GET /system/health``."""

    def test_matches_specification_shape_exactly(
        self, stub_model_client: Callable[..., tuple[TestClient, _StubModelManager]]
    ) -> None:
        """The payload has precisely the four keys fixed by API Specification §19."""
        client, _ = stub_model_client(ModelStatus.LOADED)

        data = client.get(f"{VERSIONED_PREFIX}/system/health").json()["data"]

        assert set(data) == {"backend", "database", "storage", "ai"}

    @pytest.mark.parametrize(
        "status",
        [ModelStatus.LOADED, ModelStatus.LOADING, ModelStatus.NOT_LOADED, ModelStatus.FAILED],
    )
    def test_ai_reflects_the_real_manager_state(
        self,
        stub_model_client: Callable[..., tuple[TestClient, _StubModelManager]],
        status: ModelStatus,
    ) -> None:
        """``ai`` is the manager's status, not a hardcoded constant.

        Args:
            stub_model_client: Stubbed-manager client factory.
            status: Manager state under test.
        """
        client, _ = stub_model_client(status)

        data = client.get(f"{VERSIONED_PREFIX}/system/health").json()["data"]

        assert data["ai"] == status.value

    def test_reports_honest_state_for_other_subsystems(
        self, stub_model_client: Callable[..., tuple[TestClient, _StubModelManager]]
    ) -> None:
        """Unconfigured subsystems are reported as such, never hardcoded to healthy."""
        client, _ = stub_model_client(ModelStatus.LOADED)

        data = client.get(f"{VERSIONED_PREFIX}/system/health").json()["data"]

        assert data["backend"] == "online"
        assert data["database"] == "not_configured"
        assert data["storage"] == "not_configured"

    def test_missing_manager_reports_not_loaded(
        self, make_client: Callable[..., TestClient]
    ) -> None:
        """With no manager at all, the honest answer is not_loaded."""
        client = make_client()

        data = client.get(f"{VERSIONED_PREFIX}/system/health").json()["data"]

        assert data["ai"] == "not_loaded"


class TestRootProbeAliases:
    """Unversioned aliases mounted for orchestrator probes."""

    @pytest.mark.parametrize("path", ["/health", "/ready"])
    def test_alias_serves_the_same_payload(
        self,
        stub_model_client: Callable[..., tuple[TestClient, _StubModelManager]],
        path: str,
    ) -> None:
        """Root probes return what the versioned route returns.

        Args:
            stub_model_client: Stubbed-manager client factory.
            path: Root alias under test.
        """
        client, _ = stub_model_client(ModelStatus.LOADED)

        root = client.get(path)
        versioned = client.get(f"{VERSIONED_PREFIX}{path}")

        assert root.status_code == HTTPStatus.OK
        assert root.status_code == versioned.status_code
        assert root.json()["data"].keys() == versioned.json()["data"].keys()

    @pytest.mark.parametrize("status", [ModelStatus.FAILED, ModelStatus.NOT_LOADED])
    def test_both_ready_routes_agree_when_not_ready(
        self,
        stub_model_client: Callable[..., tuple[TestClient, _StubModelManager]],
        status: ModelStatus,
    ) -> None:
        """The root alias and the versioned route must not disagree.

        Infrastructure probes the root path while dashboards call the versioned
        one. A split verdict between them would be the worst kind of bug: each
        observer would be individually convinced it was right.

        Args:
            stub_model_client: Stubbed-manager client factory.
            status: Manager state under test.
        """
        client, _ = stub_model_client(status)

        root = client.get("/ready")
        versioned = client.get(f"{VERSIONED_PREFIX}/ready")

        assert root.status_code == HTTPStatus.SERVICE_UNAVAILABLE
        assert versioned.status_code == HTTPStatus.SERVICE_UNAVAILABLE
        assert root.json()["data"] == versioned.json()["data"]

    def test_aliases_are_hidden_from_the_schema(self, client: TestClient) -> None:
        """Only the versioned routes are documented, so /docs shows no duplicates."""
        paths = client.get("/openapi.json").json()["paths"]

        assert f"{VERSIONED_PREFIX}/health" in paths
        assert f"{VERSIONED_PREFIX}/ready" in paths
        assert f"{VERSIONED_PREFIX}/system/health" in paths
        assert "/health" not in paths
        assert "/ready" not in paths


class TestErrorEnvelope:
    """Exception handling, covering every route into an error response."""

    def test_unknown_route_uses_the_envelope(self, client: TestClient) -> None:
        """A 404 is not Starlette's default ``{"detail": ...}``."""
        response = client.get(f"{VERSIONED_PREFIX}/no-such-endpoint")

        assert response.status_code == HTTPStatus.NOT_FOUND
        assert_error_envelope(response.json(), "NOT_FOUND")

    def test_wrong_method_uses_the_envelope(self, client: TestClient) -> None:
        """A 405 is also wrapped."""
        response = client.post(f"{VERSIONED_PREFIX}/health")

        assert response.status_code == HTTPStatus.METHOD_NOT_ALLOWED
        assert_error_envelope(response.json(), "NOT_FOUND")

    def test_application_error_keeps_its_status_and_code(self, error_client: TestClient) -> None:
        """An AppError is serialised with the status and code it declares."""
        response = error_client.get("/__missing")

        assert response.status_code == HTTPStatus.NOT_FOUND
        assert_error_envelope(response.json(), "SESSION_NOT_FOUND")
        assert "sess-abc-123" in response.json()["message"]

    def test_service_unavailable_error(self, error_client: TestClient) -> None:
        """A 503-mapped AppError round-trips correctly."""
        response = error_client.get("/__unavailable")

        assert response.status_code == HTTPStatus.SERVICE_UNAVAILABLE
        assert_error_envelope(response.json(), "MODEL_NOT_LOADED")

    def test_unhandled_exception_returns_generic_500(self, error_client: TestClient) -> None:
        """An unexpected failure produces a 500 in the standard envelope."""
        response = error_client.get("/__boom")

        assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR
        assert_error_envelope(response.json(), "INTERNAL_SERVER_ERROR")

    @pytest.mark.parametrize(
        "secret",
        ["hunter2", "postgres://", "10.0.0.5", "RuntimeError", "Traceback"],
    )
    def test_unhandled_exception_leaks_nothing(self, error_client: TestClient, secret: str) -> None:
        """No internal detail escapes in a 500 body.

        The failing route raises an error containing a database URL with an
        embedded password. None of it may reach the client (§12, §21).

        Args:
            error_client: Client whose app exposes the failing route.
            secret: Fragment that must be absent from the response body.
        """
        body = error_client.get("/__boom").text

        assert secret not in body


class TestValidationErrors:
    """Request validation, and what it is allowed to say back."""

    def test_missing_field_reports_its_location(self, error_client: TestClient) -> None:
        """A 422 names the offending field."""
        response = error_client.post("/__echo", json={"email": "driver@example.com"})

        assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
        assert_error_envelope(response.json(), "VALIDATION_ERROR")
        assert response.json()["errors"][0]["field"] == "body.password"

    def test_submitted_values_are_never_echoed(self, error_client: TestClient) -> None:
        """The rejected value stays out of the response.

        Pydantic's raw error report includes ``input``. Passing it through would
        put a password in the response body - and in any log that records it.
        """
        response = error_client.post(
            "/__echo",
            json={"email": "driver@example.com", "password": "hunter2", "extra": 1},
        )

        assert "hunter2" not in response.text


class TestRequestCorrelation:
    """The ``X-Request-ID`` header."""

    def test_every_response_carries_an_id(self, client: TestClient) -> None:
        """Successful responses are correlatable."""
        assert client.get(f"{VERSIONED_PREFIX}/health").headers[REQUEST_ID_HEADER]

    def test_error_responses_carry_an_id(self, error_client: TestClient) -> None:
        """500s carry one too.

        These take a different path: Starlette's ServerErrorMiddleware sits
        outside the user middleware stack, so the header is attached by the
        exception handler instead. This asserts that substitution works - it is
        the response a user is most likely to be asked to quote.
        """
        assert error_client.get("/__boom").headers[REQUEST_ID_HEADER]

    def test_ids_are_unique_per_request(self, client: TestClient) -> None:
        """Two requests do not share an id."""
        first = client.get(f"{VERSIONED_PREFIX}/health").headers[REQUEST_ID_HEADER]
        second = client.get(f"{VERSIONED_PREFIX}/health").headers[REQUEST_ID_HEADER]

        assert first != second

    def test_client_supplied_id_is_honoured(self, client: TestClient) -> None:
        """A well-formed inbound id is reused, so a trace spans both tiers."""
        response = client.get(
            f"{VERSIONED_PREFIX}/health",
            headers={REQUEST_ID_HEADER: "frontend-trace-42"},
        )

        assert response.headers[REQUEST_ID_HEADER] == "frontend-trace-42"

    @pytest.mark.parametrize(
        "malicious",
        [
            "bad\r\ninjected-header: evil",
            "x" * 200,
            "spaces are not allowed",
            "semi;colon",
        ],
    )
    def test_malformed_id_is_replaced(self, client: TestClient, malicious: str) -> None:
        """An unsafe inbound id is discarded rather than trusted.

        An unvalidated value would let a caller inject newlines into the log
        stream and forge entries, or push an unbounded string through every
        record.

        Args:
            client: Test client.
            malicious: Header value that must not be echoed.
        """
        response = client.get(f"{VERSIONED_PREFIX}/health", headers={REQUEST_ID_HEADER: malicious})

        returned = response.headers[REQUEST_ID_HEADER]
        assert returned != malicious
        assert len(returned) == 32  # noqa: PLR2004 - uuid4().hex
