import { NextResponse, type NextRequest } from "next/server";

/**
 * Auth proxy — checks for our session cookie. No Supabase dependency.
 * If the cookie is missing on a protected route, redirect to /login.
 */
const PUBLIC_PATHS = ["/login"];

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublic =
    PUBLIC_PATHS.some((p) => path === p) ||
    path.startsWith("/_next") ||
    path.startsWith("/api/") || // API routes do their own auth; let them handle their 401s
    path.includes(".");

  if (isPublic) return NextResponse.next({ request });

  const cookie = request.cookies.get("folio_session");
  if (!cookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.).*)",
  ],
};
