"use client";

import Link from "next/link";
import { useState } from "react";

import type { GraftTrayAiReviewAction } from "@/src/lib/imaging-os/graftTrayCountTypes";
import type { GraftTrayAiEstimateSummary } from "@/src/lib/imaging-os/graftTrayCountTypes";
import {
  buildGraftTrayAiReviewDisplayConfig,
  type GraftTrayAiReviewAuditEntry,
} from "@/src/lib/imaging-os/graftTrayReviewUxCore";

const TONE_CLASSES = {
  neutral: "border-slate-500/30 bg-slate-950/30 text-slate-200",
  info: "border-sky-500/30 bg-sky-950/20 text-sky-100",
  success: "border-emerald-500/30 bg-emerald-950/20 text-emerald-100",
  warning: "border-amber-500/30 bg-amber-950/20 text-amber-100",
  danger: "border-rose-500/30 bg-rose-950/20 text-rose-100",
} as const;

type ReviewHandler = (
  action: GraftTrayAiReviewAction,
  options?: { correctedCount?: number; staffNote?: string }
) => void;

type Props = {
  estimate: GraftTrayAiEstimateSummary;
  auditTrail?: GraftTrayAiReviewAuditEntry[];
  pending?: boolean;
  mode?: "actions" | "readonly";
  reviewQueueHref?: string | null;
  staffNote?: string;
  onStaffNoteChange?: (value: string) => void;
  onReview?: ReviewHandler;
};

export function GraftTrayAiReviewPanel({
  estimate,
  auditTrail = [],
  pending = false,
  mode = "actions",
  reviewQueueHref = null,
  staffNote = "",
  onStaffNoteChange,
  onReview,
}: Props) {
  const [overrideCount, setOverrideCount] = useState("");
  const display = buildGraftTrayAiReviewDisplayConfig(estimate);

  return (
    <div className="rounded border border-violet-500/25 bg-violet-950/20 p-3 text-[11px] text-violet-100">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-violet-200">Graft tray AI validation</p>
          <p className="mt-1 text-violet-100/90">{display.label}</p>
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TONE_CLASSES[display.tone]}`}
        >
          {display.state.replace(/_/g, " ")}
        </span>
      </div>

      <div className="mt-2 grid gap-1 text-violet-100/90 sm:grid-cols-2">
        <p>
          AI estimate:{" "}
          <span className="font-semibold text-violet-50">
            {estimate.estimated_graft_count ?? "—"}
          </span>
        </p>
        <p>
          Manual count:{" "}
          <span className="font-semibold text-violet-50">{estimate.manual_graft_count ?? "—"}</span>
          {estimate.manual_count_source !== "missing"
            ? ` (${estimate.manual_count_source.replace(/_/g, " ")})`
            : null}
        </p>
        <p>
          Mismatch: <span className="font-medium">{estimate.mismatch_band.replace(/_/g, " ")}</span>
          {estimate.delta != null ? ` · Δ ${estimate.delta}` : null}
        </p>
        <p>
          Confidence: {estimate.confidence_band} · Quality: {estimate.image_quality}
        </p>
        {display.finalAcceptedCount != null ? (
          <p className="sm:col-span-2">
            Final accepted count:{" "}
            <span className="font-semibold text-emerald-200">{display.finalAcceptedCount}</span>
          </p>
        ) : display.requiresStaffReview ? (
          <p className="sm:col-span-2 text-amber-200/90">
            No final count until staff completes review.
          </p>
        ) : null}
      </div>

      {display.warnings.length > 0 ? (
        <ul className="mt-2 space-y-1 rounded border border-amber-500/20 bg-amber-950/10 p-2 text-[10px] text-amber-100">
          {display.warnings.map((warning) => (
            <li key={warning}>• {warning}</li>
          ))}
        </ul>
      ) : null}

      {mode === "actions" && display.requiresStaffReview && onReview ? (
        <>
          <div className="mt-3 flex flex-wrap gap-1">
            <ActionButton
              label="Accept AI"
              tone="success"
              disabled={pending}
              onClick={() => onReview("accept_ai_estimate", { staffNote })}
            />
            <ActionButton
              label="Accept manual"
              tone="info"
              disabled={pending || estimate.manual_graft_count == null}
              onClick={() => onReview("accept_manual_count", { staffNote })}
            />
            <ActionButton
              label="Reject AI"
              tone="danger"
              disabled={pending}
              onClick={() => onReview("reject_ai_estimate", { staffNote })}
            />
            <ActionButton
              label="Quality issue / retake"
              tone="warning"
              disabled={pending}
              onClick={() => onReview("request_retake", { staffNote })}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1">
            <input
              type="number"
              min={0}
              placeholder="Override count"
              value={overrideCount}
              onChange={(e) => setOverrideCount(e.target.value)}
              className="w-28 rounded border border-violet-700/40 bg-[#020617] px-2 py-1 text-[10px]"
            />
            <ActionButton
              label="Override with manual count"
              tone="neutral"
              disabled={pending || !overrideCount.trim()}
              onClick={() =>
                onReview("correct_count", {
                  correctedCount: Number.parseInt(overrideCount, 10) || 0,
                  staffNote,
                })
              }
            />
          </div>
        </>
      ) : null}

      {mode === "readonly" && display.requiresStaffReview && reviewQueueHref ? (
        <p className="mt-3 text-xs text-amber-200/90">
          <Link href={reviewQueueHref} className="font-semibold underline-offset-2 hover:underline">
            Open Imaging review queue
          </Link>{" "}
          to accept, override, or reject this AI estimate.
        </p>
      ) : null}

      {auditTrail.length > 0 ? (
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
                  {entry.staff_note ? (
                    <p className="text-slate-500">Note: {entry.staff_note}</p>
                  ) : null}
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      {mode === "actions" && onStaffNoteChange ? (
        <input
          type="text"
          placeholder="Review notes (optional)"
          value={staffNote}
          onChange={(e) => onStaffNoteChange(e.target.value)}
          className="mt-3 w-full rounded border border-slate-700 bg-[#020617] px-2 py-1 text-xs"
        />
      ) : null}
    </div>
  );
}

function ActionButton({
  label,
  tone,
  disabled,
  onClick,
}: {
  label: string;
  tone: keyof typeof TONE_CLASSES;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded px-2 py-1 text-[10px] font-medium disabled:opacity-40 ${TONE_CLASSES[tone]}`}
    >
      {label}
    </button>
  );
}
