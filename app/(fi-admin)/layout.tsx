import type { Metadata } from "next";

import { DashboardShell } from "@/src/components/fi-admin/dashboard-ui";
import { FiOsWorkspacePickerChrome } from "@/src/components/fi-admin/shell/FiOsWorkspacePickerChrome";
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

  return (
    <DashboardShell>
      <FiOsWorkspacePickerChrome userEmail={userEmail}>{children}</FiOsWorkspacePickerChrome>
    </DashboardShell>
  );
}
