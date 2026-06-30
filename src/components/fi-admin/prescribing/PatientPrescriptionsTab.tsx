import Link from "next/link";

import { FiCard } from "@/src/components/fi-design/FiCard";
import { FiPageHeader } from "@/src/components/fi-design/FiPageHeader";
import { loadPrescriptionsForPatient } from "@/src/lib/prescribing/fiPrescribingLoaders.server";
import { PRESCRIPTION_STATUS_LABELS } from "@/src/lib/prescribing/fiPrescribingTypes";

export async function PatientPrescriptionsTab({
  tenantId,
  patientId,
}: {
  tenantId: string;
  patientId: string;
}) {
  const rows = await loadPrescriptionsForPatient(tenantId, patientId);
  const newHref = `/fi-admin/${tenantId.trim()}/prescriptions/new?patientId=${encodeURIComponent(patientId.trim())}`;

  return (
    <div className="space-y-4">
      <FiCard>
        <FiPageHeader
          titleId="patient-prescriptions-heading"
          eyebrow="DoctorOS"
          title="Prescriptions"
          description="Build structured prescriptions from your tenant medication catalogue. Save drafts, sign, and mark ready for pharmacy hand-off — transmission is not enabled in this stage."
          primaryAction={
            <Link
              href={newHref}
              className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
            >
              New prescription
            </Link>
          }
        />
      </FiCard>

      <FiCard>
        <h2 className="text-sm font-semibold text-slate-100">Recent prescriptions</h2>
        {rows.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">No prescriptions recorded for this patient yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-white/[0.08] border border-white/[0.08] rounded-lg bg-[#0F1629]/80 backdrop-blur-md">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-slate-100">
                    {new Date(r.updated_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                  <p className="text-xs text-slate-500">
                    {PRESCRIPTION_STATUS_LABELS[r.status]}
                    {r.case_id ? (
                      <>
                        {" "}
                        ·{" "}
                        <Link
                          className="text-cyan-300 hover:underline"
                          href={`/fi-admin/${tenantId.trim()}/cases/${r.case_id}`}
                        >
                          Case
                        </Link>
                      </>
                    ) : null}
                    {r.ready_for_pharmacy_at ? " · Ready for pharmacy" : null}
                  </p>
                </div>
                <Link
                  href={`/fi-admin/${tenantId.trim()}/prescriptions/${r.id}`}
                  className="shrink-0 text-sm font-medium text-cyan-300 hover:underline"
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
      </FiCard>
    </div>
  );
}
