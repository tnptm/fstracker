import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Optimistic auth check: only looks at whether the refresh cookie exists.
// Real validation happens in Django on every API call.
const REFRESH_COOKIE = "refresh_token";
// Login/register: only for signed-out visitors (signed-in users are sent home).
const GUEST_PATHS = ["/login", "/register"];
// Always reachable, signed in or not (legal information must stay readable).
const OPEN_PATHS = ["/privacy"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = request.cookies.has(REFRESH_COOKIE);
  const isGuestOnly = GUEST_PATHS.includes(pathname);

  if (OPEN_PATHS.includes(pathname)) return NextResponse.next();

  if (!hasSession && !isGuestOnly) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  if (hasSession && isGuestOnly) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Skip API calls (proxied to Django), Next internals and static files.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
