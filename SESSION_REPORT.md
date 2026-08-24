# Session Report — ONNX Export & Backend Integration

**Date:** 2026-08-07
**Scope:** `ML/export_onnx.py` fix → full ONNX export → wire ONNX Runtime into the FastAPI backend as a first-class inference backend alongside the existing PyTorch one.

---

## 1. What was asked

1. Fix a stale checkpoint path in `ML/export_onnx.py` (`checkpoints/tuned/best.pth` → `checkpoints/tuned_fixed/best.pth`).
2. Get the ONNX export actually running (hit missing-dependency and cwd errors along the way).
3. Make the **website's backend** actually run inference on the exported `.onnx` file, not just export it.

## 2. What was done

### 2.1 Fixed & ran the ONNX export
- [ML/export_onnx.py:337](ML/export_onnx.py#L337) — default `--checkpoint` now points at `checkpoints/tuned_fixed/best.pth` (was `tuned/best.pth`, a path that doesn't exist).
- Installed `onnx` and `onnxruntime` into `Backend/.venv` (the venv the ML scripts were run with).
- Ran `python export_onnx.py` from inside `ML/` (must run from `ML/` — `config.CKPT_DIR` is a relative path, `"checkpoints"`).
- **Output:** `ML/checkpoints/tuned_fixed/best.onnx` (68.2 MB, opset 16).
- Verified: `onnx.checker: OK`, and a random-tensor forward pass agreed between the PyTorch model and the ONNX graph (`VERIFICATION PASSED`).
- Graph contract (from `export_onnx.py`'s own docstring/wrapper):
  - Input `images`: float32 `[1,3,640,640]`, RGB, `/255`, normalized with mean/std `(0.5,0.5,0.5)`.
  - Outputs `boxes [D,4]` (xyxy, 640×640 model space), `labels [D]` int64 (`0=background,1=closed_eye,2=open_eye,3=yawn`), `scores [D]` float32.
  - The graph **bakes in its own score threshold** (0.5, from `ML/config.py::SCORE_THRESH`) and NMS — this cannot be changed without re-exporting.

### 2.2 Backend architecture survey (before changing anything)
Confirmed the backend (`Backend/app/`) had **zero ONNX support** — `FasterRCNNBackend` ([faster_rcnn.py](Backend/app/domain/models/faster_rcnn.py)) only loads `.pth` via PyTorch (`torch.load`), and `ModelAdminService` ([model_admin_service.py](Backend/app/services/model_admin_service.py)) only scanned for `*.pth`. Confirmed with the user this was a real feature request (add ONNX Runtime inference), not just a config change — user chose **"Switch backend inference to ONNX Runtime."**

### 2.3 New ONNX backend
- **New file:** [Backend/app/domain/models/onnx_backend.py](Backend/app/domain/models/onnx_backend.py) — `OnnxFasterRCNNBackend`, implementing the same `BaseModelBackend` interface (`checkpoint_path`, `load()`, `predict()`, `metadata()`, `warmup_shape()`) as `FasterRCNNBackend`.
  - Uses `onnxruntime.InferenceSession`; picks CUDA provider when available and requested, else CPU (`_resolve_providers`).
  - Same preprocessing as the PyTorch backend: resize to `MODEL_INPUT_SIZE` (640), `/255`, normalize with `NORM_MEAN`/`NORM_STD` (0.5/0.5), CHW, batch dim.
  - `_score_threshold` is applied as an **additional post-filter** on top of the graph's own baked-in threshold (documented in the module docstring — raising it works normally, lowering it below the export-time threshold cannot recover already-dropped detections).
  - `architecture = "faster_rcnn_onnx"` (vs `"faster_rcnn"` for the PyTorch one) — visible in admin metadata.

### 2.4 Wiring — dispatch by file extension
- [Backend/app/domain/models/factory.py](Backend/app/domain/models/factory.py) — new `build_backend(settings, path, score_threshold=None)`: `.onnx` extension → `OnnxFasterRCNNBackend`, anything else → `FasterRCNNBackend`. Old `build_faster_rcnn_backend` kept for callers/tests that specifically want PyTorch.
- [Backend/app/domain/models/__init__.py](Backend/app/domain/models/__init__.py) — exports `build_backend` and `OnnxFasterRCNNBackend`.
- [Backend/app/main.py](Backend/app/main.py) — `_build_model_manager` now uses `build_backend` instead of `build_faster_rcnn_backend`.
- [Backend/app/api/v1/admin.py](Backend/app/api/v1/admin.py) — `_model_admin_service`'s factory + `threshold_backend_factory` now use `build_backend`.
- [Backend/app/services/model_admin_service.py](Backend/app/services/model_admin_service.py) — `list_checkpoints()` now scans **both** `*.pth` and `*.onnx` under `model_checkpoints_dir`, merged and sorted by id.
- [Backend/app/schemas/admin.py](Backend/app/schemas/admin.py) — docstring updated to mention `.onnx`.

### 2.5 Config / environment
- [Backend/requirements.txt](Backend/requirements.txt) — added `onnxruntime>=1.18,<2.0`.
- [Backend/.env](Backend/.env) — `MODEL_PATH` now `../ML/checkpoints/tuned_fixed/best.onnx` (was `.pth`).
- [Backend/app/core/config.py:163](Backend/app/core/config.py#L163) — fixed the **code-level default** `model_path` (used when no `.env` is present, e.g. tests): was `../ML/checkpoints/tuned/best.pth` (a path that has never existed — real dir is `tuned_fixed`), now `../ML/checkpoints/tuned_fixed/best.onnx`. This was a **pre-existing bug**, unrelated to the ONNX ask, found while testing; fixed with the user's explicit go-ahead.

### 2.6 Testing done
- Full backend test suite: **330/330 passing** (`pytest tests/`), after the config default fix (one test — `test_ready_when_dependencies_are_merely_unconfigured` — failed before that fix, for the pre-existing reason above, unrelated to the ONNX change itself).
- Manual verification:
  - `build_backend()` correctly dispatches to `OnnxFasterRCNNBackend` for the configured `MODEL_PATH`.
  - `ModelAdminService.list_checkpoints()` lists all three files (`best.onnx` marked `active`+`compatible`, both `.pth` files `compatible` but inactive).
  - Started a real `uvicorn` instance: model loaded via ONNX Runtime (`CPUExecutionProvider`), and a real image POSTed to `/api/v1/analysis/image` returned correct detections (`open_eye` boxes, `AWAKE`/`SAFE`).

## 3. Known pre-existing gaps (not touched, flagged only)

- `/api/v1/system/health`'s `ai` field is **hardcoded** to `ModelStatus.NOT_LOADED` regardless of actual manager state — see [Backend/app/api/v1/health.py:252](Backend/app/api/v1/health.py#L252), comment says "Loading arrives in Phase G" (stale — Phase G is done). Not fixed; out of scope, flagged to the user.
- `/api/v1/ready`'s AI dependency check ([health.py:100-124](Backend/app/api/v1/health.py#L100-L124)) only checks `settings.model_path.exists()` on disk, not whether the manager actually loaded it — same "Phase G" stub comment. Also not fixed.
- These explain why the admin UI / health endpoints may show `not_loaded`/`not_configured` even when the model is actually loaded and serving — it's a reporting gap, not an inference problem.

## 4. ⚠️ Outstanding action — restart required

The **live backend process the admin UI talks to (port 8000)** was already running *before* these code/`.env` changes and is still serving the **old code** — it only lists `.pth` files in the "Active AI Model" dropdown because it hasn't re-imported the new `onnx_backend.py`/`factory.py` or re-read the updated `.env`.

**I could not stop it from this session** — Windows reports its PID (`34176`, with a `multiprocessing`-spawned child) as the `LISTEN` owner on port 8000, but this sandboxed session has no visibility/permission to actually query or kill it (`Get-Process`/`taskkill` both report "not found" despite the port being live and responding to `curl`). This is very likely a permissions/session boundary of the coding-agent sandbox, not a real orphan process.

**To finish on any desktop:** stop that backend process from whatever terminal/IDE originally launched it (Ctrl+C, or kill it from Task Manager if needed), then restart it:

```bash
cd Backend
.venv/Scripts/python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

After restart, the "Active AI Model" dropdown should show `tuned_fixed/best.onnx` alongside the two `.pth` files, marked **Active**, architecture `faster_rcnn_onnx`.

## 5. Files touched (full list)

**New**
- `Backend/app/domain/models/onnx_backend.py`

**Modified**
- `ML/export_onnx.py`
- `Backend/app/domain/models/factory.py`
- `Backend/app/domain/models/__init__.py`
- `Backend/app/main.py`
- `Backend/app/api/v1/admin.py`
- `Backend/app/services/model_admin_service.py`
- `Backend/app/schemas/admin.py`
- `Backend/requirements.txt`
- `Backend/.env`
- `Backend/app/core/config.py`

**Generated (not tracked in git — `.gitignore` excludes `checkpoints/tuned/*` etc., check whether `tuned_fixed/` needs a similar rule for `.onnx`)**
- `ML/checkpoints/tuned_fixed/best.onnx` (68.2 MB)

**Dependencies installed into `Backend/.venv`**
- `onnx`, `onnxruntime` (also pinned in `requirements.txt`)
