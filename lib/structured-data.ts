/**
 * Lightweight JSON-LD structured data helpers for SEO.
 * Schema.org types: Organization, WebSite. Extend with AboutPage, FAQPage, Article, BreadcrumbList as needed.
 */

import { PUBLIC_IMAGE_PATHS } from "@/src/lib/brand/publicImages";

const SCHEMA_CONTEXT = "https://schema.org";

/** Canonical SEO title and meta description (root layout, homepage, JSON-LD WebSite). */
export const SITE_SEO_TITLE =
  "Follicle Intelligence | The Operating System For The Future Of Hair Restoration";

export const SITE_SEO_DESCRIPTION =
  "Follicle Intelligence unifies lead flow, clinical operations, intelligence layers, surgical planning, independent audit, training, analytics, and global outcome datasets—enterprise infrastructure for modern hair restoration.";

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
    logoPath = PUBLIC_IMAGE_PATHS.follicleLogoWhite,
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
    description = SITE_SEO_DESCRIPTION,
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
