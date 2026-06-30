import type { CaseOutcomeIntelligenceView } from "@/src/lib/fi-os/outcomeIntelligence.server";

export function CaseOutcomeIntelligencePanel(props: { view: CaseOutcomeIntelligenceView }) {
  const v = props.view;
  return (
    <section
      className="rounded-lg border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40"
      aria-labelledby="case-outcome-intel-heading"
    >
      <h2 id="case-outcome-intel-heading" className="text-base font-semibold text-slate-100">
        Outcome Intelligence
      </h2>
      <p className="mt-1 text-xs text-slate-400">
        Structured checkpoints, references, and protocol signals available in FI OS. No predictions
        or automated treatment advice.
      </p>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium text-slate-300">Checkpoints captured</dt>
          <dd className="mt-1 text-slate-400">
            {v.checkpointsCaptured.length ? v.checkpointsCaptured.join(", ") : "—"}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-slate-300">Missing checkpoints</dt>
          <dd className="mt-1 text-slate-400">
            {v.checkpointsMissing.length ? v.checkpointsMissing.join(", ") : "—"}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-slate-300">12-month window</dt>
          <dd className="mt-1 text-slate-400">
            {v.twelveMonthRatio.captured}/{v.twelveMonthRatio.total} checkpoints linked (
            {Math.round(v.twelveMonthRatio.ratio * 100)}%)
          </dd>
        </div>
        <div>
          <dt className="font-medium text-slate-300">Imaging / audit refs</dt>
          <dd className="mt-1 text-slate-400">
            Imaging refs (approx.): {v.imagingRefsApprox}. Audit refs (approx.): {v.auditRefsApprox}
            .
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-medium text-slate-300">Protocol summary</dt>
          <dd className="mt-1 text-slate-400">
            {v.protocolKeys.length ? v.protocolKeys.join(", ") : "No protocol rows captured yet."}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-medium text-slate-300">Future benchmark eligibility</dt>
          <dd className="mt-1 text-slate-400">
            {v.networkEligibleHint === "insufficient_data"
              ? "More structured outcome measurements are needed before tenant-level aggregates can feed anonymised benchmarks."
              : "Tenant-only in Stage 6 — anonymised network publishing remains cohort-gated with minimum sample and tenant counts."}
          </dd>
        </div>
      </dl>
    </section>
  );
}
