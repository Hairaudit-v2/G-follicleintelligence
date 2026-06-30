import Link from "next/link";
import type { PatientProfileFoundationData } from "@/src/lib/patients/patientProfileLoader";

export function PatientActivityCard({ tenantId, data }: { tenantId: string; data: PatientProfileFoundationData }) {
  return (
    <section className="rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40">
      <h2 className="text-sm font-semibold text-slate-100">Activity</h2>
      <p className="mt-1 text-xs text-gray-500">
        Read-only CRM activity tied to this patient&apos;s leads, cases, or explicit patient_id. Clinical detail edits
        are not mirrored here — a patient-native activity stream remains deferred (Stage 4B).
      </p>
      {data.activity.length === 0 ? (
        <p className="mt-2 text-sm text-slate-400">No CRM activity rows matched.</p>
      ) : (
        <ul className="mt-3 divide-y divide-white/[0.06]">
          {data.activity.map((a) => (
            <li key={a.id} className="py-2 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-slate-100">{a.title?.trim() || a.activity_kind}</span>
                <time className="text-xs text-gray-500" dateTime={a.occurred_at}>
                  {a.occurred_at.slice(0, 16).replace("T", " ")}
                </time>
              </div>
              <p className="text-xs text-slate-400">
                {a.activity_kind}
                {a.lead_id ? (
                  <>
                    {" · "}
                    <Link href={`/fi-admin/${tenantId}/crm/leads/${a.lead_id}`} className="text-blue-300 hover:underline">
                      Lead
                    </Link>
                  </>
                ) : (
                  <>
                    {" · "}
                    <Link href={`/fi-admin/${tenantId}/patients/${data.foundationPatientId}`} className="text-blue-300 hover:underline">
                      Patient record
                    </Link>
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
