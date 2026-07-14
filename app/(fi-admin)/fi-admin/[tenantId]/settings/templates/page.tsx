import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import {
  TemplatesHubClient,
  type TemplatesHubTabId,
} from "@/src/components/fi-admin/settings/TemplatesHubClient";
import {
  ensureDefaultDocumentTemplatesForTenant,
  loadDocumentTemplatesForTenant,
} from "@/src/lib/documentTemplates/documentTemplates.server";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { loadReceptionCommunicationTemplatesForTenant } from "@/src/lib/receptionOs/receptionCommunicationTemplates.server";
import { loadReminderTemplatesForTenant } from "@/src/lib/reminders/reminderTemplates.server";
import { canAccessTenantReminderSettings } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";

export const dynamic = "force-dynamic";

function parseTab(raw: string | string[] | undefined): TemplatesHubTabId {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "commercial" || v === "documents" || v === "booking") return v;
  return "booking";
}

export default async function TenantTemplatesSettingsPage({
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
  if (!(await canAccessTenantReminderSettings(tenantId))) {
    notFound();
  }

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

  const sp = searchParams ? await searchParams : {};
  const initialTab = parseTab(sp?.tab);

  const supabase = supabaseAdmin();
  const { data: tenant, error: te } = await supabase
    .from("fi_tenants")
    .select("id")
    .eq("id", tenantId)
    .maybeSingle();
  if (te || !tenant) notFound();

  await ensureDefaultDocumentTemplatesForTenant(tenantId);

  const [reminderTemplates, receptionTemplates, documentTemplates] = await Promise.all([
    loadReminderTemplatesForTenant(tenantId),
    loadReceptionCommunicationTemplatesForTenant(tenantId),
    loadDocumentTemplatesForTenant(tenantId),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
          <Link
            href={`/fi-admin/${tenantId}/configuration`}
            className="text-[#22C1FF] hover:underline"
          >
            Configuration
          </Link>{" "}
          / Templates
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-[#F8FAFC] sm:text-2xl">
          Clinic templates
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#94A3B8]">
          One place for booking messages, invoice payment reminders, front-desk commercial
          SMS/email, and long-form sales terms &amp; invoice documents. Booking triggers still
          enqueue through the reminder job queue when patient consent is on; invoice copy is ready
          for AR / payment reminder flows.
        </p>
      </div>

      <TemplatesHubClient
        tenantId={tenantId}
        initialTab={initialTab}
        reminderTemplates={reminderTemplates}
        receptionTemplates={receptionTemplates}
        documentTemplates={documentTemplates}
      />
    </div>
  );
}
