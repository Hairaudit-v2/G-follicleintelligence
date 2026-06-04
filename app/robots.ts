import type { MetadataRoute } from "next";

const BASE_URL = "https://www.follicleintelligence.ai";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/fi-admin",
          "/fi-admin/",
          "/api/",
          "/fi-login",
          "/follicle-intelligence/login",
          "/follicle-intelligence/forgot-password",
          "/follicle-intelligence/update-password",
          "/hair-audit",
          "/hair-audit/",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
