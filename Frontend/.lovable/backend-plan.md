# DriveAlert — Backend & Data Layer Blueprint (Phase 3)

Design-only document. No code, SQL, or components will be generated until you approve. This blueprint assumes the approved Phase 1 architecture (three-tier: Lovable frontend, FastAPI AI backend, Supabase data plane) and the Phase 2 visual system.

---

## 1. Backend Architecture (FastAPI, Modular)

FastAPI is organized as a **hexagonal / clean-architecture** app: transport → application services → domain (ML + decision) → infrastructure (Supabase, notifications, queue). Every module has one job, one owner, and one test surface.

```text
┌────────────────────────────────────────────────────────────────────┐
│                        FASTAPI APPLICATION                         │
│                                                                    │
│  Transport         Application            Domain          Infra    │
│  ─────────         ───────────            ──────          ─────    │
│  REST routers ──▶  Auth service      ──▶  ML Engine   ──▶ Supabase │
│  WebSocket    ──▶  Detection service ──▶  Decision    ──▶ Storage  │
│  SSE (opt.)   ──▶  Session service   ──▶  Fatigue FSM ──▶ Notif.   │
│                    Alert service     ──▶  Model Mgr   ──▶ Queue    │
│                    Stats service                          Logs     │
│                    Admin service                                   │
└────────────────────────────────────────────────────────────────────┘
```

### Modules

| Module | Responsibility | Why isolated |
|---|---|---|
| **Authentication** | Verify Supabase JWT (JWKS), extract `sub` + role, guest short-lived tokens, admin gate via `has_role`. | Central trust boundary; must be testable and swappable. |
| **Inference Engine** | Wraps the current model (best.pt). Stateless `predict(frame) → detections`. Half-precision on GPU, ONNX fallback on CPU. | Keeps ML separate from HTTP; enables model swap. |
| **Model Manager** | Loads/unloads models, tracks active version, exposes a uniform `Detector` interface for YOLO, RF-DETR, Faster R-CNN, future nets. | Frontend and decision engine never depend on model internals. |
| **Landmarks & Metrics** | Extracts eye/mouth landmarks; computes EAR, MAR, head pose (solvePnP). | Pure functions, unit-testable on fixture frames. |
| **Video Processing** | Frame decode (OpenCV/av), resize, color convert, temporal sampling for uploads. | Isolates codec/perf concerns from ML. |
| **Image Processing** | Single-image pipeline for uploads and guest demo. | Reuses preprocessing; different SLA. |
| **Live Camera Processing** | WebSocket session handler; per-connection buffer + backpressure + adaptive fps. | Real-time concerns differ from batch. |
| **Decision Engine** | Combines EAR/MAR/head-pose over a rolling window into `state ∈ {AWAKE, DISTRACTED, DROWSY, SLEEPING}` with hysteresis. | Pure logic; deterministic; easy to tune and test. |
| **Alert Engine** | Turns state transitions into alert events; applies cooldown, severity, and channel routing. | Prevents alarm fatigue; single place for policy. |
| **Statistics** | Aggregations, daily rollups, per-user KPIs, admin analytics. | Read-heavy; separated to allow caching. |
| **Logging** | Structured JSON logs, request IDs, per-session correlation. | Observability is a first-class concern. |
| **Configuration** | Pydantic Settings from env + `model_settings` table. Hot-reload thresholds. | Zero-downtime tuning. |
| **Background Jobs** | Video job worker, notification dispatch, cleanup, rollups, report generation. | Async; must not block request threads. |

### Module dependency graph

```text
              Transport (REST + WS)
                        │
                        ▼
             Application Services
        (Auth · Detection · Session · Alert · Stats · Admin)
              │                    │
              ▼                    ▼
        Domain (pure)        Infrastructure
   ┌──────────────────┐   ┌─────────────────────┐
   │ Model Manager    │   │ Supabase (DB+Auth)  │
   │  └─ Detector API │   │ Supabase Storage    │
   │ Metrics (EAR/MAR)│   │ Redis (queue+cache) │
   │ Decision FSM     │   │ Email / WhatsApp    │
   │ Alert Policy     │   │ Sentry / OTEL       │
   └──────────────────┘   └─────────────────────┘
```

Arrows point down only. Domain never imports infrastructure; services depend on interfaces.

### Folder structure

