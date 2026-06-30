import { FiSection } from "@/src/components/fi-design/FiSection";
import type { PatientTwinV1 } from "@/src/lib/patientTwin/patientTwinTypes";

export function PatientTwinCrmCard({ twin }: { twin: PatientTwinV1 }) {
  const c = twin.crm;
  const hasSignal =
    c.active_leads_count > 0 ||
    c.latest_lead_status != null ||
    c.open_tasks_count > 0 ||
    c.latest_activity_summary != null ||
    c.primary_owner_email != null;

  return (
    <FiSection
      surfaceVariant="darkGlass"
      headingId="patient-twin-crm-heading"
      title="CRM status"
      description="Leads, tasks, and recent activity (no message bodies)."
    >
      {!hasSignal ? (
        <p className="text-sm text-[#94A3B8]">
          No CRM signals linked to this patient in this tenant.
        </p>
      ) : (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
              Active leads
            </dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-white">
              {c.active_leads_count}
            </dd>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
              Open tasks
            </dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-white">
              {c.open_tasks_count}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
              Latest lead
            </dt>
            <dd className="mt-1 text-[#E2E8F0]">
              {c.latest_lead_status ?? "—"}
              {c.latest_lead_stage_label ? (
                <span className="text-[#94A3B8]"> · {c.latest_lead_stage_label}</span>
              ) : null}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
              Latest activity
            </dt>
            <dd className="mt-1 text-[#CBD5E1]">{c.latest_activity_summary ?? "—"}</dd>
          </div>
          <div className="sm:col-span-2 space-y-1 border-t border-white/[0.06] pt-3 text-xs text-[#94A3B8]">
            <p>
              <span className="text-[#64748B]">Owner </span>
              {c.primary_owner_email ?? "—"}
            </p>
            <p>
              <span className="text-[#64748B]">Clinic </span>
              {c.primary_clinic_display_name ?? "—"}
            </p>
            <p>
              <span className="text-[#64748B]">Organisation </span>
              {c.primary_organisation_name ?? "—"}
            </p>
          </div>
        </dl>
      )}
    </FiSection>
  );
}
