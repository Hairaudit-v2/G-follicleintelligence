import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CORP_HEADER = "Cross-Origin-Resource-Policy";
const CORP_VALUE = "cross-origin";

const STATIC_IMAGE_PATH =
  /\.(?:png|jpe?g|gif|webp|svg|ico|avif)$/i;

function withCrossOriginResourcePolicy(response: NextResponse): NextResponse {
  response.headers.set(CORP_HEADER, CORP_VALUE);
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isOptimizedImage = pathname.startsWith("/_next/image");
  const isStaticPublicAsset = STATIC_IMAGE_PATH.test(pathname);

  if (isOptimizedImage || isStaticPublicAsset) {
    return withCrossOriginResourcePolicy(NextResponse.next());
  }

  return NextResponse.next();
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
