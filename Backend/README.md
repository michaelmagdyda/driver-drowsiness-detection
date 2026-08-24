# Driver Drowsiness Detection — Backend

FastAPI backend for the AI-Based Driver Drowsiness Detection System.

Serves the REST API and (from Phase H) the WebSocket stream that the Lovable
frontend consumes, runs AI inference, and owns all access to Supabase.

**Status: Phase D complete — Backend Foundation.** Health endpoints only. The
AI model, database and authentication arrive in later phases.

---

## Requirements

| | |
|---|---|
| Python | **3.12** (this machine defaults to 3.14 — use `py -3.12`) |
| Supabase | Project credentials, from Phase E onward |
| Model | `checkpoints/tuned/best.pth`, already present at the repository root |

---

## Setup

```bash
cd "Driver Drowsness/Backend"
py -3.12 -m venv .venv
.venv/Scripts/activate
pip install -r requirements.txt -r requirements-dev.txt
```

Create your environment file:

```bash
cp .env.example .env
```

Generate a real `SECRET_KEY` and paste it into `.env`:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

The application refuses to start while `SECRET_KEY` is missing or still holds
the placeholder. That is deliberate: a silent default would eventually reach
production.

---

## Running

```bash
.venv/Scripts/python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

| | |
|---|---|
| API base | <http://127.0.0.1:8000/api/v1> |
| Swagger | <http://127.0.0.1:8000/docs> |
| ReDoc | <http://127.0.0.1:8000/redoc> |

---

## Endpoints (Phase D)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/health` | Liveness. No I/O, never touches a dependency. |
| `GET` | `/api/v1/ready` | Readiness, with per-dependency detail. |
| `GET` | `/api/v1/system/health` | Operator summary (API Specification §19). |

`/health` and `/ready` are also mounted unversioned for container probes. They
are hidden from the OpenAPI schema so the documentation shows no duplicates.

---

## Response format

Every endpoint returns one of two shapes (API Specification §3).

**Success**

```json
{ "success": true, "message": "Service is healthy.", "data": { "status": "ok" } }
```

**Error**

```json
{ "success": false, "message": "…", "error_code": "NOT_FOUND", "errors": [] }
```

Responses carry an `X-Request-ID` header, including 500s. Quote it when
reporting a problem — it is the key that ties a failure to its log entry.

---

## Testing

```bash
.venv/Scripts/python.exe -m pytest
```

With coverage:

```bash
.venv/Scripts/python.exe -m coverage run -m pytest && .venv/Scripts/python.exe -m coverage report
```

Quality gate — all three must pass before a commit:

```bash
.venv/Scripts/python.exe -m ruff check app/ tests/
.venv/Scripts/python.exe -m black --check app/ tests/
.venv/Scripts/python.exe -m isort --check-only app/ tests/
```

Tests are hermetic: they build settings with `_env_file=None` and never read
your `.env`, so a local configuration change cannot make them pass or fail.

### Checking Supabase connectivity (manual)

The automated suite never touches the network. To confirm the service-role
client can actually reach your project, run this against your real `.env`:

```bash
.venv/Scripts/python.exe -c "import asyncio; from app.core.config import get_settings; from app.infra.supabase_client import create_supabase_client, close_supabase_client; \
c = asyncio.run(create_supabase_client(get_settings())); print('connected:', type(c).__name__); asyncio.run(close_supabase_client(c))"
```

A `PGRST205 table not found` from a query means the client reached PostgREST
(connectivity is fine) but the schema migrations have not been applied to that
project.

---

## Architecture

Layered, with dependencies flowing one way only:

```
api  ->  services  ->  domain  ->  infra
```

`core` and `schemas` sit below everything and may be imported anywhere.
Reversing an arrow — infra importing services, domain importing api — creates a
cycle and is forbidden (03_Backend_Architecture.md §23).

```
app/
├── main.py              Application factory, lifespan, middleware wiring
├── core/                Config, constants, exceptions, logging
├── schemas/             Pydantic wire contract
├── api/v1/              HTTP endpoints — no business logic
├── middleware/          Correlation ids, access logging, error envelope
├── dependencies/        FastAPI providers                    (Phase E)
├── services/            Business logic                       (Phase E+)
├── domain/              AI inference and fatigue analysis    (Phase G/H)
├── infra/               Supabase, storage, email, WhatsApp   (Phase F/J)
└── utils/               Stateless helpers                    (Phase G+)
```

Each package's `__init__.py` documents its responsibility, its planned contents
and the rules that apply to it. Read those before adding a file.

---

## Configuration

Every variable is documented in `.env.example`, tagged with the phase that first
reads it. Notable entries:

| Variable | Notes |
|---|---|
| `SECRET_KEY` | Required. Placeholder and short values are rejected at startup. |
| `ALLOWED_ORIGINS` | Comma-separated or a JSON array. Must be explicit and non-wildcard when `APP_ENV=production`. |
| `MODEL_PATH` | Resolved against this folder, not the working directory. Points at the existing checkpoint; the 128 MB weights are not duplicated. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Bypasses Row Level Security.** Backend only — never expose it to the browser. |

---

## Notes for contributors

**Two documented facts differ from reality.** The architecture documents
describe a YOLO `best.pt`; the real model is a from-scratch Faster R-CNN at
`checkpoints/tuned/best.pth` with three classes. And `04 — Database Design.md`
describes a schema that was never deployed — the applied Supabase migration is
authoritative, because the frontend's generated TypeScript types are built from
it.

**There is a known bug in the existing AI code.** `config.py` and
`results/test_metrics_tuned.json` both fix the class mapping as
`1 = closed_eye, 2 = open_eye`. But `utils/driver_state.py` line 13 declares
`OPEN_EYE, CLOSED_EYE, YAWN = 1, 2, 3`, and `app.py` follows it — so its
drowsiness test is inverted. Take label constants from `app/core/constants.py`,
which carries the correct mapping. Whether to fix the original file is a Phase H
decision, since it changes the Streamlit demo's behaviour.

**EAR, MAR and head pose are derived, not measured.** The detector emits
bounding boxes and no facial landmarks, so a true Eye Aspect Ratio cannot be
computed. `domain/metrics.py` will derive proxies from box geometry and must
label them as derived.

---

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| D | Backend foundation | ✅ Complete |
| E | Authentication | Planned |
| F | Database | Planned |
| G | AI integration | Planned |
| H | Fatigue engine | Planned |
| I | Frontend integration | Planned |
| J | Notifications | Planned |
| K | Reports | Planned |
| L | Testing | Planned |
| M | Deployment | Planned |
