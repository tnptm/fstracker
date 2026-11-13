"use client";

// Client-side fetch wrapper for the Django API.
// - Auth tokens live in HTTP-only cookies; the browser sends them automatically.
// - Unsafe methods send the CSRF token from the `csrftoken` cookie.
// - On 401 it refreshes the access token once and retries; if refresh fails
//   the session is over and the user is sent to /login.

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export class ApiError extends Error {
  constructor(
    public status: number,
    public data: unknown,
  ) {
    super(`API error ${status}`);
  }
}

function readCookie(name: string): string | null {
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

async function csrfToken(): Promise<string> {
  let token = readCookie("csrftoken");
  if (!token) {
    await fetch("/api/auth/csrf", { credentials: "same-origin" });
    token = readCookie("csrftoken");
  }
  return token ?? "";
}

async function rawFetch(path: string, init: RequestInit = {}) {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (!SAFE_METHODS.has(method)) {
    headers.set("X-CSRFToken", await csrfToken());
  }
  return fetch(path, { ...init, method, headers, credentials: "same-origin" });
}

// Share one in-flight refresh between concurrent 401s, so a rotated refresh
// token isn't used twice (the second use would hit the blacklist).
let refreshing: Promise<boolean> | null = null;

export function refreshSession(): Promise<boolean> {
  refreshing ??= rawFetch("/api/auth/refresh", { method: "POST" })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let res = await rawFetch(path, init);

  if (res.status === 401) {
    if (await refreshSession()) {
      res = await rawFetch(path, init);
    } else {
      // Session is over: a full page load drops any in-memory client state.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(
        `/login?next=${encodeURIComponent(window.location.pathname)}`,
      );
      throw new ApiError(401, null);
    }
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

export type User = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  /** Has the user accepted the current privacy policy version? */
  privacy_accepted: boolean;
};

export async function login(username: string, password: string): Promise<User> {
  const res = await rawFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  return data as User;
}

export async function logout(): Promise<void> {
  await rawFetch("/api/auth/logout", { method: "POST" });
}

export type RegisterInput = {
  // No username or email: the server creates a random username (anonymous accounts).
  password: string;
  password_confirm: string;
  accept_privacy: boolean; // the privacy policy checkbox, must be true
  website: string; // honeypot, must stay empty
};

export async function register(input: RegisterInput): Promise<User> {
  const res = await rawFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  return data as User;
}

// --- Account & privacy (GDPR rights) ---------------------------------------

/** Removes an email stored from before sign-up became anonymous. */
export function removeEmail(): Promise<User> {
  return apiFetch<User>("/api/auth/me", {
    method: "PATCH",
    body: JSON.stringify({ email: "" }),
  });
}

/** Right to erasure: permanently deletes the account and all of its data. */
export function deleteAccount(password: string): Promise<null> {
  return apiFetch<null>("/api/auth/me", {
    method: "DELETE",
    body: JSON.stringify({ password }),
  });
}

/** Right of access / portability: all stored personal data as JSON. */
export function exportMyData(): Promise<unknown> {
  return apiFetch("/api/auth/me/export");
}

export function acceptPrivacyPolicy(): Promise<User> {
  return apiFetch<User>("/api/auth/privacy/accept", { method: "POST" });
}
