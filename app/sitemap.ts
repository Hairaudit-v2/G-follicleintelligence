import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/seo/constants";
import { PUBLIC_SITEMAP_PAGES } from "@/lib/seo/sitemap-pages";

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_SITEMAP_PAGES.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE_URL}${path === "/" ? "" : path}`,
    changeFrequency,
    priority,
  }));
}