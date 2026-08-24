"""Shared constants and enumerations.

Single source of truth for every value that crosses a system boundary: the
Postgres enums, the frontend's TypeScript unions, the AI model's class indices
and the API error codes.

Three separate vocabularies have to agree here, and they do not use the same
spelling:

===================  ==========================  =========================
Concept              Database (Postgres enum)    Frontend (TS union)
===================  ==========================  =========================
Driver state         ``'awake' | 'drowsy' ...``  ``"AWAKE" | "DROWSY" ...``
Alert level          ``'none' | 'low' ...``      ``"SAFE" | "WARNING" ...``
===================  ==========================  =========================

Enum *values* are the database spelling, because that is the persistence
contract and cannot be changed without a migration. The ``api_label`` property
produces the frontend spelling. Never hand-write either string anywhere else.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

# =============================================================================
# AI MODEL - class labels
# =============================================================================
# Mirrors config.py at the repository root:
#     CLASS_NAMES  = ["closed_eye", "open_eye", "yawn"]
#     MODEL_LABELS = ["background"] + CLASS_NAMES
#
# Confirmed against results/test_metrics_tuned.json, whose
# `confusion_matrix_labels` are ["background", "closed_eye", "open_eye", "yawn"].
# The trained weights are bound to this ordering; it is not a free choice.
#
# WARNING - known defect in the existing codebase:
#   utils/driver_state.py:13 declares `OPEN_EYE, CLOSED_EYE, YAWN = 1, 2, 3`
#   and app.py:61-62 follows the same convention. Both have open and closed
#   INVERTED relative to the trained model. Any code reusing that convention
#   reports drowsiness when the driver's eyes are open. Do not copy it.
#   The mapping below is the correct one. See Phase H notes.
# =============================================================================

MODEL_LABEL_BACKGROUND: Final[int] = 0
MODEL_LABEL_CLOSED_EYE: Final[int] = 1
MODEL_LABEL_OPEN_EYE: Final[int] = 2
MODEL_LABEL_YAWN: Final[int] = 3

MODEL_LABELS: Final[tuple[str, ...]] = ("background", "closed_eye", "open_eye", "yawn")
"""Model label index -> class name. Index 0 is background and is never drawn."""

CLASS_NAMES: Final[tuple[str, ...]] = MODEL_LABELS[1:]
"""Foreground class names only, in model-label order."""

NUM_FOREGROUND_CLASSES: Final[int] = len(CLASS_NAMES)

MODEL_INPUT_SIZE: Final[int] = 640
"""Square input resolution the backbone was trained at. Locked by the weights."""


# =============================================================================
# DOMAIN ENUMERATIONS
# =============================================================================


class DriverState(StrEnum):
    """Classified driver state.

    Values match the Postgres ``public.driver_state`` enum. ``api_label``
    returns the uppercase spelling the frontend expects.
    """

    AWAKE = "awake"
    YAWNING = "yawning"
    DROWSY = "drowsy"
    SLEEPING = "sleeping"
    UNKNOWN = "unknown"

    @property
    def api_label(self) -> str:
        """Return the uppercase spelling used by the frontend UI.

        Returns:
            The enum value in upper case, e.g. ``"DROWSY"``.
        """
        return self.value.upper()


class AlertLevel(StrEnum):
    """Severity of a fatigue alert.

    Values match the Postgres ``public.alert_level`` enum. The frontend uses a
    different vocabulary of the same cardinality - see :data:`ALERT_LEVEL_API_LABEL`.
    """

    NONE = "none"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

    @property
    def api_label(self) -> str:
        """Return the frontend spelling for this level.

        Returns:
            One of ``"SAFE"``, ``"WARNING"``, ``"DANGER"``, ``"EMERGENCY"``.
        """
        return ALERT_LEVEL_API_LABEL[self]

    @property
    def rank(self) -> int:
        """Return an ordinal for threshold comparisons.

        ``StrEnum`` members are not ordered, so severity comparisons such as
        "at least MEDIUM" must go through this instead of ``>=`` on the member.

        Returns:
            0 for ``NONE`` rising to 3 for ``HIGH``.
        """
        return ALERT_LEVEL_RANK[self]


class SessionSource(StrEnum):
    """Origin of a monitoring session. Matches ``public.session_source``."""

    WEBCAM = "webcam"
    DASHCAM = "dashcam"
    VIDEO = "video"
    IMAGE = "image"


class SessionStatus(StrEnum):
    """Lifecycle state of a session. Matches ``public.session_status``."""

    ACTIVE = "active"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class AlertChannel(StrEnum):
    """Delivery channel for an alert. Matches ``public.alert_channel``."""

    SOUND = "sound"
    EMAIL = "email"
    WHATSAPP = "whatsapp"


class DeliveryStatus(StrEnum):
    """Delivery outcome for a dispatched alert. Matches ``public.delivery_status``."""

    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"


class AppRole(StrEnum):
    """Authorisation role.

    Matches the Postgres ``public.app_role`` enum, which defines exactly two
    members.

    Note:
        ``Frontend/src/lib/auth-role.ts`` declares a third role, ``"moderator"``,
        that does not exist in the database enum. ``getUserRole`` can therefore
        never return it. The backend follows the database.
    """

    ADMIN = "admin"
    USER = "user"


class MediaKind(StrEnum):
    """Kind of uploaded media. Matches the ``uploaded_media.kind`` CHECK constraint."""

    IMAGE = "image"
    VIDEO = "video"


# =============================================================================
# CROSS-VOCABULARY MAPPINGS
# =============================================================================

ALERT_LEVEL_API_LABEL: Final[dict[AlertLevel, str]] = {
    AlertLevel.NONE: "SAFE",
    AlertLevel.LOW: "WARNING",
    AlertLevel.MEDIUM: "DANGER",
    AlertLevel.HIGH: "EMERGENCY",
}
"""Database alert level -> the frontend's ``AlertLevel`` union.

