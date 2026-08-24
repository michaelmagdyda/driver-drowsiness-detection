"""Admin endpoints - real user/role listing only.

Every route here is gated by :data:`~app.dependencies.auth.AdminUserDep` -
the sole enforcement point for administrator access, per
``app/dependencies/__init__.py``'s Phase-E plan.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.concurrency import run_in_threadpool

from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.dependencies.auth import AdminUserDep
from app.dependencies.database import SupabaseClientDep
from app.dependencies.model import ModelManagerDep
from app.domain.models import build_backend

if TYPE_CHECKING:
    from app.domain.models.base import ModelMetadata
from app.infra.repositories.admin_repository import AdminRepository
from app.schemas.admin import (
    ActivateModelRequest,
    AdminUser,
    ModelCheckpointInfo,
    ModelMetadataInfo,
    SetDeviceRequest,
    SetScoreThresholdRequest,
)
from app.schemas.common import ApiResponse
from app.services.admin_service import AdminService
from app.services.model_admin_service import ModelAdminService

logger = get_logger(__name__)

router = APIRouter(prefix="/admin", tags=["Admin"])

PageParam = Annotated[int | None, Query(ge=1, description="1-based page number.")]
PerPageParam = Annotated[int | None, Query(ge=1, le=200, description="Rows per page.")]
SettingsDep = Annotated[Settings, Depends(get_settings)]


def _model_admin_service(manager: ModelManagerDep, settings: SettingsDep) -> ModelAdminService:
    """Build a :class:`ModelAdminService` for the current request.

    Reuses the manager's own ``backend_factory`` rather than building a
    second one from settings, so a compatibility dry-run exercises exactly
    the code path :meth:`~app.domain.models.manager.ModelManager.switch_checkpoint`
    itself would (and so a test overriding the manager can control it).

    Args:
        manager: Injected process-wide model manager.
        settings: Injected application settings, for the checkpoints
            directory and as a fallback factory source.

    Returns:
        A service bound to the live manager and real checkpoints directory.
    """
    factory = manager.backend_factory or (lambda path: build_backend(settings, path))
    return ModelAdminService(
        manager,
        checkpoints_dir=settings.model_checkpoints_dir,
        backend_factory=factory,
        threshold_backend_factory=lambda path, threshold: build_backend(
            settings, path, score_threshold=threshold
        ),
        device_backend_factory=lambda path, device: build_backend(settings, path, device=device),
    )


def _metadata_info(metadata: ModelMetadata) -> ModelMetadataInfo:
    """Convert the domain metadata dataclass to its wire schema.

    Args:
        metadata: Real metadata from the currently active backend.

    Returns:
        The equivalent :class:`ModelMetadataInfo`.
    """
    return ModelMetadataInfo(
        architecture=metadata.architecture,
        device=metadata.device,
        num_classes=metadata.num_classes,
        score_threshold=metadata.score_threshold,
    )


@router.get(
    "/users",
    summary="List Users",
    description="List every registered user with their profile and effective role. Admin only.",
    response_model=ApiResponse[list[AdminUser]],
)
async def list_users(
    admin: AdminUserDep,
    client: SupabaseClientDep,
    page: PageParam = None,
    per_page: PerPageParam = None,
) -> ApiResponse[list[AdminUser]]:
    """List every registered user.

    Args:
        admin: Injected caller, already confirmed to hold the admin role.
        client: Injected Supabase client.
        page: 1-based page number, or ``None`` for the default.
        per_page: Rows per page, or ``None`` for the default.

    Returns:
        The standard envelope wrapping a list of :class:`AdminUser`.
    """
    logger.info("Admin user list requested by %s", admin.id)
    service = AdminService(AdminRepository(client))
    result = await service.list_users(page=page, per_page=per_page)
    return ApiResponse.ok(result, message="Users retrieved.")


@router.get(
    "/models",
    summary="List Model Checkpoints",
    description=(
        "List every real .pth checkpoint under the configured checkpoints "
        "directory, each real-load-tested against the current architecture "
        "so compatibility is never guessed from a filename. Admin only. Not "
        "instant - every checkpoint is actually loaded once to verify it."
    ),
    response_model=ApiResponse[list[ModelCheckpointInfo]],
)
async def list_model_checkpoints(
    admin: AdminUserDep,
    manager: ModelManagerDep,
    settings: SettingsDep,
) -> ApiResponse[list[ModelCheckpointInfo]]:
    """List real checkpoint files and their real compatibility/active state.

    Args:
        admin: Injected caller, already confirmed to hold the admin role.
        manager: Injected process-wide model manager.
        settings: Injected application settings.

    Returns:
        The standard envelope wrapping a list of :class:`ModelCheckpointInfo`.
    """
    logger.info("Model checkpoint list requested by %s", admin.id)
    service = _model_admin_service(manager, settings)
    result = await run_in_threadpool(service.list_checkpoints)
    return ApiResponse.ok(result, message="Model checkpoints listed.")


@router.post(
    "/models/activate",
    summary="Activate Model Checkpoint",
    description=(
        "Make one real checkpoint the active model for every user of the "
        "system. The previously active model keeps serving inference until "
        "the new one has actually finished loading; a failed or incompatible "
        "checkpoint never disrupts it. Admin only, in-memory for this "
        "process only - a restart falls back to the configured MODEL_PATH."
    ),
    response_model=ApiResponse[list[ModelCheckpointInfo]],
)
async def activate_model_checkpoint(
    admin: AdminUserDep,
    manager: ModelManagerDep,
    settings: SettingsDep,
    body: ActivateModelRequest,
) -> ApiResponse[list[ModelCheckpointInfo]]:
    """Switch the active model checkpoint.

    Args:
        admin: Injected caller, already confirmed to hold the admin role.
        manager: Injected process-wide model manager.
        settings: Injected application settings.
        body: The checkpoint id to activate.

    Returns:
        The standard envelope wrapping the refreshed checkpoint listing.

    Raises:
        ValidationError: The id is unknown, or the checkpoint failed to load.
    """
    logger.info("Model checkpoint activation requested by %s: %s", admin.id, body.id)
    service = _model_admin_service(manager, settings)
    result = await run_in_threadpool(service.activate, body.id)
    return ApiResponse.ok(result, message="Active model checkpoint switched.")


@router.get(
    "/models/active",
    summary="Get Active Model Metadata",
    description=(
        "Return the currently active backend's real architecture, device and "
        "confidence threshold. Admin only. 503 if no model is loaded."
    ),
    response_model=ApiResponse[ModelMetadataInfo],
)
async def get_active_model(
    _admin: AdminUserDep,
    manager: ModelManagerDep,
    settings: SettingsDep,
) -> ApiResponse[ModelMetadataInfo]:
    """Return the active backend's metadata.

    Args:
        _admin: Injected caller, already confirmed to hold the admin role.
            Underscore-prefixed because this is the only admin route that does
            not read the caller - the dependency is required purely for its
            authorization side effect, which FastAPI resolves from the
            annotation rather than the parameter name. Removing it would
            silently make the endpoint public.
        manager: Injected process-wide model manager.
        settings: Injected application settings.

    Returns:
        The standard envelope wrapping :class:`ModelMetadataInfo`.

    Raises:
        ModelNotLoadedError: No model is currently loaded.
    """
    service = _model_admin_service(manager, settings)
    metadata = service.current_metadata()
    return ApiResponse.ok(_metadata_info(metadata), message="Active model metadata retrieved.")


@router.post(
    "/models/threshold",
    summary="Set Confidence Threshold",
    description=(
        "Rebuild the active checkpoint at a new minimum detection score. The "
        "threshold is baked into this network's RoI head at construction "
        "time, so this reloads the model - the same load-before-swap safety "
        "as activating a different checkpoint. Admin only, in-memory for "
        "this process only - a restart falls back to MODEL_SCORE_THRESHOLD."
    ),
    response_model=ApiResponse[ModelMetadataInfo],
)
async def set_score_threshold(
    admin: AdminUserDep,
    manager: ModelManagerDep,
    settings: SettingsDep,
    body: SetScoreThresholdRequest,
) -> ApiResponse[ModelMetadataInfo]:
    """Change the active model's confidence threshold.

    Args:
        admin: Injected caller, already confirmed to hold the admin role.
        manager: Injected process-wide model manager.
        settings: Injected application settings.
        body: The new threshold.

    Returns:
        The standard envelope wrapping the rebuilt backend's metadata.

    Raises:
        ValidationError: The rebuild failed to load.
    """
    logger.info("Confidence threshold change requested by %s: %s", admin.id, body.score_threshold)
    service = _model_admin_service(manager, settings)
    metadata = await run_in_threadpool(service.set_score_threshold, body.score_threshold)
    return ApiResponse.ok(_metadata_info(metadata), message="Confidence threshold updated.")


@router.post(
    "/models/device",
    summary="Set Compute Backend",
    description=(
        "Rebuild the active checkpoint targeting CPU or GPU. A 'gpu' request "
        "always succeeds - it picks the best GPU execution provider actually "
        "available on this host and falls back to CPU silently when none is "
        "(e.g. in production, which has no GPU at all); compare the returned "
        "device against the request to tell a real switch from a fallback. "
        "Admin only, in-memory for this process only - a restart falls back "
        "to MODEL_DEVICE."
    ),
    response_model=ApiResponse[ModelMetadataInfo],
)
async def set_compute_device(
    admin: AdminUserDep,
    manager: ModelManagerDep,
    settings: SettingsDep,
    body: SetDeviceRequest,
) -> ApiResponse[ModelMetadataInfo]:
    """Change the active model's compute backend (CPU/GPU).

    Args:
        admin: Injected caller, already confirmed to hold the admin role.
        manager: Injected process-wide model manager.
        settings: Injected application settings.
        body: The requested device.

    Returns:
        The standard envelope wrapping the rebuilt backend's metadata.

    Raises:
        ValidationError: The rebuild failed to load.
    """
    logger.info("Compute backend change requested by %s: %s", admin.id, body.device)
    service = _model_admin_service(manager, settings)
    metadata = await run_in_threadpool(service.set_device, body.device)
    return ApiResponse.ok(_metadata_info(metadata), message="Compute backend updated.")
