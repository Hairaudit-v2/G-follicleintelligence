import Link from "next/link";
import { CLINICAL_DETAIL_FIELD_LABELS } from "@/src/lib/patients/clinicalDetailsLabels";
import type { PatientClinicalDetailsRow } from "@/src/lib/patients/clinicalDetailsServer";
import { formatClinicalScalesSummary } from "@/src/lib/patients/hairLossScales";
import { crmLeadCardClass } from "../shared";

const READONLY_KEYS = [
  "relevant_medical_history",
  "primary_hair_concern",
  "treatment_interest",
  "hair_loss_duration",
  "family_history",
  "current_medications",
  "allergies",
  "contraindications",
  "scalp_conditions",
  "previous_hair_treatments",
  "norwood_scale",
  "ludwig_scale",
  "hairline_pattern",
  "primary_concern",
] as const;

export function LeadClinicalDetailsPanel({
  tenantId,
  patientId,
  clinicalDetails,
  clinicalScalesSummary,
}: {
  tenantId: string;
  patientId: string | null;
  clinicalDetails: PatientClinicalDetailsRow | null;
  clinicalScalesSummary: string | null;
}) {
  if (!patientId) {
    return (
      <section className={crmLeadCardClass}>
        <h2 className="text-sm font-semibold text-gray-900">Clinical profile</h2>
        <p className="mt-2 text-sm text-gray-600">
          No foundation patient linked yet. Convert this lead to unlock full medical history, Norwood scale, and the photo
          gallery.
        </p>
      </section>
    );
  }

  const scalesLine =
    clinicalScalesSummary ??
    formatClinicalScalesSummary({
      norwood_scale: clinicalDetails?.norwood_scale ?? null,
      ludwig_scale: clinicalDetails?.ludwig_scale ?? null,
      hairline_pattern: clinicalDetails?.hairline_pattern ?? null,
      primary_concern: clinicalDetails?.primary_concern ?? clinicalDetails?.primary_hair_concern ?? null,
    });

  return (
    <div className="space-y-4">
      <section className={crmLeadCardClass}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-900">Clinical scales</h2>
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <Link href={`/fi-admin/${tenantId}/patients`} className="text-blue-600 hover:underline">
              Patient directory
            </Link>
            <Link href={`/fi-admin/${tenantId}/patients/${patientId}`} className="text-blue-600 hover:underline">
              Open profile →
            </Link>
          </p>
        </div>
        <p className="mt-2 text-sm text-gray-800">{scalesLine || "No scale data recorded yet."}</p>
      </section>

      <section className={crmLeadCardClass}>
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Medical history & hair characteristics</h2>
        {!clinicalDetails ? (
          <p className="text-sm text-gray-600">No clinical details row yet for this patient.</p>
        ) : (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {READONLY_KEYS.map((key) => {
              const raw = clinicalDetails[key];
              const text = raw != null && String(raw).trim() ? String(raw).trim() : "—";
              return (
                <div key={key} className={key === "relevant_medical_history" ? "sm:col-span-2" : undefined}>
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    {CLINICAL_DETAIL_FIELD_LABELS[key]}
                  </dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-gray-800">{text}</dd>
                </div>
              );
            })}
          </dl>
        )}
      </section>
    </div>
  );
}
