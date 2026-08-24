# Phase 1 — Dockerization Completion Report

**Project:** Driver Drowsiness Detection V2
**Project root:** `D:\Project\by FR-CNN from scratch\Driver Drowsiness Detection V2\`
**Date:** 2026-08-24
**Scope:** Phase 1 (Dockerization) only. No AWS, Terraform, Kubernetes, GitHub Actions or CI work was started.
**Predecessor:** `PHASE_0_AUDIT.md` (approved)

---

## 1. Phase 1 Status

### ✅ **PASS**

Every item on the Phase 1 checklist was implemented and verified by execution, not by inspection.
Both images build, the full stack starts, both containers report `healthy`, the ONNX model loads
onto the CPU execution provider, and a **real inference request through the containerised stack
returns a correct detection**.

Three qualifications, none of which block approval:

1. **Two workarounds exist for a local machine problem, not a project problem.** This host runs
   Avast with HTTPS scanning enabled, which intercepts and re-signs TLS. That broke the Docker
   build (PyPI and npm certificate verification) and the container's outbound calls to Supabase.
   The fixes are opt-in and leave both images clean — see §13.
2. **Authenticated endpoints only work locally with the opt-in CA override applied.** Anonymous
   inference, `/health`, `/ready` and `/docs` work unconditionally.
3. **The project is still not under version control**, so the four "deleted" items were staged into
   the project's existing `_to_delete/` convention rather than unlinked. See §4.

---

## 2. Files Created

### Root

| File | Purpose |
|---|---|
| `docker-compose.yml` | The Phase 1 deliverable. Two services (`backend`, `frontend`) on one user-defined bridge network. Supersedes the stale `Backend/docker-compose.yml`. Contains no secrets. |
| `.env.docker.example` | Committed template for the root `.env`. Documents every variable Compose interpolates, and states explicitly that backend secrets are **not** here — they come from `Backend/.env` via `env_file`. |
| `.env` | Generated locally so the stack could be started and tested. Holds only public `VITE_*` values plus host port numbers. **Must be gitignored in Phase 2.** |
| `docker-compose.local-ca.yml` | Opt-in local override that makes outbound TLS work behind Avast's interception. Deliberately *not* named `docker-compose.override.yml` so Compose never loads it automatically. Temporary — see §13. |
| `.docker-ca/proxy-ca.crt` | The intercepting root CA, exported from the Windows certificate store. Build-time input only. **Must be gitignored in Phase 2.** |
| `.docker-ca/combined-ca.pem` | Mozilla root bundle + the above, for runtime `SSL_CERT_FILE`. **Must be gitignored in Phase 2.** |
| `PHASE_1_REPORT.md` | This document. |

### Backend

| File | Purpose |
|---|---|
| `Backend/Dockerfile` | Multi-stage build. `python:3.12-slim-bookworm` builder installs into `/opt/venv`; the runtime stage copies only that venv, so no pip, compilers or build caches ship. ONNX-only. Non-root. Health check. Single Uvicorn worker. |
| `Backend/.dockerignore` | Keeps `.env`, `.venv/`, `.git/`, tests, all caches and the dead `gateway/` out of the build context. |
| `Backend/requirements-torch.txt` | The optional PyTorch extras (`torch`, `torchvision`), needed only for a `.pth` checkpoint. Split out so the ONNX image does not install ~2 GB it never executes. |
| `Backend/test_metrics_tuned.json` | Byte copy of `ML/results/test_metrics_tuned.json` (861 B) into the build context. Docker cannot `COPY` from outside the context, and this mirrors the existing `Backend/best.onnx` precedent. Resolves audit blocker **D2**. |

### Frontend

| File | Purpose |
|---|---|
| `Frontend/Dockerfile` | Multi-stage `node:22-slim`. Builder runs `npm ci` then `npm run build` with `NITRO_PRESET=node-server`; the runtime stage carries only `.output/`. Non-root (`node`), port 3000, health check. |
| `Frontend/.dockerignore` | Excludes `node_modules/`, `.output/`, `.env`, `bun.lock` and the Supabase CLI project. |

### Staging markers

| File | Purpose |
|---|---|
| `Backend/_to_delete/phase-1/README.md` | Records what was removed and why, and the command to make it permanent. |
| `Frontend/_to_delete/phase-1/README.md` | Same. |

---

## 3. Files Modified

### `Backend/app/domain/models/custom_frcnn/__init__.py` — audit change **R7**

**Changed:** the eager re-export

```python
from app.domain.models.custom_frcnn.faster_rcnn import FasterRCNN
```

was replaced with a PEP 562 module-level `__getattr__` that imports `FasterRCNN` on first
attribute access, plus a matching `__dir__`.

**Why:** `onnx_backend.py` imports two normalisation constants from `custom_frcnn._geometry`.
Importing *any* submodule first executes the package `__init__`, and that one line pulled in
`faster_rcnn.py` → `torch` + `torchvision.ops` — on the ONNX path, at startup, in every process.
It was the single reason an ONNX-only image would have carried ~2 GB of PyTorch.

**Compatibility:** fully preserved. `from app.domain.models.custom_frcnn import FasterRCNN` still
works; the PyTorch adapter already performed that import inside a function
(`app/domain/models/faster_rcnn.py:75`), so the `.pth` backend is unaffected.

**Verified:**

```
app.main imported OK
torch eagerly imported      : False
torchvision eagerly imported: False
lazy FasterRCNN resolved    : FasterRCNN
torch now imported          : True      <- only after explicit access
dir() exposes               : ['FasterRCNN']
unknown attr raises         : AttributeError
```

### `Backend/requirements.txt`

**Changed:** `torch>=2.2,<3.0` and `torchvision>=0.17,<1.0` removed and replaced with a comment
block pointing at the new `requirements-torch.txt`.

**Why:** the deployed runtime serves the ONNX export. Keeping torch in the default runtime file
would reintroduce it into the image on the next rebuild. There is no duplication — the extras file
is the single home for those two pins.

**Consequence to be aware of:** `pip install -r requirements.txt` no longer installs torch. Running
a `.pth` checkpoint now requires `pip install -r requirements.txt -r requirements-torch.txt`. This
is documented in both files.

### `Frontend/.gitignore` — audit change **R9**

**Changed:** added `.env`, `.env.local`, `.env.*.local`.

**Why:** the file was not ignored (audit finding **S2**). Its keys are the publishable browser-safe
ones, so this is not a credential leak, but it hardcodes `localhost:8000` into the repository.

### `Frontend/.output/` (build artefact, gitignored)

Regenerated with the `node-server` preset. It previously held a stale `cloudflare-module` Worker
bundle that `node` cannot execute (audit blocker **D5**).

---

## 4. Files Deleted

All four were removed from their original locations exactly as instructed. Because `git rev-parse`
fails in this project — **there is no version control and therefore no way to recover an unlinked
file** — they were moved into the project's own pre-existing `_to_delete/` convention rather than
destroyed.

| Item | Size | Now at | Why removed |
|---|---|---|---|
| `Backend/gateway/` | 53 MB | `Backend/_to_delete/phase-1/gateway/` | Dead code. An Express re-implementation of an abandoned `ml-service` + `gateway` split; `/sessions` returned 501, no analytics, no admin. The frontend has always called FastAPI on port 8000 directly. |
| `Backend/docker-compose.yml` | 4 KB | `Backend/_to_delete/phase-1/` | Stale. Composed `ml-service` + `gateway`, set `MODEL_PATH=/checkpoints/tuned/best.pth` and mounted `../../checkpoints` — neither path exists. Superseded by the root `docker-compose.yml`. |
| `Backend/Dockerfile.ml` | 4 KB | `Backend/_to_delete/phase-1/` | Stale. Written for the same split; installed CPU torch wheels and copied no model. Superseded by `Backend/Dockerfile`. |
| `Frontend/bun.lock` | 172 KB | `Frontend/_to_delete/phase-1/` | Second lockfile. npm was chosen; two lockfiles let CI and the image disagree about the package manager (audit **D8**). |

Neither `_to_delete/` directory can reach an image — both `.dockerignore` files exclude them.

**To make the deletions permanent:**

```bash
rm -rf Backend/_to_delete Frontend/_to_delete
```

---

## 5. Backend Docker

| Item | Value |
|---|---|
| **Base image** | `python:3.12-slim-bookworm` (both stages) |
| **Python version** | 3.12 — matches `requires-python = ">=3.12,<3.14"` in `pyproject.toml` |
| **Final image size** | **968 MB** on disk · **261 MB** content (approximate registry transfer) |
| **Build strategy** | Multi-stage; builder installs into `/opt/venv`, runtime copies only that venv |
| **System packages** | **None.** No `apt-get` layer at all — see note below |
| **Serve command** | `uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1` |
| **Port** | `EXPOSE 8000`, published as `8000:8000` |
| **Workers** | **1**, deliberately — the ONNX session is loaded per process and each copy costs real RAM. Concurrency comes from replicas. |
| **Non-root** | ✅ Yes — `appuser`, uid 1000, gid 1000. Verified: `uid=1000(appuser) gid=1000(appuser)` |
| **Health check** | `HEALTHCHECK` every 30s hitting `/health` via `urllib`, `start-period=60s` |

### torch / torchvision absent — CONFIRMED

Three independent confirmations:

1. **Build-time invariant.** The builder stage fails the build if either package resolves:
   `ONNX-only invariant violated`. Build output: `verified: no torch, no torchvision`.
2. **Package list in the image.** `pip list` inside the image contains neither.
3. **Runtime.** `import app.main` inside the running container → `torch in sys.modules: False`.

### Installed runtime dependencies

Direct, from `requirements.txt`:

```
fastapi          0.141.1     uvicorn[standard]       0.52.4
pydantic         2.13.4      pydantic-settings       2.15.0
python-dotenv    1.2.3       pyjwt[crypto]           2.13.0
httpx            0.28.1      supabase                2.31.0
onnxruntime      1.29.0      opencv-python-headless  4.14.0.94
numpy            2.5.2       python-multipart        0.0.32
imageio-ffmpeg   0.6.0
```

Full resolved set is 52 packages (transitives include `cryptography 50.0.0`, `starlette 1.6.0`,
`uvloop 0.22.1`, `protobuf 7.36.0`, `certifi 2026.7.22`).

### Note on the removed `apt-get` layer

`Dockerfile.ml` installed `libgl1` and `libglib2.0-0` for OpenCV, and the audit recommended carrying
that forward. **It is not needed.** Verified empirically that `opencv-python-headless 4.14`,
`onnxruntime 1.29` and `imageio-ffmpeg 0.6` all import and run in a bare `python:3.12-slim-bookworm`
— imageio-ffmpeg even bundles its own static ffmpeg 7.0.2 binary. Dropping the layer removes a build
dependency on the Debian mirrors (which were returning 403 on this network — see §13) and shrinks
the image. The builder stage imports all four packages and executes `ffmpeg -version`, so the build
fails loudly if this ever stops being true.

---

## 6. ONNX Model

| Item | Value |
|---|---|
| **Source path (host)** | `Backend/best.onnx` — byte-identical to `ML/checkpoints/tuned_fixed/best.onnx` |
| **Path inside container** | `/app/models/best.onnx` |
| **Size** | 68,159,217 bytes |
| **MD5** | `0eafb9135f0dc2daf3d634e9d4e5ddba` — matches the audit's recorded hash |
| **`MODEL_PATH`** | `/app/models/best.onnx`, set by `ENV` in the Dockerfile and again in Compose |
| **Metrics path** | `/app/models/test_metrics_tuned.json` — parses, `mAP@0.5 = 0.7427` |
| **Checkpoints dir** | `/app/models` — lists `best.onnx`, `test_metrics_tuned.json` |

`Backend/best.onnx` was used rather than the `ML/` original because Docker cannot `COPY` from
outside the build context. The identical copy already existed; this resolves blocker **D1** without
enlarging the context.

### `onnxruntime.InferenceSession` — CONFIRMED LOADING

```
onnxruntime version : 1.29.0
model path          : /app/models/best.onnx
InferenceSession    : loaded OK
providers in use    : ['CPUExecutionProvider']
inputs              : [('images', [1, 3, 640, 640], 'tensor(float)')]
outputs             : ['boxes', 'labels', 'scores']
```

### Execution provider

**`CPUExecutionProvider`.** `MODEL_DEVICE=cpu` is set explicitly in the image and in Compose.
The Linux `onnxruntime` wheel offers only `AzureExecutionProvider` and `CPUExecutionProvider`;
CUDA and DirectML are not present and are not wanted in a portable image.

### Loading / warmup errors

**None.** Startup log, verbatim:

```
app.main                        | Starting Driver Drowsiness Detection API v0.1.0 (environment=production)
app.infra.supabase_client       | Supabase client initialised for project host lejbnpdeudtxvsgsickd.supabase.co
app.domain.models.onnx_backend  | AI model loaded (architecture=faster_rcnn_onnx, provider=CPUExecutionProvider, classes=3).
app.domain.models.manager       | AI model warmup pass complete.
app.main                        | Application startup complete
uvicorn.error                   | Uvicorn running on http://0.0.0.0:8000
```

No exceptions, no tracebacks, no degraded-mode warning. Because `APP_ENV=production`, the manager
ran a full warmup pass, so the first real request pays no first-inference penalty.

---

## 7. Frontend Docker

| Item | Value |
|---|---|
| **Build image** | `node:22-slim` |
| **Runtime image** | `node:22-slim` |
| **Final image size** | **337 MB** on disk · **77 MB** content (approximate registry transfer) |
| **Package manager** | ✅ **npm** — `bun.lock` removed, `package-lock.json` retained |
| **Install command** | ✅ `npm ci` — succeeds. Chosen over `npm install` so the build is reproducible and fails loudly if the manifests drift |
| **Build command** | `npm run build` (`vite build`) with `NITRO_PRESET=node-server` |
| **Nitro target** | ✅ **`node-server`** |
| **Start command** | `node .output/server/index.mjs` |
| **Port** | ✅ `EXPOSE 3000`, published `3000:3000`, `PORT=3000` and `HOST=0.0.0.0` |
| **Non-root** | ✅ Yes — `node`, uid 1000 |
| **Health check** | `fetch('http://127.0.0.1:3000/')` every 30s, `start-period=20s` |

### Nitro node-server target — CONFIRMED

The checked-in `.output/` had been built with `preset: "cloudflare-module"` — a Worker bundle that
`node` cannot execute (blocker **D5**). After setting `NITRO_PRESET=node-server` the build emits:

```
preset      : node-server
serverEntry : server/index.mjs
commands    : {"preview":"node ./server/index.mjs"}
```

The builder stage **asserts** this and fails the build on any other preset, so a regression cannot
silently produce an image whose `CMD` crash-loops.

### Production server on port 3000 — CONFIRMED

Container reports `healthy`; `GET http://localhost:3000/` returns **HTTP 200** and server-rendered
HTML with `<title>DriveAlert — AI Driver Drowsiness Detection</title>`. Zero browser console errors.

