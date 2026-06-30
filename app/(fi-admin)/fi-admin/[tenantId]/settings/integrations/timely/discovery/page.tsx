import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { TimelyDiscoveryInspector } from "@/src/components/fi-admin/settings/TimelyDiscoveryInspector";
import { loadRecentTimelyIntegrationWebhookEvents } from "@/src/lib/integrations/timely/timelyWebhookEvents.server";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { resolveFiOsPublicOrigin } from "@/src/lib/fiOs/fiOsPublicOrigin.server";
import { canViewTenantConfigurationHub } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";

export const metadata = {
  title: "Timely · Discovery",
  robots: { index: false, follow: false } as const,
};

export const dynamic = "force-dynamic";

export default async function TimelyDiscoverySettingsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  await assertFiTenantPortalAccess(tenantId);
  if (!(await canViewTenantConfigurationHub(tenantId))) {
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

  const supabase = supabaseAdmin();
  const { data: tenant, error: te } = await supabase
    .from("fi_tenants")
    .select("id")
    .eq("id", tenantId)
    .maybeSingle();
  if (te || !tenant) notFound();

  const [appOrigin, events] = await Promise.all([
    resolveFiOsPublicOrigin(),
    loadRecentTimelyIntegrationWebhookEvents(tenantId, 20, supabase),
  ]);
  const origin = appOrigin.replace(/\/+$/, "");
  const webhookUrl = `${origin}/api/tenants/${tenantId}/integrations/timely/discovery`;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
          <Link
            href={`/fi-admin/${tenantId}/configuration`}
            className="text-[#22C1FF] hover:underline"
          >
            Settings
          </Link>{" "}
          /{" "}
          <Link
            href={`/fi-admin/${tenantId}/settings/integrations/timely`}
            className="text-[#22C1FF] hover:underline"
          >
            Integrations · Timely
          </Link>{" "}
          / <span className="text-[#CBD5E1]">Discovery</span>
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-[#F8FAFC] sm:text-2xl">
          Timely · Zapier discovery
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#94A3B8]">
          Temporary inbox for raw Timely trigger payloads. Does not create patients or bookings.
          Remove or harden before production traffic at scale.
        </p>
      </div>

      {!process.env.FI_TIMELY_WEBHOOK_SECRET?.trim() ? (
        <InfoNotice variant="warning" title="Webhook secret not set">
          <p className="text-sm">
            Set <code className="text-[#22C1FF]">FI_TIMELY_WEBHOOK_SECRET</code> in the deployment
            environment. Zapier requests will fail until it is configured (required in production).
          </p>
        </InfoNotice>
      ) : null}

      <TimelyDiscoveryInspector webhookUrl={webhookUrl} events={events} />
    </div>
  );
}
