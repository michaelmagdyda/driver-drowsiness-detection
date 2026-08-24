# Deployment Guide — Driver Drowsiness Detection

**Target:** GitHub monorepo → Render (FastAPI backend + ML) → Vercel (frontend) → Supabase (already hosted)

---

## 1. What I found in your files (read this first)

Your folder structure does **not** match the architecture docs. Three things are important:

### The FastAPI app *is* your backend — the Node gateway is dead code

`Backend/app/` (FastAPI) implements **everything**: auth, sessions, analytics, admin, image analysis, video analysis, uploads.

```
Backend/app/api/v1/  →  admin.py  analysis.py  analytics.py  health.py  sessions.py  uploads.py
```

`Backend/gateway/` (Node/Express) is a *partial* re-implementation from an abandoned two-service split. Its `/sessions` routes return `501 NOT_IMPLEMENTED`, and it has no analytics or admin routes at all.

**Proof the frontend never uses it** — `Frontend/src/lib/api.js` line 6:

```js
const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
```

Port **8000** is uvicorn (FastAPI). The gateway listens on 3000. Your `Frontend/.env` confirms it:

```
VITE_API_URL=http://127.0.0.1:8000/api/v1
```

> **Decision: deploy ONE Render service — the FastAPI app.** Do not deploy the gateway. It costs a second instance, adds a network hop, and would need sessions/analytics/admin ported into Node before it could serve your frontend at all. `CONTRACT.md`, `ML_SERVICE.md` and `docker-compose.yml` describe the two-service plan that was never finished — ignore them for deployment.

### The `ML/` folder is training code, not runtime code

The backend has its **own copy** of the network at `Backend/app/domain/models/custom_frcnn/` — `faster_rcnn.py` imports from there, never from `ML/models/`. `ML/app.py` is a standalone Streamlit demo.

> **The backend needs exactly one thing out of `ML/`: the `best.pth` weights file.** Nothing else.

### Your frontend is a Lovable TanStack Start project → Vercel is zero-config

`Frontend/package.json` has `@lovable.dev/vite-tanstack-config@2.7.7`. Vercel documents that Lovable projects at `^2.6.2` or higher deploy to Vercel with **no build configuration** — Nitro handles the target detection. You do not need to change `vite.config.js`.

---

## 2. Blockers you must fix before you can deploy

| # | Problem | Why it breaks |
|---|---|---|
| 1 | `best.pth` is **134 MB** | GitHub rejects any file over 100 MB. Hard limit, no override. |
| 2 | `MODEL_PATH` points at a folder that doesn't exist | `.env` says `../ML/checkpoints/tuned/best.pth`. Your actual file is at `ML/checkpoints/**tuned_fixed**/best.pth`. There is no `tuned/` directory. |
| 3 | `requirements.txt` pulls **CUDA** torch | `torch>=2.2,<3.0` from PyPI = ~2.5 GB of NVIDIA libraries. Render's build will run out of disk or time out. Render has no GPU. |
| 4 | RAM | PyTorch CPU + a 134 MB Faster R-CNN needs **~1.5–2 GB** resident. Render Free and Starter are both **512 MB** → the process is killed on model load. |
| 5 | `Frontend/.gitignore` does **not** ignore `.env` | Your Supabase URL and publishable key would be committed. They're public-safe keys, but it's still the wrong habit and it hardcodes `localhost:8000` into the repo. |
| 6 | 800 MB of junk in the tree | `ML/checkpoints/checkpoints.rar` (626 MB), `ML/videos/*.avi` (~121 MB), `ML/results/*.mp4` (~55 MB), `Frontend/_ts_backup.tar.gz`, `Frontend/.output/`, `Backend/.coverage`, both `_to_delete/` folders. |
| 7 | Two lockfiles in `Frontend/` | `bun.lock` **and** `package-lock.json`. Vercel may pick the wrong package manager. |
| 8 | `APP_ENV=production` refuses wildcard CORS | `config.py` line ~366: production requires `ALLOWED_ORIGINS` to be explicit and non-`*`. You must set your Vercel URL there or the app **won't start**. |
| 9 | Circular dependency on URLs | Backend needs the Vercel origin for CORS; frontend needs the Render URL for `VITE_API_URL`. Deploy backend first, then patch. |
| 10 | `SECRET_KEY` in `Backend/.env` | If that file has ever been shared, generate a fresh one for production. |

---

## 3. Repository layout

One GitHub repo, three top-level folders — Render and Vercel each get a **Root Directory** setting, so a monorepo is fine and simpler than three repos.

