# Phase 0 — Project Audit

**Project:** Driver Drowsiness Detection V2
**Audit date:** 2026-08-24
**Target:** GitHub → GitHub Actions → Docker Hub → AWS (Terraform) → EKS → Kubernetes
**Status:** Audit only. No files created or modified.

---

## 1. Repository tree and architecture summary

```
Driver Drowsiness Detection V2/
├── Backend/                     FastAPI application — THE backend
│   ├── app/
│   │   ├── main.py              create_app() factory + module-level `app`
│   │   ├── api/v1/              admin, analysis, analytics, health, sessions, uploads
│   │   ├── core/                config (pydantic-settings), constants, exceptions, logging, security
│   │   ├── dependencies/        auth, database, model  (DI providers)
│   │   ├── domain/
│   │   │   ├── analysis.py, video_analysis.py
│   │   │   └── models/          base, factory, manager, faster_rcnn (torch), onnx_backend (ORT)
│   │   │       └── custom_frcnn/  vendored inference-only Faster R-CNN (torch)
│   │   ├── infra/               jwks, storage, supabase_client, video_encoder, repositories/
│   │   ├── middleware/          error_handler, request_context
│   │   ├── schemas/             pydantic response models
│   │   └── services/            analysis, analytics, admin, session, upload, video, preview_store...
│   ├── tests/                   34 test modules (unit + api)
│   ├── best.onnx                68.16 MB — byte-identical copy of the ML checkpoint
│   ├── requirements.txt         runtime deps
│   ├── requirements-dev.txt     pytest / ruff / black / isort / coverage
│   ├── pyproject.toml           Python 3.12 pin + full tool config
│   ├── .env                     REAL SECRETS PRESENT
│   ├── .env.example             committed template
│   ├── .gitignore               good, backend-scoped
│   ├── docker-compose.yml       ⚠ describes the abandoned 2-service split
│   ├── Dockerfile.ml            ⚠ same — stale MODEL_PATH, stale volume
│   ├── db/migrations/
│   └── gateway/                 ⚠ DEAD CODE — Node/Express partial re-implementation
│
├── Frontend/                    TanStack Start (React 19 + Vite 8 + Nitro), SSR
│   ├── src/
│   │   ├── routes/              25 file-based routes, `_authenticated/` guarded layout
│   │   ├── lib/api.js           API client → import.meta.env.VITE_API_URL
│   │   ├── integrations/supabase/
│   │   ├── server.js, start.js  SSR entry + error wrapper
│   │   └── components/          ~200 components (shadcn/ui + Radix + Recharts)
│   ├── .env                     Supabase public keys + VITE_API_URL
│   ├── .gitignore               ⚠ does NOT ignore .env
│   ├── package.json / package-lock.json / bun.lock   ⚠ two lockfiles
│   ├── vite.config.js           @lovable.dev/vite-tanstack-config wrapper
│   ├── .output/                 stale build — preset "cloudflare-module"
│   └── supabase/migrations/
│
├── ML/                          Training / research code — NOT runtime
│   ├── train.py, evaluate.py, export_onnx.py, inference.py, webcam.py, app.py (Streamlit)
│   ├── models/                  training copy of the network (backend has its own vendored copy)
│   ├── checkpoints/tuned_fixed/ best.onnx 68.16 MB · best.pth 134.88 MB · last.pth 134.88 MB
│   ├── results/                 metrics JSON, loss curves, ~62 MB of annotated .mp4
│   └── videos/                  ~119 MB of .avi (one file is 101.75 MB)
│
├── DEPLOY.md                    prior Render + Vercel deployment plan (superseded by this project)
└── SESSION_REPORT.md
```

**Runtime architecture, as actually implemented:**

```
Browser (TanStack Start SSR, Node/Nitro)
   │  fetch(VITE_API_URL + path)  +  Authorization: Bearer <Supabase access token>
   ▼
FastAPI  (uvicorn app.main:app, port 8000)
   │
   ├── verifies the JWT locally against Supabase JWKS (ES256, public keys, cached)
   ├── Supabase service-role client → Postgres (sessions, users, roles) + Storage
   └── ModelManager → OnnxFasterRCNNBackend → onnxruntime.InferenceSession(best.onnx)
```

