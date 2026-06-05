import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { ConsultationOsIndexPage } from "@/src/components/fi-admin/consultations/ConsultationOsIndexPage";
import { listConsultationsForTenant } from "@/src/lib/consultations/consultationLoaders.server";
import { CONSULTATION_STATUSES, type ConsultationStatus } from "@/src/lib/consultations/consultationTypes";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";

export const metadata = {
  title: "Consultations",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function parseStatusFilter(sp: Record<string, string | string[] | undefined>): ConsultationStatus | null {
  const raw = sp.status;
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (!s?.trim()) return null;
  const v = s.trim() as ConsultationStatus;
  return (CONSULTATION_STATUSES as readonly string[]).includes(v) ? v : null;
}

export default async function ConsultationsIndexRoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  await assertFiTenantPortalAccess(tenantId);

  const sp = (await searchParams) ?? {};
  const statusFilter = parseStatusFilter(sp);
  const rows = await listConsultationsForTenant(tenantId.trim(), statusFilter ? { status: statusFilter } : {});

  return <ConsultationOsIndexPage tenantId={tenantId.trim()} rows={rows} activeStatus={statusFilter} />;
}
