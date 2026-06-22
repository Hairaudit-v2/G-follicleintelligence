import type { ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { assertFiPlatformAdminSystemAccess } from "@/src/lib/fiOs/fiOsPlatformSystemGate.server";

export const dynamic = "force-dynamic";

const PLATFORM_LINKS = [
  { href: "/fi-admin/platform/deployments", label: "Deployments" },
  { href: "/fi-admin/platform/onboarding", label: "Onboarding" },
  { href: "/fi-admin/system/tenants", label: "Tenants (legacy)" },
  { href: "/fi-admin/system", label: "System admin" },
] as const;

export default async function PlatformAdminLayout({ children }: { children: ReactNode }) {
  await assertFiPlatformAdminSystemAccess();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-3 py-6 sm:px-4 lg:flex-row lg:py-8">
      <nav
        className="w-full shrink-0 space-y-1 rounded-xl border border-white/[0.08] bg-[#060d18]/90 p-2 lg:w-56"
        aria-label="Platform administration"
      >
        <p className={cn(fiOsChromeClasses.sectionEyebrow, "px-2 pb-1 pt-1")}>Platform</p>
        {PLATFORM_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="block rounded-lg px-2 py-2 text-sm font-medium text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-100"
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="min-w-0 flex-1 space-y-6">{children}</div>
    </div>
  );
}
