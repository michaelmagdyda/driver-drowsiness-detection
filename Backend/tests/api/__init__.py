"""HTTP endpoint tests.

Exercise the full ASGI stack - middleware, dependency injection, routing,
serialisation and exception handling - through ``TestClient``, rather than
calling route functions directly. Calling a route function bypasses everything
that surrounds it, which is exactly where the interesting failures live: the D4
``ALLOWED_ORIGINS`` parsing bug was invisible to direct calls and only appeared
when a real application was built.
"""
