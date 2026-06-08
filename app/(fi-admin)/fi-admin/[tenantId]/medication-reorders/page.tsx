import { notFound } from "next/navigation";

import { MedicationReorderQueueClient } from "@/src/components/fi-admin/prescribing/MedicationReorderQueueClient";
import { FiCard } from "@/src/components/fi-design/FiCard";
import { FiPageHeader } from "@/src/components/fi-design/FiPageHeader";
import { loadMedicationReorderQueueForTenant } from "@/src/lib/medicationReorder/medicationReorderLoaders.server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Medication reorders",
  robots: { index: false, follow: false },
};

export default async function MedicationReordersAdminPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return <p className="text-sm text-red-600">Server misconfigured (Supabase).</p>;
  }

  const rows = await loadMedicationReorderQueueForTenant(tid);

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-6">
      <FiCard>
        <FiPageHeader
          titleId="med-reorder-heading"
          eyebrow="DoctorOS"
          title="Medication reorder requests"
          description="Review patient portal refills, approve or reject, then advance fulfilment statuses (pharmacy / posted / completed) as operations progress."
        />
      </FiCard>
      <FiCard>
        <MedicationReorderQueueClient tenantId={tid} rows={rows} />
      </FiCard>
    </div>
  );
}
