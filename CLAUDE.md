# fstracker

Tracks voluntary (volunteer) work hours. Monorepo with two apps:

- `backend/` — Django 6 + Django REST Framework API (Python 3.15, managed with **uv** from the repo root).
- `frontend/` — Next.js 16 (App Router, React 19, Tailwind 4, TypeScript).

Features: auth (register / login / logout / 30-day session), a start/stop timer and manual time entries
with comments, whole-day notes (day off, sick…), monthly course counts, monthly hour goals, an editable
history and monthly stats. The UI is mobile-first with light/dark themes.

## Commands

Python deps are managed only with uv (`pyproject.toml` / `uv.lock` at repo root). Never use pip.

```bash
uv add <package>                                         # add a backend dependency
uv run --directory backend python manage.py runserver 8002
uv run --directory backend python manage.py test         # backend tests
uv run --directory backend python manage.py migrate
uv run --directory backend python manage.py createsuperuser

cd frontend
npm run dev        # Next dev server (port 3000, or next free port)
npm run lint
npm run build
```

Node comes from nvm (`~/.nvm/versions/node/...`). Non-interactive shells may need it put on `PATH`.

Docker (optional for development, used for production):

```bash
docker compose up --build                  # dev: hot reload, SQLite; backend :8002, frontend :3001
docker compose --env-file .env.prod -f compose.prod.yaml up -d --build   # production stack
```

See `deploy/README.md` for the production runbook (first deploy, updates, backups, resource notes).

## Configuration

`backend/.env` (gitignored, loaded by python-dotenv):

- `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`. With `DJANGO_DEBUG` off the app **refuses to
  start without a secret key** and turns on secure cookies, `X-Forwarded-Proto` handling and WhiteNoise
  hashed static files.
- `POSTGRES_HOST` (+ `POSTGRES_PORT/DB/USER/PASSWORD`): when set, Django uses PostgreSQL; otherwise SQLite
  (development default). Production always sets it (compose.prod.yaml).
- `DJANGO_CSRF_TRUSTED_ORIGINS`: comma-separated frontend origins (default `http://localhost:3000,http://localhost:3001`)
- `DJANGO_THROTTLE_REGISTER` (default `5/hour` per IP), `DJANGO_THROTTLE_REGISTER_GLOBAL` (default `100/hour` site-wide)
- `DJANGO_NUM_PROXIES` (default `0`): trusted proxies that append to `X-Forwarded-For`. See "Rate limiting & client IP".
- `DJANGO_INACTIVE_ACCOUNT_MONTHS` (default `24`, `0` = off): accounts unused this long are deleted by
  `manage.py enforce_retention` (run it daily from cron, see `docs/DATA_HANDLING.md`).
- `DJANGO_TIME_ZONE` (default `Europe/Helsinki`): defines day/month boundaries for API filters and stats.

Frontend env: `BACKEND_URL`, the Django origin that `/api/*` is proxied to (default `http://127.0.0.1:8002`).

## Architecture: auth

JWT (djangorestframework-simplejwt) stored in **HTTP-only cookies**. Tokens are never exposed to JS.

- **Same-origin via rewrite:** `frontend/next.config.ts` rewrites `/api/:path*` → `${BACKEND_URL}/api/:path*/`.
  The browser only talks to the Next origin, so the cookies are first-party and no CORS is needed.
  Frontend code calls API paths **without** a trailing slash; the rewrite appends it for Django.
- **Cookies:** `access_token` (15 min) and `refresh_token` (30 days), both `HttpOnly`, `SameSite=Lax`,
  `Secure` when `DEBUG` is off, path `/`. Helpers are in `backend/accounts/cookies.py`.
- **30-day inactivity session:** `ROTATE_REFRESH_TOKENS` + `BLACKLIST_AFTER_ROTATION`. Each refresh issues
  a new 30-day refresh token and blacklists the old one, so a session ends only after 30 days unused.
  Logout blacklists the refresh token and clears both cookies.
- **CSRF:** cookie auth requires CSRF protection. `accounts.authentication.CookieJWTAuthentication`
  (the default DRF auth class) and the login/refresh/logout views call `enforce_csrf`. The frontend
  reads the non-HttpOnly `csrftoken` cookie (obtained from `GET /api/auth/csrf`) and sends `X-CSRFToken`
  on unsafe methods.
- **Default permission is `IsAuthenticated`**: new API views are protected unless they opt out.

