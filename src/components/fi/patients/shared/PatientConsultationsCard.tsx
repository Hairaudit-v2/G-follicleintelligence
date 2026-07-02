import Link from "next/link";
import { WorkspaceFeedLink } from "@/src/components/fi-os/workspace/WorkspaceFeedLink";
import type { PatientConsultationListItem } from "@/src/lib/patients/patientConsultations";
import { crmLeadCardClass } from "@/src/components/fi/crm/shared/crmSharedStyles";

export function PatientConsultationsCard({
  tenantId,
  consultations,
  compact,
}: {
  tenantId: string;
  consultations: PatientConsultationListItem[];
  compact?: boolean;
}) {
  const rows = compact ? consultations.slice(0, 5) : consultations;

  return (
    <section className={crmLeadCardClass}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Consultations</h2>
          <p className="mt-1 text-xs text-slate-400">
            ConsultationOS workspaces linked to this patient. Norwood / Ludwig scales sync to
            clinical details on save.
          </p>
        </div>
        <Link
          href={`/fi-admin/${tenantId}/consultations/new`}
          className="text-xs text-blue-300 hover:underline"
        >
          New consultation →
        </Link>
      </div>

      {consultations.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">No consultations linked yet.</p>
      ) : (
        <ul
          className={`mt-3 divide-y divide-white/[0.06] ${compact ? "max-h-56 overflow-y-auto" : ""}`}
        >
          {rows.map((c) => (
            <li key={c.id} className="py-2.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <WorkspaceFeedLink
                    href={`/fi-admin/${tenantId}/consultations/${c.id}`}
                    className="text-sm font-medium text-blue-300 hover:underline"
                  >
                    {c.consultation_type_label}
                  </WorkspaceFeedLink>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {c.status}
                    {c.consultation_date ? ` · ${c.consultation_date}` : ""}
                    {c.consultant_name ? ` · ${c.consultant_name}` : ""}
                  </p>
                </div>
                {c.scalesSyncedToPatient ? (
                  <span className="rounded bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-300">
                    Scales synced
                  </span>
                ) : c.consultation_type === "medical_hair_loss" ? (
                  <span className="rounded bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Scales pending
                  </span>
                ) : null}
              </div>
              {c.recommendation_notes?.trim() ? (
                <p className="mt-1 line-clamp-2 text-xs text-slate-300">
                  {c.recommendation_notes.trim()}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {compact && consultations.length > rows.length ? (
        <p className="mt-2 text-xs text-gray-500">
          +{consultations.length - rows.length} more in Clinical / Treatment history tabs
        </p>
      ) : null}
    </section>
  );
}
