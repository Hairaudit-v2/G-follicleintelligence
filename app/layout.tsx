import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";

import { HairEcosystemNav } from "@/components/layout/hair-ecosystem-nav";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

import "./globals.css";

export const metadata: Metadata = {
  title: "Follicle Intelligence | Clinical Auditing Intelligence Platform",
  description:
    "Enterprise clinical auditing and benchmarking intelligence software. HairAudit is the first application powered by the Follicle Intelligence engine.",
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
