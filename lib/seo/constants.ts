/** Canonical production origin for metadata, sitemaps, and JSON-LD. */
export const SITE_URL = "https://www.follicleintelligence.ai";

export const SITE_NAME = "Follicle Intelligence";

/**
 * Default social preview image — served by `app/opengraph-image.tsx` (1200×630).
 * Referenced as a root-relative path; resolved via `metadataBase` in the root layout.
 */
export const OG_IMAGE = {
  path: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Follicle Intelligence — The Operating System For The Future Of Hair Restoration",
} as const;

/** Sister brands in the FI ecosystem — used in llms.txt and Organization `sameAs`. */
export const ECOSYSTEM_SAME_AS = [
  "https://hairaudit.com",
  "https://hairlongevityinstitute.com",
  "https://iiohr.com",
] as const;
