import { SystemAuditEventList } from "@/src/components/system-audit/SystemAuditEventList";
import type { SystemAuditEventRow } from "@/src/lib/systemAudit/systemAuditTypes";

/**
 * Patient chart → Activity: system audit events linked to this patient.
 */
export function PatientActivityTab({
  events,
}: {
  tenantId: string;
  patientId: string;
  events: SystemAuditEventRow[];
}) {
  return (
    <section
      className="rounded-xl border border-white/[0.08] bg-[#0F1629]/80 p-4 shadow-lg shadow-black/30"
      data-testid="patient-activity-tab"
    >
      <h2 className="text-sm font-semibold text-slate-100">Activity</h2>
      <p className="mt-1 text-xs text-slate-500">
        System audit events for this patient (notes, payments, images, profile changes).
      </p>
      <div className="mt-4">
        <SystemAuditEventList
          events={events}
          emptyMessage="No system activity recorded for this patient yet."
          compact
        />
      </div>
    </section>
  );
}
