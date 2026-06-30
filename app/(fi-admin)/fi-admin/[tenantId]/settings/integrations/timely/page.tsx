import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { TimelyZapierSetupGuide } from "@/src/components/fi-admin/settings/TimelyZapierSetupGuide";
import { loadTimelyZapierIntegrationSetup } from "@/src/lib/integrations/timely/timelyZapierIntegrationSetupLoader.server";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { resolveFiOsPublicOrigin } from "@/src/lib/fiOs/fiOsPublicOrigin.server";
import { canViewTenantConfigurationHub } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";

export const metadata = {
  title: "Timely (Zapier)",
  robots: { index: false, follow: false } as const,
};

export const dynamic = "force-dynamic";

export default async function TimelyZapierIntegrationSettingsPage({
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

  const [appOrigin, setup] = await Promise.all([
    resolveFiOsPublicOrigin(),
    loadTimelyZapierIntegrationSetup(tenantId),
  ]);

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
          / <span className="text-[#94A3B8]">Integrations</span> /{" "}
          <span className="text-[#CBD5E1]">Timely</span>
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-[#F8FAFC] sm:text-2xl">
          Timely · Zapier setup
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#94A3B8]">
          Internal guide for wiring Timely into FI OS via Zapier. Create Zaps that POST JSON to the
          tenant webhook URLs below using the shared bearer secret configured on the server (
          <code className="rounded bg-[#141C33] px-1.5 py-0.5 text-xs text-[#22C1FF]">
            FI_TIMELY_WEBHOOK_SECRET
          </code>
          ). This page is read-only. To capture raw Timely trigger payloads for mapping work, use{" "}
          <Link
            href={`/fi-admin/${tenantId}/settings/integrations/timely/discovery`}
            className="text-[#22C1FF] hover:underline"
          >
            Timely · Zapier discovery
          </Link>
          .
        </p>
      </div>

      {!setup.webhookSecretConfigured ? (
        <InfoNotice variant="warning" title="Webhook secret not set">
          <p className="text-sm">
            Set <code className="text-[#22C1FF]">FI_TIMELY_WEBHOOK_SECRET</code> in the deployment
            environment. Zapier requests will fail until it is configured.
          </p>
        </InfoNotice>
      ) : null}

      <TimelyZapierSetupGuide tenantId={tenantId} appOrigin={appOrigin} setup={setup} />
    </div>
  );
}
