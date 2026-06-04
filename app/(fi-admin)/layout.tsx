import type { Metadata } from "next";
import Link from "next/link";

import { fiOsSignOutAction } from "@/lib/actions/fi-os-auth-actions";
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
    <div className="min-h-screen bg-gray-50 p-4 font-sans">
      <header className="mb-6 border-b border-gray-200 pb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/" className="text-sm text-gray-500 hover:underline">
            ← Home
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">FI Admin</h1>
          <p className="text-sm text-gray-500">Internal admin only</p>
        </div>
        <form action={fiOsSignOutAction}>
          <button type="submit" className="text-sm text-gray-600 underline hover:text-gray-900">
            Sign out
          </button>
        </form>
      </header>
      {children}
    </div>
  );
}