```text
backend/
  app/
    main.py                        # FastAPI factory, lifespan (model load)
    api/
      deps.py                      # auth, db, model manager DI
      routers/
        auth.py
        users.py
        detection.py
        history.py
        statistics.py
        uploads.py
        alerts.py
        admin.py
        settings.py
        health.py
      ws/
        live_detect.py             # /ws/detect
    core/
      config.py                    # Pydantic settings
      security.py                  # JWT verification (JWKS)
      logging.py                   # structlog config
      errors.py                    # error envelope
      rate_limit.py
      middleware.py
    domain/
      detectors/
        base.py                    # Detector interface
        yolo.py                    # best.pt adapter
        rfdetr.py                  # placeholder
        faster_rcnn.py             # placeholder
      landmarks.py
      metrics.py                   # EAR, MAR, head pose
      fatigue_engine.py            # FSM + hysteresis
      alert_policy.py
      schemas.py                   # pure domain models
    services/
      auth_service.py
      detection_service.py
      session_service.py
      alert_service.py
      stats_service.py
      admin_service.py
      model_manager.py
    infrastructure/
      supabase/
        client.py                  # service-role client
        repositories/              # sessions, events, alerts, media, users
      storage/
        buckets.py
        signed_urls.py
      notifications/
        base.py
        email_resend.py
        whatsapp_twilio.py
        dispatcher.py
      queue/
        broker.py                  # Redis / RQ / Celery
        tasks.py
      observability/
        sentry.py
        otel.py
    workers/
      video_worker.py
      notification_worker.py
      cleanup_worker.py
      rollup_worker.py
      report_worker.py
    schemas/                       # Pydantic request/response DTOs
    utils/
  models/
    best.pt
    registry.yaml                  # model catalog
  tests/
    unit/  integration/  load/
  Dockerfile
  docker-compose.yml               # local: api + redis + worker
  pyproject.toml
```

**Why:** clear seams between HTTP, application, domain, and infra. New detectors, new notification channels, or a new queue backend each touch exactly one folder.

---

## 2. Database Architecture

Postgres via Supabase. Every user-facing table has RLS ON, explicit GRANTs, `created_at`/`updated_at`, and indexes tuned to real access patterns.

### Table catalog

| Table | Purpose | PK | FKs | Key columns | Indexes | Why |
|---|---|---|---|---|---|---|
| `profiles` | 1:1 with `auth.users`; app-visible identity. | `id` (= auth.uid) | `id → auth.users` | `display_name`, `phone`, `avatar_url`, `locale` | PK | Never store roles here. |
| `app_role` (enum) | `guest`, `user`, `admin`. | — | — | — | — | Type-safe roles. |
| `user_roles` | Roles per user (many-to-many). | `id` | `user_id → auth.users` | `role app_role` | unique `(user_id, role)`; idx `user_id` | Separate table + `has_role` prevents privilege escalation. |
| `sessions` | Auth/device sessions metadata (optional; complements Supabase). | `id` | `user_id` | `device`, `ip`, `user_agent`, `last_seen_at`, `revoked_at` | idx `(user_id, last_seen_at desc)` | Audit + forced logout. |
| `detection_sessions` | One row per live run or processed upload. | `id` | `user_id`, `model_version_id` | `source` (webcam/dashcam/upload_video/upload_image), `started_at`, `ended_at`, `status`, `duration_ms`, `frames_processed`, `avg_fps`, `alerts_count`, `max_state`, `summary jsonb` | idx `(user_id, started_at desc)`, idx `status`, idx `model_version_id` | Anchor for events and analytics. |
| `detection_events` | High-frequency time-series (per-frame or per-decision tick). | `id bigserial` | `session_id → detection_sessions` | `ts`, `state`, `ear`, `mar`, `head_yaw`, `head_pitch`, `head_roll`, `eye_closure_ms`, `yawn_count`, `score`, `alert_level`, `bbox jsonb`, `raw jsonb` | idx `(session_id, ts)`; **partition by month** | Write-heavy; keep isolated from `sessions`. |
| `detection_history` | Denormalized per-user summary rows for fast history lists. | `id` | `user_id`, `session_id` | `started_at`, `duration_ms`, `max_state`, `alerts_count`, `thumbnail_path` | idx `(user_id, started_at desc)` | Avoids expensive aggregation on list views. |
| `uploaded_videos` | Metadata for videos in Storage. | `id` | `user_id`, `session_id?` | `bucket`, `path`, `mime`, `size_bytes`, `duration_ms`, `checksum`, `status` (uploaded/processing/done/failed) | idx `(user_id, created_at desc)`, idx `status` | Decouples binary from processing state. |
| `uploaded_images` | Metadata for images in Storage. | `id` | `user_id`, `session_id?` | `bucket`, `path`, `mime`, `size_bytes`, `width`, `height`, `checksum` | idx `(user_id, created_at desc)` | Same. |
| `alerts` | Every fired alert. | `id` | `session_id`, `user_id` | `ts`, `level` (info/warn/critical), `type` (drowsy/sleeping/yawn/distraction), `channels text[]`, `payload jsonb`, `delivery_status jsonb` | idx `(user_id, ts desc)`, idx `(session_id, ts)`, idx `level` | Audit + admin dashboard. |
| `alert_history` | Delivery attempts per alert per channel. | `id` | `alert_id → alerts` | `channel`, `attempt`, `status`, `error`, `sent_at` | idx `alert_id` | Retry/debug. |
| `system_logs` | App/structured logs mirrored for admin UI (optional; Sentry/OTEL remain primary). | `id bigserial` | `user_id?` | `ts`, `level`, `logger`, `message`, `context jsonb`, `request_id` | idx `(ts desc)`, idx `level` | In-app admin log viewer. |
| `statistics_daily` | Pre-aggregated rollups. | `(day, user_id)` | `user_id` | `sessions`, `total_duration_ms`, `alerts_count`, `avg_score`, `yawns`, `sleeping_events` | PK covers query | Keeps analytics O(days). |
| `statistics_global_daily` | Same, aggregated across all users for admin. | `day` | — | mirrors above | PK | Admin dashboard perf. |
| `model_versions` | Registry of deployable models. | `id` | — | `name`, `family` (yolo/rfdetr/frcnn), `version`, `path_or_uri`, `checksum`, `input_size`, `params jsonb`, `is_active` | unique `(name, version)`, partial idx `is_active` | Reproducibility + safe swap. |
| `model_settings` | Tunable thresholds bound to a version. | `id` | `model_version_id` | `ear_threshold`, `mar_threshold`, `closure_ms_drowsy`, `closure_ms_sleeping`, `yawn_window_s`, `yawn_count_alert`, `head_pose_deg`, `alert_cooldown_s`, `params jsonb` | idx `model_version_id` | Hot-tunable without redeploy. |
| `settings` | Global app config (feature flags, retention days, rate limits). | `key` | — | `value jsonb`, `updated_by` | PK | Admin-editable runtime config. |
| `notification_settings` | Per-user channel prefs + thresholds. | `user_id` | `user_id` | `email_enabled`, `whatsapp_enabled`, `email`, `phone`, `min_level`, `quiet_hours` | PK | User consent + preferences. |
| `audit_logs` | Admin/security-relevant actions. | `id bigserial` | `actor_id` | `ts`, `action`, `target_type`, `target_id`, `diff jsonb`, `ip` | idx `(ts desc)`, idx `actor_id` | Compliance + forensics. |

