import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { ClinicGuideSettingsSection } from "@/src/components/onboarding-os/ClinicGuideSettingsSection";
import { GuidedAssistUsagePanel } from "@/src/components/onboarding-os/GuidedAssistUsagePanel";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import {
  canViewGuidedAssistUsageSummary,
  loadGuidedAssistSettingsState,
} from "@/src/lib/onboarding-os/guidedAssist.server";

export const metadata = {
  title: "Clinic guide",
  robots: { index: false, follow: false } as const,
};

export const dynamic = "force-dynamic";

/**
 * Settings → Clinic Guide — personal on/off for every staff member;
 * admins get clinic-wide defaults + enable-for-all.
 */
export default async function ClinicGuideSettingsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  await assertFiTenantPortalAccess(tenantId);

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  ) {
    return (
      <InfoNotice variant="danger" title="Server misconfigured">
        <p className="text-sm">Supabase environment variables are missing.</p>
      </InfoNotice>
    );
  }

  const tid = tenantId.trim();
  const [settingsResult, showUsage] = await Promise.all([
    loadGuidedAssistSettingsState(tid),
    canViewGuidedAssistUsageSummary(tid),
  ]);

  if (!settingsResult.ok) {
    return (
      <div className="mx-auto max-w-[960px] px-3 pb-10 pt-2 sm:px-4">
        <InfoNotice variant="danger" title="Could not load Clinic guide settings">
          <p className="text-sm">{settingsResult.error}</p>
        </InfoNotice>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[960px] space-y-6 px-3 pb-10 pt-2 sm:px-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[#F8FAFC] sm:text-2xl">
          Clinic guide
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#94A3B8]">
          Control the floating day-of tips and empty-screen tours. Safe to turn off or on anytime —
          no impact on clinical charts or money records.
        </p>
      </div>

      <ClinicGuideSettingsSection tenantId={tid} initialState={settingsResult.state} />

      {showUsage ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0F1629]/75 p-4 shadow-lg shadow-black/25 backdrop-blur-md sm:p-5">
          <h2 className="text-sm font-semibold text-slate-100">Guide usage (admins)</h2>
          <p className="mt-1 text-xs text-slate-500">
            How often tips are shown, dismissed, or acted on in this clinic.
          </p>
          <div className="mt-3">
            <GuidedAssistUsagePanel tenantId={tid} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
