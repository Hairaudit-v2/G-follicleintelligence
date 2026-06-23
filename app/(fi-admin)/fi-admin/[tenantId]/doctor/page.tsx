import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { DoctorWorkspaceHome } from "@/src/components/fi-admin/doctor-workspace/DoctorWorkspaceHome";
import { canViewDashboardSystemDiagnostics } from "@/src/lib/fi-os/dashboardSystemDiagnosticsAccess.server";
import { casePersonDisplayFromMetadata } from "@/src/lib/cases/caseLabels";
import { assertBookingsOperatorPageAccess, getCrmShellNavAllowed } from "@/src/lib/crm/crmShellAccess";
import { loadDoctorWorkspace } from "@/src/lib/doctorOs/doctorWorkspaceLoader.server";
import { loadRecentPrescriptionsForTenant } from "@/src/lib/prescribing/fiPrescribingLoaders.server";

export const dynamic = "force-dynamic";

async function loadPatientLabels(tenantId: string, patientIds: string[]): Promise<Map<string, string>> {
  const uniq = Array.from(new Set(patientIds.filter(Boolean)));
  const map = new Map<string, string>();
  if (uniq.length === 0) return map;
  const supabase = supabaseAdmin();
  const { data: pRows, error: pe } = await supabase
    .from("fi_patients")
    .select("id, person_id")
    .eq("tenant_id", tenantId.trim())
    .in("id", uniq);
  if (pe || !pRows?.length) return map;

  const personIds = Array.from(new Set(pRows.map((r) => String((r as { person_id: string }).person_id))));
  const { data: personRows, error: e2 } = await supabase
    .from("fi_persons")
    .select("id, metadata")
    .eq("tenant_id", tenantId.trim())
    .in("id", personIds);
  if (e2) return map;

  const personMeta = new Map<string, Record<string, unknown>>();
  for (const raw of personRows ?? []) {
    const r = raw as { id: string; metadata: unknown };
    const m =
      r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
        ? (r.metadata as Record<string, unknown>)
        : {};
    personMeta.set(String(r.id), m);
  }

  for (const raw of pRows) {
    const r = raw as { id: string; person_id: string };
    const meta = personMeta.get(String(r.person_id)) ?? {};
    map.set(String(r.id), casePersonDisplayFromMetadata(meta).label);
  }
  return map;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}): Promise<Metadata> {
  const { tenantId } = await params;
  return {
    title: `Doctor Workspace · ${tenantId.slice(0, 8)}…`,
    robots: { index: false, follow: false },
  };
}

export default async function DoctorWorkspacePage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return <p className="p-6 text-sm text-red-600">Server misconfigured (Supabase).</p>;
  }

  const session = await assertBookingsOperatorPageAccess(tid);
  const [includeCrmTasks, showDiagnosticsExpanded] = await Promise.all([
    getCrmShellNavAllowed(tid),
    canViewDashboardSystemDiagnostics(tid),
  ]);

  let bundle;
  let recentPrescriptions;
  try {
    [bundle, recentPrescriptions] = await Promise.all([
      loadDoctorWorkspace(tid, {
        viewerFiUserId: session.fiUserId,
        includeCrmTasks,
      }),
      loadRecentPrescriptionsForTenant(tid, { limit: 50 }),
    ]);
  } catch {
    redirect(`/fi-admin/${tid}`);
  }

  const patientIds = [
    ...recentPrescriptions.map((r) => r.patient_id),
    ...bundle.prescriptionsAwaitingSignature.map((r) => r.patientId),
    ...bundle.draftPrescriptionsInProgress.map((r) => r.patientId),
  ];
  const patientLabels = await loadPatientLabels(tid, patientIds);

  const base = `/fi-admin/${tid}`;
  return (
    <div className="p-4 sm:p-6">
      <DoctorWorkspaceHome
        bundle={bundle}
        base={base}
        recentPrescriptions={recentPrescriptions}
        patientLabels={patientLabels}
        showDiagnosticsExpanded={showDiagnosticsExpanded}
      />
    </div>
  );
}