Supabase is an external managed dependency (auth + Postgres + storage) and stays outside AWS.
That is a deliberate, sound choice — it keeps EKS stateless.

---

## 2. Frontend analysis

| Item | Finding |
|---|---|
| Framework | TanStack Start 1.168 + React 19 + Vite 8, wrapped by `@lovable.dev/vite-tanstack-config@2.7.7` |
| Rendering | **Server-side rendered**, via Nitro. `src/server.js` exports a `fetch` handler. Not a static SPA. |
| Build command | `npm run build` → `vite build` |
| Build output | `.output/` — `server/index.mjs` + `public/` |
| Current Nitro preset | **`cloudflare-module`** (see `.output/nitro.json`) — a Cloudflare Worker bundle |
| Dev port | Vite default 5173 (sandbox detection may override) |
| Prod port | Nitro node-server default **3000** (`PORT` env) — once the preset is switched |
| API base URL | `src/lib/api.js:6` → `import.meta.env.VITE_API_URL \|\| "http://127.0.0.1:8000/api/v1"` |
| Current value | `VITE_API_URL=http://127.0.0.1:8000/api/v1` |
| Auth | `@supabase/supabase-js` in the browser; token attached per request by `authFetch` |
| Env vars | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`, `VITE_API_URL` |
| Package manager | **Ambiguous** — `package-lock.json` (npm) *and* `bun.lock` both present |

---

## 3. Backend / FastAPI analysis

| Item | Finding |
|---|---|
| Entry point | `Backend/app/main.py` |
| App object | `app = create_app()` — factory pattern, module-level export for `uvicorn app.main:app` |
| Serve command | `uvicorn app.main:app --host 0.0.0.0 --port 8000` |
| Python | `requires-python = ">=3.12,<3.14"` — 3.12 is the target |
| Startup | `lifespan` hook: Supabase client → JWKS provider → AuthService → **ModelManager.load()** |
| Model load failure | Non-fatal. Manager records `FAILED`, service starts degraded, inference returns 503. |
| CORS | `CORSMiddleware`, origins from `ALLOWED_ORIGINS`, `allow_credentials=True`, exposes `X-Request-ID` |
| Production guard | `APP_ENV=production` **refuses to start** if `ALLOWED_ORIGINS` is empty or contains `*` |
| Health endpoints | `GET /health` (liveness), `GET /ready` (readiness), `GET /system/health` — mounted both at `/api/v1/...` and at the **root**, deliberately, for orchestrator probes |
| Docs | `/docs`, `/redoc`, `/openapi.json` — enabled in every environment by design |
| API surface | 6 routers: admin (6), analysis (3), analytics (3), health (3), sessions (5), uploads (2) |
| Tests | 34 modules, pytest + pytest-asyncio, `asyncio_mode=auto`, coverage configured, no `fail_under` gate yet |
| Lint/format | ruff + black + isort, all configured in `pyproject.toml` |
| Runs without Docker | Yes — `.venv` exists, `.env` present and valid, model file resolves. |

**Quality note:** this backend is unusually well built for containerisation — factory pattern, typed
settings, DI everywhere, `app.state` instead of globals, no `os.environ` reads outside `config.py`,
no hardcoded secrets. Very little needs to change.

---

## 4. ONNX model loading analysis

**Where the model is**

| Path | Size | md5 |
|---|---|---|
| `ML/checkpoints/tuned_fixed/best.onnx` | 68,159,217 B | `0eafb913…5ddba` |
| `Backend/best.onnx` | 68,159,217 B | `0eafb913…5ddba` — **identical copy** |

**How it loads**

1. `Settings.model_path` defaults to `../ML/checkpoints/tuned_fixed/best.onnx`; `.env` sets the same.
2. `_resolve_model_path` resolves relative paths against **`BACKEND_ROOT`** (the `Backend/` dir),
   *not* the process CWD — good, this is container-safe by design.
3. `build_backend()` dispatches on file extension: `.onnx` → `OnnxFasterRCNNBackend`, else `.pth` → PyTorch.
4. `OnnxFasterRCNNBackend` picks providers via `_resolve_providers`: CUDA → DirectML → **CPU fallback**.
   Only providers present in the installed wheel are offered. CPU-only hosts work unchanged.
5. Loaded **once** in the lifespan hook, with `warmup=True` in production.

**The important discovery — torch is imported at startup even on the ONNX path**

```
main.py
 └─ app.domain.models/__init__.py
     └─ onnx_backend.py
         └─ from app.domain.models.custom_frcnn._geometry import NORM_MEAN, NORM_STD
             └─ executes custom_frcnn/__init__.py
                 └─ from …custom_frcnn.faster_rcnn import FasterRCNN
                     └─ import torch  +  from torchvision.ops import nms, roi_align
