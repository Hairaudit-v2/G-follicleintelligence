"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";

import { updateVieComparisonReviewStatusAction } from "@/lib/actions/fi-vie-comparison-actions";
import {
  VIE_COMPARISON_CATEGORIES,
  type VieComparisonConfidenceBand,
  type VieComparisonPairRow,
  type VieComparisonRecommendedUse,
} from "@/src/lib/vie/vieComparisonTypes";
import type { VieAlignmentStatus } from "@/src/lib/vie/vieAlignmentTypes";
import { journeyStageLabel } from "@/src/lib/vie/vieLongitudinalComparisonCore";
import {
  mapComparisonPairToOutcomeInput,
  pairContributesToOutcomeEvidence,
} from "@/src/lib/vie/vieOutcomeIntelligenceCore";
import type { PatientImageProfileTile } from "@/src/lib/patientImages/patientImageTypes";

function confidenceClass(band: VieComparisonConfidenceBand): string {
  if (band === "high") return "text-emerald-300 bg-emerald-500/10 border-emerald-500/20";
  if (band === "medium") return "text-amber-300 bg-amber-400/10 border-amber-400/20";
  return "text-rose-300 bg-rose-500/10 border-rose-500/20";
}

function alignmentStatusClass(status: VieAlignmentStatus): string {
  if (status === "excellent") return "text-emerald-300 bg-emerald-500/10 border-emerald-500/20";
  if (status === "acceptable") return "text-cyan-800 bg-cyan-50 border-cyan-200";
  if (status === "poor") return "text-amber-300 bg-amber-400/10 border-amber-400/20";
  if (status === "retake_recommended") return "text-rose-300 bg-rose-500/10 border-rose-500/20";
  return "text-slate-400 bg-white/[0.03] border-white/[0.08]";
}

type AlignmentFilter = "" | "high_alignment" | "poor_alignment" | "standardized_evidence";

function categoryLabel(cat: string): string {
  return cat.replace(/_/g, " ");
}

