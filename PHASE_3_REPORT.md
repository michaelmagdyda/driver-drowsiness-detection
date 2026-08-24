# Phase 3 — Docker Hub Image Publishing

**Date:** 2026-08-24
**Scope:** Build, validate and publish the Backend and Frontend images to Docker Hub.
**Not started, by instruction:** AWS, IAM, OIDC, Terraform, Kubernetes, EKS, GitHub Actions, CI/CD,
monitoring, domain, HTTPS. No cloud resources were created or changed.

---

## 1. Status

### ✅ **PASS**

Both images were built from the approved source commit, validated locally, pushed to Docker Hub,
then **deleted locally and re-pulled from the registry** so the published artifacts — not the build
cache — were the thing verified end to end. Real inference succeeds through the pulled image.

One failure occurred during local validation and was diagnosed rather than worked around; it was a
shell artifact on this machine, not an image defect. See §18.

---

## 2. Docker Hub Account

| | |
|---|---|
| Username | `michaelmagdyda` |
| Authentication | Pre-existing login via Docker Desktop credential helper (`credsStore: desktop`) |
| Verification method | Credential helper queried for the **registry → username mapping only** |

No access token, password or credential value was requested, read, displayed or logged at any point.

---

## 3. Repository URLs

| Image | URL |
|---|---|
| Backend | https://hub.docker.com/r/michaelmagdyda/driver-drowsiness-backend |
| Frontend | https://hub.docker.com/r/michaelmagdyda/driver-drowsiness-frontend |

Both confirmed to exist and be **PUBLIC** before pushing; both were empty (0 pulls).

---

## 4. Source Git Commit

| | |
|---|---|
| Commit | `ae19e615f3a5f2f6d042df3dde7ca274d0dbda9b` |
| Short | `ae19e61` |
| Branch | `main`, in sync with `origin/main` |
| Working tree | clean at build time |
| Message | *Add ONNX model using Git LFS* |

Verified `HEAD` matched the expected commit exactly before any build ran.

---

## 5. Tags Pushed

Four tags, two images. The `ae19e61` tags are the deployment source of truth; `latest` is a
convenience alias pointing at the identical content.

```
michaelmagdyda/driver-drowsiness-backend:ae19e61
michaelmagdyda/driver-drowsiness-backend:latest
michaelmagdyda/driver-drowsiness-frontend:ae19e61
michaelmagdyda/driver-drowsiness-frontend:latest
```

No release/version tag (`v1.0.0`) was created. No other repository or tag was pushed.

---

## 6. Image IDs

| Image | ID |
|---|---|
| Backend | `sha256:1b7c0416b24f87b71da74b778f79d3157411b7a160da497729395d8fad74212d` |
| Frontend | `sha256:d0bdae7f442eca8b60a98f792530e7c061ef366dbbc17c9eb4b85877ad4fcdf7` |

Verified **before pushing** that each `:ae19e61` and `:latest` pair resolved to the *same local image
ID*, not merely the same tag name — so `latest` cannot silently diverge from the immutable tag.

---

## 7. Image Sizes

| Image | Uncompressed (local) | Compressed (registry / pull) |
|---|---|---|
| Backend | **968 MB** | **261.5 MB** |
| Frontend | **337 MB** | **78.0 MB** |

Backend size is dominated by OpenCV (~162 MB), the bundled static ffmpeg (~77 MB), NumPy (~71 MB),
ONNX Runtime (~66 MB) and the 65 MiB model. With CUDA-bundled PyTorch this image would be ~3 GB; the
ONNX-only design (Phase 1, change R7) is what keeps it under 1 GB.

---

## 8. Architectures

Both images: **`linux/amd64`** only.

Docker Hub additionally lists an `unknown/unknown` entry per tag — that is the BuildKit **attestation
(provenance) manifest**, not a second platform.

> **Worth knowing before Phase 4+:** there is no `linux/arm64` variant. If EKS nodes are Graviton,
> these images will not run there and a multi-arch build (`docker buildx --platform
> linux/amd64,linux/arm64`) will be required. Flagged, not actioned.

---

## 9. Push Digests

| Tag | Digest |
|---|---|
| `backend:ae19e61` | `sha256:1b7c0416b24f87b71da74b778f79d3157411b7a160da497729395d8fad74212d` |
| `backend:latest` | `sha256:1b7c0416b24f87b71da74b778f79d3157411b7a160da497729395d8fad74212d` |
| `frontend:ae19e61` | `sha256:d0bdae7f442eca8b60a98f792530e7c061ef366dbbc17c9eb4b85877ad4fcdf7` |
| `frontend:latest` | `sha256:d0bdae7f442eca8b60a98f792530e7c061ef366dbbc17c9eb4b85877ad4fcdf7` |