```
driver-drowsiness/
├── .gitignore          ← create this at the root (below)
├── Backend/            → Render  (Root Directory: Backend)
├── Frontend/           → Vercel  (Root Directory: Frontend)
└── ML/                 → not deployed; training code + docs, kept for the record
```

---

## 4. Which files to upload

### ✅ Commit — `Backend/`

```
Backend/app/**              ← the whole application (this is your real backend)
Backend/db/migrations/**    ← Supabase schema
Backend/tests/**
Backend/requirements.txt
Backend/requirements-dev.txt
Backend/pyproject.toml
Backend/.env.example        ← the template only
Backend/.gitignore
Backend/README.md
Backend/CONTRACT.md         ← historical; harmless
Backend/ML_SERVICE.md       ← historical; harmless
```

### ✅ Commit — `Frontend/`

```
Frontend/src/**             ← all routes, components, lib, integrations
Frontend/public/**
Frontend/supabase/**
Frontend/package.json
Frontend/package-lock.json  ← keep this one
Frontend/vite.config.js
Frontend/tsconfig.json
Frontend/components.json
Frontend/eslint.config.js
Frontend/.prettierrc
Frontend/.prettierignore
Frontend/.gitignore         ← after you add `.env` to it
Frontend/README.md
Frontend/AGENTS.md
```

### ✅ Commit — `ML/` (documentation value only)

```
ML/*.py                     ← train, test, evaluate, dataset, config, inference, app…
ML/models/**  ML/utils/**
ML/architecture/**          ← your architecture docs
ML/requirements.txt
ML/README.md  ML/DEPLOYMENT.md  ML/"Project plan website.md"
ML/results/*.json  *.csv  *.png  *.txt  *.docx   ← metrics + curves, small
```

### ❌ Never commit

| Path | Size | Reason |
|---|---|---|
| `ML/checkpoints/checkpoints.rar` | **626 MB** | Way over limit |
| `ML/checkpoints/tuned_fixed/*.pth` | **134 MB each** | Over the 100 MB limit — hosted separately (§5) |
| `ML/videos/*.avi` | ~121 MB | Test footage |
| `ML/results/*.mp4` | ~55 MB | Rendered output |
| `Frontend/_ts_backup.tar.gz` | 463 KB | Old backup |
| `Frontend/.output/`, `.tanstack/`, `.wrangler/`, `.lovable/` | — | Build artifacts |
| `Frontend/bun.lock`, `bunfig.toml` | — | Pick npm; two lockfiles confuse Vercel |
| `Backend/.env`, `Backend/gateway/.env`, `Frontend/.env` | — | **Secrets.** `Backend/.env` holds your service-role key and SMTP password |
| `Backend/.coverage`, `.pytest_cache/`, `.ruff_cache/`, `__pycache__/` | — | Caches |
| `Backend/_to_delete/`, `Frontend/_to_delete/` | — | Scratch |
| `node_modules/`, `.venv/` | — | Dependencies |

### 🤔 Optional — `Backend/gateway/`

