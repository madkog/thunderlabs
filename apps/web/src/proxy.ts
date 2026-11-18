import { NextResponse, type NextRequest } from "next/server";

// Set by the API on login (httpOnly). Must match AUTH_COOKIE in apps/api/src/auth/token.ts.
const AUTH_COOKIE = "token";

/**
 * Optimistic check: no login cookie means not logged in, so go straight to
 * /login instead of loading the page first. It doesn't verify the token, so
 * it's only a shortcut. The API checks the token on every request.
 *
 * /login is deliberately not redirected away from: an expired cookie would
 * otherwise bounce between / and /login.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has(AUTH_COOKIE)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/orders"],
};