The runtime stage copies only `.output/` — Nitro's node-server bundle is self-contained, so neither
the toolchain nor `node_modules` reaches the final image. `/app` contains exactly one entry:
`.output`.

---

## 8. Docker Compose

### Services

| Service | Container | Image | Build context |
|---|---|---|---|
| `backend` | `dd-backend` | `driver-drowsiness-backend:local` | `./Backend` |
| `frontend` | `dd-frontend` | `driver-drowsiness-frontend:local` | `./Frontend` |

### Ports

| Service | Mapping | Override |
|---|---|---|
| backend | `8000:8000` | `${BACKEND_PORT:-8000}` |
| frontend | `3000:3000` | `${FRONTEND_PORT:-3000}` |

### Networks

One user-defined bridge, `appnet`. Services resolve each other by name (`http://backend:8000`) for
future server-to-server calls.

**The localhost trap, and why it is inverted here.** `VITE_API_URL` is compiled into the *browser*
bundle, so it is resolved by the user's browser on the host — not by a container. It is therefore
correctly set to `http://localhost:8000/api/v1`. Using `http://backend:8000` would be right for a
container-to-container call and broken for the browser. This is documented inline in the file.

### Environment-variable handling

Three distinct channels, chosen so no credential is ever duplicated:

1. **Secrets → `env_file: ./Backend/.env`.** The real `SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `SMTP_*` and `WHATSAPP_API_KEY` are read from the file that already holds them and is already
   gitignored. No second copy is created.
2. **Container-correct overrides → `environment:`.** Literal, non-secret values that take precedence
   over `env_file`: `APP_ENV=production`, `HOST=0.0.0.0`, `PORT=8000`,
   `ALLOWED_ORIGINS=http://localhost:3000`, and the three in-image model paths.
   These use **literal values, never `${...}` interpolation** — an unset variable would expand to an
   empty string and silently override a real value from `env_file`. That trap is avoided by design.
3. **Public build args → root `.env`.** The `VITE_*` values, which Vite inlines into the browser
   bundle. `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` use Compose's `:?` guard, so a
   missing value fails the build with a readable message instead of producing a broken bundle.

`APP_ENV=production` is set deliberately: it exercises the startup guard that refuses to boot on an
empty or wildcard CORS allowlist (blocker **D10**), so that failure surfaces here rather than as a
`CrashLoopBackOff` in EKS.