export function VieComparisonSuggestionsPanel({
  tenantId,
  patientId,
  pairs,
  tilesById,
  adminKey,
  onReviewUpdated,
}: {
  tenantId: string;
  patientId: string;
  pairs: VieComparisonPairRow[];
  tilesById: Map<string, PatientImageProfileTile>;
  adminKey?: string;
  onReviewUpdated?: () => void;
}) {
  const [regionFilter, setRegionFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [useFilter, setUseFilter] = useState<VieComparisonRecommendedUse | "">("");
  const [confidenceFilter, setConfidenceFilter] = useState<VieComparisonConfidenceBand | "">("");
  const [alignmentFilter, setAlignmentFilter] = useState<AlignmentFilter>("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const regions = useMemo(
    () => [...new Set(pairs.map((p) => p.anatomical_region))].sort(),
    [pairs]
  );

  const filtered = useMemo(() => {
    return pairs.filter((p) => {
      if (p.review_status === "dismissed") return false;
      if (regionFilter && p.anatomical_region !== regionFilter) return false;
      if (categoryFilter && p.comparison_category !== categoryFilter) return false;
      if (useFilter && !p.recommended_use.includes(useFilter)) return false;
      if (confidenceFilter && p.confidence_band !== confidenceFilter) return false;
      if (alignmentFilter === "high_alignment") {
        const score = p.alignment?.alignment_score;
        if (score == null || score < 70) return false;
      }
      if (alignmentFilter === "poor_alignment") {
        const status = p.alignment?.alignment_status;
        if (status !== "poor" && status !== "retake_recommended") return false;
      }
      if (alignmentFilter === "standardized_evidence" && !p.alignment?.is_standardized_evidence) return false;
      return true;
    });
  }, [pairs, regionFilter, categoryFilter, useFilter, confidenceFilter, alignmentFilter]);

  const onReview = (pairId: string, reviewStatus: "accepted" | "dismissed") => {
    setMsg(null);
    startTransition(async () => {
      const res = await updateVieComparisonReviewStatusAction(tenantId, patientId, {
        pairId,
        reviewStatus,
        adminKey: adminKey?.trim() || undefined,
      });
      if (!res.ok) {
        setMsg(res.error);
        return;
      }
      onReviewUpdated?.();
    });
  };

  if (pairs.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        No suggested comparison pairs yet. Accept VIE protocol captures to build before/after candidates automatically.
      </p>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select
          className="rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1 text-xs"
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          aria-label="Filter by anatomical region"
        >
          <option value="">All regions</option>
          {regions.map((r) => (
            <option key={r} value={r}>
              {r.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select
          className="rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1 text-xs"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Filter by comparison category"
        >
          <option value="">All categories</option>
          {VIE_COMPARISON_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {categoryLabel(c)}
            </option>
          ))}
        </select>
        <select
          className="rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1 text-xs"
          value={useFilter}
          onChange={(e) => setUseFilter(e.target.value as VieComparisonRecommendedUse | "")}
          aria-label="Filter by recommended use"
        >
          <option value="">All uses</option>
          <option value="clinical_review">Clinical review</option>
          <option value="patient_progress">Patient progress</option>
          <option value="audit_evidence">Audit evidence</option>
          <option value="marketing_candidate">Marketing candidate</option>
          <option value="training_case">Training case</option>
        </select>
        <select
          className="rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1 text-xs"
          value={confidenceFilter}
          onChange={(e) => setConfidenceFilter(e.target.value as VieComparisonConfidenceBand | "")}
          aria-label="Filter by confidence band"
        >
          <option value="">All confidence</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          className="rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1 text-xs"
          value={alignmentFilter}
          onChange={(e) => setAlignmentFilter(e.target.value as AlignmentFilter)}
          aria-label="Filter by alignment"
        >
          <option value="">All alignment</option>
          <option value="high_alignment">High alignment only</option>
          <option value="poor_alignment">Poor alignment only</option>
          <option value="standardized_evidence">Standardized evidence only</option>
        </select>
      </div>

      {msg ? <p className="text-xs text-rose-300">{msg}</p> : null}

      <ul className="space-y-4">
        {filtered.map((pair) => {
          const beforeTile = tilesById.get(pair.before_image_id);
          const afterTile = tilesById.get(pair.after_image_id);
          const outcomeContribution = pairContributesToOutcomeEvidence(mapComparisonPairToOutcomeInput(pair));
          return (
            <li key={pair.id} className="rounded-lg border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-100">{categoryLabel(pair.comparison_category)}</p>
                  <p className="text-xs text-slate-400">
                    {pair.anatomical_region.replace(/_/g, " ")} · {pair.slot_family.replace(/_/g, " ")} ·{" "}
                    {pair.days_between} day{pair.days_between === 1 ? "" : "s"} apart
                  </p>
                  <p className="text-xs text-gray-500">
                    {journeyStageLabel(pair.before_timepoint)} → {journeyStageLabel(pair.after_timepoint)}
                  </p>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded border px-2 py-0.5 text-xs font-medium ${confidenceClass(pair.confidence_band)}`}
                    >
                      {pair.confidence_band} confidence
                    </span>
                    {pair.alignment?.alignment_status ? (
                      <span
                        className={`rounded border px-2 py-0.5 text-xs font-medium capitalize ${alignmentStatusClass(pair.alignment.alignment_status)}`}
                      >
                        {pair.alignment.alignment_status.replace(/_/g, " ")}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {[beforeTile, afterTile].map((tile, idx) => (
                  <div key={idx} className="space-y-1">
                    <p className="text-[0.65rem] font-medium uppercase tracking-wide text-gray-500">
                      {idx === 0 ? "Before" : "After"}
                    </p>
                    <div className="relative aspect-square overflow-hidden rounded border border-white/[0.06] bg-white/[0.03]">
                      {tile ? (
                        <Image
                          src={tile.signed.url}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="200px"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-gray-400">Image unavailable</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <dl className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-3">
                <div>
                  <dt className="font-medium text-gray-500">Quality match</dt>
                  <dd>{pair.quality_match_score}/100</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500">Alignment score</dt>
                  <dd>{pair.alignment?.alignment_score != null ? `${pair.alignment.alignment_score}%` : "—"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500">Alignment confidence</dt>
                  <dd>{pair.alignment?.confidence_band ?? "—"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500">Framing</dt>
                  <dd>{pair.framing_match_status}</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500">Angle</dt>
                  <dd>{pair.angle_match_status.replace(/_/g, " ")}</dd>
                </div>
              </dl>

              {pair.recommended_use.length > 0 ? (
                <p className="mt-2 text-xs text-slate-400">
                  Suggested use: {pair.recommended_use.map((u) => u.replace(/_/g, " ")).join(", ")}
                </p>
              ) : null}

              <p
                className={`mt-2 text-xs ${outcomeContribution.contributes ? "text-emerald-300" : "text-gray-500"}`}
              >
                Outcome evidence:{" "}
                {outcomeContribution.contributes
                  ? `contributes (${outcomeContribution.domains.map((d) => d.replace(/_/g, " ")).join(", ")})`
                  : (outcomeContribution.reason ?? "does not contribute")}
              </p>

              {pair.warnings.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs text-amber-300">
                  {pair.warnings.map((w) => (
                    <li key={w}>⚠ {w}</li>
                  ))}
                </ul>
              ) : null}

              {pair.review_status === "suggested" ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    className="rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                    onClick={() => onReview(pair.id, "accepted")}
                  >
                    Accept pair
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    className="rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1 text-xs font-medium text-slate-300 hover:bg-white/[0.03] disabled:opacity-50"
                    onClick={() => onReview(pair.id, "dismissed")}
                  >
                    Dismiss
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-xs font-medium text-emerald-300">Review status: {pair.review_status}</p>
              )}
            </li>
          );
        })}
      </ul>

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-400">No pairs match the current filters.</p>
      ) : null}
    </section>
  );
}
