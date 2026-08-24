"""API layer - HTTP transport.

Endpoints receive requests, validate input, delegate to a service and return a
schema. They contain no business logic and never reach the database or the AI
model directly (03_Backend_Architecture.md §6, §18, §23).

Versioned under :mod:`app.api.v1`. A future v2 is added alongside it rather
than by editing v1, so existing clients keep working.
"""
