/**
 * Lightweight JSON-LD structured data helpers for SEO.
 * Schema.org types: Organization, WebSite. Extend with AboutPage, FAQPage, Article, BreadcrumbList as needed.
 */

const SCHEMA_CONTEXT = "https://schema.org";

export interface OrganizationOptions {
  name?: string;
  logoPath?: string;
  sameAs?: string[];
}

/**
 * Build Organization schema (root or footer).
 */
export function buildOrganizationSchema(
  siteUrl: string,
  options: OrganizationOptions = {}
): object {
  const {
    name = "Follicle Intelligence",
    logoPath = "/brand/follicle-intelligence-logo-white.svg",
    sameAs = [
      "https://hairaudit.com",
      "https://hairlongevityinstitute.com",
      "https://iiohr.com",
    ],
  } = options;
  const base = siteUrl.replace(/\/$/, "");
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Organization",
    name,
    url: base,
    logo: `${base}${logoPath.startsWith("/") ? logoPath : `/${logoPath}`}`,
    sameAs,
  };
}

export interface WebSiteOptions {
  name?: string;
  description?: string;
}

/**
 * Build WebSite schema (root).
 */
export function buildWebSiteSchema(
  siteUrl: string,
  options: WebSiteOptions = {}
): object {
  const {
    name = "Follicle Intelligence",
    description = "Enterprise clinical auditing intelligence for hair and procedural medicine. Score, benchmark, and govern outcomes. The engine behind HairAudit and surgical quality systems.",
  } = options;
  const base = siteUrl.replace(/\/$/, "");
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "WebSite",
    name,
    url: base,
    ...(description && { description }),
  };
}

/**
 * Root layout: Organization + WebSite. Use with JsonLd component.
 */
export function getRootStructuredData(siteUrl: string): object[] {
  return [
    buildOrganizationSchema(siteUrl),
    buildWebSiteSchema(siteUrl),
  ];
}

/* Future extensions (add when needed):
 * - buildAboutPageSchema(siteUrl, options) -> @type: AboutPage
 * - buildFAQPageSchema(siteUrl, faqs: { q: string; a: string }[]) -> @type: FAQPage
 * - buildArticleSchema(options: { headline, datePublished, ... }) -> @type: Article
 * - buildBreadcrumbListSchema(items: { name: string; url: string }[]) -> @type: BreadcrumbList
 */
