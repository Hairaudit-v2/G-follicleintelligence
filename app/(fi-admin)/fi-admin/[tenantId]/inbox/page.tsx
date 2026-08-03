import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PendingApprovalsList } from "@/src/components/inbox/PendingApprovalsList";
import { FiPageHeader } from "@/src/components/fi-design/FiPageHeader";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { getCrmShellNavAllowed } from "@/src/lib/crm/crmShellAccess";

export const metadata: Metadata = {
  title: "Inbox",
  description:
    "Leads and contacts waiting for approval before they enter the clinic system.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Clinic inbox — staged leads/contacts awaiting explicit import into FI.
 * Path: /fi-admin/[tenantId]/inbox
 */
export default async function InboxPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  ) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <FiPageHeader
          variant="clinicLight"
          title="Inbox"
          description="Server misconfigured (Supabase)."
        />
      </div>
    );
  }

  await assertFiTenantPortalAccess(tid);
  const canMutate = await getCrmShellNavAllowed(tid);

  return (
    <div className="flex flex-col gap-6 p-6" data-testid="clinic-inbox-page">
      <FiPageHeader
        variant="clinicLight"
        title="Inbox"
        description="Leads and contacts waiting for approval before they enter the clinic system"
      />
      <PendingApprovalsList tenantId={tid} canMutate={canMutate} />
    </div>
  );
}
