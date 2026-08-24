"""Services layer - business logic and orchestration.

Placeholder. Populated from Phase E onward (03_Backend_Architecture.md §9,
Coding Standards §17).

Purpose
-------
A service answers "what should happen", coordinating the layers that know
"how". It is the only layer allowed to call both :mod:`app.domain` and
:mod:`app.infra`, which is precisely what keeps AI logic ignorant of the
database and the database ignorant of the AI.

Worked example - analysing an uploaded video::

    VideoService
      -> StorageService        download the file           (infra)
      -> extract frames                                    (utils)
      -> AIService             run inference per frame     (domain)
      -> FatigueEngine         temporal analysis           (domain)
      -> SessionRepository     persist session + events    (infra)
      -> NotificationService   dispatch alerts             (infra)

None of those collaborators knows the others exist. Only the service does.

Planned contents
----------------
Phase E   ``UserService`` - profile reads and updates, role resolution.
Phase F   ``SessionService`` - session lifecycle, history, deletion.
          ``SettingsService`` - user and AI settings.
Phase G   ``AIService`` - single-image analysis through the ``ModelManager``.
          ``StorageService`` - the only route to Supabase Storage (§19).
Phase H   ``VideoService`` - frame extraction, timeline building, job status.
Phase J   ``NotificationService`` - channel dispatch with cooldown.
Phase K   ``ReportService``, ``AnalyticsService`` - PDF/CSV, aggregates.

Rules
-----
* Services never import from :mod:`app.api`. The dependency arrow points one
  way: ``api -> services -> domain -> infra`` (§23). A service that needs
  request context receives it as an argument.
* Services never build HTTP responses. They raise
  :class:`~app.core.exceptions.AppError` subclasses; the exception handlers own
  the wire format.
* One responsibility per service (§4). When a service starts needing "and" to
  describe it, it has become two.
* Business rules live here, never in a route (§6) and never in a repository.
"""