Derived from ``monitoring.tsx``'s ``STATUS_LEVEL`` map, which pairs AWAKE/SAFE,
YAWNING/WARNING, DROWSY/DANGER and SLEEPING/EMERGENCY.
"""

ALERT_LEVEL_RANK: Final[dict[AlertLevel, int]] = {
    AlertLevel.NONE: 0,
    AlertLevel.LOW: 1,
    AlertLevel.MEDIUM: 2,
    AlertLevel.HIGH: 3,
}
"""Ordinal severity, for "at least this severe" comparisons."""

API_LABEL_TO_ALERT_LEVEL: Final[dict[str, AlertLevel]] = {
    label: level for level, label in ALERT_LEVEL_API_LABEL.items()
}
"""Reverse of :data:`ALERT_LEVEL_API_LABEL`.

Needed the one place the backend accepts an alert level *in* the frontend's
spelling rather than only ever producing it: a client submitting a completed
webcam session (Phase F write path) sends events using the same spelling
``/analysis/image`` just handed it back. ``DriverState`` needs no equivalent -
``DriverState(label.lower())`` already inverts its ``api_label`` cleanly.
"""

DRIVER_STATE_ALERT_LEVEL: Final[dict[DriverState, AlertLevel]] = {
    DriverState.AWAKE: AlertLevel.NONE,
    DriverState.YAWNING: AlertLevel.LOW,
    DriverState.DROWSY: AlertLevel.MEDIUM,
    DriverState.SLEEPING: AlertLevel.HIGH,
    DriverState.UNKNOWN: AlertLevel.NONE,
}
"""Baseline state -> level mapping, matching ``STATUS_LEVEL`` in monitoring.tsx.

The fatigue engine (Phase H) may escalate above this baseline, but never below.
"""


# =============================================================================
# SCORING
# =============================================================================

FATIGUE_SCORE_MIN: Final[float] = 0.0
FATIGUE_SCORE_MAX: Final[float] = 1.0
"""Fatigue is stored in Postgres on a 0.0-1.0 scale."""

FATIGUE_API_SCALE: Final[int] = 100
"""Multiplier applied on the way out.

