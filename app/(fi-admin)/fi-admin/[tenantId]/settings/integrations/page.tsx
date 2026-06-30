import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { GoogleCalendarInboundScopeCard } from "@/src/components/fi-admin/settings/GoogleCalendarInboundScopeCard";
import { GoogleCalendarIntegrationCard } from "@/src/components/fi-admin/settings/GoogleCalendarIntegrationCard";
import { GoogleCalendarMonitoringCard } from "@/src/components/fi-admin/settings/GoogleCalendarMonitoringCard";
import { GoogleCalendarSyncReviewCard } from "@/src/components/fi-admin/settings/GoogleCalendarSyncReviewCard";
import { ProviderCalendarLinksCard } from "@/src/components/fi-admin/settings/ProviderCalendarLinksCard";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { loadGoogleCalendarConnectionStatus } from "@/src/lib/googleCalendar/googleCalendarConnectionStatus.server";
import {
  assertGoogleCalendarTenantAdminAccess,
  GoogleCalendarIntegrationAccessError,
} from "@/src/lib/googleCalendar/googleCalendarIntegrationAccess.server";
import { loadGoogleCalendarInboundScopePage } from "@/src/lib/googleCalendar/googleCalendarInboundScope.server";
import { loadGoogleCalendarMonitoringPage } from "@/src/lib/googleCalendar/googleCalendarMonitoring.server";
import { loadGoogleCalendarSyncReviewPage } from "@/src/lib/googleCalendar/googleCalendarSyncReview.server";
import { loadProviderCalendarLinksPage } from "@/src/lib/googleCalendar/googleCalendarProviderLinks.server";
import { canViewTenantConfigurationHub } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";

export const metadata = {
  title: "Integrations",
  robots: { index: false, follow: false } as const,
};

export const dynamic = "force-dynamic";

function isGoogleCalendarOAuthConfigured(): boolean {
  const clientId = (
    process.env.GOOGLE_CALENDAR_CLIENT_ID ??
    process.env.GOOGLE_CLIENT_ID ??
    ""
  ).trim();
  const clientSecret = (
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET ??
    process.env.GOOGLE_CLIENT_SECRET ??
    ""
  ).trim();
  const redirectUri = (
    process.env.GOOGLE_CALENDAR_REDIRECT_URI ??
    process.env.GOOGLE_OAUTH_REDIRECT_URI ??
    ""
  ).trim();
  const masterKey = process.env.FI_EXTERNAL_CONNECTOR_MASTER_KEY?.trim();
  return Boolean(clientId && clientSecret && redirectUri && masterKey);
}

export default async function TenantIntegrationsSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ connected?: string; error?: string; reason?: string }>;
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

  const sp = await searchParams;
  const connectedFlash = sp.connected === "google-calendar";
  const errorFlash = sp.error === "google-calendar" ? (sp.reason ?? "unknown") : null;

  const googleCalendarStatus = await loadGoogleCalendarConnectionStatus(tenantId);
  const oauthConfigured = isGoogleCalendarOAuthConfigured();

  let canManageCalendarLinks = false;
  try {
    await assertGoogleCalendarTenantAdminAccess(tenantId);
    canManageCalendarLinks = true;
  } catch (e) {
    if (!(e instanceof GoogleCalendarIntegrationAccessError)) throw e;
  }

  const providerCalendarLinksPage = await loadProviderCalendarLinksPage(tenantId, {
    canManage: canManageCalendarLinks,
  });

  const inboundScopePage = await loadGoogleCalendarInboundScopePage(tenantId, {
    canManage: canManageCalendarLinks,
  });

  const syncReviewPage = await loadGoogleCalendarSyncReviewPage(tenantId, {
    canManage: canManageCalendarLinks,
    connected: inboundScopePage.connected,
    integrationId: inboundScopePage.integrationId,
  });

  const monitoringPage = await loadGoogleCalendarMonitoringPage(tenantId, {
    canManage: canManageCalendarLinks,
  });

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
          / <span className="text-[#CBD5E1]">Integrations</span>
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-[#F8FAFC] sm:text-2xl">
          Integrations
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#94A3B8]">
          Connect external systems to this clinic. OAuth secrets and tokens stay on the server —
          status only is shown here.
        </p>
      </div>

      <GoogleCalendarIntegrationCard
        tenantId={tenantId}
        initialStatus={googleCalendarStatus}
        oauthConfigured={oauthConfigured}
        connectedFlash={connectedFlash}
        errorFlash={errorFlash}
      />

      <GoogleCalendarInboundScopeCard tenantId={tenantId} pageModel={inboundScopePage} />

      <GoogleCalendarMonitoringCard tenantId={tenantId} pageModel={monitoringPage} />

      <GoogleCalendarSyncReviewCard tenantId={tenantId} pageModel={syncReviewPage} />

      <ProviderCalendarLinksCard tenantId={tenantId} pageModel={providerCalendarLinksPage} />

      <section className="rounded-xl border border-white/[0.08] bg-[#0a1424]/40 p-4 sm:p-5">
        <h2 className="text-base font-semibold text-[#F8FAFC]">Other integrations</h2>
        <ul className="mt-3 space-y-2 text-sm text-[#94A3B8]">
          <li>
            <Link
              href={`/fi-admin/${tenantId}/settings/integrations/timely`}
              className="text-[#22C1FF] hover:underline"
            >
              Timely · Zapier setup
            </Link>
            — webhook URLs and manual Timely wiring.
          </li>
          <li>
            <Link
              href={`/fi-admin/${tenantId}/settings/integrations/timely/discovery`}
              className="text-[#22C1FF] hover:underline"
            >
              Timely · Zapier discovery
            </Link>
            — raw payload capture for mapping work.
          </li>
        </ul>
      </section>
    </div>
  );
}
