/** @type {import('next').NextConfig} */
const corpHeaders = [
  { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
  { key: "Access-Control-Allow-Origin", value: "*" },
];

const nextConfig = {
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  async headers() {
    return [
      { source: "/evolved-logo.png", headers: corpHeaders },
      { source: "/icons/:path*", headers: corpHeaders },
      { source: "/brand/:path*", headers: corpHeaders },
      { source: "/:path*.png", headers: corpHeaders },
      { source: "/:path*.jpg", headers: corpHeaders },
      { source: "/:path*.jpeg", headers: corpHeaders },
      { source: "/:path*.gif", headers: corpHeaders },
      { source: "/:path*.webp", headers: corpHeaders },
      { source: "/:path*.svg", headers: corpHeaders },
      { source: "/:path*.ico", headers: corpHeaders },
      { source: "/:path*.avif", headers: corpHeaders },
      { source: "/_next/image", headers: corpHeaders },
    ];
  },
};

export default nextConfig;
