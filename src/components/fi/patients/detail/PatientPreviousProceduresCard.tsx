import type { PreviousProcedureRow } from "@/src/lib/patients/previousProcedures";
import { crmLeadCardClass } from "@/src/components/fi/crm/shared/crmSharedStyles";

export function PatientPreviousProceduresCard({ procedures }: { procedures: PreviousProcedureRow[] }) {
  return (
    <section className={crmLeadCardClass}>
      <h2 className="text-sm font-semibold text-gray-900">Previous procedures</h2>
      <p className="mt-1 text-xs text-gray-600">
        Structured history from <code className="rounded bg-gray-100 px-1">clinical_flags.previous_procedures</code>. Legacy
        free-text still shown when structured rows are empty.
      </p>

      {procedures.length === 0 ? (
        <p className="mt-3 text-sm text-gray-600">No previous procedures recorded.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="pb-2 pr-3">Procedure</th>
                <th className="pb-2 pr-3">Date</th>
                <th className="pb-2 pr-3">Clinic</th>
                <th className="pb-2 pr-3 text-right">Grafts</th>
                <th className="pb-2">Outcome / notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {procedures.map((p) => (
                <tr key={p.id}>
                  <td className="py-2 pr-3 font-medium text-gray-900">{p.procedureType}</td>
                  <td className="py-2 pr-3 text-gray-700">{p.performedAt ?? "—"}</td>
                  <td className="py-2 pr-3 text-gray-700">{p.clinic ?? "—"}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-gray-800">{p.graftCount ?? "—"}</td>
                  <td className="py-2 text-gray-700">
                    {[p.outcome, p.notes].filter(Boolean).join(" · ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
