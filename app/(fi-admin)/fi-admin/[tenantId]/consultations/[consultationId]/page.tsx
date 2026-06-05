import { notFound } from "next/navigation";

import { ConsultationOsEditPage } from "@/src/components/fi-admin/consultations/ConsultationOsEditPage";
import { loadConsultationForTenant } from "@/src/lib/consultations/consultationLoaders.server";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";

export const metadata = {
  title: "Consultation",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ConsultationOsEditRoutePage({
  params,
}: {
  params: Promise<{ tenantId: string; consultationId: string }>;
}) {
  const { tenantId, consultationId } = await params;
  if (!tenantId?.trim() || !consultationId?.trim()) notFound();

  await assertFiTenantPortalAccess(tenantId);

  const row = await loadConsultationForTenant(tenantId, consultationId);
  if (!row) notFound();

  return (
    <ConsultationOsEditPage tenantId={tenantId.trim()} consultationId={consultationId.trim()} initialRow={row} />
  );
}
