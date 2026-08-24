"""Admin model-switching service (real checkpoint discovery and activation).

Lists the real ``.pth`` and ``.onnx`` files under the configured checkpoints
directory and lets an administrator make one of them the active model.
Compatibility is never guessed from a filename or folder name - each
candidate is verified by actually building a throwaway backend and loading
it, which is what catches an anchor-config mismatch between an older
training run and the currently vendored architecture (see
``app.domain.models.custom_frcnn``) instead of silently assuming every
checkpoint fits.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING

from app.core.exceptions import ModelNotLoadedError, ValidationError
from app.core.logging import get_logger
from app.schemas.admin import ModelCheckpointInfo

if TYPE_CHECKING:
    from collections.abc import Callable
    from pathlib import Path

    from app.domain.models.base import BaseModelBackend, ModelMetadata
    from app.domain.models.manager import ModelManager

logger = get_logger(__name__)


class ModelAdminService:
    """Discovers real checkpoint files and switches the active one.

    Args:
        manager: The process-wide model manager to report against and switch.
        checkpoints_dir: Directory scanned for candidate ``.pth``/``.onnx`` files.
        backend_factory: Builds an un-loaded backend for an arbitrary
            checkpoint path - the same one the manager itself uses, so a
            compatibility check exercises exactly the code path activation
            would.
        threshold_backend_factory: Builds an un-loaded backend for a
            checkpoint path *and* an explicit score threshold. Optional so
            callers that only ever list/activate checkpoints are not forced
            to supply it - :meth:`set_score_threshold` degrades to raising
            rather than failing construction when it is absent.
        device_backend_factory: Builds an un-loaded backend for a checkpoint
            path *and* an explicit device string (``"cpu"`` or ``"gpu"``).
            Optional for the same reason as ``threshold_backend_factory`` -
            :meth:`set_device` degrades to raising rather than failing
            construction when it is absent.
    """

    def __init__(
        self,
        manager: ModelManager,
        *,
        checkpoints_dir: Path,
        backend_factory: Callable[[Path], BaseModelBackend],
        threshold_backend_factory: Callable[[Path, float], BaseModelBackend] | None = None,
        device_backend_factory: Callable[[Path, str], BaseModelBackend] | None = None,
    ) -> None:
        """Bind the injected manager, directory and backend factories."""
        self._manager = manager
        self._checkpoints_dir = checkpoints_dir
        self._backend_factory = backend_factory
        self._threshold_backend_factory = threshold_backend_factory
        self._device_backend_factory = device_backend_factory

    def list_checkpoints(self) -> list[ModelCheckpointInfo]:
        """Scan the checkpoints directory and real-load-test every file found.

        Runs synchronously and is not cheap - each candidate is actually
        loaded (and discarded) to determine compatibility, the only honest
        way to answer the question. Callers on the request path should offload
        this to a worker thread.

        Returns:
            One entry per ``.pth`` or ``.onnx`` file found, sorted by id for a
            stable listing.
        """
        if not self._checkpoints_dir.is_dir():
            logger.warning("Checkpoints directory does not exist: %s", self._checkpoints_dir)
            return []

        active_path = self._resolve_active_path()
        candidates = {
            *self._checkpoints_dir.rglob("*.pth"),
            *self._checkpoints_dir.rglob("*.onnx"),
        }
        infos = [self._describe(path, active_path) for path in candidates]
        infos.sort(key=lambda info: info.id)
        return infos

    def activate(self, checkpoint_id: str) -> list[ModelCheckpointInfo]:
        """Make one real checkpoint the active model.

        Args:
            checkpoint_id: A :attr:`ModelCheckpointInfo.id` from a prior
                :meth:`list_checkpoints` call.

        Returns:
            The refreshed checkpoint listing, reflecting the new active model.

        Raises:
            ValidationError: The id does not resolve to a real file inside
                the checkpoints directory, or that file failed to load - the
                previously active model is left running in either case.
        """
        path = self._resolve_id(checkpoint_id)
        self._manager.switch_checkpoint(path)
        return self.list_checkpoints()

    def current_metadata(self) -> ModelMetadata:
        """Return the currently active backend's real metadata.

        Args:
            None.

        Returns:
            The active backend's :class:`~app.domain.models.base.ModelMetadata`
            (architecture, device, class count, score threshold).

        Raises:
            ModelNotLoadedError: No model is currently loaded.
        """
        metadata = self._manager.metadata()
        if metadata is None:
            raise ModelNotLoadedError("The AI model is not currently available.")
        return metadata

    def set_score_threshold(self, score_threshold: float) -> ModelMetadata:
        """Rebuild the active checkpoint at a new minimum detection score.

        The threshold is baked into this network at construction time (its
        RoI head applies it inside its own forward pass), so changing it
        means rebuilding and reloading the backend - the same load-before-swap
        safety :meth:`activate` gets, just holding the checkpoint path fixed
        and varying the threshold instead.

        Args:
            score_threshold: The new minimum detection score, in ``[0, 1]``.

        Returns:
            The rebuilt backend's metadata, with the new threshold applied.

        Raises:
            ValidationError: No ``threshold_backend_factory`` was supplied at
                construction, or the rebuild failed to load - in either case
                the previously active backend is untouched and keeps serving
                inference.
        """
        if self._threshold_backend_factory is None:
            msg = "Changing the confidence threshold is not supported."
            raise ValidationError(msg)
        path = self._manager.checkpoint_path
        new_backend = self._threshold_backend_factory(path, score_threshold)
        return self._manager.switch_backend(new_backend)

    def set_device(self, device: str) -> ModelMetadata:
        """Rebuild the active checkpoint targeting a new compute device.

        The execution provider is selected when the ``InferenceSession`` (or,
        for the PyTorch backend, the ``torch.device``) is constructed, so
        changing it means rebuilding and reloading the backend - the same
        load-before-swap safety :meth:`activate` and
        :meth:`set_score_threshold` get, just holding the checkpoint path and
        threshold fixed and varying the device instead.

        A ``"gpu"`` request never fails outright: the resulting backend picks
        the best GPU execution provider actually available (falling back to
        CPU silently, exactly like ``MODEL_DEVICE=auto`` at startup) - see
        ``app.domain.models.onnx_backend._resolve_providers``. Callers should
        compare the returned metadata's ``device`` against the request to
        tell a real switch from a silent CPU fallback.

        Args:
            device: ``"cpu"`` or ``"gpu"``.

        Returns:
            The rebuilt backend's metadata, with the real device it ended up
            running on.

        Raises:
            ValidationError: No ``device_backend_factory`` was supplied at
                construction, or the rebuild failed to load - in either case
                the previously active backend is untouched and keeps serving
                inference.
        """
        if self._device_backend_factory is None:
            msg = "Changing the compute backend is not supported."
            raise ValidationError(msg)
        path = self._manager.checkpoint_path
        new_backend = self._device_backend_factory(path, device)
        return self._manager.switch_backend(new_backend)

    def _resolve_id(self, checkpoint_id: str) -> Path:
        """Turn a submitted id back into a real path inside the checkpoints directory.

        Args:
            checkpoint_id: Client-submitted, untrusted path fragment.

        Returns:
            The resolved, verified-real path.

        Raises:
            ValidationError: The id escapes the checkpoints directory or does
                not name a real file.
        """
        root = self._checkpoints_dir.resolve()
        candidate = (root / checkpoint_id).resolve()
        if root not in candidate.parents or not candidate.is_file():
            msg = "Unknown checkpoint."
            raise ValidationError(msg)
        return candidate

    def _resolve_active_path(self) -> Path | None:
        """Best-effort resolved path of the manager's current checkpoint."""
        try:
            return self._manager.checkpoint_path.resolve()
        except OSError:
            return None

    def _describe(self, path: Path, active_path: Path | None) -> ModelCheckpointInfo:
        """Build one :class:`ModelCheckpointInfo`, including a real compatibility check.

        Args:
            path: The checkpoint file to describe.
            active_path: The manager's resolved current checkpoint path, or
                ``None``.

        Returns:
            The populated info, real on every field.
        """
        compatible, reason = self._check_compatible(path)
        stat = path.stat()
        relative = path.relative_to(self._checkpoints_dir)
        directory = "" if str(relative.parent) == "." else relative.parent.as_posix()
        return ModelCheckpointInfo(
            id=relative.as_posix(),
            filename=path.name,
            directory=directory,
            size_bytes=stat.st_size,
            modified_at=datetime.fromtimestamp(stat.st_mtime, tz=UTC),
            compatible=compatible,
            incompatible_reason=reason,
            active=active_path is not None and path.resolve() == active_path,
        )

    def _check_compatible(self, path: Path) -> tuple[bool, str | None]:
        """Real dry-run load: build a throwaway backend and try to load it.

        The backend is never installed on the manager regardless of outcome -
        this only answers "would activation succeed", it never activates.

        Args:
            path: Checkpoint file to test.

        Returns:
            ``(True, None)`` if it loaded, ``(False, reason)`` otherwise.
        """
        try:
            backend = self._backend_factory(path)
            backend.load()
        except ModelNotLoadedError as error:
            return False, str(error)
        except Exception as error:  # noqa: BLE001 - surfaced to the admin, not raised
            logger.warning("Unexpected error dry-loading checkpoint %s: %s", path, error)
            return False, "This checkpoint could not be loaded."
        return True, None
