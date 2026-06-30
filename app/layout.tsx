import type { Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { JsonLd } from "@/components/seo/json-ld";
import { FiPortalChromeGate } from "@/components/layout/FiPortalChromeGate";
import { buildRootMetadata } from "@/lib/seo/page-metadata";
import { SITE_URL } from "@/lib/seo/constants";
import { getRootStructuredData } from "@/lib/structured-data";

import "./globals.css";

export const metadata = buildRootMetadata();

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#2aa8dc",
};

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
