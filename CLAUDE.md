# fstracker

Tracks voluntary (volunteer) work hours. Monorepo with two apps:

- `backend/` — Django 6 + Django REST Framework API (Python 3.15, managed with **uv** from the repo root).
- `frontend/` — Next.js 16 (App Router, React 19, Tailwind 4, TypeScript).

Status: only authentication (register / login / logout / session refresh) is implemented. The
`tracker` app has models (`Tracker`, `MontlyCourses`, `MonthlyHourGoal`) but no API yet.

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

## Configuration

`backend/.env` (gitignored, loaded by python-dotenv):

- `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`
- `DJANGO_CSRF_TRUSTED_ORIGINS`: comma-separated frontend origins (default `http://localhost:3000,http://localhost:3001`)
- `DJANGO_THROTTLE_REGISTER` (default `5/hour` per IP), `DJANGO_THROTTLE_REGISTER_GLOBAL` (default `100/hour` site-wide)
- `DJANGO_NUM_PROXIES` (default `0`): trusted proxies that append to `X-Forwarded-For`. See "Rate limiting & client IP".

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
`refresh/`, `logout/` (POST), `me/` (GET).

### Registration hardening (`RegisterView` / `RegisterSerializer`)

- CSRF token required. Per-IP and global throttles (`accounts/throttles.py`).
- Honeypot field `website`: hidden in the form; a non-empty value is rejected.
- `AUTH_PASSWORD_VALIDATORS` run with the candidate user (similarity check), plus a password confirmation.
- Username and email are unique case-insensitively, and email is lowercased. Only whitelisted fields are
  used, so `is_staff`/`is_superuser` can't be set. On success the user is logged in (cookies set, 201).

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
- `frontend/app/login/page.tsx` + `components/LoginForm.tsx`, `frontend/app/register/page.tsx` +
  `components/RegisterForm.tsx`, `components/UserPanel.tsx` (user + logout). Public (no-session) pages are
  listed in `PUBLIC_PATHS` in `proxy.ts`.

## Conventions

- Next.js 16 differs from older versions (e.g. `proxy.ts` instead of `middleware.ts`, `cacheComponents`
  enabled). Read `frontend/AGENTS.md` and the bundled docs in `frontend/node_modules/next/dist/docs/`
  before writing frontend code.
- Client components that use `useSearchParams` must be wrapped in `<Suspense>` (needed with Cache Components).
- With Cache Components, visited pages stay mounted but hidden (`<Activity>`), so their state and DOM
  survive navigation. Reset transient state (`pending` flags, errors, password inputs) with
  `useResetOnHide` from `frontend/lib/useResetOnHide.ts`.
- Data models reference users via `'auth.User'` FKs. Scope every query to `request.user`.
- New backend features go in `tracker` (domain) or `accounts` (auth/users). Add tests in the app's `tests.py`,
  using `APIClient(enforce_csrf_checks=True)` to exercise the real cookie and CSRF flow. Call `cache.clear()`
  in `setUp` for throttled endpoints.
