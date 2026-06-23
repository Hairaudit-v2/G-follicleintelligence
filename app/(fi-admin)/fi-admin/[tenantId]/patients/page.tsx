import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { PatientOsDashboard } from "@/src/components/fi-admin/patients/PatientOsDashboard";
import { PatientOsListView } from "@/src/components/fi-admin/patients/PatientOsListView";
import { getBookingsBoardNavAllowed } from "@/src/lib/crm/crmShellAccess";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { canViewDashboardSystemDiagnostics } from "@/src/lib/fi-os/dashboardSystemDiagnosticsAccess.server";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { loadPatientDirectoryPage } from "@/src/lib/patients/patientDirectoryLoader";
import {
  buildPatientOsOverviewFallback,
  loadPatientOsOverview,
} from "@/src/lib/patients/patientOsDashboardLoader.server";
import { parsePatientDirectoryQuery } from "@/src/lib/patients/patientDirectoryQuery";

export const metadata = {
  title: "PatientOS",
  description:
    "Patient journey coordination across consultations, treatment planning, surgery, follow-up, media, and outcomes.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function parseViewMode(sp: Record<string, string | string[] | undefined>): "workspace" | "list" {
  const raw = sp.view;
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v?.trim().toLowerCase() === "list" ? "list" : "workspace";
}

function directoryQueryHasListFilters(query: ReturnType<typeof parsePatientDirectoryQuery>): boolean {
  return (
    Boolean(query.search.trim()) ||
    query.patientStatus != null ||
    query.hasActiveCase != null ||
    query.hasFutureBooking != null ||
    query.norwoodMin != null ||
    query.norwoodMax != null ||
    query.lastVisitFrom != null ||
    query.lastVisitTo != null ||
    query.leadSource != null ||
    query.page > 1 ||
    query.sort !== "created_desc" ||
    query.pageSize !== 25
  );
}

export default async function PatientsHomeRoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  const tid = tenantId.trim();
  const sp = (await searchParams) ?? {};
  const viewMode = parseViewMode(sp);
  const query = parsePatientDirectoryQuery(sp);

  if (viewMode === "list" || directoryQueryHasListFilters(query)) {
    const [data, showBookingsBoard] = await Promise.all([
      loadPatientDirectoryPage(tid, query),
      getBookingsBoardNavAllowed(tid),
    ]);
    return <PatientOsListView tenantId={tid} data={data} showBookingsBoard={showBookingsBoard} />;
  }

  const [data, showBookingsBoard, showDiagnosticsExpanded, authId] = await Promise.all([
    loadPatientDirectoryPage(tid, query),
    getBookingsBoardNavAllowed(tid),
    canViewDashboardSystemDiagnostics(tid),
    resolveAuthUserId(null),
  ]);

  let overview;
  try {
    overview = await loadPatientOsOverview(tid, { summary: data.summary });
  } catch {
    overview = buildPatientOsOverviewFallback(data.summary);
  }

  const os = authId ? await loadFiOsIdentity(authId) : null;
  const sessionLabel = os?.osRole ?? undefined;

  return (
    <PatientOsDashboard
      tenantId={tid}
      overview={overview}
      summary={data.summary}
      showBookingsBoard={showBookingsBoard}
      showDiagnosticsExpanded={showDiagnosticsExpanded}
      sessionLabel={sessionLabel}
    />
  );
}
