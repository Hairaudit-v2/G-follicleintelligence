import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { CalendarSettingsSection } from "@/src/components/fi-admin/settings/CalendarSettingsSection";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { getCalendarSettingsAccess } from "@/src/lib/calendar/calendarSettingsAccess.server";
import { loadCalendarSettingsSectionData } from "@/src/lib/calendar/calendarSettings.server";

export const metadata = {
  title: "Calendar Settings",
  robots: { index: false, follow: false } as const,
};

export const dynamic = "force-dynamic";

export default async function CalendarSettingsPage({
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

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return (
      <InfoNotice variant="danger" title="Server misconfigured">
        <p className="text-sm">Supabase environment variables are missing.</p>
      </InfoNotice>
    );
  }

  const access = await getCalendarSettingsAccess(tenantId);
  if (!access.canView) notFound();

  const supabase = supabaseAdmin();
  const { data: tenant, error: te } = await supabase.from("fi_tenants").select("id").eq("id", tenantId).maybeSingle();
  if (te || !tenant) notFound();

  const sp = (await searchParams) ?? {};
  const rawClinic = sp.clinicId;
  const clinicIdParam = typeof rawClinic === "string" && rawClinic.trim() ? rawClinic.trim() : null;

  const sectionData = await loadCalendarSettingsSectionData(tenantId, clinicIdParam, access);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
          <Link href={`/fi-admin/${tenantId}/configuration`} className="text-[#22C1FF] hover:underline">
            Configuration
          </Link>{" "}
          / Calendar
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-[#F8FAFC] sm:text-2xl">Calendar settings</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#94A3B8]">
          Configure visible hours, slot size, default view, and display options for the operational calendar. Tenant defaults
          apply when no clinic override exists. You can also manage these from{" "}
          <Link href={`/fi-admin/${tenantId}/configuration?tab=calendar`} className="text-[#22C1FF] hover:underline">
            Configuration → Calendar
          </Link>
          .
        </p>
      </div>
      <CalendarSettingsSection
        tenantId={tenantId}
        clinicId={sectionData.clinicId}
        clinics={sectionData.clinics}
        initialSettings={sectionData.initialSettings}
        canEdit={sectionData.canEdit}
      />
    </div>
  );
}
