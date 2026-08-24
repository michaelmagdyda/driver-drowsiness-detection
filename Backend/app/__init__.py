"""Driver Drowsiness Detection System - FastAPI backend application package.

Layer structure (03_Backend_Architecture.md §5-§14). Dependencies flow in one
direction only::

    api -> services -> domain -> infra

`core` and `schemas` are leaf packages importable from anywhere; neither may
import from any other application package.
"""

__version__ = "0.1.0"