✅ **Both Backend tags resolve to one content digest. Both Frontend tags resolve to one content
digest.** Confirmed independently against the Docker Hub API.

---

## 10. Pull Verification

Rather than trusting the local build cache, both images were **removed locally** and pulled fresh:

```
docker pull michaelmagdyda/driver-drowsiness-backend:ae19e61
  Digest: sha256:1b7c0416b24f87b71da74b778f79d3157411b7a160da497729395d8fad74212d
  Status: Downloaded newer image

docker pull michaelmagdyda/driver-drowsiness-frontend:ae19e61
  Digest: sha256:d0bdae7f442eca8b60a98f792530e7c061ef366dbbc17c9eb4b85877ad4fcdf7
  Status: Downloaded newer image
```

✅ Pull digests match push digests exactly. `RepoDigests` on the pulled images confirm the same
values. All runtime verification in §12–16 was performed against these **pulled** images, using the
immutable `ae19e61` tag — not `latest`.

---

## 11. Backend Model SHA-256 Verification

| Location | SHA-256 | Result |
|---|---|---|
| Approved value | `b8e9af676bd63a6fcee6a219ac431e46071a1d64bdf448a0d53bc576cbda4ebf` | reference |
| Working tree (`Backend/best.onnx`, via Git LFS) | same | ✅ match |
| Inside locally built image (`/app/models/best.onnx`) | same | ✅ match |
| **Inside the image pulled back from Docker Hub** | same | ✅ **match** |

Size 68,159,217 bytes at every stage. The model survived Git LFS, the Docker build, the registry
round-trip and the pull byte-for-byte.

---

## 12. ONNX Loading Result

From the **pulled** backend image:

```
app.domain.models.onnx_backend | AI model loaded (architecture=faster_rcnn_onnx,
                                 provider=CPUExecutionProvider, classes=3).
app.domain.models.manager      | AI model warmup pass complete.
```

| | |
|---|---|
| Provider | **`CPUExecutionProvider`** |
| Available providers in image | `AzureExecutionProvider`, `CPUExecutionProvider` |
| onnxruntime | 1.29.0 |
| Warmup | completed (APP_ENV=production) |
| Errors | none |

---

## 13. Health and Readiness

All against the pulled images:

| Endpoint | Result |
|---|---|
| `/health` | ✅ 200 |
| `/ready` | ✅ 200 — `ready: true`, `ai_model: online` |
| `/api/v1/health` | ✅ 200 |
| `/api/v1/ready` | ✅ 200 |
| `/docs` | ✅ 200 |
| Container health | ✅ both `(healthy)` |

The Phase 1.5 readiness work proved itself here: during the §18 failure, `/ready` correctly returned
**503** with `ai_model: offline — "AI model failed to load."` while `/health` stayed **200**. The old
implementation would have reported ready.

---

## 14. Real Inference Result

`POST /api/v1/analysis/image` with a genuine JPEG from `ML/results/examples_tuned/`, through the
image pulled from Docker Hub:

```json
{
  "driver_state": "SLEEPING",
  "alert_level": "EMERGENCY",
  "fatigue_score": 75,
  "detections": [{ "label": "closed_eye", "score": 0.815 }],
  "inference_ms": 282.77
}
```

✅ Correct result for a closed-eye test image. ~283 ms on CPU, one worker.

---

## 15. Frontend Production / Runtime Result

| Check | Result |
|---|---|
| `npm ci` | ✅ succeeded in-build |
| Production build | ✅ succeeded |
| Nitro preset | ✅ **`node-server`** — asserted inside the build, which fails the build on any other preset |
| Server entry | `.output/server/index.mjs` |
| Port | ✅ 3000 (`EXPOSE 3000`, `PORT=3000`, `HOST=0.0.0.0`) |
| Non-root | ✅ `node`, uid 1000 |
| Homepage | ✅ 200, SSR HTML, `<title>DriveAlert — AI Driver Drowsiness Detection</title>` |
| Runtime contents | ✅ `/app` contains **only** `.output` — no toolchain, no app `node_modules` |

---

## 16. Frontend → Backend Communication

Verified in a real browser against the pulled images:

```json
{ "pageOrigin": "http://localhost:3000",
  "backendReady": { "status": 200, "ready": true, "ai": "online" } }
```

Cross-origin `fetch` from `http://localhost:3000` to `http://localhost:8000` returned 200 with
`access-control-allow-origin: http://localhost:3000`. No console errors.

