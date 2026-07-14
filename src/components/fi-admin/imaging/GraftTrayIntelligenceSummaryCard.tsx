"use client";

import Link from "next/link";

import type { GraftTrayAiReviewAuditEntry } from "@/src/lib/imaging-os/graftTrayReviewUxCore";
import type { SurgeryOsGraftTrayIntelligenceSummary } from "@/src/lib/surgeryOs/surgeryOsBoardModel.types";
import type { GraftTrayIntelligenceSummary } from "@/src/lib/imaging-os/graftTrayIntelligenceSummaryCore";

const TONE_CLASSES = {
  neutral: "border-slate-500/30 bg-slate-950/30 text-slate-200",
  info: "border-sky-500/30 bg-sky-950/20 text-sky-100",
  success: "border-emerald-500/30 bg-emerald-950/20 text-emerald-100",
  warning: "border-amber-500/30 bg-amber-950/20 text-amber-100",
  danger: "border-rose-500/30 bg-rose-950/20 text-rose-100",
} as const;

type SummaryView = Pick<
  GraftTrayIntelligenceSummary,
  | "hasFinalCount"
  | "finalAcceptedCount"
  | "originalAiEstimate"
  | "manualCount"
  | "varianceDelta"
  | "mismatchBand"
  | "confidenceBand"
  | "imageQuality"
  | "reviewDecision"
  | "reviewStatus"
  | "displayState"
  | "reviewerLabel"
  | "reviewedAt"
  | "finalCountSource"
  | "isReadOnly"
  | "supersededStaleJob"
  | "sourceImageHref"
  | "warnings"
> & {
  reviewAuditTrail?: GraftTrayAiReviewAuditEntry[];
};

function resolveTone(summary: SummaryView): keyof typeof TONE_CLASSES {
  if (summary.supersededStaleJob) return "warning";
  if (summary.hasFinalCount) return "success";
  if (summary.reviewStatus === "rejected_ai" || summary.reviewStatus === "retake_requested") {
    return "danger";
  }
  if (summary.reviewStatus === "pending_review") return "info";
  return "neutral";
}

function formatFinalCountSource(source: SummaryView["finalCountSource"]): string | null {
  if (!source) return null;
  return source === "override" ? "staff override" : source;
}

export function GraftTrayIntelligenceSummaryCard({
  summary,
  compact = false,
  showAuditTrail = true,
  title = "Graft tray intelligence",
}: {
  summary: SummaryView | SurgeryOsGraftTrayIntelligenceSummary;
  compact?: boolean;
  showAuditTrail?: boolean;
  title?: string;
}) {
  const tone = resolveTone(summary);
  const auditTrail = summary.reviewAuditTrail ?? [];

  return (
    <div
      className={`rounded border p-3 text-[11px] ${
        compact
          ? "border-violet-500/20 bg-violet-950/15 text-violet-100"
          : "border-violet-500/25 bg-violet-950/20 text-violet-100"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-violet-200">{title}</p>
          <p className="mt-1 text-violet-100/90">
            {summary.hasFinalCount
              ? `Final accepted count: ${summary.finalAcceptedCount}`
              : summary.supersededStaleJob
                ? "Awaiting fresh AI estimate after replay"
                : "No final count until staff review completes"}
          </p>
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TONE_CLASSES[tone]}`}
        >
          {summary.displayState.replace(/_/g, " ")}
        </span>
      </div>

      <div className={`mt-2 grid gap-1 text-violet-100/90 ${compact ? "" : "sm:grid-cols-2"}`}>
        {summary.originalAiEstimate != null ? (
          <p>
            AI estimate:{" "}
            <span className="font-semibold text-violet-50">{summary.originalAiEstimate}</span>
          </p>
        ) : null}
        <p>
          Manual count:{" "}
          <span className="font-semibold text-violet-50">{summary.manualCount ?? "—"}</span>
        </p>
        <p>
          Variance: <span className="font-medium">{summary.mismatchBand.replace(/_/g, " ")}</span>
          {summary.varianceDelta != null ? ` · Δ ${summary.varianceDelta}` : null}
        </p>
        <p>
          Confidence: {summary.confidenceBand} · Quality: {summary.imageQuality}
        </p>
        {summary.finalCountSource ? (
          <p>
            Final source:{" "}
            <span className="font-medium">{formatFinalCountSource(summary.finalCountSource)}</span>
          </p>
        ) : null}
        {summary.reviewedAt ? (
          <p className={compact ? "" : "sm:col-span-2"}>
            Reviewed {new Date(summary.reviewedAt).toLocaleString()}
            {summary.reviewerLabel ? ` · ${summary.reviewerLabel}` : ""}
          </p>
        ) : null}
      </div>

      {summary.sourceImageHref ? (
        <p className="mt-2">
          <Link
            href={summary.sourceImageHref}
            className="font-semibold text-violet-300 underline-offset-2 hover:underline"
          >
            View source image
          </Link>
        </p>
      ) : null}

      {summary.isReadOnly ? (
        <p className="mt-2 text-[10px] text-emerald-200/80">Read-only after review finalisation.</p>
      ) : null}

      {summary.warnings.length > 0 ? (
        <ul className="mt-2 space-y-1 rounded border border-amber-500/20 bg-amber-950/10 p-2 text-[10px] text-amber-100">
          {summary.warnings.map((warning) => (
            <li key={warning}>• {warning}</li>
          ))}
        </ul>
      ) : null}

      {showAuditTrail && auditTrail.length > 0 ? (
        <div className="mt-3 rounded border border-white/10 bg-slate-950/40 p-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Review audit trail
          </p>
          <ul className="mt-2 space-y-2">
            {auditTrail
              .slice()
              .reverse()
              .map((entry, index) => (
                <li key={`${entry.reviewed_at}-${index}`} className="text-[10px] text-slate-300">
                  <p>
                    {new Date(entry.reviewed_at).toLocaleString()} ·{" "}
                    {entry.decision.replace(/_/g, " ")} → {entry.review_status.replace(/_/g, " ")}
                  </p>
                  <p className="text-slate-400">
                    AI {entry.previous_ai_estimate ?? "—"} · manual{" "}
                    {entry.previous_manual_count ?? "—"} · final {entry.final_accepted_count ?? "—"}
                  </p>
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