### Why this shape

- **`detection_events` separated from `detection_sessions`** because event volume is orders of magnitude higher; separating enables `(session_id, ts)` indexing and monthly partitioning without touching the light session table.
- **`detection_history` denormalized** so the "History" page is a single indexed lookup, not a group-by across millions of events.
- **`model_versions` + `model_settings` split** so the same model can be tuned differently across environments and rolled back atomically.
- **`statistics_daily` pre-aggregated** by a nightly worker so admin charts render in milliseconds.
- **`user_roles` separate + `has_role` SECURITY DEFINER** is the only safe pattern; storing roles on `profiles` is the classic privilege-escalation footgun.

### RLS strategy

- User-owned tables (`profiles`, `detection_sessions`, `detection_events`, `uploaded_*`, `alerts`, `alert_history`, `notification_settings`, `detection_history`): policies scoped to `auth.uid()`.
- Admin overrides via `public.has_role(auth.uid(), 'admin')` on SELECT for `_global`, `system_logs`, `audit_logs`, `model_*`, `settings`.
- FastAPI writes with the **service-role key** (bypasses RLS); the API enforces ownership before writing. The browser never sees this key.
- Grants: `authenticated` gets `SELECT, INSERT, UPDATE, DELETE` on user tables per policy; `service_role` gets `ALL`; `anon` only where a policy explicitly permits (e.g. public demo counters).

---

## 3. Storage Architecture (Supabase Storage)

### Buckets

| Bucket | Public | Purpose | Path convention |
|---|---|---|---|
| `uploads-images` | private | User-uploaded stills for detection. | `{user_id}/{yyyy}/{mm}/{uuid}.jpg` |
| `uploads-videos` | private | User-uploaded videos for batch detection. | `{user_id}/{yyyy}/{mm}/{uuid}.mp4` |
| `results` | private | Per-session JSON/CSV result artifacts. | `{user_id}/sessions/{session_id}/result.json` |
| `screenshots` | private | Alert-triggered frame captures. | `{user_id}/sessions/{session_id}/{ts}.jpg` |
| `exports` | private | Generated PDF/CSV reports for download. | `{user_id}/exports/{report_id}.pdf` |
| `tmp` | private | Ephemeral scratch (chunked uploads, workers). | `{user_id}/tmp/{uuid}/...` |
| `logs` | private (admin only) | Archived structured log bundles. | `{yyyy}/{mm}/{dd}/{host}-{shard}.ndjson.gz` |
| `avatars` | public | Profile pictures. | `{user_id}/{uuid}.png` |

