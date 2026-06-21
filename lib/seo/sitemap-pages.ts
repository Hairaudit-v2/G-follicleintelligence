/**
 * Public marketing URLs included in /sitemap.xml.
 * Keep in sync with indexable routes linked from site navigation.
 */

export type SitemapPage = {
  path: string;
  priority: number;
  changeFrequency: "yearly" | "monthly" | "weekly";
};

export const PUBLIC_SITEMAP_PAGES: readonly SitemapPage[] = [
  { path: "/", priority: 1, changeFrequency: "monthly" },
  { path: "/platform", priority: 0.9, changeFrequency: "monthly" },
  { path: "/platform/ecosystem", priority: 0.88, changeFrequency: "monthly" },
  { path: "/platform/progress", priority: 0.8, changeFrequency: "weekly" },
  { path: "/platform/surgery-os", priority: 0.86, changeFrequency: "monthly" },
  { path: "/platform/patient-os", priority: 0.86, changeFrequency: "monthly" },
  { path: "/platform/leadflow", priority: 0.86, changeFrequency: "monthly" },
  { path: "/platform/imaging-os", priority: 0.86, changeFrequency: "monthly" },
  { path: "/platform/clinic-os", priority: 0.86, changeFrequency: "monthly" },
  { path: "/platform/analytics-os", priority: 0.86, changeFrequency: "monthly" },
  { path: "/patient-twin", priority: 0.88, changeFrequency: "monthly" },
  { path: "/technology", priority: 0.88, changeFrequency: "monthly" },
  { path: "/surgeons", priority: 0.85, changeFrequency: "monthly" },
  { path: "/clinic-owners", priority: 0.85, changeFrequency: "monthly" },
  { path: "/enterprise", priority: 0.85, changeFrequency: "monthly" },
  { path: "/academy", priority: 0.85, changeFrequency: "monthly" },
  { path: "/audit-network", priority: 0.85, changeFrequency: "monthly" },
  { path: "/intelligence", priority: 0.85, changeFrequency: "monthly" },
  { path: "/demo", priority: 0.9, changeFrequency: "monthly" },
  { path: "/pricing", priority: 0.88, changeFrequency: "monthly" },
  { path: "/solutions", priority: 0.9, changeFrequency: "monthly" },
  { path: "/hair-intelligence", priority: 0.9, changeFrequency: "monthly" },
  { path: "/ai-hair-transplant-analysis", priority: 0.85, changeFrequency: "monthly" },
  { path: "/white-label", priority: 0.9, changeFrequency: "monthly" },
  { path: "/methodology", priority: 0.8, changeFrequency: "yearly" },
  { path: "/about", priority: 0.8, changeFrequency: "monthly" },
  { path: "/why-follicle-intelligence", priority: 0.78, changeFrequency: "monthly" },
  { path: "/the-future-of-hair-restoration", priority: 0.78, changeFrequency: "monthly" },
  { path: "/vision", priority: 0.75, changeFrequency: "monthly" },
  { path: "/research", priority: 0.75, changeFrequency: "monthly" },
  { path: "/partners", priority: 0.78, changeFrequency: "monthly" },
  { path: "/investors", priority: 0.75, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.9, changeFrequency: "monthly" },
  { path: "/dashboard-demo", priority: 0.7, changeFrequency: "monthly" },
  { path: "/future-verticals", priority: 0.7, changeFrequency: "monthly" },
  { path: "/modules", priority: 0.7, changeFrequency: "monthly" },
  { path: "/integration", priority: 0.7, changeFrequency: "monthly" },
  { path: "/security", priority: 0.7, changeFrequency: "monthly" },
  { path: "/licensing", priority: 0.7, changeFrequency: "monthly" },
  { path: "/use-cases", priority: 0.8, changeFrequency: "monthly" },
] as const;

/** Paths that must appear in the sitemap because they are linked from public nav/footer. */
export const NAV_FOOTER_PATHS_REQUIRED_IN_SITEMAP: readonly string[] = [
  "/technology",
  "/platform/ecosystem",
  "/platform/progress",
  "/platform/surgery-os",
  "/platform/patient-os",
  "/platform/leadflow",
  "/platform/imaging-os",
  "/platform/clinic-os",
  "/platform/analytics-os",
  "/research",
  "/partners",
  "/investors",
  "/why-follicle-intelligence",
  "/the-future-of-hair-restoration",
  "/pricing",
  "/patient-twin",
];

export function getSitemapPaths(): string[] {
  return PUBLIC_SITEMAP_PAGES.map((page) => page.path);
}