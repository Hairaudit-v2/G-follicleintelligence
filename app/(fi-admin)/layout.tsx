import type { Metadata } from "next";

import { FiOsWorkspaceEntryShell } from "@/src/components/fi-os/FiOsWorkspaceEntryShell";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { resolveFiOsAuthUserEmail } from "@/src/lib/fiOs/fiOsAuthDisplay.server";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsPlatformAdminRole } from "@/src/lib/fiOs/fiOsRoles";
import { assertFiAdminShellAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "FI Admin",
};

export default async function FiAdminLayout({ children }: { children: React.ReactNode }) {
  await assertFiAdminShellAccess();
  const userEmail = await resolveFiOsAuthUserEmail();
  let showSystemAdminEntry = false;
  const authId = await resolveAuthUserId(null);
  if (authId) {
    const os = await loadFiOsIdentity(authId);
    showSystemAdminEntry = Boolean(os && isFiOsPlatformAdminRole(os.osRole));
  }

  return (
    <FiOsWorkspaceEntryShell userEmail={userEmail} showSystemAdminEntry={showSystemAdminEntry}>
      {children}
    </FiOsWorkspaceEntryShell>
  );
}
