import Link from "next/link";

import type { PatientTwinV1 } from "@/src/lib/patientTwin/patientTwinTypes";
import type { VieImagingDomainCompleteness } from "@/src/lib/vie/vieProtocolTypes";
import { outcomeDomainLabel, outcomeStatusLabel } from "@/src/lib/vie/vieOutcomeIntelligenceCore";
import type { VieOutcomeStatus } from "@/src/lib/vie/vieOutcomeTypes";

function outcomeStatusTone(status: VieOutcomeStatus): string {
  if (status === "audit_ready" || status === "favourable") return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  if (status === "monitoring" || status === "early_signal") return "text-cyan-300 bg-cyan-500/10 border-cyan-500/20";
  if (status === "concern") return "text-amber-400 bg-amber-500/10 border-amber-500/20";
  return "text-slate-400 bg-white/[0.03] border-white/[0.08]";
}

function DomainMeter({ domain, accent }: { domain: VieImagingDomainCompleteness; accent: string }) {
  if (domain.required_total === 0) return null;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[0.65rem] font-medium text-slate-400">{domain.label}</p>
        <p className="text-xs text-slate-300">{domain.display}</p>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${accent}`} style={{ width: `${domain.percent}%` }} />
      </div>
    </div>
  );
}

function qualityBandTone(band: string): string {
  if (band === "excellent") return "text-emerald-400";
  if (band === "retake_recommended") return "text-amber-400";
  return "text-slate-300";
}

export function PatientTwinVieCard({
  tenantId,
  patientId,
  twin,
}: {
  tenantId: string;
  patientId: string;
  twin: PatientTwinV1;
}) {
  const vie = twin.vie;
  if (!vie) return null;

  const { imaging_completeness: ic } = vie;
  const latestQuality = ic.latest_capture_quality;
  const outcome = vie.outcome_summary;

  return (
    <section className="rounded-lg border border-white/[0.08] bg-[#0b1220]/80 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-400/90">Visual Intelligence Engine</p>
          <p className="mt-1 text-sm text-slate-200">{ic.consultation.display}</p>
        </div>
        <Link
          href={`/fi-admin/${tenantId}/patients/${patientId}?tab=gallery`}
          className="text-xs font-medium text-cyan-300 hover:underline"
        >
          Capture protocol
        </Link>
      </div>

      <div className="mt-4 space-y-3">
        <DomainMeter domain={ic.consultation} accent="bg-cyan-500" />
        <DomainMeter domain={ic.full_head_series} accent="bg-sky-500" />
        <DomainMeter domain={ic.donor_documentation} accent="bg-amber-500" />
        <DomainMeter domain={ic.surgical_documentation} accent="bg-violet-500" />
      </div>

      {latestQuality && latestQuality.acceptance_status === "accepted" ? (
        <div className="mt-4 rounded-md bg-white/[0.03] px-3 py-2 ring-1 ring-white/[0.06]">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">Latest accepted quality</p>
          <p className="mt-1 text-sm text-slate-200">
            <span className={qualityBandTone(latestQuality.quality_band)}>
              {latestQuality.quality_score}/100 · {latestQuality.quality_band.replace(/_/g, " ")}
            </span>
            <span className="text-slate-500"> · {latestQuality.protocol_slot_slug.replace(/_/g, " ")}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {latestQuality.clinically_usable ? "Clinically usable" : "Clinically unusable — retake recommended"}
          </p>
        </div>
      ) : latestQuality ? (
        <div className="mt-4 rounded-md bg-white/[0.03] px-3 py-2 ring-1 ring-white/[0.06]">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">Latest capture</p>
          <p className="mt-1 text-xs text-amber-400">
            Pending review — {latestQuality.protocol_slot_slug.replace(/_/g, " ")} not yet accepted
          </p>
        </div>
      ) : (
        <p className="mt-4 text-xs text-slate-500">No protocol captures yet — start initial / baseline consultation.</p>
      )}

      <div className="mt-4 rounded-md bg-white/[0.03] px-3 py-2 ring-1 ring-white/[0.06]">
        <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">Alignment consistency</p>
        <p className="mt-1 text-sm text-slate-200">
          Score {vie.alignment_summary.alignment_consistency_score}%
          {vie.alignment_summary.standardized_evidence_coverage_percent > 0
            ? ` · ${vie.alignment_summary.standardized_evidence_coverage_percent}% standardized evidence`
            : ""}
        </p>
        {vie.alignment_summary.regions_with_poor_consistency.length > 0 ? (
          <p className="mt-1 text-xs text-amber-400">
            Poor consistency: {vie.alignment_summary.regions_with_poor_consistency.map((r) => r.replace(/_/g, " ")).join(", ")}
          </p>
        ) : (
          <p className="mt-1 text-xs text-slate-500">No regions flagged for poor alignment consistency</p>
        )}
        {vie.alignment_summary.next_recommended_standardized_recapture.slot_label ? (
          <p className="mt-1 text-xs text-cyan-300/90">
            Recapture: {vie.alignment_summary.next_recommended_standardized_recapture.slot_label}
          </p>
        ) : null}
      </div>

      <div className="mt-4 rounded-md bg-white/[0.03] px-3 py-2 ring-1 ring-white/[0.06]">
        <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">Comparison readiness</p>
        <p className="mt-1 text-sm text-slate-200">
          {vie.comparison_readiness.suggested_pairs_count} suggested pair
          {vie.comparison_readiness.suggested_pairs_count === 1 ? "" : "s"}
          {vie.comparison_readiness.audit_ready_pairs_count > 0
            ? ` · ${vie.comparison_readiness.audit_ready_pairs_count} audit-ready`
            : ""}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Follow-up coverage {vie.comparison_readiness.follow_up_progression_coverage}%
          {vie.comparison_readiness.regions_without_comparison.length > 0
            ? ` · ${vie.comparison_readiness.regions_without_comparison.length} region(s) without comparison`
            : ""}
        </p>
        {vie.comparison_readiness.next_recommended_capture.label ? (
          <p className="mt-1 text-xs text-cyan-300/90">
            Next capture: {vie.comparison_readiness.next_recommended_capture.label}
          </p>
        ) : null}
        <Link
          href={`/fi-admin/${tenantId}/patients/${patientId}/imaging?tab=compare`}
          className="mt-2 inline-block text-xs font-medium text-cyan-300 hover:underline"
        >
          View comparisons
        </Link>
      </div>

      {outcome ? (
        <div className="mt-4 rounded-md bg-white/[0.03] px-3 py-2 ring-1 ring-white/[0.06]">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">Outcome readiness</p>
          <p className="mt-1 text-sm text-slate-200">
            Evidence readiness {outcome.overall_outcome_readiness_score}%
            <span className="text-slate-500"> · {outcome.confidence_band} confidence</span>
            {outcome.audit_ready ? <span className="text-emerald-400"> · audit-ready signal</span> : null}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {outcome.domains.map((d) => (
              <span
                key={d.domain}
                className={`rounded border px-1.5 py-0.5 text-[0.65rem] capitalize ${outcomeStatusTone(d.status)}`}
                title={outcomeDomainLabel(d.domain)}
              >
                {d.domain.replace(/_/g, " ")}: {outcomeStatusLabel(d.status)}
              </span>
            ))}
          </div>
          {outcome.next_actions[0] ? (
            <p className="mt-2 text-xs text-cyan-300/90">Next: {outcome.next_actions[0].label}</p>
          ) : null}
          {outcome.clinical_review_recommended ? (
            <p className="mt-1 text-xs text-amber-400/90">Monitoring signal — clinician review recommended</p>
          ) : null}
        </div>
      ) : null}

      {vie.latest_intelligence.length > 1 ? (
        <ul className="mt-3 space-y-1.5">
          {vie.latest_intelligence.slice(1, 4).map((row) => (
            <li key={row.patient_image_id} className="flex justify-between text-xs text-slate-500">
              <span>{row.protocol_slot_slug.replace(/_/g, " ")}</span>
              <span>{row.quality_score}/100</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
