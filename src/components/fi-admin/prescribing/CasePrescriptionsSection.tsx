import Link from "next/link";

import { FiCard } from "@/src/components/fi-design/FiCard";
import { FiPageHeader } from "@/src/components/fi-design/FiPageHeader";
import { loadPrescriptionsForCase } from "@/src/lib/prescribing/fiPrescribingLoaders.server";
import { PRESCRIPTION_STATUS_LABELS } from "@/src/lib/prescribing/fiPrescribingTypes";

export async function CasePrescriptionsSection({
  tenantId,
  caseId,
  foundationPatientId,
}: {
  tenantId: string;
  caseId: string;
  foundationPatientId: string | null;
}) {
  if (!foundationPatientId?.trim()) {
    return (
      <FiCard>
        <FiPageHeader
          titleId="case-prescriptions-no-patient-heading"
          eyebrow="DoctorOS"
          title="Prescriptions"
          description="Link a foundation patient to this case to author compound prescriptions from the catalogue."
        />
      </FiCard>
    );
  }

  const rows = await loadPrescriptionsForCase(tenantId, caseId);
  const newHref = `/fi-admin/${tenantId.trim()}/prescriptions/new?patientId=${encodeURIComponent(
    foundationPatientId.trim()
  )}&caseId=${encodeURIComponent(caseId.trim())}`;

  return (
    <FiCard>
      <FiPageHeader
        titleId="case-prescriptions-heading"
        eyebrow="DoctorOS"
        title="Prescriptions"
        description="Structured hair-loss prescriptions for this case. Stage 1 is internal authoring only — nothing is sent to the pharmacy automatically."
        primaryAction={
          <Link
            href={newHref}
            className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
          >
            New prescription
          </Link>
        }
      />
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">No prescriptions yet for this case.</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-200 border border-slate-200 rounded-lg bg-white">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-slate-900">
                  {new Date(r.updated_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                </p>
                <p className="text-xs text-slate-500">
                  Status: {PRESCRIPTION_STATUS_LABELS[r.status]}
                  {r.ready_for_pharmacy_at ? " · Ready for pharmacy (queued)" : null}
                </p>
              </div>
              <Link
                href={`/fi-admin/${tenantId.trim()}/prescriptions/${r.id}`}
                className="shrink-0 text-sm font-medium text-sky-700 hover:underline"
              >
                Open
              </Link>
            </li>
          ))}
        </ul>
      )}
    </FiCard>
  );
}