---

## 17. Security Scan Result

Both published images had their **entire filesystems exported and searched** for the real credential
values read from the gitignored `.env` files, plus credential-shaped patterns.

| Item | Backend | Frontend |
|---|---|---|
| `SECRET_KEY` | ✅ absent | ✅ absent |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ absent | ✅ absent |
| `SUPABASE_JWT_SECRET` | ✅ absent | ✅ absent |
| SMTP password / WhatsApp key | ✅ absent | ✅ absent |
| `.env` | ✅ ABSENT | ✅ ABSENT |
| `.git` metadata | ✅ ABSENT | ✅ ABSENT |
| Virtualenv (`.venv`) | ✅ ABSENT | ✅ ABSENT |
| `node_modules` (app) | ✅ ABSENT | ✅ ABSENT — `/app` holds only `.output` |
| Docker credentials (`"auths"`) | ✅ ABSENT | ✅ ABSENT |
| AWS credential files / `.aws` | ✅ ABSENT | ✅ ABSENT |
| pytest / lint caches | ✅ ABSENT | ✅ ABSENT |
| torch / torchvision | ✅ **absent** | n/a |
| Non-root user | ✅ `appuser` uid 1000 | ✅ `node` uid 1000 |

**Secrets are supplied at run time only**, from the gitignored `Backend/.env` via `--env-file`. None
is baked into any layer.

### Pattern hits — located, not assumed

Raw pattern counts were non-zero, so every hit was traced to a specific file rather than waved away:

| Pattern | Count | Where | Verdict |
|---|---|---|---|
| `-----BEGIN … PRIVATE KEY-----` | 18 (backend) | `libgnutls.so` ×10, `libonnxruntime.so` ×3, `onnxruntime_pybind11_state.so` ×3, `cryptography/…/ssh.py` + its `.pyc` ×2 | **PEM format-string constants inside libraries.** No key material. |
| `-----BEGIN … PRIVATE KEY-----` | 13 (frontend) | `libgnutls.so` ×10, npm's own docs/config definitions ×3 | Same — npm documents a `key` config option using a PEM header as the example. |
| `AKIA[0-9A-Z]{16}` | 1 (backend), 7 (frontend) | `libunistring.so` ×1; `/usr/local/bin/node` ×6 | **Byte coincidences in compiled base-image binaries.** Not credentials. |

None is in application code. All originate from the Debian/Node base images or third-party libraries.

### Intentionally public

The Backend image contains **`/app/models/best.onnx`** (65 MiB). This is approved and deliberate: the
repository is public and the model is already distributed via Git LFS.

The Frontend image contains the four browser-safe `VITE_*` values compiled into the bundle
(`VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`).
This is inherent to Vite and by design — these are the publishable/anon values already served to
every visitor. **No** service-role key, `SECRET_KEY`, JWT secret, SMTP password, WhatsApp key, AWS
credential or Docker Hub token was passed as a build argument.

---

## 18. Errors Encountered and Fixes

### 18.1 Model failed to load in the first local runtime test — diagnosed, not worked around

The first run of the newly built backend image produced:

```
ERROR | app.domain.models.onnx_backend | ONNX model file not found at configured path.
ERROR | app.domain.models.manager      | AI model failed to load; inference will return 503.
```

`/ready` returned **503**, `/health` stayed **200**, and inference returned `MODEL_NOT_LOADED`.

**Root cause:** not an image defect. Git Bash (MSYS2) on Windows rewrites POSIX-looking command
arguments into Windows paths. The environment variable arrived inside the container as:

```
MODEL_PATH=C:/Program Files/Git/app/models/best.onnx
```

which Settings resolved to `/app/C:/Program Files/Git/app/models/best.onnx`. The image itself was
correct throughout — `/app/models/best.onnx` was present at 68,159,217 bytes with the right hash.

**Fix:** `MSYS_NO_PATHCONV=1` for the `docker run` invocation. Re-ran; model loaded, `/ready`
returned 200, inference succeeded.

**Worth noting for later phases:** Kubernetes manifests and Linux CI are unaffected — this is
specific to invoking `docker run` from Git Bash on Windows.

### 18.2 A validation command hung and was killed

An over-nested `docker run … sh -c` containing a heredoc inside quoted shell inside another heredoc
hung past its timeout and was terminated (exit 137, from my own `docker rm -f`). Replaced with
several small, flat commands. No image or repository state was affected.

### 18.3 My secret scanner under-counted, and I corrected it