Decision C5: persist 0.0-1.0, serve 0-100. Every gauge in the frontend
(`FatigueGauge`, `monitoring.tsx`, `image-analysis.tsx`) expects 0-100.
"""


# =============================================================================
# STORAGE BUCKETS
# =============================================================================
# These are the buckets the applied Supabase migration actually created and
# wrote RLS policies for. Decision C2 makes the live schema authoritative, so
# the different bucket names listed in "04 - Database Design.md" §18
# (videos/, images/, reports/, temporary/, models/) are NOT used.
# =============================================================================

BUCKET_UPLOADS_VIDEOS: Final[str] = "uploads-videos"
BUCKET_UPLOADS_IMAGES: Final[str] = "uploads-images"
BUCKET_SESSION_CLIPS: Final[str] = "session-clips"
BUCKET_AVATARS: Final[str] = "avatars"

MEDIA_KIND_BUCKET: Final[dict[MediaKind, str]] = {
    MediaKind.IMAGE: BUCKET_UPLOADS_IMAGES,
    MediaKind.VIDEO: BUCKET_UPLOADS_VIDEOS,
}
"""Media kind -> private bucket. Mirrors the frontend's upload.tsx choice."""


# =============================================================================
# UPLOAD VALIDATION
# =============================================================================
# Frontend Integration §8: the frontend pre-checks extension and size, the
# backend performs the final, authoritative validation.
# =============================================================================

ALLOWED_IMAGE_MIME_TYPES: Final[frozenset[str]] = frozenset(
    {"image/jpeg", "image/png", "image/webp"}
)
ALLOWED_VIDEO_MIME_TYPES: Final[frozenset[str]] = frozenset(
    {
        "video/mp4",
        "video/quicktime",
        "video/x-msvideo",
        "video/x-matroska",
    }
)
ALLOWED_VIDEO_EXTENSIONS: Final[frozenset[str]] = frozenset({".mp4", ".mov", ".avi", ".mkv"})
"""Fallback for video upload validation.

Browsers are unreliable at sniffing a video's MIME type - particularly for
``.avi`` and ``.mkv`` on a host with no registered file association, which is
sent as ``application/octet-stream`` or an empty type rather than one of
:data:`ALLOWED_VIDEO_MIME_TYPES`. The video analysis endpoint accepts a file
whose *either* declared MIME type or filename extension matches, rather than
rejecting a genuinely valid upload the browser merely mislabelled.
"""

ALLOWED_RECORDING_MIME_TYPES: Final[frozenset[str]] = frozenset({"video/webm", "video/mp4"})
"""Accepted MIME types for a webcam session recording (Phase F write path).

Deliberately separate from :data:`ALLOWED_VIDEO_MIME_TYPES`: this is a
browser's own ``MediaRecorder`` output, not an arbitrary uploaded file, so it
is never an ``.avi``/``.mkv``/``.mov`` - and it commonly *is* WebM, which the
video-analysis upload path has no reason to accept from a user-supplied file.
"""

BYTES_PER_MB: Final[int] = 1024 * 1024


# =============================================================================
# VIDEO ANALYSIS SAMPLING (Phase G2)
# =============================================================================
# A CPU-bound forward pass per sampled frame means the whole clip cannot be run
# through the model at its native frame rate within one HTTP request. These
# bounds keep worst-case processing time predictable regardless of how long or
# how high-frame-rate the uploaded clip is - the response always reports the
# sample rate it actually used, never the one the caller asked for, so the
# frontend never presents an unapplied setting as fact.
# =============================================================================

DEFAULT_VIDEO_SAMPLE_RATE_FPS: Final[float] = 2.0
MIN_VIDEO_SAMPLE_RATE_FPS: Final[float] = 0.5
MAX_VIDEO_SAMPLE_RATE_FPS: Final[float] = 5.0
MAX_VIDEO_SAMPLED_FRAMES: Final[int] = 120
"""Hard cap on frames actually run through the model for one upload.

Sampling spacing is widened (never narrowed) beyond the requested rate so this
cap is respected while still spanning the full clip, rather than only its
first few seconds.
"""


# =============================================================================
# ANNOTATED VIDEO PREVIEW (Phase G2)
# =============================================================================
# Drawing boxes and encoding is cheap compared to inference (no model forward
# pass involved), so this runs on every decoded frame - not just the sampled
# ones - holding each frame's overlay at the nearest analysed sample's result.
# It is still bounded, because encoding is not free either: an extremely long
# upload would otherwise make one HTTP request encode for minutes.
# =============================================================================