```

`_geometry.py` itself imports nothing but constants. The `custom_frcnn` **package `__init__`**
eagerly re-exports `FasterRCNN`, and that is what drags torch + torchvision into every process.

Everything *else* is already lazy and correct: the PyTorch adapter imports `torch` inside its
methods (lines 118/162/198/231) and `FasterRCNN` inside a function (line 75).

**Cost of this one line:** default PyPI `torch` wheels bundle CUDA — roughly **2.5 GB**.
CPU-only wheels are ~800 MB–1 GB. With torch removed from an ONNX-only image, the backend image
lands at roughly **450–600 MB** (python-slim + onnxruntime + opencv-headless + numpy + ffmpeg + 68 MB model).

Fix is ~8 lines in `custom_frcnn/__init__.py` (a module-level `__getattr__` for lazy re-export).
Nothing else changes; the PyTorch path still works when a `.pth` checkpoint is configured.

---

## 5. Environment and configuration analysis

**Backend `.env` — non-secret values**

```
APP_ENV=development          LOG_LEVEL=INFO
HOST=127.0.0.1               PORT=8000        API_V1_PREFIX=/api/v1
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:8080,http://localhost:8081
MODEL_PATH=../ML/checkpoints/tuned_fixed/best.onnx
MODEL_DEVICE=auto            MODEL_SCORE_THRESHOLD=0.5
MAX_IMAGE_SIZE_MB=25         MAX_VIDEO_SIZE_MB=500
SMTP_HOST=smtp.gmail.com     SMTP_PORT=587    SMTP_FROM_NAME=DriveAlert
```

**Backend `.env` — secret variables that are populated (values not read, not shown, not stored)**

`SECRET_KEY` · `SUPABASE_URL` · `SUPABASE_SERVICE_ROLE_KEY` · `SUPABASE_JWT_SECRET` ·
`SMTP_USER` · `SMTP_PASSWORD` · `WHATSAPP_API_KEY`

**Paths that point outside the `Backend/` directory** — all three break inside a container:

| Setting | Default | Used by |
|---|---|---|
| `model_path` | `../ML/checkpoints/tuned_fixed/best.onnx` | inference |
| `model_metrics_path` | `../ML/results/test_metrics_tuned.json` | Analytics "AI performance" card |
| `model_checkpoints_dir` | `../ML/checkpoints` | Admin "switch active model" |

**Frontend `.env`** — `VITE_*` values are baked into the bundle at build time. This makes the
frontend image environment-specific unless we route the API through the same origin (see §9).

---

## 6. Current deployment-related files

| File | Verdict |
|---|---|
| `Backend/Dockerfile.ml` | **Stale.** Written for the two-service split. Installs CPU torch wheels, copies only `app/` (no model), `CMD uvicorn --host 0.0.0.0 --port 8000` is correct. Useful as a starting point, not as-is. |
| `Backend/docker-compose.yml` | **Stale.** `MODEL_PATH=/checkpoints/tuned/best.pth` — that directory does not exist. Mounts `../../checkpoints` — does not exist. Composes `ml-service` + `gateway`, not `backend` + `frontend`. |
| `Backend/gateway/` | **Dead code.** Express re-implementation of an abandoned split. `/sessions` returns `501`. No analytics, no admin. The frontend calls port 8000 (FastAPI), never 3000. Already documented as dead in `DEPLOY.md`. |
| `Backend/gateway/Dockerfile` | Correct multi-stage Node build — but for a service we are not deploying. |
| `DEPLOY.md` | Prior Render + Vercel plan. Superseded by the AWS/EKS target, but its blocker analysis is accurate and consistent with what I found. |
| `Backend/.gitignore` | Good. Covers `.env`, venvs, caches, `*.onnx`/`*.pth`/`*.pt`. |
| `Frontend/.gitignore` | Covers node_modules/dist/.output — **but not `.env`**. |
| Root `.gitignore` | **Does not exist.** |
| `.dockerignore` | **Does not exist anywhere.** |
| `.github/`, `k8s/`, `terraform/` | **Do not exist.** |
| Git repository | **Does not exist.** `git rev-parse` fails — the project has never been version controlled. |

---

## 7. Security problems

| # | Severity | Problem |
|---|---|---|
| S1 | **Critical** | No git repo and no root `.gitignore`. `Backend/.env` (service-role key, `SECRET_KEY`, SMTP password, WhatsApp key) is unprotected the moment `git init && git add .` runs from the project root — the backend-scoped `.gitignore` covers it, but only if the root ignore file does not fight it and only if we verify before the first commit. |
| S2 | **High** | `Frontend/.gitignore` does not ignore `.env`. It would be committed. The keys in it are the *publishable* ones (browser-safe by design), so this is not a credential leak — but it is the wrong habit and it hardcodes `localhost:8000` into the repository. |
| S3 | **High** | No `.dockerignore` anywhere. A naive `COPY . .` would bake `.env`, `.venv/`, `.git/`, `node_modules/`, `.coverage`, and every cache directory into the published Docker Hub images. `.env` inside a public image is a real credential leak. |
| S4 | Medium | `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security. It is correctly backend-only today. In Kubernetes it must land as a Secret (or AWS Secrets Manager), never a ConfigMap, never a baked env var in the Dockerfile. |
| S5 | Medium | `SECRET_KEY` currently lives in a file on a developer machine. Per your own `DEPLOY.md` §2 item 10 — generate a **fresh** one for production and never reuse the local value. |
| S6 | Low | `/docs`, `/redoc`, `/openapi.json` are deliberately public in every environment. That is a documented decision, not a bug — but on a public ALB it advertises the full admin surface. Worth an explicit decision in Phase 7. |
| S7 | Low | `SUPABASE_JWT_SECRET` is set in `.env` but is legacy and unused (project migrated to ES256/JWKS). Dead secret sitting in a file. Safe to delete. |
| S8 | Info | The JWT algorithm is pinned in code, not configurable from the environment — correct, and it closes the `alg: none` / HMAC-downgrade forgery routes. Nothing to fix. |

