import Link from "next/link";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { FiCard } from "@/src/components/fi-design/FiCard";
import { FiPageHeader } from "@/src/components/fi-design/FiPageHeader";
import { casePersonDisplayFromMetadata } from "@/src/lib/cases/caseLabels";
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
    const m = r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata) ? (r.metadata as Record<string, unknown>) : {};
    personMeta.set(String(r.id), m);
  }

  for (const raw of pRows) {
    const r = raw as { id: string; person_id: string };
    const meta = personMeta.get(String(r.person_id)) ?? {};
    map.set(String(r.id), casePersonDisplayFromMetadata(meta).label);
  }
  return map;
}

export async function PrescriptionsWorkspacePage({ tenantId }: { tenantId: string }) {
  const rows = await loadRecentPrescriptionsForTenant(tenantId, { limit: 100 });
  const patientIds = rows.map((r) => r.patient_id);
  const labels = await loadPatientLabels(tenantId, patientIds);

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-6">
      <FiCard>
        <FiPageHeader
          titleId="prescriptions-workspace-heading"
          eyebrow="DoctorOS"
          title="Prescriptions workspace"
          description="Review recent prescriptions across patients. Open a patient profile or case to start a new prescription in full clinical context."
        />
      </FiCard>

      <FiCard>
        <h2 className="text-sm font-semibold text-slate-900">Recent activity</h2>
        {rows.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No prescriptions yet for this tenant.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-200 border border-slate-200 rounded-lg bg-white">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{labels.get(r.patient_id) ?? "Patient"}</p>
                  <p className="text-xs text-slate-500">
                    {PRESCRIPTION_STATUS_LABELS[r.status]}
                    {" · "}
                    {new Date(r.updated_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-3 text-sm font-medium">
                  <Link
                    className="text-sky-700 hover:underline"
                    href={`/fi-admin/${tenantId.trim()}/patients/${r.patient_id}?tab=prescriptions`}
                  >
                    Patient
                  </Link>
                  <Link className="text-sky-700 hover:underline" href={`/fi-admin/${tenantId.trim()}/prescriptions/${r.id}`}>
                    Open
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </FiCard>
    </div>
  );
}
