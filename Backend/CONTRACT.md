# Service contract — Node backend ⇄ FastAPI ML service

The system is split into two independently-deployable services that talk over
HTTP/JSON on a private network.

```
                ┌────────────────────────────┐        ┌──────────────────────────────┐
   browser ───▶ │  Node backend (Express)     │  HTTP  │  FastAPI ML service          │
   frontend     │  Backend/gateway  :3000     │ ─────▶ │  Backend/app      :8000      │
                │  auth · sessions · routing  │        │  Faster R-CNN inference only │
                │  · upload handling · CORS   │ ◀───── │  stateless, no DB/auth       │
                └────────────────────────────┘        └──────────────────────────────┘
```

## Responsibility split

| Concern | Owner |
|---|---|
| Client-facing REST API, CORS, correlation ids | **Node backend** |
| Authentication / authorization (Supabase JWT) | **Node backend** |
| Sessions, history, persistence (Supabase/Postgres) | **Node backend** |
| Upload receipt and pre-validation | **Node backend** |
| Model loading and inference (Faster R-CNN) | **FastAPI ML service** |
| Driver-state / fatigue classification from detections | **FastAPI ML service** |

The ML service is **stateless**: it holds no database connection, no auth, and
no session state. It receives pixels and returns detections + a classification.
Everything stateful lives in the Node backend.

## Shared response envelope

Both services speak the identical envelope (API Specification §3), so the
frontend sees one shape regardless of origin.

Success: `{ "success": true, "message": "…", "data": { … } }`
Error:   `{ "success": false, "message": "…", "error_code": "…", "errors": [] }`

`error_code` values are shared between the two services. When the ML service
returns an error, the Node backend passes its status and `error_code` through
unchanged rather than masking it.

Every response carries an `X-Request-ID`. The Node backend generates it and
forwards it to the ML service on the `X-Request-ID` header, so one id traces the
whole chain across both logs.

## Internal endpoint: ML service

Consumed only by the Node backend, never exposed to the browser directly.

### `POST {ML_SERVICE_URL}{ML_API_PREFIX}/analysis/image`

- **Request:** `multipart/form-data`, single field **`file`** — a JPEG/PNG/WebP image.
- **Headers:** `X-Request-ID` (forwarded from the backend).
- **Response `200`:** `ApiResponse<ImageAnalysisData>`:

```json
{
  "success": true,
  "message": "Image analysed successfully.",
  "data": {
    "driver_state": "DROWSY",          // AWAKE | YAWNING | DROWSY | SLEEPING | UNKNOWN
    "alert_level":  "DANGER",          // SAFE | WARNING | DANGER | EMERGENCY
    "fatigue_score": 72,               // 0–100
    "detections": [
      { "label": "closed_eye", "label_index": 1, "score": 0.94,
        "box": { "x1": 210.0, "y1": 140.0, "x2": 260.0, "y2": 175.0 } }
    ],
    "metrics": { "eye_aspect_ratio": 0.11, "mouth_aspect_ratio": null,
                 "eyes_closed": true, "yawning": false, "derived": true },
    "inference_ms": 128.4,
    "image_width": 640, "image_height": 480
  }
}
```

- **Error responses** (standard envelope):

| Status | `error_code` | When |
|---|---|---|
| 415 | `UNSUPPORTED_MEDIA` | Not a JPEG/PNG/WebP, or undecodable |
| 413 | `FILE_TOO_LARGE` | Over the configured size limit |
| 503 | `MODEL_NOT_LOADED` | Weights not loaded / failed to load |
| 500 | `INFERENCE_ERROR` | Forward pass failed |

### `GET {ML_SERVICE_URL}{ML_API_PREFIX}/ready`

Readiness probe. The Node backend's own `/ready` pings this so a load balancer
knows whether the whole chain can serve traffic.

## Public endpoint: Node backend

### `POST {GATEWAY}/api/v1/analysis/image`
Same `multipart/form-data` `file` field. The backend pre-validates type/size,
forwards to the ML service, and returns its envelope unchanged.

### `GET /api/v1/health`, `GET /api/v1/ready`
Backend liveness and readiness (readiness pings the ML service).

### `GET /api/v1/auth/me`, `GET /api/v1/auth/verify`
Backend-owned auth, **implemented**. Requires `Authorization: Bearer <supabase-jwt>`.
The backend verifies the token (ES256, pinned) against Supabase's JWKS, checks
issuer/audience/expiry, then resolves the application role from
`public.user_roles` (never from the token) and returns the principal
`{ id, email, role }`. `401 AUTH_REQUIRED` when no token, `401 INVALID_TOKEN`
when verification fails, `503` when `SUPABASE_URL` is unset.

### `GET|POST /api/v1/sessions`, `GET /api/v1/sessions/:id`
Backend-owned sessions, **authenticated** (the `authenticate` middleware runs
first). Data-access logic is still to be built and returns `NOT_IMPLEMENTED`
(501) for now, but the auth + ownership boundary is real.

Auth is ported from the FastAPI reference (`app/core/security.py`,
`app/infra/jwks.py`, `app/services/auth_service.py`, `role_cache.py`,
`user_repository.py`) using `jose` for JWKS/ES256.

## Configuration coupling

| Node backend (`gateway/.env`) | Points at |
|---|---|
| `ML_SERVICE_URL` | The FastAPI service base URL (e.g. `http://127.0.0.1:8000`) |
| `ML_API_PREFIX` | Must equal the FastAPI `api_v1_prefix` (default `/api/v1`) |
| `MAX_IMAGE_SIZE_MB` | Should be ≤ the ML service `MAX_IMAGE_SIZE_MB` (ML side is authoritative) |
