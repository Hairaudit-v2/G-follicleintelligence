import { FiSection } from "@/src/components/fi-design/FiSection";
import {
  fiBadgeIntentClassNames,
  type FiBadgeIntent,
} from "@/src/components/fi-design/fiDesignTokens";
import { cn } from "@/lib/utils";
import type { HairProgressionStabilityLabel } from "@/src/lib/hair-intelligence/hairProgressionIntelligence";
import {
  formatReviewMultiplier,
  formatSignedVelocityDeltaGradesPerYear,
  formatStabilityClinicalLabel,
  formatVerifiedPointFraction,
  formatVelocityGradesPerYearWithUnit,
  hairProgressionAnalysedTimebounds,
  hairProgressionIsInsufficientLongitudinalData,
  hairProgressionLatestGradePresentation,
} from "@/src/lib/hair-intelligence/hairProgressionIntelligence/progressionDisplay";
import type { PatientTwinV1 } from "@/src/lib/patientTwin/patientTwinTypes";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{children}</p>
  );
}

function formatIsoDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  return new Date(ms).toLocaleDateString(undefined, { dateStyle: "medium" });
}

function humaniseAgeBand(band: string): string {
  const map: Record<string, string> = {
    under_25: "Under 25",
    "25_35": "25–35",
    "36_45": "36–45",
    "46_55": "46–55",
    "56_plus": "56+",
    unknown: "Unknown",
  };
  return map[band] ?? band.replace(/_/g, " ");
}

function stabilityBadgeIntent(label: HairProgressionStabilityLabel): FiBadgeIntent {
  switch (label) {
    case "stable":
      return "success";
    case "slow_progression":
      return "info";
    case "rapid_progression":
      return "danger";
    case "diffuse_unstable_progression":
      return "warning";
    case "insufficient_data":
      return "neutral";
    default:
      return "neutral";
  }
}