MAX_ANNOTATED_VIDEO_FRAMES: Final[int] = 6000
"""Skip annotated-video generation above this many source frames.

The JSON analysis is unaffected either way - this only decides whether a
burned-in preview is also produced. ~3-4 minutes of dashcam footage at a
typical frame rate; long enough for the feature's real use case (reviewing
one incident clip) without an unbounded encode time.
"""

PREVIEW_STORE_MAX_ENTRIES: Final[int] = 20
"""Maximum annotated previews held on disk at once.

The preview endpoint is unauthenticated and stateless (Phase G2 has no
per-user storage), so previews live in a small in-process registry rather
than a database row. Registering past this count evicts the oldest entry
immediately, rather than waiting for the TTL - a bound on disk usage matters
more here than retaining every old preview.
"""

PREVIEW_STORE_TTL_SECONDS: Final[int] = 30 * 60
"""How long an annotated preview stays fetchable after being generated."""

DEFAULT_VIDEO_FALLBACK_FPS: Final[float] = 30.0
"""Assumed frame rate when a container reports none.

Some AVI/MKV muxers report ``0``, and browser ``MediaRecorder`` output often
has no fixed frame rate at all (variable frame rate recording) - shared
between the uploaded-video and webcam-session-recording pipelines, which both
hit this the same way.
"""


# =============================================================================
# API ERROR CODES
# =============================================================================


class ErrorCode(StrEnum):
    """Machine-readable error identifiers returned in the error envelope.

    The first block is the canonical table from the API Specification §23 and
    must not be renamed - the frontend may branch on these strings. The second
    block covers cases §23 omits but HTTP requires.
    """

    # --- API Specification §23 (canonical) ---
    AUTH_REQUIRED = "AUTH_REQUIRED"
    # noqa S105: the member name contains "TOKEN", so the hardcoded-password
    # check fires on its own identifier. This is an error code, not a credential.
    INVALID_TOKEN = "INVALID_TOKEN"  # noqa: S105
    SESSION_NOT_FOUND = "SESSION_NOT_FOUND"
    MODEL_NOT_LOADED = "MODEL_NOT_LOADED"
    FILE_TOO_LARGE = "FILE_TOO_LARGE"
    UNSUPPORTED_MEDIA = "UNSUPPORTED_MEDIA"
    STORAGE_ERROR = "STORAGE_ERROR"
    DATABASE_ERROR = "DATABASE_ERROR"
    INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR"

    # --- Extensions ---
    # VALIDATION_ERROR is used in the API Specification §3 error example but is
    # missing from its own §23 table; the rest fill genuine gaps.
    VALIDATION_ERROR = "VALIDATION_ERROR"
    FORBIDDEN = "FORBIDDEN"
    NOT_FOUND = "NOT_FOUND"
    CONFLICT = "CONFLICT"
    RATE_LIMITED = "RATE_LIMITED"
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"
    INFERENCE_ERROR = "INFERENCE_ERROR"
    VIDEO_PROCESSING_ERROR = "VIDEO_PROCESSING_ERROR"


# =============================================================================
# SERVICE HEALTH
# =============================================================================


class ServiceStatus(StrEnum):
    """Reported state of a backend dependency in the health endpoints."""

    ONLINE = "online"
    OFFLINE = "offline"
    DEGRADED = "degraded"
    NOT_CONFIGURED = "not_configured"
    """Credentials absent. Expected for Supabase and SMTP during Phase D."""


class ModelStatus(StrEnum):
    """Reported state of the AI model.

    The API Specification §19 example returns ``"ai": "loaded"`` rather than
    ``"online"``, so the model deliberately uses its own vocabulary instead of
    :class:`ServiceStatus`. Changing it to "online" would match the other three
    fields but break the documented contract.
    """

    LOADED = "loaded"
    LOADING = "loading"
    NOT_LOADED = "not_loaded"
    FAILED = "failed"


# =============================================================================
# HTTP
# =============================================================================

REQUEST_ID_HEADER: Final[str] = "X-Request-ID"
