import type { Metadata } from "next";

import { FiOsWorkspaceEntryShell } from "@/src/components/fi-os/FiOsWorkspaceEntryShell";
import { resolveFiOsAuthUserEmail } from "@/src/lib/fiOs/fiOsAuthDisplay.server";
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
  const userEmail = await resolveFiOsAuthUserEmail();

  return <FiOsWorkspaceEntryShell userEmail={userEmail}>{children}</FiOsWorkspaceEntryShell>;
}
