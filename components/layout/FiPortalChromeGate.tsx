"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { HairEcosystemNav } from "@/components/layout/hair-ecosystem-nav";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

function isFiAdminPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === "/fi-admin" || pathname.startsWith("/fi-admin/");
}

function isMarketingBareShell(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === "/fi-login") return true;
  if (pathname.startsWith("/follicle-intelligence/login")) return true;
  if (pathname.startsWith("/follicle-intelligence/forgot-password")) return true;
  if (pathname.startsWith("/follicle-intelligence/update-password")) return true;
  if (pathname.startsWith("/hair-audit")) return true;
  return false;
}

/**
 * Marketing site chrome is hidden on FI Admin, FI OS auth, and HairAudit hub routes so they read as dedicated portal shells.
 */
export function FiPortalChromeGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (isFiAdminPath(pathname)) {
    return <>{children}</>;
  }
  if (isMarketingBareShell(pathname)) {
    return <div className="min-h-screen bg-slate-950 text-slate-100">{children}</div>;
  }
  return (
    <>
      <HairEcosystemNav currentSite="follicleintelligence" />
      <Header />
      <main>{children}</main>
      <Footer />
    </>
  );
}