### Health checks

| Service | Probe | Interval | Timeout | Retries | Start period |
|---|---|---|---|---|---|
| backend | `GET /health` via `urllib` | 15s | 5s | 5 | 60s |
| frontend | `fetch('http://127.0.0.1:3000/')` | 15s | 5s | 5 | 20s |

The frontend declares `depends_on: backend: condition: service_healthy`, so the UI is never served
in a state where every API call would fail. Verified working: Compose printed
`Container dd-backend Healthy` before starting the frontend.

Both images additionally carry their own `HEALTHCHECK`, so a bare `docker run` is also monitored.

### No secrets hardcoded or baked — CONFIRMED

`docker-compose.yml` contains no credential. `.env.docker.example` contains only placeholders.
Neither Dockerfile sets a secret via `ENV`. Evidence in §9.

---

## 9. Security Validation

Verified by **exporting each image's complete filesystem and searching it for the real secret
values** read from `Backend/.env` — not by inspecting the Dockerfiles.

### Real credentials — absent from both images

| Secret | Backend image | Frontend image |
|---|---|---|
| `SECRET_KEY` | ✅ absent | ✅ absent |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ absent | ✅ absent |
| `SUPABASE_JWT_SECRET` | ✅ absent | ✅ absent |
| `SMTP_USER` | ✅ absent | ✅ absent |
| AWS credentials / `AWS_*` env | ✅ absent (0 vars, no `.aws`, no `credentials` file) | ✅ absent |

**Two apparent hits, both benign and explained:**

- `SMTP_PASSWORD` and `WHATSAPP_API_KEY` matched inside `/app/app/core/config.py`. The matched
  strings are `your-app-password-here` and `your-whatsapp-api-key-here` — **documentation
  placeholders in the source file's own comments**. Their matching also confirms those two variables
  are still unset in `Backend/.env`. Not a leak.
- `SUPABASE_URL` matched in the frontend image. **Expected and correct** — it is the public project
  URL, inlined into the browser bundle by design, and the audit records it as public.

### Files explicitly confirmed excluded

| Item | Backend image | Frontend image |
|---|---|---|
| `.env` | ✅ ABSENT | ✅ ABSENT |
| `.git` | ✅ ABSENT | ✅ ABSENT |
| `.venv` | ✅ ABSENT | ✅ ABSENT |
| `node_modules` (project) | ✅ ABSENT | ✅ ABSENT — `/app` holds only `.output` |
| `__pycache__` (project) | ✅ ABSENT | n/a |
| `tests/` (project) | ✅ ABSENT | n/a |
| Runs non-root | ✅ `appuser` uid 1000 | ✅ `node` uid 1000 |

Base-image internals do match those names — Python's stdlib `__pycache__` under
`/usr/local/lib/python3.12/`, npm's own bundled modules under `/usr/local/lib/node_modules`, and
system CA bundles (`*.pem`). None of these are project artefacts, and the CA bundles are required
for TLS.

### A real defect found and fixed during this validation

The first scan revealed that **`app/**/__pycache__/` was being copied into the backend image**,
including stale `config.cpython-314.pyc` bytecode from a different Python version. Cause: Docker
matches a bare `__pycache__/` pattern **only at the build-context root**, and `*` never crosses a
`/`. Both `.dockerignore` files were rewritten with explicit `**/` prefixes, the images rebuilt, and
the absence re-verified. This is why the section above is evidence-based rather than asserted.

---

## 10. Tests and Validation

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Backend test suite | ✅ **PASS** | **330 passed**, 0 failed, ~111 s. Run three times: after R7, after the requirements split, and against the final tree. The 40 warnings are pre-existing `supabase` deprecations. |
| 2 | Frontend production build | ✅ **PASS** | `npm run build` with `NITRO_PRESET=node-server` → `preset: node-server`, `.output/server/index.mjs` emitted |
| 3 | Backend Docker build | ✅ **PASS** | Both build-time invariants passed (`no torch, no torchvision`; cv2/onnxruntime/ffmpeg import) |
| 4 | Frontend Docker build | ✅ **PASS** | `npm ci` succeeded; preset assertion passed |
| 5 | `docker compose up` | ✅ **PASS** | Verified from a clean `down`; backend gated the frontend via `service_healthy` |
| 6 | Backend container health | ✅ **PASS** | `Up (healthy)` |
| 7 | Frontend container health | ✅ **PASS** | `Up (healthy)` |
| 8 | `GET /health` | ✅ **PASS** | HTTP 200 — `{"status":"ok","environment":"production"}` |
| 9 | `GET /ready` | ✅ **PASS** | HTTP 200 — `ready: true`; see the caveat in §14 |
| 10 | `GET /docs` | ✅ **PASS** | HTTP 200 (`/openapi.json` and `/redoc` also 200) |
| 11 | Frontend accessible | ✅ **PASS** | HTTP 200, SSR HTML, correct `<title>`, no console errors |
| 12 | Frontend → backend | ✅ **PASS** | Cross-origin `fetch` executed **in the browser** from origin `http://localhost:3000` → `http://localhost:8000/api/v1/health` returned **200**; protected route returned **401 `INVALID_TOKEN`**, proving CORS passed and JWT verification ran |
| 13 | Real ONNX inference | ✅ **PASS** | See below |

### CORS

| Origin | Result |
|---|---|
| `http://localhost:3000` (preflight) | ✅ `access-control-allow-origin: http://localhost:3000`, credentials allowed, `X-Request-ID` exposed |
| `http://evil.example` | ✅ **No** `access-control-allow-origin` header — correctly refused |

### Real inference through the containerised stack

`POST /api/v1/analysis/image` with a genuine JPEG from `ML/results/examples_tuned/`:

```json
{
  "driver_state": "SLEEPING",
  "alert_level": "EMERGENCY",
  "fatigue_score": 75,
  "detections": [{ "label": "closed_eye", "score": 0.815, "box": { "...": "..." } }],
  "metrics": { "eye_aspect_ratio": 0.0, "eyes_closed": true, "yawning": false },
  "inference_ms": 247.66,
  "image_width": 640,
  "image_height": 640
}
```

The result is **correct for the input** — a closed-eye test image classified as `SLEEPING` with
0.815 confidence. ~248 ms per image on CPU with one worker.

### Authentication

Protected endpoints (`/sessions`, `/analytics/*`, `/admin/*`) return **401** without a token, and
**401 `INVALID_TOKEN`** with a forged one — after successfully fetching and caching the Supabase
JWKS public keys over HTTPS. The full verification chain works inside the container.

---

## 11. Docker Container Status

```
$ docker compose ps

NAME          IMAGE                              COMMAND                  SERVICE    CREATED         STATUS                   PORTS
dd-backend    driver-drowsiness-backend:local    "uvicorn app.main:ap…"   backend    2 minutes ago   Up 2 minutes (healthy)   0.0.0.0:8000->8000/tcp, [::]:8000->8000/tcp
dd-frontend   driver-drowsiness-frontend:local   "docker-entrypoint.s…"   frontend   2 minutes ago   Up 2 minutes (healthy)   0.0.0.0:3000->3000/tcp, [::]:3000->3000/tcp
```

Both services **healthy**, both ports published, no restarts, no crash loops.

---

## 12. Docker Image Sizes

| Image | On disk | Content (≈ registry transfer) |
|---|---|---|
| `driver-drowsiness-backend:local` | **968 MB** | **261 MB** |
| `driver-drowsiness-frontend:local` | **337 MB** | **77 MB** |

### Backend composition

| Component | Size |
|---|---|
| `opencv-python-headless` (`cv2` + `.libs`) | 162 MB |
| `imageio-ffmpeg` (bundled static ffmpeg) | 77 MB |
| `numpy` (+ `.libs`) | 71 MB |
| `onnxruntime` | 66 MB |
| `best.onnx` | 68 MB |
| `python:3.12-slim-bookworm` base | ~130 MB |
| Remaining venv (fastapi, supabase, cryptography, uvloop…) | ~85 MB |
| Application code | 1.5 MB |

**Honest note:** the audit estimated 450–600 MB. **That estimate was too low** — the real figure is
968 MB, driven mostly by OpenCV and the bundled ffmpeg binary. The comparison that matters is
against the alternative: with default CUDA-bundled torch wheels this image would be roughly
**3 GB**, and ~1.9 GB even with CPU-only wheels. R7 is still worth well over 2 GB per image, per
pull, per node.

Further reduction is possible later (stripping `numpy`/`onnxruntime` test data, a distroless runtime,
or replacing OpenCV decode with Pillow-SIMD) but each carries risk and none is a Phase 1 concern.

---

## 13. Errors Encountered

### 13.1 Session opened in the wrong repository — resolved

