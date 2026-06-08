import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { ReminderTemplatesSection } from "@/src/components/fi-admin/settings/ReminderTemplatesSection";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { loadReminderTemplatesForTenant } from "@/src/lib/reminders/reminderTemplates.server";
import { canAccessTenantReminderSettings } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";

export const dynamic = "force-dynamic";

export default async function TenantReminderSettingsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  await assertFiTenantPortalAccess(tenantId);
  if (!(await canAccessTenantReminderSettings(tenantId))) {
    notFound();
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return (
      <InfoNotice variant="danger" title="Server misconfigured">
        <p className="text-sm">Supabase environment variables are missing.</p>
      </InfoNotice>
    );
  }

  const supabase = supabaseAdmin();
  const { data: tenant, error: te } = await supabase.from("fi_tenants").select("id").eq("id", tenantId).maybeSingle();
  if (te || !tenant) notFound();

  const templates = await loadReminderTemplatesForTenant(tenantId);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
          <Link href={`/fi-admin/${tenantId}/configuration`} className="text-[#22C1FF] hover:underline">
            Configuration
          </Link>{" "}
          / Reminders
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-[#F8FAFC] sm:text-2xl">Reminder templates</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#94A3B8]">
          Tenant-scoped SMS and email templates with merge fields. When a patient has{" "}
          <span className="text-[#CBD5E1]">reminder consent</span> on their profile, booking create/update rebuilds the
          pending job queue (48h / 24h / immediate acknowledgement).{" "}
          <span className="text-[#CBD5E1]">Lead created</span> and{" "}
          <span className="text-[#CBD5E1]">post-consult</span> triggers enqueue from CRM and ConsultationOS (completed)
          respectively. Delivery is stubbed until ESP/SMS wiring; process jobs with the cron API using{" "}
          <code className="rounded bg-[#141C33] px-1.5 py-0.5 text-xs text-[#22C1FF]">FI_REMINDER_CRON_SECRET</code>.
        </p>
      </div>
      <ReminderTemplatesSection tenantId={tenantId} initialTemplates={templates} />
    </div>
  );
}
