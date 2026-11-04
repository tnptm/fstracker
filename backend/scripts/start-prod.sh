#!/bin/sh
# Production start: apply migrations, then run gunicorn (config: gunicorn.conf.py).
# Works in the Docker image and on a plain server (run from the backend/ directory).
#
#   RUN_MIGRATIONS=0       skip `migrate` (e.g. when running several replicas)
#   COLLECT_STATIC=1       run `collectstatic` (the Docker image does this at build time)
set -eu

cd "$(dirname "$0")/.."

if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
    python manage.py migrate --noinput
fi

if [ "${COLLECT_STATIC:-0}" = "1" ]; then
    python manage.py collectstatic --noinput
fi

exec gunicorn --config gunicorn.conf.py config.wsgi:application