The session was rooted in a git worktree of an unrelated project
(`D:\deep learning\project\deep learning\...\phase-1-dockerization-1911ac`, a CheXNet chest X-ray
repo) which has no `Backend/`, `Frontend/`, ONNX model or FastAPI app. The real project was located
at `D:\Project\by FR-CNN from scratch\Driver Drowsiness Detection V2\` and confirmed by the presence
of `PHASE_0_AUDIT.md`. Folder access was requested and granted. **The CheXNet worktree was not
modified.**

### 13.2 Docker daemon not running — resolved

Docker Desktop 29.1.3 was installed but the engine was down
(`open //./pipe/docker_engine: The system cannot find the file specified`). Started it.

### 13.3 `deb.debian.org` returned HTTP 403 — resolved, and the layer removed

The first backend build failed at `apt-get update` with `403 Forbidden` from all three Debian
repositories. Rather than work around it, the necessity of the layer was tested:
`opencv-python-headless`, `onnxruntime` and `imageio-ffmpeg` were verified to import and run in a
bare `python:3.12-slim-bookworm`. **The `apt-get` layer was deleted entirely** — a smaller image, a
faster build, and no dependency on the Debian mirrors. A build-time import check guards the
assumption.

### 13.4 TLS interception broke pip and npm — worked around, **should be replaced**

Root cause: **Avast antivirus HTTPS scanning** (`SSLKEYLOGFILE=\\.\aswMonFltProxy\...`) intercepts
outbound TLS and re-signs it with `CN=Avast Web/Mail Shield Root`. Windows trusts that CA; a Linux
container does not. pip failed with `CERTIFICATE_VERIFY_FAILED`, and npm would have failed the same
way.

**Fix:** both Dockerfiles accept an **optional BuildKit secret** `proxy_ca`, mounted only while
installing dependencies. Without the secret it is a no-op. Because each runtime stage copies only the
build output (`/opt/venv`, `.output/`), **no CA is ever baked into a shipped image** — verified.

> **Replace this later.** The cleanest fix is to disable HTTPS scanning in Avast
> (Protection → Core Shields → Web Shield → *Enable HTTPS scanning*), then delete `.docker-ca/` and
> remove the two `secrets:` blocks. Left in place, it is harmless in CI (the secret simply will not
> exist) but it is machine-specific clutter that must not reach GitHub.

### 13.5 Container could not reach Supabase over HTTPS — worked around, **should be replaced**

The same interception broke the *running* container's outbound calls: `httpx` → Supabase JWKS failed
with `CERTIFICATE_VERIFY_FAILED`. Symptom: anonymous endpoints work, every authenticated endpoint
fails.

**Fix:** `docker-compose.local-ca.yml`, an **explicit opt-in** override (deliberately not named
`docker-compose.override.yml`, which Compose would auto-load). It mounts a combined CA bundle
read-only and sets `SSL_CERT_FILE` / `REQUESTS_CA_BUNDLE` for Python and `NODE_EXTRA_CA_CERTS` for
Node. Nothing is baked into either image. Verified: JWKS fetch returns 200 and token verification
runs.

> **Replace this later.** Same remedy as 13.4. This file must never be applied in AWS/EKS, where no
> such proxy exists.

### 13.6 `.dockerignore` was not excluding nested caches — fixed

Found during the §9 security scan, not by inspection: `app/**/__pycache__/` was being copied into the
backend image, including stale `cpython-314` bytecode. Docker matches a bare `__pycache__/` pattern
**only at the context root**, and `*` does not cross `/`. Both `.dockerignore` files were rewritten
with explicit `**/` prefixes; images rebuilt; absence re-verified.

### 13.7 `Frontend/.output/` held a Cloudflare Worker bundle — fixed

Pre-existing blocker **D5**. `NITRO_PRESET=node-server` fixes it, and the builder now asserts the
preset so a regression fails the build instead of shipping a crash-looping image.

---

## 14. Remaining Issues / Technical Debt

### Introduced by Phase 1 — must be cleaned up

| # | Item | When |
|---|---|---|
| 1 | `.docker-ca/` and `docker-compose.local-ca.yml` — machine-specific Avast workarounds | Remove once HTTPS scanning is disabled; **must not be committed** |
| 2 | Root `.env` must be gitignored before `git init` | **Phase 2, blocking** |
| 3 | `requirements.txt` no longer installs torch — a `.pth` run needs `-r requirements-torch.txt` | Documented; no action |

### Deferred to later phases (from the audit)

| # | Ref | Item | Phase |
|---|---|---|---|
| 4 | **S1** | No git repo, no root `.gitignore`. `Backend/.env` holds a service-role key, `SECRET_KEY` and an SMTP password — verify nothing secret is staged before the first commit | **Phase 2, critical** |
| 5 | — | Files over GitHub's 100 MB hard limit: `best.pth` and `last.pth` (134.88 MB each), `6-MaleGlasses.avi` (101.75 MB) | Phase 2 |
| 6 | **D12** | `Backend/.gitignore` ignores `*.onnx`, so `best.onnx` will not be committed and CI will have no model to `COPY`. Needs a decision: un-ignore the single path, Git LFS, S3, or bake-from-release | Phase 2/3 |
| 7 | **D15** | **`/ready` does not consult the `ModelManager`.** It still reports `ai_model: not_configured — "loading is implemented in Phase G"` even though the model loaded successfully. A pod whose model failed would report Ready and receive traffic. The readinessProbe is currently not meaningful | Phase 12, or earlier |
| 8 | **D14** | `preview_store` is in-process. With more than one replica, a preview generated on pod A 404s from pod B. Constrains replica count / needs session affinity | Phase 6/7 |
| 9 | **D7** | `VITE_API_URL` is baked at build time, so the frontend image is environment-specific. Collapsing to a same-origin `/api/v1` behind the Ingress makes it portable | Phase 7 |
| 10 | **D3** | `MODEL_CHECKPOINTS_DIR` now points at `/app/models`, which contains only the one model — admin "switch active model" has nothing to switch to. Needs S3 | Phase 11 |
| 11 | **D13** | `MAX_VIDEO_SIZE_MB=500` plus ffmpeg re-encode drives ALB timeouts, pod resource limits and node sizing | Phase 6/7 |
| 12 | **S4/S5** | Service-role key must land as a k8s Secret, never a ConfigMap. Generate a **fresh** `SECRET_KEY` for production — never reuse the local value | Phase 5+ |
| 13 | **S6** | `/docs`, `/redoc`, `/openapi.json` are public in every environment by design. On a public ALB this advertises the full admin surface | Phase 7 |
| 14 | **S7** | `SUPABASE_JWT_SECRET` is set but unused (project migrated to ES256/JWKS). Dead secret in a file — safe to delete | Phase 2 |
| 15 | — | **`POST /api/v1/analysis/image` requires no authentication.** Pre-existing, not introduced here — but it is an unauthenticated, CPU-heavy endpoint that will sit on a public ALB. Worth an explicit decision | Phase 7 |
| 16 | — | Backend image is 968 MB. Reducible, but every option carries risk | Optional, post-Phase 6 |
| 17 | — | Both images are `:local`. Tagging, registry naming and multi-arch are Phase 3 | Phase 3 |

---

## 15. Manual Reproduction Commands

All commands run from the project root:

```bash
cd "D:/Project/by FR-CNN from scratch/Driver Drowsiness Detection V2"
```

**1 — Backend test suite** (expect `330 passed`)

```bash
Backend/.venv/Scripts/python.exe -m pytest -q
```

**2 — Prove torch is gone from the import graph, and that `.pth` still works** (run from `Backend/`)

```bash
Backend/.venv/Scripts/python.exe -c "import sys, app.main; print('torch eager:', 'torch' in sys.modules); from app.domain.models.custom_frcnn import FasterRCNN; print('lazy ok:', FasterRCNN.__name__, '| torch now:', 'torch' in sys.modules)"
```

**3 — Frontend production build**

```bash
cd Frontend && NITRO_PRESET=node-server npm run build && node -e "console.log(require('./.output/nitro.json').preset)"
```

**4 — Build both images**

```bash
docker compose build
```

**5 — Start the stack** (on this machine, include the CA override)

```bash
docker compose -f docker-compose.yml -f docker-compose.local-ca.yml up -d
```

> Once Avast HTTPS scanning is off, plain `docker compose up -d` is enough.

**6 — Container status**

```bash
docker compose ps
```

**7 — ONNX loading**

```bash
docker compose logs backend | grep -iE "model loaded|warmup|error"
```

**8 — Health, readiness, docs**

```bash
curl -s http://localhost:8000/health; echo; curl -s http://localhost:8000/ready; echo; curl -s -o /dev/null -w "docs HTTP %{http_code}\n" http://localhost:8000/docs
```