export function PatientTwinHairProgressionCard({ twin }: { twin: PatientTwinV1 }) {
  const hp = twin.intelligence.hair_progression;
  const insufficient = hairProgressionIsInsufficientLongitudinalData(hp);
  const bounds = hairProgressionAnalysedTimebounds(hp);
  const latest = hairProgressionLatestGradePresentation(hp);
  const dominant = hp.analysis_basis.classification_system_used;
  const net = hp.global_network;
  const cohort = hp.cohort_context;
  const hasNetworkRow =
    net.matched_bucket &&
    net.population_sample_count != null &&
    net.population_sample_count > 0 &&
    net.week_bucket;

  return (
    <FiSection
      surfaceVariant="darkGlass"
      headingId="patient-twin-hair-progression-heading"
      title="Hair progression intelligence (HIE)"
      description="Stage 9B longitudinal read model — velocity, stability, therapy-associated slopes, and anonymised cohort context from the classification ledger."
    >
      <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-50/95">
        AI progression intelligence supports review and does not replace clinical judgement.
      </p>

      {insufficient ? (
        <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-3">
          <p className="text-sm font-medium text-white">Insufficient longitudinal data</p>
          <p className="mt-1 text-xs text-[#94A3B8]">
            At least two graded observations on the same dominant classification system, spanning
            roughly six weeks, are required before reporting progression velocity and stability with
            confidence.
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
          Classification stability
        </span>
        <span
          className={cn(
            "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
            fiBadgeIntentClassNames[stabilityBadgeIntent(hp.stability.label)]
          )}
        >
          {formatStabilityClinicalLabel(hp.stability.label)}
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-[#94A3B8]">{hp.stability.rationale}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div>
          <FieldLabel>Dominant classification system</FieldLabel>
          <p className="mt-0.5 text-sm font-medium text-white">
            {dominant ? dominant.replace(/_/g, " ") : "—"}
          </p>
        </div>
        <div>
          <FieldLabel>Latest grade / ordinal</FieldLabel>
          <p className="mt-0.5 text-sm text-slate-200">
            {latest.grade ?? "—"}
            {latest.ordinal != null ? (
              <span className="text-[#94A3B8]"> (ordinal {latest.ordinal})</span>
            ) : null}
          </p>
        </div>
        <div>
          <FieldLabel>Progression velocity (unweighted)</FieldLabel>
          <p className="mt-0.5 text-sm tabular-nums text-slate-200">
            {formatVelocityGradesPerYearWithUnit(hp.progression_velocity.grades_per_year)}
          </p>
        </div>
        <div>
          <FieldLabel>Progression velocity (confidence-weighted)</FieldLabel>
          <p className="mt-0.5 text-sm tabular-nums text-slate-200">
            {formatVelocityGradesPerYearWithUnit(
              hp.progression_velocity.confidence_weighted_grades_per_year
            )}
          </p>
        </div>
        <div>
          <FieldLabel>First classification date (analysed window)</FieldLabel>
          <p className="mt-0.5 text-sm text-slate-200">{formatIsoDate(bounds.firstAt)}</p>
        </div>
        <div>
          <FieldLabel>Latest classification date</FieldLabel>
          <p className="mt-0.5 text-sm text-slate-200">{formatIsoDate(bounds.lastAt)}</p>
        </div>
        <div>
          <FieldLabel>Classification points (analysed)</FieldLabel>
          <p className="mt-0.5 text-sm tabular-nums text-slate-200">
            {hp.analysis_basis.point_count}
          </p>
        </div>
        <div>
          <FieldLabel>Observation span</FieldLabel>
          <p className="mt-0.5 text-sm text-slate-200">
            {hp.analysis_basis.span_months != null ? `${hp.analysis_basis.span_months} mo` : "—"}
            {hp.analysis_basis.span_days != null ? (
              <span className="text-[#64748B]"> ({hp.analysis_basis.span_days} d)</span>
            ) : null}
          </p>
        </div>
        <div>
          <FieldLabel>Clinician-verified point fraction</FieldLabel>
          <p className="mt-0.5 text-sm tabular-nums text-slate-200">
            {formatVerifiedPointFraction(hp.clinician_review_weighting.verified_point_fraction)}
          </p>
        </div>
        <div>
          <FieldLabel>Review confidence weighting (mean multiplier)</FieldLabel>
          <p className="mt-0.5 text-sm tabular-nums text-slate-200">
            {formatReviewMultiplier(hp.clinician_review_weighting.average_review_multiplier)}
          </p>
        </div>
        {hp.stability.segment_velocity_std_grades_per_year != null ? (
          <div className="sm:col-span-2">
            <FieldLabel>Segment velocity dispersion (grades/year, SD)</FieldLabel>
            <p className="mt-0.5 text-sm tabular-nums text-slate-200">
              {hp.stability.segment_velocity_std_grades_per_year.toFixed(3)}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-8 border-t border-white/10 pt-6">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-cyan-400/90">
          Treatment-associated velocity change
        </h3>
        <p className="mt-1 text-xs text-[#64748B]">
          Slopes before vs after first recorded exposure (MedicationOS events).
        </p>
        <ul className="mt-3 space-y-2">
          {hp.treatment_response.map((row) => (
            <li
              key={row.canonical_code}
              className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm text-[#E2E8F0]"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-white">{row.display_label}</span>
                {row.first_exposure_at ? (
                  <span className="text-xs text-[#94A3B8]">
                    First exposure: {formatIsoDate(row.first_exposure_at)}
                  </span>
                ) : (
                  <span className="text-xs text-[#64748B]">No recorded exposure</span>
                )}
              </div>
              <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
                <div>
                  <span className="text-[#64748B]">Before: </span>
                  <span className="tabular-nums text-slate-200">
                    {formatVelocityGradesPerYearWithUnit(row.velocity_before_grades_per_year)}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B]">After: </span>
                  <span className="tabular-nums text-slate-200">
                    {formatVelocityGradesPerYearWithUnit(row.velocity_after_grades_per_year)}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B]">Δ velocity: </span>
                  <span className="tabular-nums text-slate-200">
                    {formatSignedVelocityDeltaGradesPerYear(row.delta_velocity_after_minus_before)}
                  </span>
                </div>
              </div>
              {row.notes ? (
                <p className="mt-2 text-[11px] leading-snug text-[#64748B]">{row.notes}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8 border-t border-white/10 pt-6">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-cyan-400/90">
          Forecast (Norwood linear extrapolation)
        </h3>
        {hp.forecast && hp.forecast.target_grade === "V" ? (
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <FieldLabel>Years to Norwood V (model estimate)</FieldLabel>
              <p className="mt-0.5 tabular-nums text-white">
                {hp.forecast.estimated_years_to_target.toFixed(1)} yr
              </p>
            </div>
            <div>
              <FieldLabel>Current grade / ordinal</FieldLabel>
              <p className="mt-0.5 text-slate-200">
                {hp.forecast.current_grade} (ordinal {hp.forecast.current_ordinal})
              </p>
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>Velocity used in projection</FieldLabel>
              <p className="mt-0.5 tabular-nums text-slate-200">
                {formatVelocityGradesPerYearWithUnit(hp.forecast.velocity_grades_per_year)}
              </p>
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-[#94A3B8]">
            No Norwood V timing estimate for this snapshot (requires positive Norwood velocity and
            current stage below V).
          </p>
        )}
      </div>

      <div className="mt-8 border-t border-white/10 pt-6">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-cyan-400/90">
          Network cohort context
        </h3>
        <p className="mt-1 text-xs text-[#64748B]">
          Anonymised weekly aggregates keyed by cohort signature — no patient identifiers in
          benchmark rows.
        </p>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <FieldLabel>Age band (cohorting)</FieldLabel>
            <p className="mt-0.5 text-slate-200">{humaniseAgeBand(cohort.age_band)}</p>
          </div>
          <div className="sm:col-span-2 min-w-0">
            <FieldLabel>Cohort signature</FieldLabel>
            <p className="mt-0.5 break-all font-mono text-xs text-[#94A3B8]">
              {cohort.cohort_signature || "—"}
            </p>
          </div>
        </div>
        {hasNetworkRow ? (
          <dl className="mt-4 grid gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] p-3 text-sm sm:grid-cols-2">
            <div>
              <FieldLabel>Network mean velocity</FieldLabel>
              <p className="mt-0.5 tabular-nums text-white">
                {formatVelocityGradesPerYearWithUnit(net.population_mean_velocity)}
              </p>
            </div>
            <div>
              <FieldLabel>Network sample count</FieldLabel>
              <p className="mt-0.5 tabular-nums text-slate-200">
                {net.population_sample_count ?? "—"}
              </p>
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>Week bucket</FieldLabel>
              <p className="mt-0.5 text-slate-200">{net.week_bucket ?? "—"}</p>
            </div>
          </dl>
        ) : (
          <p className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-[#94A3B8]">
            No anonymised network bucket matched this cohort for the latest available ingestion
            week. Benchmarks may be unavailable or not yet populated for this signature.
          </p>
        )}
      </div>

      <p className="mt-6 text-[10px] text-[#475569]">
        Engine {hp.engine_version} · timeline cap {hp.timeline_point_cap}
      </p>
    </FiSection>
  );
}
