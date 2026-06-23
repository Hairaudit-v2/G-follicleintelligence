import Link from "next/link";
import { ArrowRight, Pill, Stethoscope } from "lucide-react";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { DoctorPrescriptionWorkspace } from "@/src/components/fi-admin/doctor-workspace/DoctorPrescriptionWorkspace";
import { casePersonDisplayFromMetadata } from "@/src/lib/cases/caseLabels";
import { loadDoctorWorkspace } from "@/src/lib/doctorOs/doctorWorkspaceLoader.server";
import {
  buildDoctorPrescriptionWorkspace,
  doctorWorkspaceLinkButtonClass,
} from "@/src/lib/fiAdmin/doctorWorkspacePresentation";
import { loadRecentPrescriptionsForTenant } from "@/src/lib/prescribing/fiPrescribingLoaders.server";
import { PRESCRIPTION_STATUS_LABELS } from "@/src/lib/prescribing/fiPrescribingTypes";

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
      r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata) ? (r.metadata as Record<string, unknown>) : {};
    personMeta.set(String(r.id), m);
  }

  for (const raw of pRows) {
    const r = raw as { id: string; person_id: string };
    const meta = personMeta.get(String(r.person_id)) ?? {};
    map.set(String(r.id), casePersonDisplayFromMetadata(meta).label);
  }
  return map;
}

function formatShortDate(iso: string): string {
  const d = Date.parse(iso);
  if (!Number.isFinite(d)) return "—";
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export async function PrescriptionsWorkspacePage({ tenantId }: { tenantId: string }) {
  const tid = tenantId.trim();
  const base = `/fi-admin/${tid}`;

  const [recentPrescriptions, bundle] = await Promise.all([
    loadRecentPrescriptionsForTenant(tid, { limit: 100 }),
    loadDoctorWorkspace(tid, { viewerFiUserId: null, includeCrmTasks: false }),
  ]);

  const patientIds = recentPrescriptions.map((r) => r.patient_id);
  const labels = await loadPatientLabels(tid, patientIds);
  const prescriptionModel = buildDoctorPrescriptionWorkspace(base, bundle, recentPrescriptions, labels);

  return (
    <div className="mx-auto min-w-0 max-w-[88rem] space-y-6 pb-10 sm:space-y-8 sm:pb-12">
      <DashboardCard elevated className="relative overflow-hidden p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(560px_260px_at_0%_0%,rgba(16,185,129,0.11),transparent_55%),radial-gradient(420px_200px_at_100%_100%,rgba(52,211,153,0.06),transparent_50%)]"
          aria-hidden
        />
        <div className="relative border-l-4 border-emerald-400/80 pl-5 sm:pl-6">
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300/95">
            <Pill className="h-4 w-4" aria-hidden />
            FI OS · Medication
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#F8FAFC] sm:text-4xl">Prescription workspace</h1>
          <p className="mt-2 max-w-3xl text-base leading-relaxed text-[#94A3B8]">
            Medication approvals, active prescriptions, renewals, and recent prescribing activity across patients.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href={`${base}/prescriptions/new`} className={doctorWorkspaceLinkButtonClass}>
              New Prescription
            </Link>
            <Link href={`${base}/doctor`} className={doctorWorkspaceLinkButtonClass}>
              <Stethoscope className="mr-1.5 h-4 w-4" aria-hidden />
              Open Doctor Workspace
            </Link>
            <Link href={`${base}/medication-reorders`} className={doctorWorkspaceLinkButtonClass}>
              Medication Reorders
            </Link>
          </div>
        </div>
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6" role="region" aria-labelledby="prescriptions-workspace-heading">
        <SectionHeader
          id="prescriptions-workspace-heading"
          kicker="Workflow"
          title="Prescription actions"
          description="What requires physician review right now."
          className="mb-4"
        />
        <DoctorPrescriptionWorkspace base={base} model={prescriptionModel} />
      </DashboardCard>

      {recentPrescriptions.length > 0 ? (
        <DashboardCard className="p-5 sm:p-6" role="region" aria-labelledby="prescriptions-history-heading">
          <SectionHeader
            id="prescriptions-history-heading"
            kicker="History"
            title="Recent prescriptions"
            description="Chronological list — open a record for full clinical context."
            className="mb-4"
          />
          <ul className="divide-y divide-white/[0.06]">
            {recentPrescriptions.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#F8FAFC]">{labels.get(r.patient_id) ?? "Patient"}</p>
                  <p className="mt-0.5 text-xs text-[#64748B]">
                    {PRESCRIPTION_STATUS_LABELS[r.status]} · {formatShortDate(r.updated_at)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Link
                    href={`${base}/patients/${encodeURIComponent(r.patient_id)}?tab=prescriptions`}
                    className="rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-xs font-medium text-[#E2E8F0] transition hover:border-emerald-400/30 hover:text-emerald-300"
                  >
                    Patient
                  </Link>
                  <Link
                    href={`${base}/prescriptions/${encodeURIComponent(r.id)}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400/80 hover:text-emerald-300"
                  >
                    Open
                    <ArrowRight className="h-3 w-3" aria-hidden />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </DashboardCard>
      ) : null}
    </div>
  );
}
