import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";

import { HairEcosystemNav } from "@/components/layout/hair-ecosystem-nav";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

import "./globals.css";

const siteDescription =
  "Enterprise clinical auditing intelligence for scoring, benchmarking, governance, and white-label quality systems. HairAudit is the first application powered by the Follicle Intelligence engine.";

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
  },
  twitter: {
    card: "summary_large_image",
    title: "Follicle Intelligence | Enterprise Clinical Audit Intelligence",
    description: siteDescription,
  },
};

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
        <HairEcosystemNav currentSite="follicleintelligence" />
        <Header />
        <main>{children}</main>
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
