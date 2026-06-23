import bundleAnalyzer from "@next/bundle-analyzer";

/** @type {import('next').NextConfig} */
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  // Non-interactive: write HTML reports instead of opening a dev server (build exits).
  openAnalyzer: false,
  analyzerMode: "static",
});

// ---------------------------------------------------------------------------
// CORS: only public branding/static assets that legitimately need cross-origin
// access (logo, icons, brand kit). Patient images and other assets must NOT
// carry a wildcard ACAO header.
// ---------------------------------------------------------------------------
const brandingCorsHeaders = [
  { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
  { key: "Access-Control-Allow-Origin", value: "*" },
];

// ---------------------------------------------------------------------------
// Security headers applied to every page/API response.
// CSP uses 'unsafe-inline' for script-src because Next.js App Router emits
// inline hydration scripts that cannot be nonce-gated without additional
// server-side nonce injection. This will be tightened in a future pass once
// a nonce strategy is in place.
// ---------------------------------------------------------------------------
const securityHeaders = [
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Clickjacking protection (belt-and-suspenders with CSP frame-ancestors)
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Limit referrer information sent to third-party origins
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Restrict access to sensitive browser APIs
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // Content Security Policy
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // unsafe-inline required for Next.js App Router hydration scripts
      "script-src 'self' 'unsafe-inline' https://va.vercel-analytics.com https://vitals.vercel-insights.com https://vercel.live",
      // unsafe-inline required for Tailwind CSS-in-JS class injection
      "style-src 'self' 'unsafe-inline'",
      // Supabase storage URLs are HTTPS; data:/blob: needed for canvas/previews
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      // Supabase REST/Realtime and Vercel telemetry
      "connect-src 'self' https: wss:",
      "media-src 'self' blob:",
      "worker-src 'self' blob:",
      // Equivalent to X-Frame-Options: DENY; allows only same-origin frames
      "frame-ancestors 'self'",
      // Prevent form submissions to external origins
      "form-action 'self'",
      // Block <base> tag injection
      "base-uri 'self'",
    ].join("; "),
  },
];

// API routes return dynamic, user-specific data — never cache them at a CDN
// or browser level.
const apiNoCacheHeaders = [
  { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate" },
  { key: "Pragma", value: "no-cache" },
  { key: "Expires", value: "0" },
];

const nextConfig = {
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  async headers() {
    return [
      // --- Global security headers (all routes) ---
      { source: "/(.*)", headers: securityHeaders },

      // --- API: no-cache ---
      { source: "/api/(.*)", headers: apiNoCacheHeaders },

      // --- CORS: public branding assets ONLY ---
      // Any image not in this explicit list does NOT get Access-Control-Allow-Origin: *.
      { source: "/evolved-logo.png", headers: brandingCorsHeaders },
      { source: "/icons/:path*", headers: brandingCorsHeaders },
      { source: "/brand/:path*", headers: brandingCorsHeaders },

      // NOTE: The previous config applied CORS to every *.png, *.jpg, etc. path
      // and to /_next/image. That has been removed. Patient and clinical images
      // must not be embeddable from arbitrary origins.
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
