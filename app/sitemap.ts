import type { MetadataRoute } from "next";

const BASE_URL = "https://www.follicleintelligence.ai";

const STATIC_PAGES: { path: string; priority: number; changeFrequency: "yearly" | "monthly" | "weekly" }[] = [
  { path: "/", priority: 1, changeFrequency: "monthly" },
  { path: "/platform", priority: 0.9, changeFrequency: "monthly" },
  { path: "/solutions", priority: 0.9, changeFrequency: "monthly" },
  { path: "/hair-intelligence", priority: 0.9, changeFrequency: "monthly" },
  { path: "/ai-hair-transplant-analysis", priority: 0.85, changeFrequency: "monthly" },
  { path: "/white-label", priority: 0.9, changeFrequency: "monthly" },
  { path: "/methodology", priority: 0.8, changeFrequency: "yearly" },
  { path: "/about", priority: 0.8, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.9, changeFrequency: "monthly" },
  { path: "/dashboard-demo", priority: 0.7, changeFrequency: "monthly" },
  { path: "/future-verticals", priority: 0.7, changeFrequency: "monthly" },
  { path: "/modules", priority: 0.7, changeFrequency: "monthly" },
  { path: "/integration", priority: 0.7, changeFrequency: "monthly" },
  { path: "/security", priority: 0.7, changeFrequency: "monthly" },
  { path: "/licensing", priority: 0.7, changeFrequency: "monthly" },
  { path: "/use-cases", priority: 0.8, changeFrequency: "monthly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return STATIC_PAGES.map(({ path, priority, changeFrequency }) => ({
    url: `${BASE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));
}
