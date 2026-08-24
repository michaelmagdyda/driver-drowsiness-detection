"""Automated test suite.

Structure mirrors Testing Strategy §30::

    tests/
      unit/         isolated functions and classes      (Phase G onward)
      integration/  across a service or infra boundary  (Phase E onward)
      api/          HTTP endpoints via TestClient
      websocket/    live stream                         (Phase H)
      fixtures/     sample images, videos, predictions   (Phase G)

Phase D populates ``api/`` only, because health checks are the only endpoints
that exist. Each later phase adds its own directory rather than reorganising
this one.
"""
