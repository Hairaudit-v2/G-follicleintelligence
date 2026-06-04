import type { Metadata } from "next";
import Link from "next/link";

import { fiOsSignOutAction } from "@/lib/actions/fi-os-auth-actions";
import { DashboardShell } from "@/src/components/fi-admin/dashboard-ui";
import { assertFiAdminShellAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "FI Admin",
};

export default async function FiAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertFiAdminShellAccess();

  return (
    <DashboardShell>
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-[#0F1629]/70 px-5 py-4 shadow-lg shadow-black/30 backdrop-blur-md">
        <div className="flex min-w-0 flex-wrap items-center gap-4">
          <Link
            href="/"
            className="text-sm text-[#94A3B8] transition hover:text-[#22C1FF] hover:underline decoration-[#22C1FF]/40"
          >
            ← Home
          </Link>
          <div className="h-8 w-px shrink-0 bg-white/[0.08]" aria-hidden />
          <div className="min-w-0">
            <h1 className="text-base font-semibold tracking-tight text-[#F8FAFC]">FI Admin</h1>
            <p className="text-xs text-[#64748B]">Internal admin · Hair Restoration OS</p>
          </div>
        </div>
        <form action={fiOsSignOutAction}>
          <button
            type="submit"
            className="rounded-lg border border-white/[0.1] bg-[#141C33]/80 px-4 py-2 text-sm font-medium text-[#94A3B8] transition hover:border-[#22C1FF]/35 hover:text-[#22C1FF]"
          >
            Sign out
          </button>
        </form>
      </header>
      {children}
    </DashboardShell>
  );
}
