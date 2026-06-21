import type { Metadata } from "next";

import { SITE_SEO_DESCRIPTION, SITE_SEO_TITLE } from "@/lib/structured-data";

import { OG_IMAGE, SITE_NAME, SITE_URL } from "./constants";
import { buildSiteVerificationMetadata } from "./site-verification";

export type PageMetadataInput = {
  title: string;
  description: string;
  /** Root-relative path, e.g. `/platform` or `/`. */
  path?: string;
  imageAlt?: string;
  robots?: Metadata["robots"];
};

function canonicalUrl(path: string): string {
  if (path === "/") return SITE_URL;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Consistent title, description, canonical, Open Graph, and Twitter metadata for public pages.
 */
export function buildPageMetadata(input: PageMetadataInput): Metadata {
  const { title, description, path, imageAlt, robots } = input;
  const imageAltText = imageAlt ?? OG_IMAGE.alt;
  const canonical = path ? canonicalUrl(path) : undefined;

  return {
    title,
    description,
    ...(canonical && { alternates: { canonical } }),
    ...(robots && { robots }),
    openGraph: {
      title,
      description,
      siteName: SITE_NAME,
      type: "website",
      ...(canonical && { url: canonical }),
      images: [
        {
          url: OG_IMAGE.path,
          width: OG_IMAGE.width,
          height: OG_IMAGE.height,
          alt: imageAltText,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [OG_IMAGE.path],
    },
  };
}

/** Root layout defaults — merges site-wide fields with homepage social metadata. */
export function buildRootMetadata(): Metadata {
  const verification = buildSiteVerificationMetadata();

  return {
    metadataBase: new URL(SITE_URL),
    title: SITE_SEO_TITLE,
    description: SITE_SEO_DESCRIPTION,
    applicationName: SITE_NAME,
    manifest: "/site.webmanifest",
    ...(verification && { verification }),
    ...buildPageMetadata({
      title: SITE_SEO_TITLE,
      description: SITE_SEO_DESCRIPTION,
      path: "/",
    }),
  };
}