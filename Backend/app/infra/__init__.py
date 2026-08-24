"""Infrastructure layer - adapters for external systems.

Placeholder. Populated in Phases F and J (03_Backend_Architecture.md §10, §18).

Purpose
-------
Everything that talks to something outside this process: Supabase PostgreSQL,
Supabase Storage, SMTP, WhatsApp. Each adapter translates between the external
system's vocabulary and ours, and does nothing else. Confining third-party
clients here means swapping a provider touches one file, and the services above
never learn what a ``PostgrestResponse`` is.

Planned contents
----------------
``supabase_client.py``
    Service-role client, constructed once and injected. The service-role key
    **bypasses Row Level Security**, so ownership must be enforced in the
    service layer on every query - RLS is a second line of defence here, not the
    first.
``repositories/``
    One module per table: sessions, detection events, alerts, media, settings,
    audit logs. Repositories run queries and map rows; they hold no business
    rules (§18).
``storage_client.py``
    Supabase Storage: signed URLs, upload, download, delete.
``email_client.py``
    SMTP delivery.
``whatsapp_client.py``
    WhatsApp delivery.

Schema authority
----------------
The applied Supabase migration is authoritative, not
``04 - Database Design.md`` (decision C2). Repositories target the live tables -
``profiles``, ``user_roles``, ``detection_sessions``, ``detection_events``,
``alerts``, ``notification_settings``, ``model_settings``, ``audit_logs``,
``statistics_daily``, ``uploaded_media`` - because the frontend's generated
TypeScript types are built from exactly those. Tables the documents require but
the migration lacks (``reports``, ``exports``, ``ai_models``,
``system_settings``, ``user_settings``) are added by a new migration in Phase F.
Nothing is renamed.

Bucket names likewise follow the migration: ``uploads-videos``,
``uploads-images``, ``session-clips``, ``avatars``. See
:mod:`app.core.constants`.

Rules
-----
* No business logic (§10). An adapter that decides *whether* to send an email,
  rather than *how*, has taken a service's job.
* Never import from :mod:`app.api` or :mod:`app.services` (§23) - that would
  invert the dependency arrow and create a cycle.
* Raise :class:`~app.core.exceptions.StorageError` or
  :class:`~app.core.exceptions.DatabaseError`; never let a provider-specific
  exception escape this layer, or every caller ends up importing the SDK.
* Credentials come from :class:`~app.core.config.Settings` only, and never
  appear in a log or an error message (§13, §14).
"""
