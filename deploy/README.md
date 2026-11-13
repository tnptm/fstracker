# Deploying fstracker (fs.tnptm.top)

Target: a small VPS (1 vCPU, <= 2 GB RAM) with Docker + Compose and nginx on the host.

```
internet -> nginx (TLS, rate limits) -> 127.0.0.1:3000 Next.js -> backend:8000 gunicorn -> db:5432 PostgreSQL 18
                                     \-> 127.0.0.1:8000 gunicorn  (only /admin/ and /static/)
```

## First deploy

1. **DNS:** point `fs.tnptm.top` at the server.
2. **Secrets:**
   ```bash
   cp .env.prod.example .env.prod
   python3 -c "import secrets; print(secrets.token_urlsafe(64))"   # -> DJANGO_SECRET_KEY
   python3 -c "import secrets; print(secrets.token_urlsafe(32))"   # -> POSTGRES_PASSWORD
   chmod 600 .env.prod
   ```
3. **Start the stack:**
   ```bash
   docker compose --env-file .env.prod -f compose.prod.yaml up -d --build
   docker compose --env-file .env.prod -f compose.prod.yaml ps      # all three "healthy"
   ```
   Migrations run automatically when the backend starts.
4. **TLS certificate** (certbot, HTTP-01): install the nginx file first without the `443` block
   (or use `certbot --nginx`), get the certificate, then enable the full config:
   ```bash
   sudo cp deploy/nginx/fs.tnptm.top.conf /etc/nginx/conf.d/
   sudo certbot certonly --webroot -w /var/www/certbot -d fs.tnptm.top
   sudo nginx -t && sudo systemctl reload nginx
   ```
5. **Admin user:**
   ```bash
   docker compose --env-file .env.prod -f compose.prod.yaml exec backend python manage.py createsuperuser
   ```

## Updating

```bash
git pull
docker compose --env-file .env.prod -f compose.prod.yaml up -d --build
docker image prune -f      # reclaim disk from old layers
```

The PostgreSQL data lives in the named volume `fstracker-prod_pgdata` and survives `down`/`up`
and rebuilds. **Never run `down -v`** on production: that deletes the volume.

## Backups

`deploy/backup-db.sh` writes a compressed `pg_dump` and prunes old ones (see the header for the cron
line and the restore command).

## Data retention (GDPR)

Schedule the retention job once a day. It deletes accounts unused for `DJANGO_INACTIVE_ACCOUNT_MONTHS` (default
24) and flushes expired token rows; admins are skipped. Preview with `--dry-run`:

```bash
docker compose --env-file .env.prod -f compose.prod.yaml exec -T backend python manage.py enforce_retention --dry-run
# cron (daily 04:15):
15 4 * * * cd /opt/fstracker && docker compose --env-file .env.prod -f compose.prod.yaml exec -T backend python manage.py enforce_retention
```

The privacy policy promises backups roll off within about two weeks (`deploy/backup-db.sh` keeps 14) and that
logs are short-lived, so rotate nginx access logs (e.g. 14 days) too. Details: `docs/DATA_HANDLING.md`.

## Resource notes (1 vCPU, <= 2 GB)

| Part | Setting | Why |
|---|---|---|
| gunicorn | 2 workers x 4 threads (`backend/gunicorn.conf.py`) | 8 concurrent requests for ~110 MB; more processes only compete for the single core |
| gunicorn | `max_requests=1000` + jitter, `preload_app` | recycle workers against slow memory growth, share memory between workers |
| PostgreSQL | `shared_buffers=96MB`, `max_connections=25` | fits the 384 MB limit; the app needs about 8 connections |
| Next.js | `--max-old-space-size=256`, standalone output | small image and heap |
| Compose | `mem_limit`: db 384M, backend 384M, frontend 320M | about 1.1 GB worst case, so a runaway container is killed instead of the whole server |

Measured idle: backend ~107 MB, frontend ~40 MB, db ~32 MB. On a server with 1 GB or less, add a swap file
and lower `GUNICORN_THREADS`/`GUNICORN_WORKERS` in `.env.prod`.

## Security notes

- Containers publish ports on `127.0.0.1` only. Keep the firewall closed except for 22/80/443.
- nginx **overwrites** `X-Forwarded-For`; Django trusts exactly that value (`DJANGO_NUM_PROXIES=1`) for
  the sign-up rate limit. If you put another proxy (e.g. Cloudflare) in front of nginx, revisit this.
- `/admin/` is reachable on the public domain. Restrict it in the nginx file (`allow`/`deny`) if you can.
- Login, sign-up and token refresh are limited to 10 requests/minute per IP in nginx, on top of the
  app's own sign-up throttles.