Endpoints (`backend/accounts/urls.py`, mounted at `/api/auth/`): `csrf/` (GET), `login/`, `register/`,
`refresh/`, `logout/` (POST), `me/` (GET, PATCH `{"email": ""}` to remove a legacy email, DELETE to erase the account), `me/export/` (GET,
JSON of all the user's data), `privacy/accept/` (POST). See "Privacy & GDPR".

### Registration hardening (`RegisterView` / `RegisterSerializer`)

- CSRF token required. Per-IP and global throttles (`accounts/throttles.py`).
- Honeypot field `website`: hidden in the form; a non-empty value is rejected.
- `AUTH_PASSWORD_VALIDATORS` run with the candidate user (similarity check), plus a password confirmation.
- Sign-up is anonymous: the client sends only a password (+ confirmation and the privacy checkbox). The server picks a
  random username (`accounts/usernames.py`); no email or name is collected, so there is no password reset. Login matches
  the username case-insensitively. Only whitelisted fields are
  used, so `is_staff`/`is_superuser` can't be set. On success the user is logged in (cookies set, 201).

### Privacy & GDPR (`docs/DATA_HANDLING.md` is the full reference)

- No data goes to third parties; the app has no analytics, external fonts or trackers. Keep it that way.
- Registration requires `accept_privacy: true` (checkbox in `RegisterForm`, linking to `/privacy`). The accepted
  policy version and time are stored in `accounts.PolicyAcceptance`. `UserSerializer.privacy_accepted` is false for
  older accounts, and `components/PrivacyNotice.tsx` asks them to accept via `POST /api/auth/privacy/accept/`.
- The policy page is `frontend/app/(legal)/privacy/page.tsx`, reachable signed in or out (`OPEN_PATHS` in
  `proxy.ts`). Its version lives in `PRIVACY_POLICY_VERSION` (settings) and `POLICY_VERSION` (`lib/privacy.ts`):
  bump both when the policy changes.
- User rights: export (`accounts/export.py`), rectification (`PATCH /api/auth/me/`) and erasure
  (`DELETE /api/auth/me/`, password required, cascades to all user data), all in the Account page
  (`components/views/AccountView.tsx`).
- **When you add a model or field with personal data**: cascade-delete it with the user, add it to
  `accounts/export.py`, and update the data inventory in `docs/DATA_HANDLING.md` and the privacy page.
- Never put personal data (email, username, request bodies) in logs or URLs.

### Rate limiting & client IP

Next's external rewrite does **not** add `X-Forwarded-For` and passes a client-supplied one through
unchanged. With the default `NUM_PROXIES=0`, Django uses `REMOTE_ADDR`, which is the Next server.
Per-IP limits therefore act as one shared bucket, which is safe but coarse. In production, put a
reverse proxy (nginx/Caddy) in front of Next that *overwrites* `X-Forwarded-For` with the real client
IP, keep Django unreachable except via Next, and set `DJANGO_NUM_PROXIES=1`. Never leave
`NUM_PROXIES` unset/`None`: DRF would then trust the whole spoofable header.

Frontend pieces:

- `frontend/lib/api.ts`: `apiFetch()` is the only way to call the API from client components. It adds
  credentials and the CSRF header, refreshes once on 401 (one shared in-flight refresh so a rotated token
  is never reused) and retries, then sends the user to `/login` if refresh fails.
- `frontend/proxy.ts`: Next 16's replacement for `middleware.ts`. It does an *optimistic* check (only
  whether the `refresh_token` cookie exists) to redirect between `/login` and protected pages. Real
  authorization always happens in Django.
- `app/(auth)/` holds the login and register pages (`components/LoginForm.tsx`, `RegisterForm.tsx`).
  `components/UserMenu.tsx` handles logout and clears the SWR cache. Public (no-session) pages are listed
  in `PUBLIC_PATHS` in `proxy.ts`.

## Architecture: tracker (`backend/tracker`)

Models: `Tracker` (a time entry; `end_time` is null while the timer runs), `MonthlyCourses`,
`MonthlyHourGoal` (both have one row per user and month, `month` is the 1st day), and `DailyComment`
(one note per user and day, `kind` = day_off/sick/vacation/other).

DB constraints: `end_time > start_time`, **at most one running entry per user**, and the unique
per-month/per-day rows. The serializer also rejects overlapping entries (a running entry counts as
ending now) and times in the future.

