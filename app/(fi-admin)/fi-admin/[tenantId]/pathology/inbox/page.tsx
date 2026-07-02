import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PathologyResultsInboxClient } from "@/src/components/fi-admin/pathology/PathologyResultsInboxClient";
import { SectionHeader } from "@/src/components/fi-admin/dashboard-ui/SectionHeader";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { loadPathologyInboxDocuments } from "@/src/lib/pathology/pathologyInboxLoad.server";
import { readPathologyExtractionEnabled } from "@/src/lib/pathology/pathologyExtractionEnv.server";
import { isPathologyEmailIngestionEnabledFromEnv } from "@/src/lib/pathology/email/pathologyEmailIngestionEnv";
import { getPaymentRecordMutationCapability } from "@/src/lib/payments/paymentRecordAccess.server";

export const metadata: Metadata = {
  title: "Pathology · Results inbox",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PathologyResultsInboxPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return <p className="text-sm text-rose-300">Server misconfigured (Supabase).</p>;
  }

  await assertFiTenantPortalAccess(tid);

  const [documents, { canMutate }] = await Promise.all([
    loadPathologyInboxDocuments(tid),
    getPaymentRecordMutationCapability(tid),
  ]);
  const extractionEnabled = readPathologyExtractionEnabled();
  const emailIngestionEnabled = isPathologyEmailIngestionEnabledFromEnv();

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Pathology"
        title="Pathology results inbox"
        description="Tenant-level queue for inbound lab PDFs before patient matching. Confirm a match, then promote into the patient pathology record."
      />
      <PathologyResultsInboxClient
        tenantId={tid}
        initialDocuments={documents}
        canMutate={canMutate}
        extractionEnabled={extractionEnabled}
        emailIngestionEnabled={emailIngestionEnabled}
      />
    </div>
  );
}
