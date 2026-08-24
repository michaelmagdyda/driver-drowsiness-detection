# FastAPI ML service

This `Backend/app` FastAPI application is the **standalone ML inference service**
in the two-service architecture (see `CONTRACT.md`). Its single job is to load
the trained Faster R-CNN model once and turn uploaded images into detections and
a driver-state classification. It is stateless — the Node backend owns auth,
sessions and persistence.

## What it exposes

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/health` | Liveness. |
| `GET` | `/api/v1/ready` | Readiness (checkpoint present, dependencies). |
| `GET` | `/api/v1/system/health` | Operator summary. |
| `POST` | `/api/v1/analysis/image` | Run drowsiness detection on one image. |

Swagger at `/docs`.

## ML layer (implemented Phase G)

```
app/
├── domain/
│   ├── analysis.py            detections → driver state / alert level / fatigue
│   └── models/
│       ├── base.py            BaseModelBackend interface + RawDetection
│       ├── faster_rcnn.py     trained-checkpoint adapter  ← the integration point
│       └── manager.py         loads weights once, reports status, serialises predict
├── services/analysis_service.py   validate → decode → threadpool inference → classify
├── schemas/analysis.py        wire payload (fatigue 0–100; EAR/MAR flagged derived)
├── api/v1/analysis.py         POST /analysis/image
└── dependencies/model.py      injects the process-wide ModelManager
```

Model loads once in `main.py`'s lifespan hook. A failed load is recorded
(`ModelStatus.FAILED`) and does **not** crash startup — inference returns a clean
`503 MODEL_NOT_LOADED` until fixed.

Label mapping is taken from `app/core/constants.py`
(`1=closed_eye, 2=open_eye, 3=yawn`) — **not** the inverted convention in the
repo-root `utils/driver_state.py`.

## ⚠ The one integration point

`app/domain/models/faster_rcnn.py::_build_model()` assumes a **torchvision
`fasterrcnn_resnet50_fpn`** architecture for the *state-dict* load path.

- If `checkpoints/tuned/best.pth` is a **whole pickled module** (`torch.save(model)`),
  the loader uses it directly and this is irrelevant.
- If it is a **state dict of a custom from-scratch network**, point `_build_model()`
  at that network's class. This is the only place to change; the rest of the
  backend is architecture-agnostic.

## Auth / Supabase code

The `app/core/security.py`, `app/infra/jwks.py`, `app/services/auth_service.py`
and Supabase modules remain from the original monolith. In the two-service model
those concerns move to the **Node backend**; here they are reference material for
that port and can be removed from the ML service once the backend owns auth.

## Run

```bash
py -3.12 -m venv .venv
.venv/Scripts/activate
pip install -r requirements.txt
.venv/Scripts/python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

> `torch`/`torchvision` default wheels are large (bundled CUDA). For a CPU-only
> host: `pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu`.