**9 — Frontend reachable**

```bash
curl -s -o /dev/null -w "frontend HTTP %{http_code}\n" http://localhost:3000/
```

**10a — CORS, allowed origin** (expect the header to be present)

```bash
curl -s -i http://localhost:8000/api/v1/health -H "Origin: http://localhost:3000" | grep -i access-control-allow-origin
```

**10b — CORS, refused origin** (must print `0`)

```bash
curl -s -i http://localhost:8000/api/v1/health -H "Origin: http://evil.example" | grep -ci access-control-allow-origin
```

**11 — Real ONNX inference**

```bash
curl -s -X POST http://localhost:8000/api/v1/analysis/image -H "Origin: http://localhost:3000" -F "file=@ML/results/examples_tuned/test_01_closed_eye_1943-jpg_face_1_jpg.rf.9ac99f581ec497a09791541ac3745716.jpg"
```

> Expect `"driver_state":"SLEEPING"`, `"alert_level":"EMERGENCY"`, `closed_eye` ≈ 0.815.

**12 — Confirm no torch and no `.env` in the image**

```bash
docker run --rm --entrypoint sh driver-drowsiness-backend:local -c "python -c \"import importlib.util as u; print('torch:', u.find_spec('torch') is not None)\"; find / -name '.env' -not -path '/proc/*' | head; id"
```

**13 — Frontend → backend from the browser**

Open <http://localhost:3000>, then in the DevTools console:

```javascript
fetch("http://localhost:8000/api/v1/health").then(r => r.json()).then(console.log)
```

**14 — Tear down**

```bash
docker compose down
```

**15 — Make the Phase 1 deletions permanent** (only when satisfied)

```bash
rm -rf Backend/_to_delete Frontend/_to_delete
```

---

## 16. Final Recommendation

### ✅ Phase 1 is safe to approve. The project is ready for Phase 2.

Every deliverable was produced and every acceptance criterion was verified by execution: both images
build, the stack runs healthy, the ONNX model loads onto `CPUExecutionProvider` with a clean warmup,
and a real image returns a correct detection through the containerised API. The backend test suite is
green at **330 passed**. Both containers run as non-root, no real secret exists in either image, and
`.env`, `.git`, `.venv` and project `node_modules` are all confirmed absent.

The application changes were minimal and surgical, exactly as the audit projected: one lazy import,
one dependency split, one gitignore line. No business logic was touched, and `.pth` support is intact.

Two judgement calls are worth your explicit sign-off:

1. **The four deletions are staged in `_to_delete/`, not unlinked.** This project has no version
   control, so an unlink is unrecoverable. They are gone from their original locations and cannot
   reach an image. One command finalises them.
2. **Two Avast workarounds exist** and are clearly marked. They keep both images clean, but they are
   machine-specific and must not reach GitHub.

### Recommended before starting Phase 2

1. **Decide on Avast HTTPS scanning.** Disabling it lets me delete `.docker-ca/`,
   `docker-compose.local-ca.yml` and the two `secrets:` blocks, so nothing machine-specific is
   committed. This is the single cleanest thing to do before `git init`.
2. **Treat the root `.gitignore` as blocking.** Before the first `git add`, it must cover `/.env`,
   `/.docker-ca/`, `*/_to_delete/`, `Backend/.env`, `Frontend/.env`, `.venv/`, `node_modules/`,
   `.output/`, and the three files above GitHub's 100 MB limit.
3. **Settle the `best.onnx` question early** (audit **D12**) — `Backend/.gitignore` currently ignores
   it, and CI cannot build the backend image without it.

### One thing worth pulling forward

**Fix `/ready` (D15) sooner than Phase 12.** It currently returns `ready: true` with
`ai_model: not_configured` regardless of whether the model actually loaded. The moment Kubernetes
readiness probes are wired up, a pod with a failed model will be sent live traffic and every
inference will 503. It is a small change and the risk it removes is real.


---
---

# Phase 1.5 Cleanup — Final

**Date:** 2026-08-24
**Scope:** Readiness correctness, removal of the Avast/proxy-CA workaround, Phase 1 leftover
cleanup, and a root `.gitignore`. **No Phase 2 work.** Git was not initialised; no `git init`,
`git add`, `git commit`, `git push` and no GitHub repository. No AWS, Terraform, Kubernetes or
GitHub Actions files were created.

---

## 1. Phase 1.5 Status

### ✅ **PASS**

Every item was implemented and verified by execution. The readiness endpoint now reflects the real
`ModelManager` and returns 503 when the model cannot serve traffic — confirmed both by unit tests
and against a **live container** deliberately started with a broken `MODEL_PATH`. The proxy-CA
workaround is gone and both images build from scratch with **normal TLS verification enabled**.

Two things found and fixed that were not on the original list, and one pre-existing issue that was
found but deliberately **not** fixed — all recorded in §13 and §14.

---

## 2. Files Created

| File | Purpose |
|---|---|
| `.gitignore` (root) | Repository-root ignore rules, written before `git init` because the tree contains real credentials, a 3.5 GB virtualenv and three files over GitHub's 100 MB hard limit. Verified by simulation — see §9. |

No other files were created. Phase 1.5 was predominantly deletion and correction.

---

## 3. Files Modified

### `Backend/app/api/v1/health.py` — the substantive change

| Before | After |
|---|---|
| `_model_status(settings)` checked only `settings.model_path.exists()` | `_model_status(manager)` reads the live `ModelManager.status` |
| `/ready` always returned HTTP 200 | `/ready` returns 200 only when the model is loaded, 503 otherwise |
| `_is_ready` treated `NOT_CONFIGURED` as ready for *every* dependency | Supabase may be `NOT_CONFIGURED`; the model must be positively `ONLINE` |
| `/system/health` hardcoded `ai=ModelStatus.NOT_LOADED` | `ai` is the manager's real status |

Specifics:

* Added a `_MODEL_DEPENDENCY_STATE` mapping from `ModelStatus` to `(ServiceStatus, detail)`, held as
  data rather than an `if`-chain so an added enum member falls through to "unavailable" instead of
  being silently treated as ready.
* `LOADING` maps to `DEGRADED` rather than `OFFLINE`, so an operator can distinguish "starting up"
  from "broken" — but it still does **not** satisfy readiness.
* A not-ready result sets the status code through an injected `Response`, so `response_model` and
  the standard envelope are both preserved and the body still carries the full `ReadinessData`.
* `503` is documented in the OpenAPI `responses` for the route.

### `Backend/app/dependencies/model.py`

Added `get_optional_model_manager` and `OptionalModelManagerDep` — the non-raising counterpart to
the existing `get_model_manager`.

**Why a second provider rather than reusing the first:** `get_model_manager` raises
`ModelNotLoadedError` when the manager is absent. That is correct for inference handlers, but for a
health endpoint it would be caught by the exception middleware and returned as a generic error
envelope with no `data.ready` and no dependency list. Reporting "the model is unavailable" *is* the
readiness endpoint's job, so it needs a provider that returns `None` instead of raising.

The provider reads `app.state` and nothing else: no I/O, no backend construction, no load, no
inference.

### `Backend/tests/api/test_health.py`

Rewritten for the new behaviour — see §5.

### `docker-compose.yml`

Removed `build.secrets` from both services and the entire top-level `secrets:` block with its
explanatory comment. No other change; `env_file`, the literal-value `environment:` overrides,
health checks, `depends_on` and the network are untouched.

### `Backend/Dockerfile`

The `RUN --mount=type=secret,id=proxy_ca …` block reverted to a plain
`RUN pip install --upgrade pip setuptools wheel && pip install -r requirements.txt`.
`PIP_CERT` and the CA-append logic are gone. **pip certificate verification is fully enabled.**

### `Frontend/Dockerfile`

The equivalent block reverted to a plain `RUN npm ci`. `NODE_EXTRA_CA_CERTS` is gone.
**npm certificate verification is fully enabled.**

---

## 4. Files Deleted

Each was inspected before removal.

| Item | Size | Verification before deleting |
|---|---|---|
| `.docker-ca/` | 243 KB | Listed contents: exactly two files, `proxy-ca.crt` and `combined-ca.pem`. A search for any non-`.crt`/`.pem` file returned nothing — no application code. Contents were never printed. |
| `docker-compose.local-ca.yml` | 3 KB | Non-comment lines inspected in full: two `volumes:` mounts and three TLS environment variables. Nothing else. |
| `Backend/_to_delete/` | 53 MB | Held `gateway/`, `docker-compose.yml`, `Dockerfile.ml` — all confirmed obsolete in Phase 1, with replacements verified present (`docker-compose.yml`, `Backend/Dockerfile`). |
| `Frontend/_to_delete/` | 177 KB | Held `bun.lock`; replacement `package-lock.json` confirmed present. |
| `Frontend/bunfig.toml` | <1 KB | Pure Bun `[install]` configuration. Confirmed unreferenced by `package.json`, `vite.config.js` and `src/`. |

