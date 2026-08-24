"""Admin schemas - real user/role data only.

The database has exactly two roles (``admin``, ``user`` - see
:class:`~app.core.constants.AppRole`); the frontend's mock admin console
invents a five-role taxonomy (Administrator/Instructor/Researcher/Demo
User/Guest) with no backing table. This schema serves the real two.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class AdminUser(BaseModel):
    """One registered user, as listed in the admin console.

    Attributes:
        id: Supabase user id.
        email: Registered email, when known.
        display_name: Profile display name, falling back to ``None`` if the
            user has no ``profiles`` row yet.
        role: Effective application role - ``"admin"`` or ``"user"``.
        created_at: Account creation time.
        last_sign_in_at: Most recent sign-in, ``None`` if never signed in.
    """

    id: UUID
    email: str | None = None
    display_name: str | None = None
    role: str = Field(description="Effective role: admin or user.")
    created_at: datetime
    last_sign_in_at: datetime | None = None


class ModelCheckpointInfo(BaseModel):
    """One real ``.pth`` or ``.onnx`` file found under the configured checkpoints directory.

    ``compatible`` is not guessed from the filename or directory - it comes
    from actually attempting to build a backend for this file and load it
    (see :class:`~app.services.model_admin_service.ModelAdminService`), which
    is what catches an anchor-config mismatch between an older training run
    and the currently vendored architecture instead of assuming it away.

    Attributes:
        id: Path relative to the checkpoints directory, e.g. ``"tuned/best.pth"`` -
            the identifier :class:`ActivateModelRequest` submits back.
        filename: The file's own name, e.g. ``"best.pth"``.
        directory: Parent directory relative to the checkpoints root, ``""``
            for a file directly in it.
        size_bytes: File size on disk.
        modified_at: File's last-modified time.
        compatible: Whether this checkpoint actually loaded against the
            current architecture in a real dry-run attempt.
        incompatible_reason: The real error message when ``compatible`` is
            ``False``, ``None`` otherwise.
        active: Whether this is the checkpoint currently serving inference.
    """

    id: str
    filename: str
    directory: str
    size_bytes: int = Field(ge=0)
    modified_at: datetime
    compatible: bool
    incompatible_reason: str | None = None
    active: bool


class ActivateModelRequest(BaseModel):
    """Request body for making one checkpoint the active model.

    Attributes:
        id: The checkpoint's :attr:`ModelCheckpointInfo.id`.
    """

    id: str = Field(min_length=1, description="Checkpoint id, e.g. 'tuned/best.pth'.")


class ModelMetadataInfo(BaseModel):
    """Real descriptive facts about the currently active backend.

    Wire counterpart of :class:`~app.domain.models.base.ModelMetadata`. Never
    includes the checkpoint's filesystem path (Frontend Integration §11).

    Attributes:
        architecture: Human-readable architecture name, e.g. ``"faster_rcnn"``.
        device: Torch device the weights are resident on, e.g. ``"cpu"``,
            ``"cuda"``.
        num_classes: Number of foreground classes the head predicts.
        score_threshold: Minimum score a detection must clear to be returned.
    """

    architecture: str
    device: str
    num_classes: int = Field(ge=0)
    score_threshold: float = Field(ge=0.0, le=1.0)


class SetScoreThresholdRequest(BaseModel):
    """Request body for changing the active model's confidence threshold.

    Attributes:
        score_threshold: The new minimum detection score, in ``[0, 1]``.
    """

    score_threshold: float = Field(ge=0.0, le=1.0)


class SetDeviceRequest(BaseModel):
    """Request body for changing the active model's compute backend.

    Attributes:
        device: ``"cpu"`` to force CPU-only inference, or ``"gpu"`` to
            request the best GPU execution provider actually available on
            this host - falling back to CPU silently (never an error) when
            none is, e.g. in production, which has no GPU at all.
    """

    device: Literal["cpu", "gpu"]