Commit it for the record if you like (it's small, ~150 KB excluding `node_modules`), but **do not deploy it**. If you want a clean repo, delete it.

### Root `.gitignore` — create this file

```gitignore
# ---------- Python ----------
__pycache__/
*.py[cod]
.venv/
venv/
.pytest_cache/
.ruff_cache/
.mypy_cache/
.coverage
htmlcov/

# ---------- Node ----------
node_modules/
dist/
.output/
.nitro/
.tanstack/
.wrangler/
.vercel/
*.log

# ---------- Secrets ----------
.env
.env.*
!.env.example

# ---------- Model weights (hosted externally) ----------
*.pth
*.pt
*.onnx
*.rar

# ---------- Media ----------
*.mp4
*.avi
*.mov
*_backup.tar.gz

# ---------- Scratch ----------
_to_delete/
.lovable/
.DS_Store
Thumbs.db
```

Then add `.env` to `Frontend/.gitignore` (it's currently missing).

---

## 5. Host the model weights

`best.pth` cannot live in Git. Pick one:

**Option A — GitHub Release asset (easiest, 2 GB per-file limit)**

1. Push your repo, then on GitHub: **Releases → Draft a new release** → tag `v1.0`.
2. Drag `ML/checkpoints/tuned_fixed/best.pth` into the assets box → Publish.
3. Copy the download URL: `https://github.com/<you>/<repo>/releases/download/v1.0/best.pth`

**Option B — Hugging Face** (better for ML, free, fast CDN)

```bash
pip install huggingface_hub
huggingface-cli login
huggingface-cli upload <you>/driver-drowsiness best.pth
```
URL: `https://huggingface.co/<you>/driver-drowsiness/resolve/main/best.pth`

**Option C — Supabase Storage** — you already have a project; make a public `models` bucket and upload.

Keep the URL. You'll set it as `MODEL_URL` on Render.

---

## 6. Push to GitHub

```bash
cd "F:\Digilians\Courses Online\Project\Website\Driver Project"

# clean the tree first
rm -rf Backend/_to_delete Frontend/_to_delete Frontend/.output Frontend/.tanstack
rm -f  Frontend/_ts_backup.tar.gz Frontend/bun.lock Frontend/bunfig.toml Backend/.coverage

# create the root .gitignore from §4, then:
git init
git add .
git status                    # ← REVIEW. No .pth, .rar, .avi, .mp4 or .env should appear.
git commit -m "Driver drowsiness detection: FastAPI backend + TanStack frontend"
git branch -M main
git remote add origin https://github.com/<you>/driver-drowsiness.git
git push -u origin main
```

If `git status` shows anything from the ❌ table, fix `.gitignore` before committing — removing a large file after the fact means rewriting history.

---

## 7. Deploy the backend to Render

**New → Web Service → connect your GitHub repo.**

| Setting | Value |
|---|---|
| Name | `driver-drowsiness-api` |
| Language | **Python 3** |
| Root Directory | `Backend` |
| Branch | `main` |
| Instance Type | **Standard — 2 GB / 1 CPU — $25/mo** ⚠️ see note |
| Health Check Path | `/health` |

**Build Command** — installs CPU torch first so the CUDA wheels are never fetched, then downloads the weights:

```bash
pip install --upgrade pip && \
pip install torch==2.5.1 torchvision==0.20.1 --index-url https://download.pytorch.org/whl/cpu && \
pip install -r requirements.txt && \
curl -L "$MODEL_URL" -o ./best.pth
```

> `torch>=2.2,<3.0` in `requirements.txt` is already satisfied by 2.5.1, so the second `pip install` won't re-download it. No file edits needed.

**Start Command:**

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1
```

Keep `--workers 1`. Each worker loads its own copy of the model — two workers doubles your RAM.

**Environment Variables:**

| Key | Value |
|---|---|
| `PYTHON_VERSION` | `3.12.7` |
| `APP_ENV` | `production` |
| `LOG_LEVEL` | `INFO` |
| `API_V1_PREFIX` | `/api/v1` |
| `ALLOWED_ORIGINS` | `https://your-app.vercel.app` ← placeholder for now, fix in §9 |
| `SECRET_KEY` | generate: `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `SUPABASE_URL` | `https://lejbnpdeudtxvsgsickd.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | from Supabase → Settings → API |
| `SUPABASE_JWT_SECRET` | from Supabase → Settings → API |
| `MODEL_URL` | your §5 URL |
| `MODEL_PATH` | `best.pth` ← resolves against `Backend/`, matching the build command |
| `MODEL_DEVICE` | `cpu` |
| `MODEL_SCORE_THRESHOLD` | copy from your local `.env` |
| `MAX_IMAGE_SIZE_MB` | `25` |
| `MAX_VIDEO_SIZE_MB` | `50` |
| `SMTP_*`, `WHATSAPP_API_KEY` | only if you're using notifications |

Do **not** set `HOST` or `PORT` — Render injects `PORT` and the start command uses it.

Deploy. First build takes 5–10 minutes (torch is large). Then check:

```
https://driver-drowsiness-api.onrender.com/health   → {"success": true, ...}
https://driver-drowsiness-api.onrender.com/ready    → model status
https://driver-drowsiness-api.onrender.com/docs     → Swagger
```

`/ready` is the one that matters — it reports whether the checkpoint actually loaded. A failed load does **not** crash startup (by design in `main.py`); inference just returns `503 MODEL_NOT_LOADED`.

### ⚠️ About the instance size

Render's tiers are Free (512 MB), Starter (512 MB, $7), **Standard (2 GB, $25)**, Pro (4 GB, $85).

PyTorch's CPU runtime alone sits around 300–500 MB resident; add the 134 MB checkpoint plus per-request tensors and you're at roughly 1–1.5 GB. **512 MB will be OOM-killed while loading the model.** Free tier also sleeps after 15 minutes idle, and waking it means re-loading the model — a 60–90 second first request.

If $25/mo isn't viable right now: deploy on Free to prove that auth, sessions and analytics work (they will — those endpoints don't touch torch), accept that `/analysis/image` returns 503, and upgrade when you need the demo live. Alternatively put just the inference endpoint on a free Hugging Face Space (16 GB RAM) and have Render call it.

**Video analysis is the heaviest path** — it decodes every frame, runs the detector, and re-encodes to H.264 via ffmpeg on 1 CPU. Expect minutes for a short clip. Keep test videos to a few seconds.

---

## 8. Deploy the frontend to Vercel

**vercel.com/new → import your repo.**

| Setting | Value |
|---|---|
| Framework Preset | auto-detected (leave it) |
| **Root Directory** | `Frontend` ← the only thing you must change |
| Build / Output / Install | leave blank — `@lovable.dev/vite-tanstack-config` handles it |

**Environment Variables** (set for Production, Preview and Development):

| Key | Value |
|---|---|
| `VITE_API_URL` | `https://driver-drowsiness-api.onrender.com/api/v1` ← no trailing slash |
| `VITE_SUPABASE_URL` | `https://lejbnpdeudtxvsgsickd.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `${VITE_SUPABASE_PUBLISHABLE_KEY}` |
| `VITE_SUPABASE_PROJECT_ID` | `lejbnpdeudtxvsgsickd` |
| `SUPABASE_URL` | same as above (the SSR server entry reads the unprefixed names too) |
| `SUPABASE_PUBLISHABLE_KEY` | same |
| `SUPABASE_PROJECT_ID` | same |

Deploy. Note the URL Vercel gives you.

---

## 9. Close the loop (the step everyone forgets)

1. **Render → Environment → `ALLOWED_ORIGINS`** = your real Vercel URL, e.g.
   `https://driver-drowsiness.vercel.app`
   Add preview deploys too if you want them working:
   `https://driver-drowsiness.vercel.app,https://driver-drowsiness-git-main-you.vercel.app`
   Save → Render redeploys. **Without this, every frontend request fails CORS.**

2. **Supabase → Authentication → URL Configuration**
   - Site URL: `https://driver-drowsiness.vercel.app`
   - Redirect URLs: add `https://driver-drowsiness.vercel.app/**`
   Otherwise sign-up confirmation and password-reset links bounce to localhost.

3. **Supabase → migrations** — confirm `Backend/db/migrations/` and `Frontend/supabase/migrations/` are applied to the project. The backend README warns the docs' schema was never deployed; the applied migration is the authoritative one.

---

## 10. Verify

| Check | Expected |
|---|---|
| `GET <render>/health` | `{"success": true}` |
| `GET <render>/ready` | model `LOADED`, Supabase reachable |
| `GET <render>/docs` | Swagger renders |
| Open Vercel URL | Landing page, no console errors |
| Sign up → confirm email | Lands back on your Vercel domain, not localhost |
| Dashboard loads | No CORS errors in DevTools → Network |
| Upload an image on **Image Analysis** | Detections + driver state returned |
| DevTools → Network | Requests go to `onrender.com`, not `127.0.0.1` |

If you see `503 MODEL_NOT_LOADED`, check Render logs during boot — either the download failed (wrong `MODEL_URL`) or the process was OOM-killed (upgrade the instance).

---

## 11. Known issues in the code, unrelated to hosting

Worth knowing before you demo:

- **Inverted label bug.** `ML/utils/driver_state.py` line 13 declares `OPEN_EYE, CLOSED_EYE, YAWN = 1, 2, 3`, but `config.py` and the test metrics both say `1 = closed_eye, 2 = open_eye`. The Streamlit demo (`ML/app.py`) inherits the inversion; the FastAPI backend uses the correct mapping from `app/core/constants.py`. **Your deployed backend is correct** — only the local Streamlit demo is wrong.
- **EAR / MAR / head pose are derived, not measured.** The detector emits boxes, no landmarks. `domain/analysis.py` estimates them from box geometry and flags `derived: true`. Don't present them as true Eye Aspect Ratio in your defense.
- **Sessions/analytics may return mock data** in places — several frontend components still import `mockData.js`. Check `admin`, `alerts`, `explainability` and `profile` pages before demoing them as live.

---

## Summary

| | Deploy? | Where | Root Dir |
|---|---|---|---|
| `Backend/app` (FastAPI) | ✅ Yes | Render Web Service | `Backend` |
| `Backend/gateway` (Node) | ❌ No | — | unused by the frontend |
| `Frontend` (TanStack) | ✅ Yes | Vercel | `Frontend` |
| `ML/` | ❌ No | — | training code; only `best.pth` is needed, hosted externally |
| Database + Auth | already live | Supabase | — |

**Order:** clean repo → push to GitHub → host `best.pth` → Render → Vercel → set `ALLOWED_ORIGINS` + Supabase redirect URLs → test.
