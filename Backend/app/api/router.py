"""Version 1 router assembly.

Single place where v1 route modules are mounted. The application factory
includes this one object, so adding a resource in a later phase means adding a
line here and never editing ``main.py`` - the Open/Closed principle applied to
the transport layer (Coding Standards §4).

No URL prefix is applied here. ``main.py`` mounts this router at
``settings.api_v1_prefix``, which keeps the prefix configurable and keeps this
module free of any dependency on configuration.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import admin, analysis, analytics, health, sessions, uploads

api_router = APIRouter()
"""Aggregate router for every version 1 endpoint."""

# ---------------------------------------------------------------------------
# Phase D - Backend Foundation
# ---------------------------------------------------------------------------
api_router.include_router(health.router)

# ---------------------------------------------------------------------------
# Phase G - AI Integration (image analysis)
# ---------------------------------------------------------------------------
api_router.include_router(analysis.router)

# ---------------------------------------------------------------------------
# Phase F - sessions, history (real detection_sessions/detection_events data)
# ---------------------------------------------------------------------------
api_router.include_router(sessions.router)

# ---------------------------------------------------------------------------
# Phase F - uploads (analyse-and-store a video/image as a session)
# ---------------------------------------------------------------------------
api_router.include_router(uploads.router)

# ---------------------------------------------------------------------------
# Phase K - analytics (real AI evaluation metrics + session trend aggregation)
# ---------------------------------------------------------------------------
api_router.include_router(analytics.router)

# ---------------------------------------------------------------------------
# Phase E+ - admin (real user/role listing)
# ---------------------------------------------------------------------------
api_router.include_router(admin.router)

# ---------------------------------------------------------------------------
# Reserved for later phases. Each is a single include_router call once its
# route module exists; nothing else in the application changes.
#
#   Phase E  auth (login/session endpoints) - dependency layer already wired
#   Phase F  settings (notification_settings, model_settings)
#   Phase H  analysis (video), live WebSocket
#   Phase J  notifications, alerts (table is real but currently unwritten)
#   Phase K  reports, explainability, exports
#   Phase E+ models, storage, system logs, audit logs
# ---------------------------------------------------------------------------
