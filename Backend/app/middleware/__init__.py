"""Middleware layer - request-scoped concerns applied to every route.

Covers correlation ids, timing, access logging and the translation of
exceptions into the standard error envelope (03_Backend_Architecture.md §13).

Nothing here knows what an endpoint does. Middleware observes and shapes the
HTTP exchange; business decisions belong in the services layer.
"""