**No hardcoded secrets were found in source code, Dockerfiles, or compose files.** The one real
credential in `.env.example` is `SUPABASE_URL`, which is public by design.

---

## 8. Potential Docker blockers

| # | Blocker | Consequence |
|---|---|---|
| D1 | `MODEL_PATH` resolves outside the build context (`Backend/../ML/...`) | `COPY ../ML/...` is illegal in Docker. Model missing → manager `FAILED` → every inference returns 503. `Backend/best.onnx` already exists as an identical copy, which solves this cleanly. |
| D2 | `model_metrics_path` → `../ML/results/test_metrics_tuned.json` | Analytics "AI performance" card degrades. Small file (a few KB) — copy it into the backend context. |
| D3 | `model_checkpoints_dir` → `../ML/checkpoints` | Admin model-switching finds nothing. Needs to point at an in-image directory (and eventually S3 — Phase 11). |
| D4 | torch + torchvision imported at startup (§4) | ~2.5 GB image with default wheels, ~1 GB with CPU wheels, slow builds, slow pod starts, high ECR/Docker Hub pull cost. Avoidable. |
| D5 | Nitro preset is `cloudflare-module` | `.output/` is a Worker bundle. `node .output/server/index.mjs` will not run it. Needs `NITRO_PRESET=node-server` (or nitro v3 equivalent) at build time. |
| D6 | Frontend is SSR, not static | Cannot be served by a plain nginx/static container. Needs a Node runtime container. |
| D7 | `VITE_API_URL` is baked at build time | The frontend image is environment-specific unless the API is served on the same origin behind the Ingress. |
| D8 | Two lockfiles (`package-lock.json` + `bun.lock`) | Non-reproducible builds; the Dockerfile and CI could disagree about the package manager. |
| D9 | `HOST=127.0.0.1` in `.env` | Bound to loopback inside a container = unreachable. (`Dockerfile.ml`'s `--host 0.0.0.0` CLI flag overrides it, but relying on that is fragile.) |
| D10 | `APP_ENV=production` + empty/wildcard `ALLOWED_ORIGINS` = **startup failure** | In EKS this is a `CrashLoopBackOff` with a clear log line. Must be set in the ConfigMap before the first production deploy. |
| D11 | `opencv-python-headless` needs `libgl1` + `libglib2.0-0` | Already handled correctly in `Dockerfile.ml`. Carry it forward. |
| D12 | `Backend/.gitignore` ignores `*.onnx` | `Backend/best.onnx` will not be committed → CI has no model to `COPY`. Needs an explicit decision (Phase 3). |
| D13 | `MAX_VIDEO_SIZE_MB=500` + ffmpeg re-encode | Large request bodies and heavy CPU/RAM per request. Drives ALB timeouts, k8s resource limits and node instance sizing. |
| D14 | `preview_store` is **in-process** state (token → temp file) | With more than one backend replica, a preview generated on pod A 404s when requested from pod B. Affects replica count / session affinity (Phase 6–7). |
| D15 | `/ready` does not consult the `ModelManager` | It only checks that the checkpoint file *exists*. A pod whose model failed to load would report Ready and receive traffic. Must be fixed before the readinessProbe means anything (Phase 12, or earlier). |

**Files too large for GitHub — must be excluded before the first push (Phase 2):**

| File | Size | Limit |
|---|---|---|
| `ML/checkpoints/tuned_fixed/best.pth` | 134.88 MB | **over the 100 MB hard limit** |
| `ML/checkpoints/tuned_fixed/last.pth` | 134.88 MB | **over the 100 MB hard limit** |
| `ML/videos/6-MaleGlasses.avi` | 101.75 MB | **over the 100 MB hard limit** |
| `ML/results/*.mp4` | ~62 MB total | over the 50 MB warning |
| `ML/videos/*.avi` (others) | ~17 MB | fine |
| `best.onnx` (×2) | 68.16 MB each | under the hard limit, over the warning |

Also: `Frontend/node_modules`, `Frontend/.output`, `Frontend/_ts_backup.tar.gz`, `Backend/.venv`,
`Backend/.coverage`, `Backend/_to_delete/`, `Frontend/_to_delete/`, `.ruff_cache/`, `.pytest_cache/`.

---

## 9. Recommended changes before Dockerization

Ordered by necessity. Everything here is small and surgical — no application logic is rewritten.

### Required for Phase 1

| # | Change | File | Size |
|---|---|---|---|
| R1 | Set `MODEL_PATH=/app/models/best.onnx` **via environment in the container only** | `docker-compose.yml` / Dockerfile `ENV` | 1 line, no source change |
| R2 | Copy `best.onnx` + `test_metrics_tuned.json` into the image at build | `backend/Dockerfile` | new file |
| R3 | Set `HOST=0.0.0.0`, `PORT=8000` in the container environment | compose / manifests | config only |
| R4 | Switch the Nitro build target to a Node server preset | frontend Dockerfile build stage (`NITRO_PRESET=node-server`) | env var, no source change |
| R5 | Choose one package manager and delete the other lockfile | `Frontend/` | delete 1 file |
| R6 | Add `.dockerignore` to `Backend/` and `Frontend/` | new files | new |

### Strongly recommended (do it now, it gets harder later)

| # | Change | File | Size |
|---|---|---|---|
| R7 | Make `custom_frcnn/__init__.py` re-export lazily → drop torch/torchvision from the ONNX runtime image | `Backend/app/domain/models/custom_frcnn/__init__.py` | ~8 lines · saves ~1–2 GB per image |
| R8 | Point `model_metrics_path` / `model_checkpoints_dir` at in-image locations | container env only | config only |
| R9 | Add `.env` to `Frontend/.gitignore` | 1 line | 1 line |

### Deferred to their own phase (noted, not done now)

- **Phase 2** — root `.gitignore`, `git init`, verify no secret and no >100 MB file is staged, decide what happens to `ML/checkpoints/*.pth` and the videos.
- **Phase 2/3** — decide how `best.onnx` reaches CI (un-ignore the single path / Git LFS / S3 / bake-from-release). 68 MB is legal on GitHub but noisy on every clone.
- **Phase 3** — decide the fate of `Backend/gateway/`: delete, or keep and mark clearly as unused. I will not delete it without your word.
- **Phase 6/7** — `preview_store` multi-replica behaviour (D14); whether `/docs` stays public (S6).
- **Phase 7** — same-origin API routing so `VITE_API_URL=/api/v1` works in every environment (D7).
- **Phase 12** — make `/ready` consult the `ModelManager` (D15).

---

## 10. Proposed plan for Phase 1 — Dockerization

### Target layout

```
Driver Drowsiness Detection V2/
├── docker-compose.yml           ← NEW (root, supersedes Backend/docker-compose.yml)
├── .env.docker.example          ← NEW (compose variable template, no real values)
├── Backend/
│   ├── Dockerfile               ← NEW
│   └── .dockerignore            ← NEW
└── Frontend/
    ├── Dockerfile               ← NEW
    └── .dockerignore            ← NEW
```

Note the capitalised `Backend/` and `Frontend/` — I will preserve your existing directory names
rather than renaming to lowercase, so nothing already written against those paths breaks.

### Backend image

- Base `python:3.12-slim` (matches the `requires-python` pin).
- Multi-stage: builder installs into a venv, runtime copies the venv → no pip/compilers in the final layer.
- `libgl1` + `libglib2.0-0` installed at runtime for `opencv-python-headless`.
- **ONNX-only runtime**: `onnxruntime` yes, `torch`/`torchvision` no — enabled by change R7.
  If you would rather not touch application code yet, the fallback is CPU-only torch wheels
  (`--index-url https://download.pytorch.org/whl/cpu`) and an image roughly 1 GB larger.
- Model copied to `/app/models/best.onnx`; `MODEL_PATH` set by `ENV`, overridable at runtime.
- Non-root user, `EXPOSE 8000`, `HEALTHCHECK` hitting `/health`.
- `CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]` — single worker,
  because the model is loaded per process and each copy costs real RAM. Concurrency comes from
  Kubernetes replicas, not from uvicorn workers.
- Layer order: requirements → pip install → model → application code, so a code change rebuilds
  only the last, smallest layer.

### Frontend image

- Multi-stage: `node:22-slim` builder → `node:22-slim` runtime.
- `NITRO_PRESET=node-server` so the build emits a runnable Node server.
- `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` as **build args**
  (they are compiled into the bundle — this is inherent to Vite, not a design choice).
  In Phase 7 we can collapse `VITE_API_URL` to a same-origin `/api/v1` and make the image portable.
- Runtime stage carries only `.output/`, `EXPOSE 3000`, non-root, `CMD ["node", ".output/server/index.mjs"]`.

### Compose wiring

- Two services on one user-defined bridge network.
- Backend published to the host as `8000:8000`, frontend as `3000:3000`.
- Because `VITE_API_URL` is compiled into the browser bundle, it must be a **host-reachable** URL
  (`http://localhost:8000/api/v1`) — the browser resolves it, not the container. Using
  `http://backend:8000` there would break in the browser. This is exactly the "don't use localhost
  incorrectly between containers" trap, inverted: for *browser-facing* values, host URLs are correct;
  for *server-to-server* calls, service names are correct.
- `ALLOWED_ORIGINS=http://localhost:3000` on the backend so CORS admits the frontend container.
- Secrets read from the shell / a gitignored `.env` at the repo root — never written into
  `docker-compose.yml`.
- `depends_on` with `condition: service_healthy` so the frontend waits for a healthy backend.

### Validation commands you will run

```bash
docker compose build
docker compose up -d
docker compose ps
docker compose logs -f backend
```

Then manually verify: `/health`, `/ready`, `/docs`, a real image inference through the UI, and the
frontend reaching the backend without a CORS error in the browser console.

---

## Decisions I need from you before Phase 1

1. **Apply change R7** (lazy `custom_frcnn` import, drop torch from the runtime image)? — recommended;
   saves 1–2 GB per image, per pull, on every node.
2. **`Backend/gateway/`** — delete it, or keep it in the repo marked as unused?
3. **Package manager for the frontend** — npm (`package-lock.json`) or bun (`bun.lock`)?
4. **`Backend/docker-compose.yml` and `Dockerfile.ml`** — delete them, or leave them alongside
   the new root `docker-compose.yml`?
