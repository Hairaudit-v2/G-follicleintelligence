import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CrmLeadDetailPageView } from "@/src/components/fi/crm/detail/CrmLeadDetailPageView";
import { AppointmentSlideOverProvider } from "@/src/components/fi/appointments/AppointmentSlideOver";
import { leadTitleFromRow } from "@/src/lib/crm/crmLeadListDisplay";
import { parseCrmLeadDetailTab } from "@/src/lib/crm/crmLeadDetailTabs";
import { parseCrmLeadPreviewSearchParam } from "@/src/lib/crm/crmLeadPreviewQuery";
import { getCrmShellPageSession } from "@/src/lib/crm/crmShellAccess";
import { loadCrmShellLeadDetailPagePayload } from "@/src/lib/crm/crmShellLoaders";
import { loadClinicalStaffPickerOptions } from "@/src/lib/staff/clinicalStaffPickerLoader.server";
import { loadFiServicesForTenant } from "@/src/lib/services/fiServices.server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantId: string; leadId: string }>;
}): Promise<Metadata> {
  const { tenantId, leadId } = await params;
  const payload = await loadCrmShellLeadDetailPagePayload(tenantId, leadId);
  const lead = payload?.detail.lead;
  const title = lead ? leadTitleFromRow(lead.summary, lead.id) : "CRM lead";
  return {
    title: `${title} · CRM`,
    robots: { index: false, follow: false },
  };
}

export default async function CrmLeadShellPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string; leadId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantId, leadId } = await params;
  const session = await getCrmShellPageSession(tenantId);
  const sp = (await searchParams) ?? {};
  const previewLeadId = parseCrmLeadPreviewSearchParam(sp.preview);
  const activeTab = parseCrmLeadDetailTab(sp.tab);
  const [payload, services, clinicalStaffOptions] = await Promise.all([
    loadCrmShellLeadDetailPagePayload(tenantId, leadId),
    loadFiServicesForTenant(tenantId.trim()),
    loadClinicalStaffPickerOptions(tenantId.trim()),
  ]);
  if (!payload) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-6">
        <h1 className="text-lg font-semibold text-slate-100">Lead not found</h1>
        <p className="text-sm text-slate-400">
          No lead <code className="font-mono text-xs">{leadId}</code> for this tenant, or it was
          deleted.
        </p>
        <Link href={`/fi-admin/${tenantId}/crm`} className="text-sm text-blue-300 hover:underline">
          ← Leads
        </Link>
      </div>
    );
  }

  const groupingNowIso = new Date().toISOString();

  return (
    <AppointmentSlideOverProvider
      tenantId={tenantId}
      operatorFiUserId={session.fiUserId}
      userRole={session.role}
      canUseClinicFeatures={session.canUseClinicFeatures}
      assignees={clinicalStaffOptions}
      clinics={payload.detail.clinics}
      existingBookings={payload.detail.leadBookings}
      calendarTimezone={payload.calendarTimezone}
      services={services}
    >
      <Suspense
        fallback={
          <div
            className="mx-auto max-w-6xl animate-pulse space-y-4 py-6"
            aria-busy="true"
            aria-hidden
          />
        }
      >
        <CrmLeadDetailPageView
          tenantId={tenantId}
          leadId={leadId}
          initialPayload={payload}
          activeTab={activeTab}
          previewLeadId={previewLeadId}
          groupingNowIso={groupingNowIso}
          services={services}
          clinicalStaffOptions={clinicalStaffOptions}
        />
      </Suspense>
    </AppointmentSlideOverProvider>
  );
}
