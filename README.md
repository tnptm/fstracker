# fstracker

A mobile-first web app for tracking voluntary (volunteer) work hours.

Start a timer or add time afterwards, note days off, count courses, set monthly hour goals, and see how
you are doing against them in the history and stats views. Light and dark themes are included.

## Features

- **Accounts:** anonymous sign-up (a random username and a password, no email), log in and log out. Sessions last 30 days and are extended on use.
- **Time tracking:** a start/stop timer, manual time entries, and comments on each entry.
- **Day notes:** mark a whole day as day off, sick, vacation or other.
- **Courses:** count the courses you completed each month.
- **Goals and stats:** monthly hour goals, a pace indicator for the current month, and a 12-month chart and table.
- **History:** browse and edit past entries.
- **Privacy (GDPR):** a privacy policy page, acceptance when you sign up, a data export, editing of your details,
  account deletion, and automatic deletion of long-unused accounts. No data is shared with third parties.

## Tech stack

| Part | Technology |
|---|---|
| Backend | Python, Django 6, Django REST Framework, SimpleJWT |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, SWR |
| Database | SQLite for development, PostgreSQL 18 in production |
| Serving | gunicorn (backend), Next.js standalone server (frontend), nginx as the public entry point |
| Packaging | uv (Python), npm (frontend), Docker Compose |

## Architecture

```
browser ──► Next.js (/, /history, /track, /stats, /api/* rewrite)
                 │
                 └──► Django REST API (/api/…)  ──► SQLite or PostgreSQL
```

The browser only talks to the Next.js origin. Next rewrites `/api/*` to the Django backend, so the
authentication cookies are first-party and CORS is not needed.

Authentication uses JWT stored in `HttpOnly` cookies, so tokens are never exposed to JavaScript. CSRF
protection is enforced on unsafe methods. See [CLAUDE.md](CLAUDE.md) for the full auth design.

## Repository layout

```
backend/            Django project
  accounts/         registration, login, tokens, throttles
  tracker/          time entries, day notes, courses, goals, stats
  config/           settings and URL configuration
  scripts/          production start script
frontend/           Next.js app
  app/              routes: (auth) login/register, (app) home, history, track, stats
  components/       UI components and views
  lib/              API client (apiFetch), data keys, formatting, theme
deploy/             production runbook, nginx config, database backup script
compose.yaml        development Docker stack
compose.prod.yaml   production Docker stack
```

## Getting started

