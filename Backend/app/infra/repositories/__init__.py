"""Repositories - data access over the Supabase client.

A repository turns rows into domain values and back. It runs queries and maps
results; it holds no business rules (03_Backend_Architecture.md §18). Each module
owns one table or one closely-related group.

Repositories receive the ``AsyncClient`` by constructor injection, so they can be
unit-tested against a fake client with no network. They translate provider
errors into the application's own :class:`~app.core.exceptions.DatabaseError`, so
nothing above this layer ever imports the Supabase SDK's exception types.
"""
