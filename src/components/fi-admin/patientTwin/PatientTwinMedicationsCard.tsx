import type { PatientTwinV1 } from "@/src/lib/patientTwin/patientTwinTypes";

const card = "rounded border border-gray-200 bg-white p-4 shadow-sm";

function formatWhen(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function PatientTwinMedicationsCard({ twin }: { twin: PatientTwinV1 }) {
  const m = twin.clinical.medications;
  const hasSignal =
    m.active_plan_count > 0 || m.active_items.length > 0 || m.therapy_events_preview.length > 0;

  return (
    <section className={card}>
      <h2 className="text-sm font-semibold text-gray-900">MedicationOS — therapy</h2>
      <p className="mt-1 text-xs text-gray-600">
        Read-only active plans and recent therapy events (caps: {m.active_item_cap} line items, {m.therapy_events_preview_cap}{" "}
        events). Loader tables:{" "}
        <span className="font-mono text-[11px]">fi_patient_therapy_plans</span>,{" "}
        <span className="font-mono text-[11px]">fi_patient_therapy_plan_items</span>,{" "}
        <span className="font-mono text-[11px]">fi_medication_os_canonical</span>,{" "}
        <span className="font-mono text-[11px]">fi_patient_therapy_events</span>.
      </p>

      {!hasSignal ? (
        <p className="mt-3 text-sm text-gray-600">No active MedicationOS therapy plans or events for this patient yet.</p>
      ) : (
        <>
          <p className="mt-3 text-sm text-gray-800">
            <span className="font-semibold">{m.active_plan_count}</span> active plan
            {m.active_plan_count === 1 ? "" : "s"}
            {m.active_items.length > 0 ? (
              <>
                {" "}
                · <span className="font-semibold">{m.active_items.length}</span> active line item
                {m.active_items.length === 1 ? "" : "s"} shown
              </>
            ) : null}
          </p>

          {m.active_items.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-xs text-gray-800">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-600">
                    <th className="py-2 pr-3 font-medium">Plan</th>
                    <th className="py-2 pr-3 font-medium">Item</th>
                    <th className="py-2 pr-3 font-medium">Role</th>
                    <th className="py-2 pr-3 font-medium">Rx link</th>
                  </tr>
                </thead>
                <tbody>
                  {m.active_items.map((row) => (
                    <tr key={row.plan_item_id} className="border-b border-gray-100 last:border-0">
                      <td className="py-2 pr-3 align-top">
                        <div className="font-medium text-gray-900">{row.plan_title}</div>
                        <div className="text-gray-500">{row.plan_type}</div>
                      </td>
                      <td className="py-2 pr-3 align-top">
                        <div>{row.display_name}</div>
                        <div className="font-mono text-[10px] text-gray-500">{row.canonical_code}</div>
                        {row.dosing_summary ? <div className="mt-0.5 text-gray-600">{row.dosing_summary}</div> : null}
                      </td>
                      <td className="py-2 pr-3 align-top text-gray-700">{row.role}</td>
                      <td className="py-2 pr-3 align-top">
                        {row.prescription_id ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-900">Linked Rx</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {m.therapy_events_preview.length > 0 ? (
            <div className="mt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-700">Recent therapy events</h3>
              <ul className="mt-2 space-y-2">
                {m.therapy_events_preview.map((ev) => (
                  <li key={ev.id} className="rounded border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-800">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium text-gray-900">{ev.title}</span>
                      <time className="text-gray-500" dateTime={ev.occurred_at}>
                        {formatWhen(ev.occurred_at)}
                      </time>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-gray-600">
                      <span className="font-mono">{ev.event_type}</span>
                      {ev.canonical_code ? <span>· {ev.canonical_code}</span> : null}
                      <span className="rounded bg-white px-1.5 py-0.5 text-gray-500">{ev.source_table}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