The per-file scan applied a 60 MB size cap, which silently skipped `/usr/local/bin/node` and reported
**1** AWS-pattern hit where the uncapped stream had reported **7**. Rather than accept the
convenient lower number, the scan was re-run with no cap: the true count is 7, of which 6 are inside
the Node binary. Both figures are benign, but the discrepancy was a scanner bug and is recorded
because a security scan that quietly misses large files is worse than one that finds nothing.

---

## 19. Remaining Warnings

| # | Item | Severity |
|---|---|---|
| 1 | **`linux/amd64` only.** No arm64 variant. Graviton EKS nodes would not run these images; multi-arch buildx needed if that is the target. | Medium — decide in Phase 4/5 |
| 2 | **`latest` is mutable by definition.** It currently matches `ae19e61`, but the next push moves it. Kubernetes manifests must pin the immutable tag or the digest. | Medium |
| 3 | **3 production npm advisories remain** (`js-yaml` high, `nanoid` high, `postcss` moderate), all transitive with non-breaking fixes. `npm audit fix` has never been run and the lockfile is untouched. These are compiled into the frontend build toolchain. | Medium |
| 4 | **Backend image is 968 MB uncompressed** (261 MB compressed). Reducible, but every option carries risk. | Low |
| 5 | **The model is publicly downloadable** from both the repository and the image. Explicitly approved. | Accepted |
| 6 | **No image signing or SBOM attestation** (cosign / `--provenance`). BuildKit provenance is attached, but images are not signed. | Low — worth considering before production |
| 7 | `POST /api/v1/analysis/image` remains unauthenticated — a CPU-heavy public endpoint once exposed. | Medium — Phase 7 |

---

## 20. Pull and Run Commands for Users

**Pull (immutable tags — recommended):**

```bash
docker pull michaelmagdyda/driver-drowsiness-backend:ae19e61
```

```bash
docker pull michaelmagdyda/driver-drowsiness-frontend:ae19e61
```

**Run the backend.** Secrets are supplied at run time and are never in the image. Copy
`Backend/.env.example` to `Backend/.env` and fill it in first:

```bash
docker run -d --name dd-backend -p 8000:8000 --env-file Backend/.env -e APP_ENV=production -e HOST=0.0.0.0 -e ALLOWED_ORIGINS=http://localhost:3000 -e MODEL_PATH=/app/models/best.onnx -e MODEL_METRICS_PATH=/app/models/test_metrics_tuned.json -e MODEL_CHECKPOINTS_DIR=/app/models -e MODEL_DEVICE=cpu michaelmagdyda/driver-drowsiness-backend:ae19e61
```

**Run the frontend:**

```bash
docker run -d --name dd-frontend -p 3000:3000 michaelmagdyda/driver-drowsiness-frontend:ae19e61
```

**Verify:**

```bash
curl -s http://localhost:8000/health && curl -s http://localhost:8000/ready
```

Then open <http://localhost:3000>. API docs at <http://localhost:8000/docs>.

> **Windows / Git Bash users:** prefix `docker run` with `MSYS_NO_PATHCONV=1`, or the `/app/...`
> paths above are rewritten into Windows paths and the model will not load. See §18.1.

> The frontend's API URL is compiled in at build time as `http://localhost:8000/api/v1`. To point it
> elsewhere, rebuild with a different `VITE_API_URL` build argument.

---

## 21. Recommended Immutable Tags for Kubernetes Manifests

Use the **digest**, not the tag. A tag can be repointed; a digest cannot.

```yaml
# Backend
image: michaelmagdyda/driver-drowsiness-backend@sha256:1b7c0416b24f87b71da74b778f79d3157411b7a160da497729395d8fad74212d

# Frontend
image: michaelmagdyda/driver-drowsiness-frontend@sha256:d0bdae7f442eca8b60a98f792530e7c061ef366dbbc17c9eb4b85877ad4fcdf7
```

If a readable tag is preferred, use `:ae19e61` — never `:latest` — together with
`imagePullPolicy: IfNotPresent`. Both forms trace back to source commit
`ae19e615f3a5f2f6d042df3dde7ca274d0dbda9b`.

---

## 22. Phase 4 Not Started

Confirmed absent: `.github/`, `terraform/`, `k8s/`, `kubernetes/`, `.terraform/`.

No AWS account, IAM role, OIDC provider, Terraform state, Kubernetes cluster, GitHub Actions
workflow, monitoring stack, domain or TLS certificate was created, configured or modified. No cloud
resource of any kind was touched.

---

*Docker images are tagged with source commit `ae19e61`. The documentation commit that adds this file
does not change the image source revision — the published images remain built from `ae19e61`.*
