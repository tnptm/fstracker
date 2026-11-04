"""Gunicorn settings tuned for a small VPS: 1 vCPU, <= 2 GB RAM.

Everything can be overridden with GUNICORN_* environment variables.

Why these values:
- 2 workers on 1 core: one can serve while the other is busy or being
  recycled. More processes would only compete for the single CPU and memory.
- gthread with 4 threads: requests mostly wait on PostgreSQL, so threads give
  concurrency (2 x 4 = 8 requests) for a few MB each instead of ~60-80 MB per
  extra worker process.
- preload_app: load Django once in the master so workers share memory pages
  (copy-on-write) and start faster.
- max_requests (+ jitter): recycle workers regularly so slow memory growth
  can't build up; jitter avoids both restarting at the same time.
"""

import os


def _int(name, default):
    return int(os.getenv(name, default))


bind = os.getenv('GUNICORN_BIND', '0.0.0.0:8000')

workers = _int('GUNICORN_WORKERS', 2)
worker_class = 'gthread'
threads = _int('GUNICORN_THREADS', 4)
preload_app = True

max_requests = _int('GUNICORN_MAX_REQUESTS', 1000)
max_requests_jitter = _int('GUNICORN_MAX_REQUESTS_JITTER', 100)

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
