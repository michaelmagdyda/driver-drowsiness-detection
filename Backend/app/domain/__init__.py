"""Domain layer - AI inference and fatigue analysis.

Placeholder. Populated in Phases G and H (03_Backend_Architecture.md §8, §15-§17).

Purpose
-------
Pure computation. Given pixels, produce detections; given detections over time,
produce a driver state and a fatigue score. Nothing here performs I/O, reads a
request, or touches the database - which is what makes this layer directly
unit-testable against sample frames, as the Testing Strategy §5 requires.

Planned structure
-----------------
``models/``
    ``base.py``       ``BaseModelBackend`` - the interface every detector implements.
    ``faster_rcnn.py`` Adapter over the existing trained model.
    ``manager.py``    ``ModelManager`` - load, unload, switch, report metadata.
``metrics.py``        EAR, MAR and head-pose derivation.
``fsm.py``            Temporal smoothing and the driver-state machine.
``fatigue.py``        Fatigue scoring and alert-level escalation.

Reusing the trained model
-------------------------
The detector already exists at the repository root and is **wrapped, not
rewritten**. ``faster_rcnn.py`` adapts ``inference.py``'s ``load_model`` and
``detect_image``; ``config.py`` there remains authoritative for input size,
normalisation and class order. ``MODEL_PATH`` points at
``checkpoints/tuned/best.pth`` rather than a copy (decision C3).

``BaseModelBackend`` exists so RF-DETR and any future detector are substitutable
without touching a route (Liskov, Coding Standards §4). Routes reach the model
only through ``ModelManager`` (§16) - never directly.

Two decisions this layer must honour
------------------------------------
**EAR / MAR / head pose are derived, not measured** (decision C1). The detector
emits bounding boxes for ``closed_eye``, ``open_eye`` and ``yawn`` - there are no
facial landmarks, so a true Eye Aspect Ratio cannot be computed. ``metrics.py``
derives proxies from box geometry and must label them as derived in its output.
Presenting an approximation as a measurement would be dishonest to anyone
reading the explainability dashboard.

**The existing state machine has open and closed eyes inverted.**
``config.py`` and ``results/test_metrics_tuned.json`` both fix the mapping as
``1 = closed_eye, 2 = open_eye``. But ``utils/driver_state.py`` line 13 declares
``OPEN_EYE, CLOSED_EYE, YAWN = 1, 2, 3``, and ``app.py`` follows it. Its
``eyes_closed`` test is therefore backwards: it reports drowsiness when the
driver's eyes are open. The module's self-test passes only because it feeds
itself synthetic labels in its own convention.

``fsm.py`` reuses that temporal-counter design but **must** take its label
constants from :mod:`app.core.constants`, which carries the correct mapping.
Whether to also fix the original file is a Phase H decision, since it changes
the behaviour of the Streamlit demo.

Rules
-----
* No HTTP, no database, no Supabase, no ``UploadFile`` (§8).
* Inference stays synchronous. PyTorch and OpenCV are CPU-bound; wrapping them
  in ``async`` adds no concurrency and blocks the event loop (§10). Services
  offload to a thread pool.
* Model weights load once, at startup, never per request (§25).
"""
