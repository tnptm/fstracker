# syntax=docker/dockerfile:1
# Build context: repository root (pyproject.toml + uv.lock live there).
#   docker build -f backend/Dockerfile --target prod .

ARG PYTHON_VERSION=3.15

# ---- base: Python + locked dependencies ------------------------------------
FROM python:${PYTHON_VERSION}-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH="/opt/venv/bin:$PATH"

COPY --from=ghcr.io/astral-sh/uv:0.13 /uv /bin/uv

WORKDIR /app
COPY pyproject.toml uv.lock ./
# Dependencies only (the root package itself isn't needed to run Django).
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

WORKDIR /app/backend

# ---- dev: runserver with the source bind-mounted (see compose.yaml) ----------
FROM base AS dev
EXPOSE 8000
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

# ---- prod: gunicorn, non-root, static files collected at build time ----------
FROM base AS prod

RUN groupadd --system --gid 10001 app \
 && useradd --system --uid 10001 --gid app --no-create-home --shell /usr/sbin/nologin app

COPY backend/ /app/backend/

# collectstatic only needs settings to import; these values never reach runtime.
RUN DJANGO_DEBUG=False DJANGO_SECRET_KEY=collectstatic-only \
    python manage.py collectstatic --noinput \
 && chmod +x scripts/start-prod.sh

USER app
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health/', timeout=4).status == 200 else 1)"

CMD ["./scripts/start-prod.sh"]
