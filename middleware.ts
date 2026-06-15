import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CORP_HEADER = "Cross-Origin-Resource-Policy";
const CORP_VALUE = "cross-origin";
const CORS_HEADER = "Access-Control-Allow-Origin";
const CORS_VALUE = "*";

const STATIC_IMAGE_PATH =
  /\.(?:png|jpe?g|gif|webp|svg|ico|avif)$/i;

function withStaticImageHeaders(response: NextResponse): NextResponse {
  response.headers.set(CORP_HEADER, CORP_VALUE);
  response.headers.set(CORS_HEADER, CORS_VALUE);
  return response;
}

function isStaticImageRequest(pathname: string): boolean {
  return (
    STATIC_IMAGE_PATH.test(pathname) ||
    pathname.includes("evolved-logo")
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();
  response.headers.set("x-pathname", pathname);

  if (isStaticImageRequest(pathname)) {
    return withStaticImageHeaders(response);
  }

  return response;
}

export const config = {
  /**
   * Matchers intentionally skip `/_next/static` and `/_next/image` in the catch-all so the
   * bundler and image optimizer do not pay middleware on every asset request. CORP/CORS for
   * `/_next/image` is applied in `next.config.mjs` `headers()` instead.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
    "/evolved-logo.png",
    "/brand/:path*",
    "/icons/:path*",
    "/:path*.png",
    "/:path*.jpg",
    "/:path*.jpeg",
    "/:path*.gif",
    "/:path*.webp",
    "/:path*.svg",
    "/:path*.ico",
    "/:path*.avif",
  ],
};
