import Link from "next/link";
import type { PatientProfileFoundationData } from "@/src/lib/patients/patientProfileLoader";

export function PatientActivityCard({ tenantId, data }: { tenantId: string; data: PatientProfileFoundationData }) {
  return (
    <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">Activity</h2>
      <p className="mt-1 text-xs text-gray-500">
        Read-only CRM activity tied to this patient&apos;s leads, cases, or explicit patient_id. Clinical detail edits
        are not mirrored here — a patient-native activity stream remains deferred (Stage 4B).
      </p>
      {data.activity.length === 0 ? (
        <p className="mt-2 text-sm text-gray-600">No CRM activity rows matched.</p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100">
          {data.activity.map((a) => (
            <li key={a.id} className="py-2 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-gray-900">{a.title?.trim() || a.activity_kind}</span>
                <time className="text-xs text-gray-500" dateTime={a.occurred_at}>
                  {a.occurred_at.slice(0, 16).replace("T", " ")}
                </time>
              </div>
              <p className="text-xs text-gray-600">
                {a.activity_kind}
                {" · "}
                <Link href={`/fi-admin/${tenantId}/crm/leads/${a.lead_id}`} className="text-blue-600 hover:underline">
                  Lead
                </Link>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
