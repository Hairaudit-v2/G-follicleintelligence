import type { OutcomeMeasurementRow, OutcomeProtocolRow } from "@/src/lib/fi-os/outcomeIntelligence.server";

export function PatientTwinOutcomeJourneyCard(props: {
  measurements: OutcomeMeasurementRow[];
  protocols: OutcomeProtocolRow[];
}) {
  const { measurements, protocols } = props;
  return (
    <section
      className="rounded-xl border border-white/[0.08] bg-[#0b1220]/90 p-4 shadow-inner shadow-black/30"
      aria-labelledby="twin-outcome-journey-heading"
    >
      <h2 id="twin-outcome-journey-heading" className="text-sm font-semibold tracking-tight text-slate-100">
        Outcome Journey
      </h2>
      <p className="mt-1 text-xs text-slate-400">
        Checkpoints, measurements, imaging and audit references, and protocol timeline (tenant-scoped). No clinical advice
        or predictions.
      </p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Measurements</h3>
          {measurements.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">No structured outcome measurements yet.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm text-slate-200">
              {measurements.map((m) => (
                <li key={m.id} className="rounded border border-white/[0.06] bg-black/20 px-2 py-1.5">
                  <span className="font-medium text-slate-100">{m.checkpoint_key}</span>
                  {m.measurement_date ? <span className="text-slate-400"> · {m.measurement_date}</span> : null}
                  {m.case_id ? <span className="block text-xs text-slate-500">Case-linked</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Protocol timeline</h3>
          {protocols.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">No protocol capture rows yet.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm text-slate-200">
              {protocols.map((p) => (
                <li key={p.id} className="rounded border border-white/[0.06] bg-black/20 px-2 py-1.5">
                  <span className="font-medium text-slate-100">{p.protocol_label}</span>
                  <span className="text-slate-400"> ({p.protocol_type})</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
