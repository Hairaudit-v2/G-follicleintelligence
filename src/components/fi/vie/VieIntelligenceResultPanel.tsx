"use client";

import { AlertTriangle, CheckCircle2, RotateCcw, XCircle } from "lucide-react";

import type { VieCaptureReviewPayload } from "@/src/lib/vie/vieProtocolTypes";

function statusTone(status: string): { className: string; icon: "pass" | "warn" | "fail" | "pending" } {
  if (status === "heuristic_pass" || status === "stub_pass" || status === "stub_match") {
    return { className: "text-emerald-700", icon: "pass" };
  }
  if (status === "heuristic_fail") return { className: "text-red-700", icon: "fail" };
  return { className: "text-amber-700", icon: "pending" };
}

function StatusIcon({ kind }: { kind: ReturnType<typeof statusTone>["icon"] }) {
  if (kind === "pass") return <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />;
  if (kind === "fail") return <XCircle className="h-4 w-4 shrink-0" aria-hidden />;
  return <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />;
}

function CheckRow({ label, status, message }: { label: string; status: string; message: string }) {
  const tone = statusTone(status);
  return (
    <li className={`flex gap-2 rounded-md px-2 py-1.5 text-sm ${tone.className}`}>
      <StatusIcon kind={tone.icon} />
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-xs opacity-90">{message}</p>
      </div>
    </li>
  );
}

export function VieIntelligenceResultPanel({
  review,
  pending,
  onAccept,
  onRetake,
  onOverrideAccept,
}: {
  review: VieCaptureReviewPayload;
  pending: boolean;
  onAccept: () => void;
  onRetake: () => void;
  onOverrideAccept?: () => void;
}) {
  const usability = review.clinical_usability;
  const usabilityTone =
    usability.status === "usable"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : usability.status === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-red-200 bg-red-50 text-red-900";

  return (
    <div className="space-y-3 rounded-lg border border-cyan-200 bg-cyan-50/40 p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-800">Capture intelligence</p>
        <p className="mt-1 text-sm text-gray-800">
          Detected view: <span className="font-medium">{review.protocol_slot_slug.replace(/_/g, " ")}</span>
          {" · "}
          Region: {review.classification.expected_region.replace(/_/g, " ")}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-md bg-white px-3 py-2 ring-1 ring-gray-200">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-gray-500">Quality score</p>
          <p className="text-lg font-semibold tabular-nums text-gray-900">{review.quality_score}/100</p>
          <p className="text-xs text-gray-600">{review.quality_band.replace(/_/g, " ")}</p>
        </div>
        <div className={`flex-1 rounded-md border px-3 py-2 ${usabilityTone}`}>
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide">Clinical usability</p>
          <p className="text-sm font-medium capitalize">{usability.status.replace(/_/g, " ")}</p>
          {usability.retake_recommendation ? (
            <p className="mt-1 text-xs">{usability.retake_recommendation}</p>
          ) : null}
        </div>
      </div>

      <ul className="space-y-1">
        <CheckRow label="Classification" status={review.classification.status} message={review.classification.message} />
        <CheckRow label="Angle" status={review.angle_verification.status} message={review.angle_verification.message} />
        <CheckRow label="Focus" status={review.focus_verification.status} message={review.focus_verification.message} />
        <CheckRow
          label="Lighting"
          status={review.lighting_verification.status}
          message={review.lighting_verification.message}
        />
      </ul>

      {usability.warnings.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Warnings</p>
          <ul className="mt-1 list-inside list-disc text-xs text-amber-900">
            {usability.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {!review.review.allowed && review.review.reason ? (
        <p className="text-sm text-red-700" role="alert">
          {review.review.reason}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={pending || !review.review.allowed}
          onClick={onAccept}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Accept capture
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onRetake}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50"
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          Retake
        </button>
      </div>

      {review.review.requires_override && review.policy.allow_quality_override && onOverrideAccept ? (
        <button
          type="button"
          disabled={pending}
          onClick={onOverrideAccept}
          className="w-full rounded-lg border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
        >
          Accept with quality override (clinic policy allows)
        </button>
      ) : null}
    </div>
  );
}
