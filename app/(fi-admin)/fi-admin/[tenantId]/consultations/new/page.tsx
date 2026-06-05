import { notFound } from "next/navigation";

import { ConsultationOsCreatePage } from "@/src/components/fi-admin/consultations/ConsultationOsCreatePage";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";

export const metadata = {
  title: "New consultation",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ConsultationOsNewRoutePage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  await assertFiTenantPortalAccess(tenantId);

  return <ConsultationOsCreatePage tenantId={tenantId} />;
}
