"""Gunicorn settings tuned for a small VPS: 1 vCPU, <= 2 GB RAM.

Everything can be overridden with GUNICORN_* environment variables.

Why these values:
- ONE worker process: users' encryption keys (derived from their passwords, see
  accounts/crypto.py) live in process memory, so every request must reach the same
  process. Do not raise GUNICORN_WORKERS above 1.
- gthread with 8 threads: requests mostly wait on PostgreSQL, so threads give
  concurrency for a few MB each instead of ~60-80 MB per extra worker process.
- preload_app: load Django once in the master and start faster.
- max_requests is off (0): recycling the worker would drop all in-memory keys and
  sign every user out. Set GUNICORN_MAX_REQUESTS only if you accept that.
"""

import os


def _int(name, default):
    return int(os.getenv(name, default))


bind = os.getenv('GUNICORN_BIND', '0.0.0.0:8000')

workers = _int('GUNICORN_WORKERS', 1)
worker_class = 'gthread'
threads = _int('GUNICORN_THREADS', 8)
preload_app = True

max_requests = _int('GUNICORN_MAX_REQUESTS', 0)
max_requests_jitter = _int('GUNICORN_MAX_REQUESTS_JITTER', 0)

# Fail slow requests instead of tying up one of only 8 slots.
timeout = _int('GUNICORN_TIMEOUT', 30)
graceful_timeout = _int('GUNICORN_GRACEFUL_TIMEOUT', 20)
# Upstream (Next.js) reuses connections; keep them briefly.
keepalive = _int('GUNICORN_KEEPALIVE', 5)
# Small listen queue: on a tiny box it's better to fail fast than to pile up.
backlog = _int('GUNICORN_BACKLOG', 256)

# No runtime control socket: not needed here, and the container has no writable home.
control_socket_disable = True

# Heartbeat files in RAM instead of the container's overlay filesystem.
worker_tmp_dir = '/dev/shm' if os.path.isdir('/dev/shm') else None

# Logs to stdout/stderr (docker logs). X-Forwarded-For carries the client IP from nginx.
accesslog = os.getenv('GUNICORN_ACCESS_LOG', '-')
errorlog = '-'
loglevel = os.getenv('GUNICORN_LOG_LEVEL', 'info')
access_log_format = '%({x-forwarded-for}i)s "%(r)s" %(s)s %(b)s %(M)sms "%(a)s"'

# Limits that reject oversized/malformed requests early (the API only takes small JSON).
limit_request_line = 4094
limit_request_fields = 100
limit_request_field_size = 8190
