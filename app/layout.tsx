import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { JsonLd } from "@/components/seo/json-ld";
import { FiPortalChromeGate } from "@/components/layout/FiPortalChromeGate";
import { getRootStructuredData, SITE_SEO_DESCRIPTION, SITE_SEO_TITLE } from "@/lib/structured-data";
import { PUBLIC_IMAGES } from "@/src/lib/brand/publicImages";

import "./globals.css";

/** OG/Twitter image: production-safe fallback. Replace with /og.png (1200×630) when available for optimal social previews. */
const OG_IMAGE = PUBLIC_IMAGES.appleTouchIcon;

export const metadata: Metadata = {
  metadataBase: new URL("https://www.follicleintelligence.ai"),
  title: SITE_SEO_TITLE,
  description: SITE_SEO_DESCRIPTION,
  applicationName: "Follicle Intelligence",
  manifest: "/site.webmanifest",
  openGraph: {
    title: SITE_SEO_TITLE,
    description: SITE_SEO_DESCRIPTION,
    siteName: "Follicle Intelligence",
    type: "website",
    images: [
      {
        url: OG_IMAGE.src,
        width: OG_IMAGE.width,
        height: OG_IMAGE.height,
        alt: "Follicle Intelligence — The Operating System For The Future Of Hair Restoration",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_SEO_TITLE,
    description: SITE_SEO_DESCRIPTION,
    images: [OG_IMAGE.src],
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#2aa8dc",
};

const SITE_URL = "https://www.follicleintelligence.ai";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen font-sans antialiased">
        <JsonLd data={getRootStructuredData(SITE_URL)} />
        <FiPortalChromeGate>{children}</FiPortalChromeGate>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