### Lifecycle & retention

| Bucket | Default TTL | Cleanup trigger | Notes |
|---|---|---|---|
| `uploads-images` | 30 days | Nightly cleanup worker | User can pin to keep. |
| `uploads-videos` | 30 days | Nightly cleanup worker | Delete on user request immediately. |
| `results` | 90 days | Cascade with session soft-delete | Referenced by history UI. |
| `screenshots` | 30 days | Cleanup worker | Only kept if user opted in to alert clips. |
| `exports` | 14 days | Cleanup worker | Signed URL TTL 15 min. |
| `tmp` | 24 hours | Cleanup worker | Aggressive prune. |
| `logs` | 180 days | Rollup worker → cold storage | Compressed NDJSON. |
| `avatars` | forever | User delete | Public read only for avatars. |

### Security

- **Private by default**, folder-level RLS: users can only read/write under `auth.uid()/...`. Enforced with `storage.foldername(name)[1] = auth.uid()::text` on `storage.objects`.
- **Signed URLs** with short TTL (5–15 min) for all downloads; never expose raw bucket URLs.
- **Signed uploads** from the browser directly to Storage (no proxy through FastAPI) with size + MIME limits enforced by policy and re-validated server-side.
- **Malware/MIME sniffing** on the worker before processing (magic-bytes check, not just extension).
- `logs` bucket readable only by `admin` role via a dedicated policy.

---

## 4. API Architecture (REST + WS surface — no code)

### Conventions
JSON only, ISO-8601 timestamps, cursor pagination (`?cursor=&limit=`), consistent error envelope `{error:{code,message,details}}`, request-id header, per-user + per-IP rate limits, OpenAPI at `/docs`.

### Groups

**Authentication** (thin — Supabase owns the flow; backend only verifies + issues guest tokens)
- `POST /auth/guest` — mint a short-lived guest token for demo. **Public**, rate-limited.
- `POST /auth/verify` — introspect current token. **Auth required**.
- `POST /auth/logout` — revoke server session record. **Auth required**.
- Password reset & Google OAuth: handled by Supabase directly.

**Users**
- `GET /me` — profile + role. **Auth**.
- `PATCH /me` — update profile. **Auth**.
- `GET /me/notification-settings` / `PUT /me/notification-settings`. **Auth**.

