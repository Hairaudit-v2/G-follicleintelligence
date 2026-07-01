import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Shape of the cookie list passed to the Supabase SSR `setAll` callback.
type CookieToSet = { name: string; value: string; options?: CookieOptions };

// ---------------------------------------------------------------------------
// Branding assets: the ONLY paths that legitimately need CORS access from
// external origins (social embeds, partner widgets, etc.).
// ---------------------------------------------------------------------------
const BRANDING_PATH_RE = /^\/(?:evolved-logo\.png|icons(?:\/|$)|brand(?:\/|$))/;

function isBrandingPath(pathname: string): boolean {
  return BRANDING_PATH_RE.test(pathname);
}

function withBrandingCorsHeaders(response: NextResponse): NextResponse {
  response.headers.set("Cross-Origin-Resource-Policy", "cross-origin");
  response.headers.set("Access-Control-Allow-Origin", "*");
  return response;
}

// ---------------------------------------------------------------------------
// Staff PIN session cookie name — must match staffPinSession.server.ts.
// The PIN session allows clinic-floor staff to access a subset of /fi-admin
// routes without a full Supabase account. Middleware defers to the existing
// route-level PIN validation (getStaffPinClinicSessionIfValid) for this case.
// ---------------------------------------------------------------------------
const STAFF_PIN_COOKIE = "fi_staff_pin_session";

// ---------------------------------------------------------------------------
// Routes within /fi-admin/* that are intentionally public (no session required
// at the middleware layer). Route-level code applies additional checks.
// ---------------------------------------------------------------------------
function isFiAdminPublicSubpath(pathname: string): boolean {
  // Kiosk staff-PIN login page (no Supabase account required)
  if (pathname.includes("/staff-pin-login")) return true;
  return false;
}

// ---------------------------------------------------------------------------
// API routes that must not be gated by the middleware session check. These
// routes use their own auth mechanism (cron secrets, webhook signatures, etc.).
// ---------------------------------------------------------------------------
function isBypassedApiRoute(pathname: string): boolean {
  if (pathname.startsWith("/api/cron/")) return true;
  if (pathname.startsWith("/api/webhooks/")) return true;
  if (pathname.startsWith("/api/health/")) return true;
  if (pathname.startsWith("/api/fi-staff-pin/")) return true;
  if (pathname.startsWith("/api/nexus/")) return true;
  // Supabase auth callback
  if (pathname.startsWith("/api/auth/")) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Patient portal: public sign-in only at the middleware layer (production).
// ---------------------------------------------------------------------------
function isPatientPortalPublicSubpath(pathname: string): boolean {
  return /\/patient\/[^/]+\/sign-in\/?$/.test(pathname);
}

function extractPatientPortalTenantId(pathname: string): string | null {
  const m = /^\/patient\/([^/]+)/.exec(pathname);
  return m?.[1]?.trim() || null;
}

// ---------------------------------------------------------------------------
// Auth guard for /fi-admin/* routes (production only).
// This is a safety net — individual layouts call assertFiTenantPortalAccess()
// which performs full membership/role checks. The middleware guard ensures
// unauthenticated requests never reach the server component tree, regardless
// of whether a particular route remembered to call the portal gate.
// ---------------------------------------------------------------------------
async function applyFiAdminAuthGuard(
  request: NextRequest,
  pathname: string
): Promise<NextResponse | null> {
  // Mirror the existing server-side NODE_ENV guard so local development is
  // unaffected — auth is handled by assertFiTenantPortalAccess in each layout.
  if (process.env.NODE_ENV !== "production") return null;

  if (!pathname.startsWith("/fi-admin")) return null;
  if (isFiAdminPublicSubpath(pathname)) return null;

  // Staff PIN sessions are validated server-side in the layout; allow through.
  if (request.cookies.has(STAFF_PIN_COOKIE)) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    // Misconfigured environment: pass through so the server-side guard can
    // return a proper error rather than a confusing redirect.
    return null;
  }

  // Supabase SSR middleware pattern: refresh session cookies and verify JWT.
  let supabaseResponse = NextResponse.next({ request });
  supabaseResponse.headers.set("x-pathname", pathname);

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        // Propagate refreshed cookies to both the mutated request and response
        // so the refreshed session token reaches the server component tree.
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        supabaseResponse.headers.set("x-pathname", pathname);
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/follicle-intelligence/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // User is authenticated — return the (possibly cookie-refreshed) response.
  return supabaseResponse;
}

// ---------------------------------------------------------------------------
// Auth guard for /patient/* routes (production only).
// ---------------------------------------------------------------------------
async function applyPatientPortalAuthGuard(
  request: NextRequest,
  pathname: string
): Promise<NextResponse | null> {
  if (process.env.NODE_ENV !== "production") return null;
  if (!pathname.startsWith("/patient")) return null;
  if (isPatientPortalPublicSubpath(pathname)) return null;

  const tenantId = extractPatientPortalTenantId(pathname);
  if (!tenantId) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  let supabaseResponse = NextResponse.next({ request });
  supabaseResponse.headers.set("x-pathname", pathname);

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        supabaseResponse.headers.set("x-pathname", pathname);
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL(`/patient/${tenantId}/sign-in`, request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

// ---------------------------------------------------------------------------
// Middleware entry point
// ---------------------------------------------------------------------------
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Branding CORS: only the specific public branding paths.
  if (isBrandingPath(pathname)) {
    const response = NextResponse.next();
    response.headers.set("x-pathname", pathname);
    return withBrandingCorsHeaders(response);
  }

  // 2. Bypassed API routes: skip auth guard.
  if (isBypassedApiRoute(pathname)) {
    const response = NextResponse.next();
    response.headers.set("x-pathname", pathname);
    return response;
  }

  // 3. /fi-admin/* auth safety net.
  const adminGuardResult = await applyFiAdminAuthGuard(request, pathname);
  if (adminGuardResult) return adminGuardResult;

  // 4. /patient/* auth safety net.
  const patientGuardResult = await applyPatientPortalAuthGuard(request, pathname);
  if (patientGuardResult) return patientGuardResult;

  // 5. Default: forward with x-pathname header set.
  const response = NextResponse.next();
  response.headers.set("x-pathname", pathname);
  return response;
}

export const config = {
  /**
   * Run on all routes except Next.js internal static chunks and the image
   * optimizer. Security headers for /_next/image are applied in
   * next.config.mjs headers() instead (runs before middleware).
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
    "/evolved-logo.png",
    "/brand/:path*",
    "/icons/:path*",
  ],
};
