"""Model lifecycle owner.

The one object a route or service reaches the detector through
(03_Backend_Architecture.md §16). It holds the loaded backend, tracks its
status for the health endpoints, and guarantees the weights load exactly once
per process (§25) rather than on the first - or every - request.

A failed load is not fatal to the process (Deployment §23): the manager records
``FAILED`` and keeps serving every other endpoint, while inference requests get
a clean :class:`~app.core.exceptions.ModelNotLoadedError` (503) and an operator
can trigger a reload.
"""

from __future__ import annotations

import threading
from typing import TYPE_CHECKING

import numpy as np

from app.core.constants import ModelStatus
from app.core.exceptions import ModelNotLoadedError, ValidationError
from app.core.logging import get_logger

if TYPE_CHECKING:
    from collections.abc import Callable
    from pathlib import Path

    from app.domain.models.base import BaseModelBackend, ModelMetadata, RawDetection

logger = get_logger(__name__)


class ModelManager:
    """Owns a single detector backend and its load state.

    Args:
        backend: The detector to manage. Constructed cheaply; its weights are
            not touched until :meth:`load` is called.
        backend_factory: Builds a fresh, unloaded backend for an arbitrary
            checkpoint path. Optional - only :meth:`switch_checkpoint` needs
            it, and a manager built without one simply cannot switch.
    """

    def __init__(
        self,
        backend: BaseModelBackend,
        *,
        backend_factory: Callable[[Path], BaseModelBackend] | None = None,
    ) -> None:
        """Wrap a backend in the unloaded state; call :meth:`load` to load weights."""
        self._backend = backend
        self._backend_factory = backend_factory
        self._status: ModelStatus = ModelStatus.NOT_LOADED
        # Guards status transitions and serialises the forward pass. The torch
        # model is not guaranteed thread-safe for concurrent calls, and the
        # service offloads inference to a thread pool, so predictions are
        # serialised here rather than risking interleaved forward passes.
        self._lock = threading.Lock()

    @property
    def status(self) -> ModelStatus:
        """Current model status, as reported by the health endpoints."""
        return self._status

    @property
    def is_loaded(self) -> bool:
        """Whether the model is loaded and ready to serve inference."""
        return self._status is ModelStatus.LOADED

    @property
    def backend_factory(self) -> Callable[[Path], BaseModelBackend] | None:
        """The factory this manager uses to build a backend for a given path, if any.

        Exposed so callers building a *related* backend - the admin
        model-switching feature's compatibility dry-run - build it exactly
        the way :meth:`switch_checkpoint` itself would, rather than
        maintaining a second, potentially diverging factory.
        """
        return self._backend_factory

    @property
    def checkpoint_path(self) -> Path:
        """Checkpoint path of the currently active backend."""
        return self._backend.checkpoint_path

    def load(self, *, warmup: bool = False) -> None:
        """Load the backend's weights. Idempotent for an already-loaded model.

        Called from the application lifespan hook at startup. A failure is
        caught, recorded as :attr:`ModelStatus.FAILED`, and re-raised is
        *suppressed* here so startup completes - the service comes up degraded
        rather than not at all.

        Args:
            warmup: When ``True`` and the load succeeds, run one throwaway
                inference so the first real request does not pay for lazy kernel
                allocation.
        """
        with self._lock:
            if self._status is ModelStatus.LOADED:
                return
            self._status = ModelStatus.LOADING

        try:
            self._backend.load()
        except Exception:  # noqa: BLE001 - recorded, never crashes startup
            self._status = ModelStatus.FAILED
            logger.error("AI model failed to load; inference will return 503 until reloaded.")
            return

        self._status = ModelStatus.LOADED
        if warmup:
            self._warmup()

    def _warmup(self) -> None:
        """Run one best-effort throwaway inference. Failures are logged, not raised."""
        try:
            shape = getattr(self._backend, "warmup_shape", lambda: (64, 64, 3))()
            self._backend.predict(np.zeros(shape, dtype=np.uint8))
            logger.info("AI model warmup pass complete.")
        except Exception:  # noqa: BLE001 - warmup is an optimisation, never fatal
            logger.warning("AI model warmup pass failed; first request may be slower.")

    def predict(self, image_rgb: np.ndarray) -> list[RawDetection]:
        """Run inference, guarding against an unloaded model.

        Serialised under the manager lock: torch modules are not reliably safe
        for concurrent forward passes, and inference is offloaded to a thread
        pool by the service.

        Args:
            image_rgb: ``H x W x 3`` uint8 RGB array.

        Returns:
            Foreground detections above threshold.

        Raises:
            ModelNotLoadedError: The model is not in the ``LOADED`` state.
        """
        if self._status is not ModelStatus.LOADED:
            raise ModelNotLoadedError("The AI model is not currently available.")
        with self._lock:
            return self._backend.predict(image_rgb)

    def metadata(self) -> ModelMetadata | None:
        """Return backend metadata, or ``None`` when the model is not loaded."""
        if self._status is not ModelStatus.LOADED:
            return None
        return self._backend.metadata()

    def switch_checkpoint(self, new_path: Path) -> ModelMetadata:
        """Replace the active backend with one loaded from ``new_path``.

        Builds and loads the *new* backend before touching any shared state -
        a slow or failing load never blocks or disrupts inference already
        being served by the still-active old backend. Only on success is the
        swap made, atomically, under the same lock :meth:`predict` uses.

        Args:
            new_path: Checkpoint to load and make active.

        Returns:
            The newly active backend's metadata.

        Raises:
            ValidationError: No ``backend_factory`` was supplied at
                construction, or the new checkpoint failed to load - in
                either case the previously active backend is untouched and
                keeps serving inference.
        """
        if self._backend_factory is None:
            msg = "Switching the active model checkpoint is not supported."
            raise ValidationError(msg)

        new_backend = self._backend_factory(new_path)
        return self.switch_backend(new_backend)

    def switch_backend(self, new_backend: BaseModelBackend) -> ModelMetadata:
        """Load and install an already-constructed backend as the active one.

        The lower-level primitive :meth:`switch_checkpoint` builds on: it lets
        a caller that needs to vary something :meth:`switch_checkpoint` does
        not expose - such as the score threshold baked into the network at
        construction time (see ``FasterRCNNBackend``) - construct the backend
        itself and still get the same load-before-swap safety.

        Args:
            new_backend: An unloaded backend, already pointed at whichever
                checkpoint it should load.

        Returns:
            The newly active backend's metadata.

        Raises:
            ValidationError: The backend failed to load - the previously
                active backend is untouched and keeps serving inference.
        """
        try:
            new_backend.load()
        except ModelNotLoadedError as error:
            msg = f"Could not load this checkpoint: {error}"
            raise ValidationError(msg) from error

        with self._lock:
            self._backend = new_backend
            self._status = ModelStatus.LOADED
        logger.info("Active model backend switched.")
        return new_backend.metadata()