**Detection**
- `POST /detect/image` — single image inference. **Auth (guest OK, quota'd)**. Req: multipart or `{image_path}`. Res: `{state, ear, mar, head_pose, score, boxes[]}`. Errors: 400 invalid image, 413 too large, 429 quota.
- `POST /detect/video` — enqueue video job. **Auth**. Req: `{upload_id}`. Res: `{job_id}`.
- `GET /detect/jobs/{id}` — job status. **Auth (owner)**.
- `WS /ws/detect` — live bidirectional stream. **Auth (bearer via `?token=`)**. Inbound: JPEG frames + control msgs. Outbound: per-tick event JSON.

**History**
- `GET /history/sessions` — paginated list. **Auth**.
- `GET /history/sessions/{id}` — session + summary. **Auth (owner or admin)**.
- `GET /history/sessions/{id}/events?from=&to=&downsample=` — time-series. **Auth**.
- `DELETE /history/sessions/{id}` — soft-delete + cascade storage cleanup. **Auth**.

**Statistics**
- `GET /stats/me/summary?range=7d|30d|90d`. **Auth**.
- `GET /stats/me/timeseries?metric=&range=`. **Auth**.

**Uploads**
- `POST /uploads/sign` — return signed upload URL + object path. **Auth**. Req: `{kind, mime, size}`. Enforces limits.
- `POST /uploads/finalize` — record metadata after successful PUT. **Auth**.

**Alerts**
- `GET /alerts?range=&level=`. **Auth**.
- `GET /alerts/{id}`. **Auth**.
- `POST /alerts/{id}/ack`. **Auth**.

**Administration** (all require `admin`)
- `GET /admin/users` · `PATCH /admin/users/{id}/role` · `POST /admin/users/{id}/disable`.
- `GET /admin/analytics/summary` · `GET /admin/analytics/timeseries`.
- `GET /admin/alerts` · `GET /admin/sessions`.
- `GET /admin/logs?level=&from=&to=` · `GET /admin/audit`.
- `GET /admin/models` · `POST /admin/models/activate/{id}` · `PUT /admin/model-settings/{id}`.
- `GET /admin/settings` · `PUT /admin/settings/{key}`.

**Settings**
- `GET /settings/public` — non-sensitive flags exposed to the app. **Public**.

**Health**
- `GET /health` — liveness. **Public**.
- `GET /ready` — readiness (model loaded, DB reachable, queue reachable). **Public** (network-restricted).

### Error responses (uniform)
`400` validation, `401` unauthenticated, `403` forbidden/role, `404` not found, `409` conflict, `413` payload too large, `415` unsupported media, `422` semantic, `429` rate limit, `500` internal, `503` degraded. Every error carries `code` (stable string), `message` (human), `details` (structured).

---

## 5. Real-Time Communication — Recommendation

**Hybrid, with WebSocket as the primary real-time channel.**

- **WebSocket (`/ws/detect`)** for live webcam/dashcam: bidirectional (frames up, events down), low overhead, sub-second latency, one connection per session.
- **REST** for everything else: auth, uploads, jobs, history, admin, settings — request/response is the right shape for these.
- **Server-Sent Events (SSE)** as a fallback for hostile networks that block WS (some corporate proxies), one-way server → client, useful for job progress notifications to a dashboard tab that isn't actively streaming frames.

**Why not pick just one:** REST alone cannot deliver 10 Hz event streams without polling storms; WS alone forces batch/admin flows into an unnecessarily stateful protocol; SSE is one-way so it cannot carry frames. Using each where it fits keeps the surface small and the latency budget honest.

---

## 6. AI Inference Pipeline

```text
Frame source (WS frame · uploaded image · video frame)
        │
        ▼
[1] Ingest & Validate  ── MIME/size/decoding, drop malformed
        │
        ▼
[2] Preprocess         ── resize (model input, e.g. 640), color, normalize, letterbox
        │
        ▼
[3] Model Inference    ── Model Manager → active Detector.predict()
        │                (best.pt today; YOLO/RF-DETR/FRCNN tomorrow)
        ▼
[4] Post-process       ── NMS, class map, bbox scaling to original coords
        │
        ▼
[5] Landmark Extraction── eyes/mouth landmarks per face detection
        │
        ▼
[6] Metrics
     ├─ EAR   (eye aspect ratio; per eye + averaged)
     ├─ MAR   (mouth aspect ratio; yawn candidate)
     └─ Head Pose (yaw/pitch/roll via solvePnP)
        │
        ▼
[7] Fatigue Engine     ── rolling window (N seconds) + FSM + hysteresis
        │                → state, score, alert_level
        ▼
[8] Alert Engine       ── cooldown, severity, channel routing
        │
        ▼
[9] Persist            ── detection_events (always), alerts (on trigger),
        │                screenshots bucket (on trigger, if opted in)
        ▼
[10] Fan-out           ── WS event → browser; notifications → email/WhatsApp
```

**Why this ordering:** ingest guards the process from malformed input; preprocessing is deterministic and testable; inference is the only heavy step and stays behind an interface; metrics and decisions are pure functions; persistence and notifications are last so a downstream failure never blocks the real-time loop (fire-and-forget with retry queue).

---

## 7. Decision Engine (Fatigue FSM)

**Inputs per tick (≈10 Hz):** `ear`, `mar`, `head_yaw|pitch`, plus rolling counters.

**Derived signals:**
- `eye_closure_ms`: continuous time `ear < ear_threshold`.
- `yawn_count_window`: yawns (`mar > mar_threshold` for ≥ 500 ms) in last `yawn_window_s` (default 60 s).
- `head_off_axis_ms`: continuous time `|yaw|>25°` or `|pitch|>20°`.
- `perclos`: percentage of eye closure over last 60 s (industry-standard drowsiness metric).

**State machine:**

```text
             ┌────────────┐
             │   AWAKE    │◀──────────────────────┐
             └─────┬──────┘                       │
     eye_closure_ms>400 OR head_off_axis_ms>1500  │
                   ▼                              │
             ┌────────────┐   metrics normal 3s   │
             │ DISTRACTED │───────────────────────┤
             └─────┬──────┘                       │
   perclos>0.15 OR yawn_count_window≥2           │
                   ▼                              │
             ┌────────────┐   metrics normal 5s   │
             │   DROWSY   │───────────────────────┤
             └─────┬──────┘                       │
       eye_closure_ms>1500 OR perclos>0.3         │
                   ▼                              │
             ┌────────────┐   eyes open 2s        │
             │  SLEEPING  │───────────────────────┘
             └────────────┘
```

**Fatigue score (0–100):** weighted blend, e.g. `score = 40·perclos_norm + 25·closure_norm + 20·yawn_norm + 15·head_norm`. All weights and thresholds live in `model_settings` and are hot-tunable.

**Alert level mapping:** `AWAKE→none`, `DISTRACTED→info`, `DROWSY→warn`, `SLEEPING→critical`. Hysteresis (must hold state N ticks) prevents flicker; cooldown (default 30 s per type) prevents alarm spam.

**Why FSM + hysteresis + perclos:** single-frame thresholds are noisy; PERCLOS is the most validated fatigue metric in the literature; hysteresis and cooldown turn a probabilistic signal into a trustworthy safety alarm.

---

## 8. Model Manager (multi-model ready)

```text
┌────────────────────────────────────────────────────────┐
│                   Model Manager                        │
│  ┌───────────────┐   ┌───────────────┐   ┌──────────┐  │
│  │ Registry (db) │──▶│ Loader (lazy) │──▶│  Cache   │  │
│  └───────────────┘   └───────────────┘   └────┬─────┘  │
│                                               │        │
│                Detector Interface  ◀──────────┘        │
│         predict(frame) → List[Detection]               │
└────────────────────────────────────────────────────────┘
        ▲                    ▲                    ▲
        │                    │                    │
   YoloAdapter         RfDetrAdapter        FasterRcnnAdapter
   (best.pt today)     (future)             (future)
```

- Single `Detector` interface; every model family is an adapter.
- `model_versions` table lists all deployable models; exactly one is `is_active=true` per environment.
- Warm swap: new model loaded, health-checked on a canary frame, then flag flipped atomically.
- The frontend never sees which model runs — only the detection schema, which stays stable.

---

## 9. Authentication Architecture

- **Provider:** Supabase Auth (email/password + Google) via Lovable Cloud.
- **Session:** JWT stored by Supabase JS in browser; refresh handled by SDK.
- **Guest flow:** frontend calls `POST /auth/guest`; backend mints a short-lived signed token (JWT, 15 min, `role=guest`, `sub=guest-{uuid}`) with strict quotas. No DB row until upgrade to a real account, at which point recent in-memory session data can be persisted.
- **Administrator flow:** identical sign-in; admin gate via `has_role(auth.uid(),'admin')` at both DB (RLS) and API (dependency) layers.
- **Token validation:** FastAPI dependency fetches JWKS (cached), verifies signature + `iss` + `aud` + `exp`, extracts `sub` and custom claims. Guest tokens verified against the backend's own signing key.
- **Password reset:** Supabase magic link; backend not involved.
- **Session records:** `sessions` table for device/IP audit and forced revoke; independent of Supabase's own token lifecycle.
- **Role permissions:** `guest` → demo endpoints only, no history persistence; `user` → own data; `admin` → global read + admin mutations.

---

## 10. Security Architecture

- **Transport:** HTTPS + WSS only; HSTS; TLS 1.2+.
- **API auth:** JWT verification on every request; explicit dependency; no ambient auth.
- **CORS:** allowlist for Lovable preview + production domain; credentials disabled unless required.
- **Rate limits:** per-IP and per-user, tighter for guest (`/auth/guest`, `/detect/image` demo). Redis token-bucket.
- **File uploads:** signed URLs with size/mime constraints; server re-validates magic bytes; reject archives; scan queued for larger tiers.
- **Input validation:** Pydantic everywhere; strict schemas; reject unknown fields.
- **Secrets:** platform env only (never in repo, never in Lovable frontend). Rotate quarterly. Service-role key exists **only** on FastAPI hosts.
- **RLS:** on every user table; policy tests in CI.
- **Audit logs:** every admin mutation and role change.
- **PII minimization:** phone numbers optional; encrypted at rest with `pgcrypto` if stored.
- **Frames:** not retained by default; explicit consent required for `screenshots`.
- **Dependency hygiene:** SBOM, Dependabot/Renovate, image scanning (Trivy).

---

## 11. Performance

- **Caching:** Redis for JWKS, rate-limit buckets, `settings`, `model_settings`, per-user stats summaries (TTL 60 s). HTTP `Cache-Control` on public config.
- **DB indexing:** as listed in §2; add covering indexes when EXPLAIN shows heap fetch dominance.
- **Async everywhere:** FastAPI async endpoints, `asyncio` for I/O, thread pool only for CPU/OpenCV work; inference runs in a dedicated worker (avoids blocking event loop).
- **Video streaming:** client samples at 8–12 fps, downscales to model input, JPEG q≈70 over WS; server applies backpressure by dropping frames when queue depth > N.
- **GPU:** fp16, batch of 1 for live, batch of 8–16 for uploads; ONNX/TensorRT export as later optimization; keep one model instance per worker process.
- **Memory:** frame buffers reused via arenas; explicit `del` + `torch.cuda.empty_cache()` between batch jobs; hard limit per WS session.
- **Concurrency:** `uvicorn --workers N` sized to GPU/CPU; sticky sessions for WS behind LB; long jobs off-loaded to worker pool.
- **Precomputed rollups:** admin analytics never scan `detection_events` live.

---

## 12. Logging & Monitoring

- **Structured logs:** `structlog` JSON; every request has `request_id`; every WS session has `session_id`; propagated to workers.
- **Inference logs:** per-tick sampled (1 in N) to avoid volume; per-alert always logged.
- **API logs:** access log with latency + status + user id (hashed) + route.
- **Alert logs:** dedicated stream; mirrored to `alerts` + `alert_history`.
- **Health:** `/health` (liveness) and `/ready` (deps). Uptime pings from external monitor.
- **Errors:** Sentry (frontend + backend) with release tagging.
- **Metrics:** OpenTelemetry → Grafana/Prometheus (request rate, p95 latency, GPU util, queue depth, model FPS, WS active connections, alert rate).
- **Log storage:** hot in platform logs, cold archived to `logs` bucket nightly.

---

## 13. Background Tasks

Queue: **Redis + RQ** initially (simple, Python-native); upgrade path to Celery when workflows fan out.

| Worker | Trigger | Job |
|---|---|---|
| `video_worker` | `POST /detect/video` | Download upload → run pipeline frame-by-frame → persist session + events → mark job done. |
| `notification_worker` | Alert Engine emits event | Dispatch email (Resend/SMTP), WhatsApp (Twilio); retry with backoff; write `alert_history`. |
| `cleanup_worker` | Cron nightly | Prune expired storage per retention table; soft-delete cascades; VACUUM hints. |
| `rollup_worker` | Cron nightly + hourly | Populate `statistics_daily` and `statistics_global_daily`. |
| `report_worker` | User requests export | Build PDF/CSV, upload to `exports`, email signed link. |
| `log_archive_worker` | Cron nightly | Bundle previous day's logs → `logs` bucket (gz). |

**Why a queue, not `BackgroundTasks`:** `BackgroundTasks` dies with the request process; queues survive restarts, retry on failure, and can be observed.

---

## 14. Deployment Architecture

```text
Frontend   → Lovable hosting (edge)
Database   → Lovable Cloud (Supabase-managed Postgres + Auth + Storage)
Backend    → Containerized FastAPI
              · Dev  : Docker Compose (api + redis + worker) on VS Code
              · Prod : Fly.io (CPU tier, global regions) OR Render/Railway
                       for CPU workloads; RunPod / Lambda Labs / AWS g5
                       for GPU workers when demand justifies.
              · Reverse proxy with HTTPS + WSS (Fly/Cloudflare/NGINX).
Queue      → Managed Redis (Upstash / Fly Redis).
Notif      → Resend (email), Twilio (WhatsApp).
Observability → Sentry + Grafana Cloud (or Better Stack).
```

**Recommended production host: Fly.io** for the API + a GPU pool on RunPod for heavy inference. Rationale: Fly gives global edge, WS-friendly, sticky sessions, cheap idle; RunPod gives on-demand GPUs that autoscale to zero — the right cost curve for a graduation project that must also demo credibly under real load.

### Environments
- `dev` (local Docker Compose, own Supabase project).
- `staging` (Fly app + staging Supabase project).
- `prod` (Fly app + prod Supabase project + GPU pool).
- Config strictly via env; no `.env` in repo.

### CI/CD
- GitHub Actions: lint → typecheck (mypy) → unit → integration (spin up Postgres + Redis) → build image → push to registry → deploy on tag.
- DB migrations via `alembic` or Supabase migrations tool; PR checks include a dry-run.
- Frontend deploys via Lovable on merge.

### Scaling
- Stateless FastAPI → horizontal autoscale on CPU + WS connection count.
- Sticky sessions for WS or Redis pub/sub for cross-node fan-out.
- Worker pool scales on Redis queue depth.
- GPU pool scales to zero when idle; warm pool of 1 during business hours if needed.

### Backup & recovery
- Supabase PITR enabled (7–14 day window).
- Nightly logical backup of Postgres to object storage (encrypted).
- Storage buckets versioned; lifecycle rules per §3.
- Runbook: RTO 1 h, RPO 15 min. Quarterly restore drill.

---

## 15. Complete Data Flow Diagrams

### Live webcam / dashcam
```text
Browser camera ─► WS frame ─► FastAPI /ws/detect ─► Inference ─► Metrics ─► Fatigue FSM
                                                                                │
                                             ┌──────────────────────────────────┤
                                             ▼                                  ▼
                                     WS event → Browser                Alert Engine
                                     (state, ear, mar, score)                  │
                                                                    ┌──────────┼───────────┐
                                                                    ▼          ▼           ▼
                                                              Supabase   Notif queue   Screenshot
                                                              (events,   (email,       bucket
                                                              alerts)     WhatsApp)    (opt-in)
```

### Uploaded video/image
```text
Browser ─► /uploads/sign ─► Signed PUT to Storage ─► /uploads/finalize
                                                            │
                                                            ▼
Browser ─► /detect/video {upload_id} ─► Enqueue job ─► video_worker
                                                            │
                              Storage download ◀────────────┤
                                                            ▼
                                          Frame loop → Pipeline → Persist
                                                            │
                                                            ▼
                                                  Job status → Browser polls
                                                            │
                                                            ▼
                                                     Session detail view
```

### Alert dispatch
```text
Fatigue FSM ─► Alert Engine ─► alerts row ─► notification_worker
                                                    │
                                     ┌──────────────┼───────────────┐
                                     ▼              ▼               ▼
                                  Resend       Twilio WhatsApp   WS push
                                     │              │               │
                                     └──────────────┴──► alert_history
```

---

## 16. Development Roadmap (Backend)

**B0 — Foundations**
- Repo scaffold, Docker Compose (api + redis + worker), pre-commit, mypy/ruff, Sentry.

**B1 — Core API skeleton**
- FastAPI app factory, config, structured logging, error envelope, `/health`, `/ready`.
- Supabase JWT verification dependency; guest token issuance.

**B2 — Model Manager + Inference Engine**
- Detector interface; YOLO adapter for `best.pt`; model registry read from DB.
- Warm load on startup; `/detect/image` endpoint end-to-end.

**B3 — Metrics + Decision Engine**
- EAR/MAR/head-pose modules with unit tests on fixture frames.
- Fatigue FSM + hysteresis + PERCLOS; tuning via `model_settings`.

**B4 — WebSocket live pipeline**
- `/ws/detect`, per-connection state, backpressure, adaptive fps.
- Persist `detection_sessions` + `detection_events`.

**B5 — Uploads + Video worker**
- Signed uploads, `/detect/video`, RQ worker, job status endpoints.

**B6 — Alerts + Notifications**
- Alert Engine, cooldown, `alerts` + `alert_history`.
- Email + WhatsApp adapters, retry, per-user preferences.

**B7 — History + Statistics**
- History list/detail endpoints; nightly rollups; `/stats/me/*`.

**B8 — Admin surface**
- Admin routers (users, analytics, alerts, logs, models, settings, audit).
- Model activation flow; hot-tunable thresholds.

**B9 — Hardening**
- Rate limits, CORS lockdown, dependency scan, load test WS + workers.
- Perf pass: fp16, downscaling, batch tuning, cache pass.

**B10 — Deploy & Ops**
- Fly.io API + Upstash Redis + RunPod GPU pool.
- CI/CD, migrations pipeline, PITR + backup drills, runbook, dashboards.

---

## 17. Why these choices (summary)

- **Modular FastAPI (hexagonal):** clean seams let ML, notifications, and storage change independently — critical for a project that will iterate on models.
- **Model Manager with Detector interface:** the frontend and decision engine are insulated from model choice, so YOLO → RF-DETR → Faster R-CNN swaps are a config change, not a rewrite.
- **Hybrid REST + WS + optional SSE:** each protocol used where it fits; nothing forced.
- **Separate `detection_events` + monthly partitioning + `statistics_daily`:** the only shape that keeps analytics fast as event volume grows.
- **Roles in `user_roles` + `has_role` SECURITY DEFINER:** the only safe pattern; anything else invites privilege escalation.
- **Signed URLs + private buckets + folder RLS:** protects footage without proxying large files through the API.
- **Redis + RQ queue:** durable async work with a trivial ops footprint, upgradeable to Celery.
- **Fly.io + RunPod split:** cheap always-on API at the edge; GPU capacity only when needed.
- **PERCLOS + FSM + hysteresis + cooldown:** turns noisy per-frame ML output into a trustworthy safety alarm.
- **Supabase as the data plane only:** it does auth, DB, and storage extremely well; keeping ML out of it preserves separation of concerns and lets each side scale on its own curve.

---

Awaiting your approval. Once you confirm, I'll start **B0 → B2** on the FastAPI side (repo scaffold + core API skeleton + Model Manager) and check in after each backend phase before continuing.
