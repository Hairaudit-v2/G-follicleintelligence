import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";

import { JsonLd } from "@/components/seo/json-ld";
import { FiPortalChromeGate } from "@/components/layout/FiPortalChromeGate";
import { getRootStructuredData } from "@/lib/structured-data";
import { PUBLIC_IMAGES } from "@/src/lib/brand/publicImages";

import "./globals.css";

const siteDescription =
  "Enterprise clinical auditing intelligence for scoring, benchmarking, governance, and white-label quality systems. HairAudit is the first application powered by the Follicle Intelligence engine.";

/** OG/Twitter image: production-safe fallback. Replace with /og.png (1200×630) when available for optimal social previews. */
const OG_IMAGE = PUBLIC_IMAGES.appleTouchIcon;

export const metadata: Metadata = {
  metadataBase: new URL("https://www.follicleintelligence.ai"),
  title: "Follicle Intelligence | Enterprise Clinical Audit Intelligence",
  description: siteDescription,
  applicationName: "Follicle Intelligence",
  manifest: "/site.webmanifest",
  openGraph: {
    title: "Follicle Intelligence | Enterprise Clinical Audit Intelligence",
    description: siteDescription,
    siteName: "Follicle Intelligence",
    type: "website",
    images: [
      {
        url: OG_IMAGE.src,
        width: OG_IMAGE.width,
        height: OG_IMAGE.height,
        alt: "Follicle Intelligence — Enterprise Clinical Audit Intelligence",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Follicle Intelligence | Enterprise Clinical Audit Intelligence",
    description: siteDescription,
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
      </body>
    </html>
  );
}
