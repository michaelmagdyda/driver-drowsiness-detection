"""Utils layer - stateless reusable helpers.

Placeholder. Populated in Phase G onward (03_Backend_Architecture.md §12).

Purpose
-------
Small pure functions that several layers need and none of them owns. A helper
here takes arguments and returns a value: no configuration, no clients, no
accumulated state between calls.

Planned contents
----------------
``image_utils.py``
    Decode uploaded bytes to a BGR array, validate dimensions, re-encode.
``video_utils.py``
    Frame extraction with a configurable stride, duration and FPS probing.
    ``app.py`` at the repository root already demonstrates the stride approach:
    processing every Nth frame trades a little temporal resolution for a large
    speed gain, which matters more now that inference runs on CPU.
``file_utils.py``
    MIME sniffing, extension checks, safe temporary-file handling with
    guaranteed cleanup (§19).
``time_utils.py``
    UTC helpers and duration formatting.

Rules
-----
* Stateless (§12). Anything that must remember something between calls belongs
  in a service or the domain layer.
* No imports from :mod:`app.api`, :mod:`app.services`, :mod:`app.domain` or
  :mod:`app.infra`. Utils sit beside :mod:`app.core` at the bottom of the graph;
  importing upward would create a cycle.
* One home per helper (§28). Before adding a function here, check it does not
  already exist - the root ``utils/`` package has box, NMS and visualisation
  helpers that Phase G may be able to reuse rather than reimplement.
"""
