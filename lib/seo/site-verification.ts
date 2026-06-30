import type { Metadata } from "next";

/**
 * Optional Search Console / Bing Webmaster verification tokens.
 * Set in Vercel Production after registering the property:
 * - GOOGLE_SITE_VERIFICATION — meta content value from Google Search Console
 * - BING_SITE_VERIFICATION — meta content value for msvalidate.01 from Bing Webmaster Tools
 */
export function buildSiteVerificationMetadata(): Metadata["verification"] | undefined {
  const google = process.env.GOOGLE_SITE_VERIFICATION?.trim().replace(/\s+/g, "") || undefined;
  const bing = process.env.BING_SITE_VERIFICATION?.trim().replace(/\s+/g, "") || undefined;

  if (!google && !bing) return undefined;

  return {
    ...(google && { google }),
    ...(bing && { other: { "msvalidate.01": bing } }),
  };
}
