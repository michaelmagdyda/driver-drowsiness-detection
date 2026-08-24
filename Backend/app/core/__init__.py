"""Core layer - cross-cutting concerns available to every other layer.

Contains application configuration, shared constants and enumerations, the
exception hierarchy, and logging setup (03_Backend_Architecture.md §7).

This package must not import from `api`, `services`, `domain` or `infra`. It
sits at the bottom of the dependency graph, which is what makes it safe for
every layer above to depend on it without creating a cycle.
"""
