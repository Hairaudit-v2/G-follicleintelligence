import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/seo/constants";

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
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}