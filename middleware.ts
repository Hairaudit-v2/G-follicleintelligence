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
    pathname.includes("evolved-logo") ||
    pathname.startsWith("/_next/image")
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  if (isStaticImageRequest(pathname)) {
    return withStaticImageHeaders(response);
  }

  return response;
}

export const config = {
  matcher: [
    "/_next/image",
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