**Deleted only after** the from-scratch Docker build proved TLS works without the workaround — so a
failure would still have been recoverable.

> **One thing was lost with `bunfig.toml`, and it is worth knowing.** It carried a real
> supply-chain control: `minimumReleaseAge = 86400`, refusing packages published less than 24 hours
> ago, with an explicit allowlist of `@lovable.dev/*` exceptions. That control was already inert —
> it is Bun-only and the project uses npm — so deleting the file changed nothing in practice. But
> npm has no built-in equivalent, so the *intent* is now unprotected. Recorded in §14 for Phase 3
> CI.

---

## 5. `/ready` — Exact Behaviour

### HTTP status

| Condition | `/ready` | `data.ready` | `ai_model` dependency | `detail` |
|---|---|---|---|---|
| Manager present, `LOADED` | **200** | `true` | `online` | `null` |
| Manager present, `LOADING` | **503** | `false` | `degraded` | `AI model is still loading.` |
| Manager present, `NOT_LOADED` | **503** | `false` | `offline` | `AI model has not been loaded.` |
| Manager present, `FAILED` | **503** | `false` | `offline` | `AI model failed to load.` |
| Manager missing from `app.state` | **503** | `false` | `offline` | `AI model is unavailable.` |
| Supabase not configured | does not block | — | — | database/storage report `not_configured` |

`/health` returns **200 in every one of those rows.** That separation is the point: restarting a
container cannot fix a bad checkpoint, so liveness must not invite a restart loop.

### ModelManager integration

* Reached through `Depends(get_optional_model_manager)`, which reads
  `app.state.model_manager` and returns `None` if absent.
* Uses `ModelManager.status` — the same value `ModelManager.predict()` checks — so readiness cannot
  disagree with what an inference request would actually do.
* **Does not** construct a backend, call `load()`, call `switch_checkpoint()`, or run inference.
  Enforced by a test whose stub raises on `load` or `predict`.
* The model still loads exactly once, in the FastAPI lifespan hook. Unchanged.

### Supabase readiness — deliberately unchanged

Still a configuration check, not a remote call. A readiness probe firing every few seconds must not
make a network round-trip: it would add latency to a hot path and let one Supabase hiccup pull every
replica out of the load balancer simultaneously. Per the brief, the Phase 1.5 requirement was
accurate *ModelManager* readiness, and that is what changed.

### Information disclosure

`detail` strings are fixed literals. They never contain the checkpoint path, a credential, a stack
trace, or an exception message. Verified by a test asserting that `secret-models`, `best.onnx` and
`/srv` are absent from the body across three manager states — and confirmed against the live
container, whose 503 body and error log both name no path.

### `/system/health`

`ai` now returns the manager's real status (`loaded` / `loading` / `not_loaded` / `failed`), and
`not_loaded` when no manager exists. Previously hardcoded to `not_loaded`.

---

## 6. Tests Added / Updated

`Backend/tests/api/test_health.py`. **330 → 349 tests (+19).**

A `_StubModelManager` replaces the real manager via `app.dependency_overrides`, following the same
pattern already used by `test_uploads.py` and `test_video_analysis.py`. Clients are built with
`make_client()` **without** entering the context manager, so the lifespan hook never runs and the
real 68 MB ONNX checkpoint is never touched.

| # | Requirement | Test | Result |
|---|---|---|---|
| 1 | `/health` 200 while model failed/not loaded | `test_stays_healthy_while_the_model_is_not_ready` (×3 states), `test_stays_healthy_with_no_manager_at_all` | ✅ |
| 2 | `/ready` 200 when loaded | `test_ready_when_model_is_loaded` | ✅ |
| 3 | `/ready` 503 when `FAILED` | `test_unloaded_model_is_not_ready[FAILED]` | ✅ |
| 4 | `/ready` 503 when `NOT_LOADED` | `test_unloaded_model_is_not_ready[NOT_LOADED]` | ✅ |
| 5 | `/ready` 503 when `LOADING` | `test_unloaded_model_is_not_ready[LOADING]` | ✅ |
| 6 | `/ready` 503 when manager missing | `test_missing_manager_is_not_ready` — no override, so the real `getattr` lookup is exercised | ✅ |
| 7 | `/ready` never exposes the model path | `test_detail_never_leaks_the_model_path` (×3 states) | ✅ |
| 8 | `/ready` never reloads or infers | `test_never_loads_or_infers` — stub raises on either call; asserts both counters are 0 | ✅ |
| 9 | Root and versioned `/ready` agree | `test_alias_serves_the_same_payload`, `test_both_ready_routes_agree_when_not_ready` (×2 states) | ✅ |
| 10 | `/system/health` reports the real state | `test_ai_reflects_the_real_manager_state` (×4 states), `test_missing_manager_reports_not_loaded` | ✅ |
| — | Envelope preserved on a 503 | `test_body_keeps_the_envelope_on_503` | ✅ |
| — | Unconfigured Supabase does not block | `test_unconfigured_supabase_does_not_block_readiness` | ✅ |

### Existing tests: what changed and why

No test was weakened or deleted to make the suite pass. Three encoded the **old, incorrect**
behaviour and were updated to assert the new contract:

| Test | Change |
|---|---|
| `test_ready_when_dependencies_are_merely_unconfigured` | Asserted `ai_model: not_configured` with `ready: true`. Became `test_unconfigured_supabase_does_not_block_readiness`, keeping its real intent (absent Supabase must not block) while asserting `ai_model: online`. |
| `test_not_ready_when_a_dependency_is_broken` | Superseded by `test_missing_manager_is_not_ready` and the parametrised `test_unloaded_model_is_not_ready`, which additionally assert the 503 status the old test could not. |
| `test_reports_honest_state` | Asserted `ai == "not_loaded"` unconditionally. Split into `test_ai_reflects_the_real_manager_state` (×4 states) and `test_reports_honest_state_for_other_subsystems`. |

Coverage went **up**, not down: the old suite could not distinguish 200-with-`ready:false` from a
correct 503, because the endpoint could not produce a 503 at all.

---

## 7. Validation Results

### Backend

| Check | Result | Detail |
|---|---|---|
| `ruff check` (changed files) | ✅ **PASS** | `All checks passed!` on all four Phase 1.5 files |
| `ruff check app tests` (whole tree) | ⚠️ **1 pre-existing error** | `ARG001` in `app/api/v1/admin.py:200`. **Not introduced here** — that file's mtime is 2026-08-23, before this session, and it was never opened. Left unfixed as out of scope; see §14. |
| `black --check app tests` | ✅ **PASS** | 108 files unchanged (`health.py` was reformatted by `black` itself, then re-verified) |
| `isort --check-only app tests` | ✅ **PASS** | clean |
| Targeted health/readiness tests | ✅ **PASS** | `50 passed in 33.92s` |
| Complete backend suite | ✅ **PASS** | **349 passed**, 0 failed, 107.88s. Warnings are pre-existing `supabase` deprecations. |

### Frontend

| Check | Result | Detail |
|---|---|---|
| `npm ci` | ✅ **PASS** | after clearing a stale file lock — see §13.2 |
| Production build | ✅ **PASS** | `preset: node-server`, `.output/server/index.mjs` emitted |
| `npm audit` | ⚠️ **3 production vulnerabilities** | 1 moderate, 2 high (`nanoid`, `postcss`); 4 including dev. Not fixed — see §14. |

### Docker

| Check | Result | Detail |
|---|---|---|
| `docker compose config` | ✅ **PASS** | valid |
| `docker build --check` (both) | ✅ **PASS** | `Check complete, no warnings found` |
| **Build from scratch** (`--no-cache`) | ✅ **PASS** | both images, **with TLS verification enabled and no CA injected** |
| `docker compose up -d` | ✅ **PASS** | backend gated the frontend via `service_healthy` |
| `docker compose ps` | ✅ **PASS** | both `healthy` |

```
NAME          STATUS                   PORTS
dd-backend    Up 5 minutes (healthy)   0.0.0.0:8000->8000/tcp, [::]:8000->8000/tcp
dd-frontend   Up 5 minutes (healthy)   0.0.0.0:3000->3000/tcp, [::]:3000->3000/tcp
```

**Image sizes (unchanged from Phase 1):**

| Image | On disk | Content (≈ registry transfer) |
|---|---|---|
| `driver-drowsiness-backend:local` | 968 MB | 261 MB |
| `driver-drowsiness-frontend:local` | 337 MB | 77 MB |

