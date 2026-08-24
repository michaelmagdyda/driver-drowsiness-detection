# syntax=docker/dockerfile:1.7
# =============================================================================
# Driver Drowsiness Detection - FastAPI backend (ONNX runtime)
# =============================================================================
# Two stages so the final image carries no pip, no compilers and no build
# caches: the builder resolves dependencies into a self-contained virtualenv,
# the runtime copies that venv and nothing else.
#
# ONNX-ONLY BY DESIGN. torch/torchvision are not installed here - they live in
# requirements-torch.txt and are only needed for a `.pth` MODEL_PATH. The code
# still supports that backend; app/domain/models/custom_frcnn/__init__.py
# re-exports FasterRCNN lazily so nothing imports torch unless it is used.
# Keeping it out costs ~2 GB per image, per pull, per node.
#
# NO apt-get LAYER. Dockerfile.ml installed libgl1 + libglib2.0-0 for OpenCV,
# but opencv-python-headless (4.14), onnxruntime (1.29) and imageio-ffmpeg all
# ship self-contained wheels - imageio-ffmpeg even bundles a static ffmpeg
# binary. Verified by the import check in the builder stage below, which fails
# the build if that ever stops being true. Dropping apt removes a network
# dependency on the Debian mirrors and shrinks the image.
#
# Build context is Backend/ (see .dockerignore). Layer order is
# requirements -> install -> model -> application code, so editing a route
# rebuilds only the last and smallest layer.
# =============================================================================

ARG PYTHON_VERSION=3.12

# -----------------------------------------------------------------------------
# Stage 1 - builder
# -----------------------------------------------------------------------------
FROM python:${PYTHON_VERSION}-slim-bookworm AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /build

# Own virtualenv rather than --user or the system site-packages: it makes the
# runtime stage a single, self-contained COPY.
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copied alone, before the source, so the dependency layer is cached across
# every change that does not touch this file.
COPY requirements.txt ./

RUN pip install --upgrade pip setuptools wheel \
 && pip install -r requirements.txt

# Two build-time invariants. Both fail the build rather than producing an image
# that is quietly wrong - a 2 GB "ONNX-only" image, or one that only discovers
# a missing system library on the first inference request in production.
RUN python -c "\
import importlib.util, sys; \
found = [m for m in ('torch', 'torchvision') if importlib.util.find_spec(m)]; \
sys.exit('ONNX-only invariant violated: %s is installed' % found) if found else None; \
print('verified: no torch, no torchvision')" \
 && python -c "\
import onnxruntime, cv2, numpy, imageio_ffmpeg, subprocess; \
print('onnxruntime', onnxruntime.__version__, onnxruntime.get_available_providers()); \
print('cv2', cv2.__version__); \
print('numpy', numpy.__version__); \
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-version'], check=True, capture_output=True); \
print('bundled ffmpeg: OK')"

# -----------------------------------------------------------------------------
# Stage 2 - runtime
# -----------------------------------------------------------------------------
FROM python:${PYTHON_VERSION}-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

# --- Container-correct configuration -----------------------------------------
# Defaults only. Every one of these is overridable at run time, and NO secret
# is set here - secrets arrive from the environment (compose / k8s Secret).
#
# The three model paths must point inside the image: their source defaults are
# ../ML/... relative to the Backend directory, which does not exist in a
# container. Settings resolves absolute paths as-is (app/core/config.py).
ENV APP_ENV=production \
    HOST=0.0.0.0 \
    PORT=8000 \
    MODEL_PATH=/app/models/best.onnx \
    MODEL_METRICS_PATH=/app/models/test_metrics_tuned.json \
    MODEL_CHECKPOINTS_DIR=/app/models \
    MODEL_DEVICE=cpu

WORKDIR /app

# Unprivileged runtime user.
RUN groupadd --gid 1000 appuser \
 && useradd --uid 1000 --gid 1000 --create-home --shell /usr/sbin/nologin appuser

COPY --from=builder /opt/venv /opt/venv

# Model artefacts before application code: 68 MB that changes far less often
# than the source, so the layer stays cached across code edits.
COPY --chown=appuser:appuser best.onnx               /app/models/best.onnx
COPY --chown=appuser:appuser test_metrics_tuned.json /app/models/test_metrics_tuned.json

COPY --chown=appuser:appuser app/ /app/app/

USER appuser

EXPOSE 8000

# Liveness only. /health answers as soon as the process is up; /ready is the
# readiness signal and is consulted by the orchestrator, not by Docker.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0) if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4).status == 200 else sys.exit(1)"

# One worker on purpose: the ONNX session is loaded per process and each copy
# costs real RAM. Scale with replicas, not with workers.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