Requirements: [uv](https://docs.astral.sh/uv/) with Python 3.15, and Node.js 24 (or a recent LTS).

### 1. Backend configuration

Create `backend/.env` (it is gitignored):

```bash
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
```

With `DJANGO_DEBUG` on, a development secret key is used automatically. With it off, you must set
`DJANGO_SECRET_KEY` or the app refuses to start.

### 2. Run the backend

```bash
uv run --directory backend python manage.py migrate
uv run --directory backend python manage.py createsuperuser   # optional, for /admin/
uv run --directory backend python manage.py runserver 8002
```

### 3. Run the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:3000>. The frontend proxies `/api/*` to `http://127.0.0.1:8002` by default. Set
`BACKEND_URL` if your backend runs somewhere else.

### Docker (development)

Requirements: Docker with the Compose plugin. Node and uv are not needed on the host.

```bash
docker compose up --build    # first run builds both images; create backend/.env first (step 1)
```

- Frontend: <http://localhost:3001>
- Backend API and admin: <http://localhost:8002> (`/admin/`, `/api/`)

Useful commands:

```bash
docker compose up -d                                              # start in the background
docker compose logs -f frontend                                   # follow logs (or backend)
docker compose exec backend python manage.py migrate              # run migrations
docker compose exec backend python manage.py createsuperuser     # create an admin user
docker compose exec backend python manage.py test                 # run backend tests
docker compose down                                               # stop (keeps SQLite and caches)
```

Dev stack details (`compose.yaml`):

- `backend` runs `manage.py runserver` from the `dev` target of `backend/Dockerfile`. The `./backend`
  directory is bind-mounted, so code changes reload automatically. The SQLite database is
  `backend/db.sqlite3` on the host.
- `frontend` runs `next dev` from the `dev` target of `frontend/Dockerfile`. `./frontend` is
  bind-mounted, and `node_modules` and `.next` live in named volumes so the host's copies are not used.
  `WATCHPACK_POLLING=true` makes file watching work on Docker Desktop and WSL.
- Inside the network the frontend reaches Django at `http://backend:8000` (`BACKEND_URL`), and Django
  accepts the `backend` host name.
- `DJANGO_DEBUG` defaults to `True`. Values from `backend/.env` are read by python-dotenv, and variables
  set in the compose file take precedence.
- To develop against PostgreSQL instead, add the `POSTGRES_*` variables to `backend/.env` and point
  `POSTGRES_HOST` at a running database.

To remove the dev containers and volumes (this deletes the cached `node_modules`, not your SQLite file):
`docker compose down -v`.

## Configuration

Backend environment variables (set in `backend/.env` or the shell):

| Variable | Default | Purpose |
|---|---|---|
| `DJANGO_SECRET_KEY` | none (dev key if `DEBUG` is on) | Required when `DJANGO_DEBUG` is off |
| `DJANGO_DEBUG` | `False` | Development mode; off enables secure cookies and HTTPS settings |
| `DJANGO_ALLOWED_HOSTS` | empty | Comma-separated hostnames Django accepts |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | `http://localhost:3000,http://localhost:3001` | Frontend origins allowed for CSRF |
| `DJANGO_TIME_ZONE` | `Europe/Helsinki` | Defines day and month boundaries for filters and stats |
| `DJANGO_THROTTLE_REGISTER` | `5/hour` | Sign-up limit per IP |
| `DJANGO_THROTTLE_REGISTER_GLOBAL` | `100/hour` | Sign-up limit for the whole site |
| `DJANGO_INACTIVE_ACCOUNT_MONTHS` | `24` | Accounts unused this long are deleted by `enforce_retention` (`0` disables it) |
| `DJANGO_NUM_PROXIES` | `0` | Number of trusted proxies appending to `X-Forwarded-For` |
| `POSTGRES_HOST` | unset (SQLite) | Set to use PostgreSQL; also `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` |

Frontend environment variable: `BACKEND_URL` (default `http://127.0.0.1:8002`).

## API overview

All endpoints are under `/api/` and require a logged-in user unless noted. Every query is scoped to the
current user.

| Endpoint | Description |
|---|---|
| `auth/csrf/` (GET) | Sets the CSRF cookie |
| `auth/register/`, `auth/login/`, `auth/refresh/`, `auth/logout/` | Session management |
| `auth/me/` | GET: current user. PATCH `{"email": ""}`: remove a legacy email. DELETE: erase the account (needs `password`) |
| `auth/me/export/` (GET) | All of the user's data as JSON (GDPR access/portability) |
| `auth/privacy/accept/` (POST) | Accept the current privacy policy version |
| `entries/` | Time entries (CRUD); `entries/current/`, `entries/start/`, `entries/stop/` |
| `daily-comments/` | Day notes (CRUD) |
| `goals/YYYY-MM/`, `courses/YYYY-MM/` | Monthly goal and course count (PUT upserts) |
| `stats/?year=YYYY` | Current month and 12-month totals, in seconds |
| `health/` | Health check (no auth) |

## Privacy and data protection

fstracker is built to comply with the GDPR. Accounts are anonymous (a random username plus a password, no email or name). User data (hours and notes) is used only to run
the app and is never shared with third parties.

- Sign-up requires accepting the [privacy policy](frontend/app/(legal)/privacy/page.tsx) (`/privacy` in the app).
- Users can download their data and delete their account from the Account page.
- Accounts unused for 24 months are deleted. Schedule this daily:
  `docker compose --env-file .env.prod -f compose.prod.yaml exec -T backend python manage.py enforce_retention`
  (add `--dry-run` to preview).
- Before going live, set a contact email in [frontend/lib/privacy.ts](frontend/lib/privacy.ts).

The data inventory, retention rules, request handling and contributor rules are in
[docs/DATA_HANDLING.md](docs/DATA_HANDLING.md).

## Testing

```bash
uv run --directory backend python manage.py test
cd frontend && npm run lint && npm run build
```

## Production deployment

The production stack (`compose.prod.yaml`, project name `fstracker-prod`) runs three containers:

| Service | Image | Role | Host port |
|---|---|---|---|
| `db` | `postgres:18-alpine` | PostgreSQL, data in the named volume `pgdata` | none |
| `backend` | `backend/Dockerfile`, target `prod` | Django under gunicorn, non-root user, read-only filesystem, migrations at start | `127.0.0.1:8000` |
| `frontend` | `frontend/Dockerfile`, target `prod` | Next.js standalone server, `/api/*` proxied to `backend` | `127.0.0.1:3000` |

The containers only listen on `127.0.0.1`. nginx on the host terminates TLS for the public domain and
proxies to them. Each container has a memory limit (db 384 MB, backend 384 MB, frontend 320 MB), and
all three use `json-file` logs capped at 10 MB × 3 files. The containers are sized for a small VPS
(1 vCPU, 2 GB RAM).

### First deploy

1. Point the domain (`DOMAIN` in `.env.prod`, default `fs.tnptm.top`) at the server.
2. Create the secrets file and generate the two secrets:

   ```bash
   cp .env.prod.example .env.prod
   python3 -c "import secrets; print(secrets.token_urlsafe(64))"   # DJANGO_SECRET_KEY
   python3 -c "import secrets; print(secrets.token_urlsafe(32))"   # POSTGRES_PASSWORD
   chmod 600 .env.prod
   ```

3. Build and start the stack:

   ```bash
   docker compose --env-file .env.prod -f compose.prod.yaml up -d --build
   docker compose --env-file .env.prod -f compose.prod.yaml ps    # wait until all are "healthy"
   ```

   The backend applies migrations before gunicorn starts.
4. Install the nginx site from `deploy/nginx/fs.tnptm.top.conf` and get a TLS certificate with certbot.
   The full steps are in [deploy/README.md](deploy/README.md).
5. Create an admin user:

   ```bash
   docker compose --env-file .env.prod -f compose.prod.yaml exec backend python manage.py createsuperuser
   ```

### Day-to-day commands

Set up a shorthand first (optional): `alias dc='docker compose --env-file .env.prod -f compose.prod.yaml'`.

```bash
dc ps                       # container status and health
dc logs -f backend          # follow logs (also db, frontend)
dc restart backend          # restart one service
dc exec backend python manage.py shell
```

### Updating

```bash
git pull
docker compose --env-file .env.prod -f compose.prod.yaml up -d --build
docker image prune -f       # remove old image layers
```

### Backups

`deploy/backup-db.sh` writes a compressed `pg_dump` to `backups/` and keeps the newest 14 (set `KEEP`
to change this). Run it from cron; the header of the script has the cron line and the restore command.

```bash
deploy/backup-db.sh /var/backups/fstracker
```

### Stopping

```bash
dc down          # stop and remove containers; the database volume is kept
```

Never run `docker compose down -v` in production, because it deletes the `pgdata` volume and all data
in it.

### Production configuration

Set in `.env.prod` (template: `.env.prod.example`):

| Variable | Purpose |
|---|---|
| `DOMAIN` | Public host name; used for Django's allowed hosts and CSRF origin (default `fs.tnptm.top`) |
| `DJANGO_SECRET_KEY` | Required. The app refuses to start without it |
| `POSTGRES_PASSWORD` | Required. Also `POSTGRES_DB` and `POSTGRES_USER` (default `fstracker`) |
| `DJANGO_TIME_ZONE` | Default `Europe/Helsinki` |
| `DJANGO_THROTTLE_REGISTER`, `DJANGO_THROTTLE_REGISTER_GLOBAL` | Sign-up rate limits |
| `GUNICORN_WORKERS`, `GUNICORN_THREADS` | Default 1 × 8 (keep 1 worker: encryption keys live in process memory) |
| `FRONTEND_PORT`, `BACKEND_PORT` | Host ports on `127.0.0.1` (defaults 3000 and 8000) |

Production-only settings are fixed in `compose.prod.yaml`: `DJANGO_DEBUG=False` (which turns on secure
cookies and HTTPS handling), `DJANGO_NUM_PROXIES=1` (nginx overwrites `X-Forwarded-For`), and the
PostgreSQL host `db`. The frontend's `BACKEND_URL` is a build argument, so it is baked into the image.

The full runbook, including resource notes and security notes, is in [deploy/README.md](deploy/README.md).

## Contributing

Contributions are welcome through pull requests only. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Released under the [MIT License](LICENSE).