### ONNX loading

✅ **PASS.** Backend startup log, verbatim:

```
app.main                        | Starting Driver Drowsiness Detection API v0.1.0 (environment=production)
app.infra.supabase_client       | Supabase client initialised for project host lejbnpdeudtxvsgsickd.supabase.co
app.domain.models.onnx_backend  | AI model loaded (architecture=faster_rcnn_onnx, provider=CPUExecutionProvider, classes=3).
app.domain.models.manager       | AI model warmup pass complete.
app.main                        | Application startup complete
uvicorn.error                   | Uvicorn running on http://0.0.0.0:8000
```

No errors, no tracebacks, no degraded-mode warning.

### Endpoints

| Endpoint | Result |
|---|---|
| `/health` | ✅ 200 |
| `/ready` | ✅ 200, `ready: true`, `ai_model: online` |
| `/api/v1/health` | ✅ 200 |
| `/api/v1/ready` | ✅ 200 |
| `/docs` | ✅ 200 |
| Frontend `/` | ✅ 200, SSR HTML, correct `<title>`, no console errors |
| Frontend → backend | ✅ browser-context cross-origin `fetch` from `http://localhost:3000` → `/api/v1/health` **200**, `/api/v1/ready` **200** with `ai: online` |

`/system/health` now returns `{"backend":"online","database":"online","storage":"online","ai":"loaded"}`
— `ai` was hardcoded `not_loaded` before Phase 1.5.

### Real inference

✅ **PASS.** `POST /api/v1/analysis/image` with a genuine JPEG from `ML/results/examples_tuned/`:

```
SLEEPING | EMERGENCY | fatigue 75 | closed_eye 0.815 | 257.39 ms
```

Correct for the input — a closed-eye test image.

### Failure scenario — verified against a live container, not only in tests

A real backend container was started with `MODEL_PATH=/app/models/does-not-exist.onnx`:

| Probe | Result |
|---|---|
| `/health` | ✅ **HTTP 200** — liveness unaffected |
| `/ready` | ✅ **HTTP 503**, `ready: false`, `ai_model: offline`, `detail: "AI model failed to load."` |
| `/system/health` | ✅ `ai: "failed"` |
| Log line | `ONNX model file not found at configured path.` — names no path |

The temporary container was removed afterwards. This is the scenario the old implementation got
wrong: it would have reported the service ready.

---

## 8. Security Validation

Verified by **exporting each rebuilt image's filesystem and searching it** for the real values from
`Backend/.env` — not by reading the Dockerfiles.

| Item | Backend image | Frontend image |
|---|---|---|
| `.env` | ✅ ABSENT | ✅ ABSENT |
| `SECRET_KEY` | ✅ absent | ✅ absent |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ absent | ✅ absent |
| `SUPABASE_JWT_SECRET` | ✅ absent | ✅ absent |
| `SMTP_USER` | ✅ absent | ✅ absent |
| **Deleted Avast proxy CA** (`Avast Web/Mail Shield` marker) | ✅ absent | ✅ absent |
| AWS credentials | ✅ none — see note | ✅ none — see note |
| `.git` / `.venv` / project `node_modules` / `__pycache__` | ✅ ABSENT | ✅ ABSENT |
| Runs non-root | ✅ `appuser` uid 1000 | ✅ `node` uid 1000 |

> **On the AWS check.** A first pass searching for the bare substring `AKIA` matched both images. A
> strict `AKIA[0-9A-Z]{16}` search located the single hit precisely: inside
> `/usr/lib/x86_64-linux-gnu/libunistring.so.2.2.0`, a **Debian base-image** library whose Unicode
> character-name tables contain that byte sequence. It is present in both images because both derive
> from `-slim-bookworm`, it is in no project file, and it is not a credential. Reported rather than
> quietly dropped, because "we scanned and found nothing" would have been the less honest summary.

**No TLS bypass was introduced anywhere.** A tree-wide search for `NODE_TLS_REJECT_UNAUTHORIZED`,
`strict-ssl`, `--trusted-host`, `PIP_CERT` and `insecure` found nothing outside the two intentional
`.gitignore` guard entries. pip and npm both verify certificates normally.

---

## 9. Root `.gitignore`

Covers every category requested: env files (with `.env.example` / `.env.docker.example` re-included),
certificates and keys, AWS credentials, Terraform state and `.terraform/`, Kubernetes kubeconfigs and
rendered Secret manifests, Python venvs and caches, `node_modules/`, Node build outputs
(`dist/`, `.output/`, `.nitro/`, `.wrangler/`), test/coverage caches, IDE and OS files, logs and
temporary files, `_to_delete/`, archives, model artifacts (`*.pth`, `*.pt`, `*.ckpt`, `*.onnx`,
`*.pb`, `*.h5`, `*.safetensors`), and the large ML directories.

### The trap that was avoided, and why it is documented in the file

Two directories of real application source are named `models`:

```
Backend/app/domain/models/     the detector backends and ModelManager
ML/models/                     the training network definition
```

A bare `models/` rule matches at **every depth** and would have silently untracked both. The file
therefore excludes model *artifacts* by extension and by anchored path (`/ML/checkpoints/`), never by
directory name, and carries a prominent "READ THIS BEFORE ADDING A PATTERN" warning so the rule is
not reintroduced later.

### Verified by simulation, without initialising Git

Git was **not** initialised. Instead the rules were evaluated with `pathspec`'s `GitIgnoreSpec`
(the same gitignore matcher used by `black`) against 48 representative paths:

```
tracked-checks : 23
ignored-checks : 25

ALL PASS - no source ignored, every sensitive/large path ignored.
```

Confirmed tracked: both `models/` source trees, `Backend/app/api/v1/health.py`,
`Backend/Dockerfile`, `Backend/requirements-torch.txt`, `Backend/test_metrics_tuned.json`,
`ML/train.py`, `Frontend/src/lib/api.js`, `Frontend/package-lock.json`, `docker-compose.yml`,
`.env.docker.example`.

Confirmed ignored: `.env`, `Backend/.env`, `Frontend/.env`, both virtualenvs, `node_modules/`,
`Backend/best.onnx`, `ML/checkpoints/tuned_fixed/best.pth`, `ML/videos/*.avi`, `ML/results/*.mp4`,
`terraform.tfstate`, `.docker-ca/`, `docker-compose.local-ca.yml`, `bun.lock`, `bunfig.toml`,
`_to_delete/`, `*.pem`, `*.key`, `.aws/credentials`.

**`Backend/best.onnx` remains on disk** and Docker builds keep working — it is ignored by Git only,
which is the intended temporary state. The artifact strategy is still an open Phase 2/3 decision
(audit **D12**), and the `.gitignore` says so inline so nobody "fixes" it by deleting the rule.

---

## 10. Errors Encountered

### 10.1 `.gitignore` would have silently untracked application source — caught before it mattered

The obvious way to exclude model weights is a `models/` rule. Inspecting the tree first showed two
source directories with that exact name. Excluding artifacts by extension and anchored path instead,
then verifying with `pathspec`, turned an assumption into a check. Documented in the file itself.

### 10.2 `npm ci` failed with `EPERM` — diagnosed, not worked around

```
npm error code EPERM
npm error syscall unlink
npm error path ...\Frontend\node_modules\lightningcss-win32-x64-msvc\lightningcss.win32-x64-msvc.node
```

A native `.node` binary was locked by a running process. The cause was **PID 27784**, a stale
`vite dev --port 5173` server for this exact project, running since 2026-08-23.

`npm ci` had already begun removing `node_modules`, so the frontend tree was left broken and the
install had to be completed rather than abandoned. The process was stopped — after confirming its
command line pointed at *this* project's `Frontend`, so no unrelated dev server was touched — and
`npm ci` then succeeded.

> **Side effect on your machine:** that Vite dev server on port 5173 is no longer running. Restart it
> with `npm run dev` in `Frontend/` if you were using it. Nothing else was stopped; the other node
> processes (MCP servers, and dev servers belonging to the older `driver_drowsiness_detection` copy)
> were left alone.

This was a host-only problem. `npm ci` inside the Docker build was unaffected and has always
succeeded.

### 10.3 A shell escaping bug corrupted a Dockerfile line — caught by re-reading

Rewriting the `RUN` block via a shell heredoc turned an intended line continuation into a literal
`\n`, producing:

```
RUN pip install --upgrade pip setuptools wheel \n && pip install -r requirements.txt
```

Found by reading the file back rather than trusting the edit. Fixed, then confirmed by an exact-match
search for literal `\n` across all generated files (clean) and `docker build --check` on both
Dockerfiles (no warnings). The same escaping had already mangled a line in `Frontend/Dockerfile`
during Phase 1; that line was being deleted anyway.

