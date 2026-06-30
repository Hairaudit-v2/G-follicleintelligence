import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { FoundationOsDashboard } from "@/src/components/fi-admin/foundation/FoundationOsDashboard";
import { loadFoundationOsDashboard } from "@/src/lib/fi/foundation/foundationOsDashboardRead.server";
import {
  loadIncompletePhotoProtocolSessionsForTenant,
  loadPhotoProtocolAnalyticsForTenant,
} from "@/src/lib/hair-intelligence/photoProtocols/photoProtocolAnalyticsLoader.server";
import { loadPhotoProtocolAlertEventsForTenant } from "@/src/lib/hair-intelligence/photoProtocols/protocolAlertEvents.server";
import { isFiOsPlatformAdminFullSessionBypass, resolveAuthUserId } from "@/src/lib/crm/crmGate";
import {
  buildPatientOsOverviewFallback,
  loadPatientOsOverview,
} from "@/src/lib/patients/patientOsDashboardLoader.server";

export const metadata = {
  title: "Patient Twin",
  description:
    "Unified patient identity, media, clinical timeline, and treatment history across FI OS.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FoundationIntegrityPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  const tid = tenantId.trim();

  const [data, patientOsResult, authUserId] = await Promise.all([
    loadFoundationOsDashboard(tid),
    loadPatientOsOverview(tid).catch(() => null),
    resolveAuthUserId(),
  ]);

  const patientOs =
    patientOsResult ??
    buildPatientOsOverviewFallback({
      totalPatients: data.twin_health.foundation_patients,
      activePatients: 0,
      withActiveCase: 0,
      withFutureBooking: 0,
    });

  const showDiagnosticsExpanded = authUserId
    ? await isFiOsPlatformAdminFullSessionBypass(authUserId)
    : false;

  let analytics: Awaited<ReturnType<typeof loadPhotoProtocolAnalyticsForTenant>> | null = null;
  let incomplete: Awaited<ReturnType<typeof loadIncompletePhotoProtocolSessionsForTenant>> = [];
  try {
    analytics = await loadPhotoProtocolAnalyticsForTenant(tid, {});
  } catch {
    analytics = null;
  }
  try {
    incomplete = await loadIncompletePhotoProtocolSessionsForTenant(tid, {});
  } catch {
    incomplete = [];
  }

  let alertEvents: Awaited<ReturnType<typeof loadPhotoProtocolAlertEventsForTenant>>["events"] = [];
  try {
    alertEvents = (await loadPhotoProtocolAlertEventsForTenant(tid, { limit: 200 })).events;
  } catch {
    alertEvents = [];
  }

  const photoProtocol = analytics
    ? {
        summary: analytics.summary,
        alerts: analytics.alerts,
        incomplete_sessions: incomplete.slice(0, 100),
        scan_note: analytics.scan_note,
        alert_events: alertEvents,
      }
    : null;

  return (
    <div className="mx-auto max-w-[88rem] min-w-0 px-1 sm:px-0">
      <FoundationOsDashboard
        tenantId={tid}
        data={data}
        patientOs={patientOs}
        photoProtocol={photoProtocol}
        showDiagnosticsExpanded={showDiagnosticsExpanded}
      />
    </div>
  );
}