API (mounted at `/api/`, every query scoped to `request.user`; other users' objects return 404):

- `entries/`: CRUD. Filters `?month=YYYY-MM`, `?from=&to=` (dates, inclusive), `?limit=N`.
  Actions: `entries/current/` (GET, the running entry or null), `entries/start/` and `entries/stop/`
  (POST, optional `description`; return 409 if already running / not running). A manual create requires
  `end_time`.
- `daily-comments/`: CRUD, `?month=YYYY-MM`.
- `goals/` and `courses/`: addressed by month, e.g. `PUT /api/goals/2026-11/` upserts. `?year=YYYY` on list.
- `stats/?year=YYYY`: `current` (this month: seconds, goal, expected-by-today pace, remaining, today) and
  `year` (12 months of seconds/goal/courses/day notes). Durations are in **seconds**. An entry counts
  toward the day/month it starts in.

## Architecture: frontend app (`frontend/app/(app)`)

- Pages: Home `/`, History `/history`, Track `/track`, Stats `/stats`, Account `/account` (reached from the user icon in
  the header, not the tab bar). `/privacy` is a public page in `app/(legal)/`. Each `page.tsx` renders a view from
  `components/views/` inside `<ClientOnly>`: views use "now" and the browser time zone, which can't be
  prerendered (Next errors on `new Date()` during prerender).
- Layout: header nav on `md+`; on phones a fixed bottom tab bar (`components/NavLinks.tsx`) with
  safe-area padding (`viewportFit: "cover"`). `<main>` has bottom padding so content clears the bar.
- Data: SWR (`components/Providers.tsx`) with `apiFetch` as fetcher. SWR keys are API paths (see `keys`
  in `lib/tracker.ts`). Mutations go through `lib/tracker.ts` helpers, which call `refreshTrackerData()`
  to revalidate all tracker keys, so Home, History and Stats stay consistent.
- Dates: shown in browser local time via `lib/format.ts` (en-GB, 24 h). Edits send ISO/UTC.
- Theme: the user's choice (system/light/dark) is stored in `localStorage.theme` and applied as
  `<html data-theme>` by an inline head script (`lib/theme-script.ts`) before first paint.
  `useTheme()` is in `lib/theme.ts`. Tailwind's `dark:` variant is bound to `data-theme` in `globals.css`.
- Styling: shared classes in `globals.css` (`card`, `btn btn-primary|secondary|ghost|danger`, `input`,
  `field`, `alert-*`, `icon-btn`). Inputs are 16px so iOS doesn't zoom on focus. Accent is teal.
- Chart (`components/MonthlyChart.tsx`): single series in `--chart-series`. Its light/dark values were
  validated for contrast/lightness against the card surfaces, so re-validate if you change them. Goals
  are a tick per month; each column is a focusable button with a tooltip. The Stats table is the
  accessible view of the same data.
- Edit dialogs use native `<dialog>` (`components/ui.tsx` `Modal`): a bottom sheet on phones.

## Architecture: Docker & production

- `compose.yaml` (dev): `backend` (runserver) and `frontend` (`next dev`) with the source bind-mounted. Same
  settings as running locally: SQLite in `backend/db.sqlite3`, `backend/.env` read by python-dotenv (no
  `env_file`, because compose would interpolate `$` inside the secret key).
- `compose.prod.yaml` (prod, project `fstracker-prod`): `db` (PostgreSQL **18**, data in the named volume
  `pgdata` mounted at `/var/lib/postgresql`, which is where 18+ images expect it), `backend` (gunicorn),
  `frontend` (Next standalone). Ports are published on `127.0.0.1` only; the host's nginx
  (`deploy/nginx/fs.tnptm.top.conf`) is the public entry. Secrets come from `.env.prod` (template:
  `.env.prod.example`; the `!.env*.example` rule in `.gitignore` keeps the template committable).
- Images: `backend/Dockerfile` has build context = **repo root** (it needs `pyproject.toml` and `uv.lock`),
  targets `dev` and `prod` (non-root, `collectstatic` at build time, health check on `/api/health/`).
  `frontend/Dockerfile` has context `frontend/`. `BACKEND_URL` is a **build arg** for the prod frontend, since
  `next.config.ts` bakes the rewrite target into the build (`output: "standalone"`).
- Django receives `Host: backend` from the Next proxy, so `backend` is in the prod `ALLOWED_HOSTS`.
- Gunicorn for 1 vCPU / <= 2 GB: `backend/gunicorn.conf.py` (2 workers x 4 threads, `gthread`, `preload_app`,
  `max_requests` recycling, control socket disabled), started by `backend/scripts/start-prod.sh`
  (`migrate`, then gunicorn). Tune with `GUNICORN_WORKERS` / `GUNICORN_THREADS`. Containers have memory
  limits (db 384M, backend 384M, frontend 320M); PostgreSQL is tuned to match (see `compose.prod.yaml`).
- nginx **overwrites** `X-Forwarded-For` with the real client IP and the backend runs with
  `DJANGO_NUM_PROXIES=1` (see "Rate limiting & client IP"). nginx also rate-limits login/register/refresh.
- Backups: `deploy/backup-db.sh` (compressed `pg_dump`, keeps the newest N). Never run `down -v` in production.

## Conventions

- Next.js 16 differs from older versions (e.g. `proxy.ts` instead of `middleware.ts`, `cacheComponents`
  enabled). Read `frontend/AGENTS.md` and the bundled docs in `frontend/node_modules/next/dist/docs/`
  before writing frontend code.
- Client components that use `useSearchParams` must be wrapped in `<Suspense>` (needed with Cache Components).
- With Cache Components, visited pages stay mounted but hidden (`<Activity>`), so their state and DOM
  survive navigation. Reset transient state (`pending` flags, errors, password inputs) with
  `useResetOnHide` from `frontend/lib/useResetOnHide.ts`.
- Data models reference users via `settings.AUTH_USER_MODEL`. Scope every query to `request.user`
  (`UserOwnedMixin` in `tracker/views.py`) and assign `user` server-side in `perform_create`.
- Avoid `<input type="month">` (missing in Firefox). Use the `Switcher` component from `components/ui.tsx`.
- New backend features go in `tracker` (domain) or `accounts` (auth/users). Add tests in the app's `tests.py`,
  using `APIClient(enforce_csrf_checks=True)` to exercise the real cookie and CSRF flow. Call `cache.clear()`
  in `setUp` for throttled endpoints.