### 10.4 Pre-existing ruff error surfaced

Running the configured lint across the whole tree surfaced `ARG001` in `app/api/v1/admin.py:200`.
File mtime `2026-08-23`, before this session; never opened here. **Not fixed** — it is unrelated to
Phase 1.5 and the parameter is almost certainly a dependency used for its authorization side effect.
See §14.

### 10.5 No TLS failures after removing the workaround

The scenario the brief asked me to stop and report on **did not occur**. With Avast disabled, a
full `--no-cache` rebuild of both images completed with certificate verification enabled: pip
installed 47 packages from PyPI and `npm ci` completed from the npm registry. No bypass was needed
and none was introduced.

---

## 11. Remaining Issues / Technical Debt

### New, from Phase 1.5

| # | Item | Suggested phase |
|---|---|---|
| 1 | **`ARG001` in `app/api/v1/admin.py:200`** — pre-existing, one line. Left unfixed as out of scope, but it will fail a lint gate the moment CI runs `ruff`. Rename to `_admin` or add a targeted `noqa`. | Phase 3 (before CI), or now on your word |
| 2 | **npm audit: 3 production vulnerabilities** (1 moderate, 2 high — `nanoid`, `postcss`). Not fixed: `npm audit fix` rewrites the lockfile, which is exactly the kind of change that should not ride along in a cleanup phase. | Phase 2/3 |
| 3 | **Supply-chain guard lost with `bunfig.toml`** — `minimumReleaseAge = 86400` was Bun-only and already inert under npm, but the intent is now unenforced. npm has no built-in equivalent. | Phase 3 CI |
| 4 | **Root `.env` is untracked but present.** Now covered by `.gitignore`; verify before the first `git add`. | Phase 2, verify |

### Carried forward from Phase 1 / the audit

| # | Ref | Item | Phase |
|---|---|---|---|
| 5 | **S1** | No git repo yet. `Backend/.env` holds a service-role key, `SECRET_KEY` and an SMTP password — confirm nothing secret is staged before the first commit. The root `.gitignore` now exists and is verified, which removes most of this risk. | **Phase 2** |
| 6 | **D12** | `Backend/best.onnx` (68 MB) is gitignored, so CI will have no model to `COPY`. Decide: un-ignore that one path, Git LFS, S3, or bake-from-release. | Phase 2/3 |
| 7 | — | Files over GitHub's 100 MB hard limit: `best.pth`, `last.pth` (134.88 MB each), `6-MaleGlasses.avi` (101.75 MB). Now gitignored. | Phase 2 |
| 8 | **D14** | `preview_store` is in-process; a preview generated on pod A 404s from pod B. Constrains replica count. | Phase 6/7 |
| 9 | **D7** | `VITE_API_URL` is baked at build time, so the frontend image is environment-specific. | Phase 7 |
| 10 | **D3** | `MODEL_CHECKPOINTS_DIR` points at `/app/models`, which holds only the active model — admin model-switching has nothing to switch to. | Phase 11 |
| 11 | **D13** | `MAX_VIDEO_SIZE_MB=500` plus ffmpeg re-encode drives ALB timeouts and pod sizing. | Phase 6/7 |
| 12 | **S4/S5** | Service-role key must be a k8s Secret, never a ConfigMap. Generate a **fresh** `SECRET_KEY` for production. | Phase 5+ |
| 13 | **S6** | `/docs`, `/redoc`, `/openapi.json` are public in every environment. | Phase 7 |
| 14 | **S7** | `SUPABASE_JWT_SECRET` is set but unused (project migrated to ES256/JWKS). Dead secret in a file. | Phase 2 |
| 15 | — | `POST /api/v1/analysis/image` requires no authentication — an unauthenticated, CPU-heavy endpoint destined for a public ALB. | Phase 7 |
| 16 | — | Backend image is 968 MB. Reducible, but every option carries risk. | Optional |
| 17 | — | Both images are `:local`. Tagging, registry naming and multi-arch are Phase 3. | Phase 3 |

**Resolved by Phase 1.5:** audit **D15** (`/ready` did not consult the `ModelManager`) — the item
flagged in the Phase 1 report as worth pulling forward. It is done.

---

## 12. Manual Reproduction Commands

From the project root:

```bash
cd "D:/Project/by FR-CNN from scratch/Driver Drowsiness Detection V2"
```

**1 — Lint and format**

```bash
Backend/.venv/Scripts/python.exe -m ruff check Backend/app/api/v1/health.py Backend/app/dependencies/model.py Backend/tests/api/test_health.py
```

**2 — Targeted readiness tests** (expect `50 passed`)

```bash
Backend/.venv/Scripts/python.exe -m pytest Backend/tests/api/test_health.py -q
```

**3 — Complete backend suite** (expect `349 passed`)

```bash
Backend/.venv/Scripts/python.exe -m pytest Backend/tests -q
```

**4 — Frontend production build**

```bash
cd Frontend && npm ci && NITRO_PRESET=node-server npm run build && node -e "console.log(require('./.output/nitro.json').preset)"
```

**5 — Build and start** (no CA override; none exists any more)

```bash
docker compose build --no-cache && docker compose up -d && docker compose ps
```

**6 — ONNX loading**

```bash
docker compose logs backend | grep -iE "model loaded|warmup|error"
```

**7 — `/ready` reports the real model state** (expect `ai_model: online`)

```bash
curl -s http://localhost:8000/ready
```

**8 — `/system/health`** (expect `"ai":"loaded"`)

```bash
curl -s http://localhost:8000/api/v1/system/health
```

**9 — The failure scenario: `/ready` 503 while `/health` stays 200**

```bash
docker run -d --name dd-badmodel -p 18000:8000 --env-file Backend/.env -e APP_ENV=production -e HOST=0.0.0.0 -e ALLOWED_ORIGINS=http://localhost:3000 -e MODEL_PATH=/app/models/nope.onnx driver-drowsiness-backend:local
```

```bash
sleep 18; echo "health: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:18000/health)"; echo "ready:  $(curl -s -o /dev/null -w '%{http_code}' http://localhost:18000/ready)"; curl -s http://localhost:18000/ready
```

```bash
docker rm -f dd-badmodel
```

**10 — Real inference**

```bash
curl -s -X POST http://localhost:8000/api/v1/analysis/image -H "Origin: http://localhost:3000" -F "file=@ML/results/examples_tuned/test_01_closed_eye_1943-jpg_face_1_jpg.rf.9ac99f581ec497a09791541ac3745716.jpg"
```

**11 — No `.env`, no torch, non-root**

```bash
docker run --rm --entrypoint sh driver-drowsiness-backend:local -c "python -c \"import importlib.util as u; print('torch:', u.find_spec('torch') is not None)\"; find / -name '.env' -not -path '/proc/*' | head; id"
```

**12 — Tear down**

```bash
docker compose down
```

---

## 13. Final Recommendation

### ✅ Phase 1.5 is PASS. The repository is technically ready to begin Phase 2.

Readiness now tells the truth. `/ready` returns 200 only when the `ModelManager` reports `LOADED`
and 503 in every other state, verified both by 19 new tests and against a live container with a
deliberately broken `MODEL_PATH` — the exact case the old implementation reported as ready. `/health`
stays 200 throughout, so a bad checkpoint cannot trigger a restart loop. `/system/health` reports the
real model state instead of a constant. Nothing leaks the checkpoint path.

The Avast workaround is entirely gone — Dockerfiles, Compose, and both files on disk — and both
images build from scratch with **certificate verification enabled**. No TLS bypass was introduced.
Every Phase 1 leftover is deleted, each inspected first. All 349 backend tests pass, the frontend
production build is green, both containers are healthy, ONNX loads on `CPUExecutionProvider`, and a
real image still returns a correct detection.

The root `.gitignore` is the piece that most directly unblocks Phase 2, and it was verified by
simulation rather than assumed — including the specific trap that would have untracked
`Backend/app/domain/models/` and `ML/models/`.

### Before you run `git init`

1. **Decide the `best.onnx` strategy (audit D12).** `Backend/best.onnx` is currently gitignored, so
   CI cannot build the backend image. This is the one open decision that blocks Phase 3, and it is
   easier to settle before the first commit than after.
2. **Confirm the ignore rules against your real tree.** After `git init`, run
   `git status --short | head -50` and `git count-objects -vH` **before** the first `git add -A`, and
   confirm no `.env`, no `*.pth`, and nothing over 100 MB is staged.
3. **Consider the two-line lint fix** (`ARG001`) so the first CI run is green.

### Not done, by instruction

Git was not initialised. No `git add`, `commit`, `push`, or GitHub repository. No AWS, Terraform,
Kubernetes or GitHub Actions files were created. **Awaiting your approval to begin Phase 2.**
