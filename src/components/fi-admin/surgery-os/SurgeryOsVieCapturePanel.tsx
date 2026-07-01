"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Circle } from "lucide-react";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { surgeryLinkButtonClass } from "@/src/lib/fiAdmin/surgeryPresentation";
import type { SurgeryOsLiveSurgery } from "@/src/lib/surgeryOs/surgeryOsBoardPayloadSchema";
import type { SurgeryOsVieCaptureSummary } from "@/src/lib/surgeryOs/surgeryOsVieCapture.types";
import { SurgeryOsCaptureEvidenceButton } from "./SurgeryOsCaptureEvidenceButton";

function statusLabel(status: SurgeryOsVieCaptureSummary["graftTrayStatus"]): string {
  if (status === "complete") return "Complete";
  if (status === "pending_review") return "Pending review";
  if (status === "partial") return "Partial";
  return "Missing";
}

function statusClass(status: SurgeryOsVieCaptureSummary["graftTrayStatus"]): string {
  if (status === "complete") return "text-emerald-300";
  if (status === "pending_review") return "text-amber-300";
  if (status === "partial") return "text-amber-200";
  return "text-rose-300";
}

function percentClass(percent: number): string {
  if (percent >= 100) return "text-emerald-300";
  if (percent >= 50) return "text-amber-200";
  return "text-rose-300";
}

function comparisonPairLabel(status: "ready" | "partial" | "missing"): string {
  if (status === "ready") return "Pair ready";
  if (status === "partial") return "Partial";
  return "Missing";
}

function comparisonPairClass(status: "ready" | "partial" | "missing"): string {
  if (status === "ready") return "text-emerald-300";
  if (status === "partial") return "text-amber-200";
  return "text-rose-300";
}

function outcomeStatusClass(status: string): string {
  if (status === "audit_ready" || status === "favourable") return "text-emerald-300";
  if (status === "monitoring" || status === "early_signal") return "text-cyan-300";
  if (status === "concern") return "text-amber-300";
  return "text-slate-400";
}

export function SurgeryOsVieCapturePanel({
  tenantId,
  surgeries,
  vieCapture,
  onMutated,
}: {
  tenantId: string;
  surgeries: SurgeryOsLiveSurgery[];
  vieCapture: SurgeryOsVieCaptureSummary[];
  onMutated: () => void;
}) {
  const [surgeryId, setSurgeryId] = useState("");
  const captureBySurgery = useMemo(
    () => new Map(vieCapture.map((c) => [c.surgeryId, c])),
    [vieCapture]
  );

  const selectedSurgery = surgeries.find((s) => s.id === surgeryId) ?? surgeries[0] ?? null;
  const capture = selectedSurgery ? (captureBySurgery.get(selectedSurgery.id) ?? null) : null;

  if (surgeries.length === 0) return null;

  return (
    <DashboardCard className="p-5 sm:p-6" role="region" aria-labelledby="so-vie-capture-heading">
      <SectionHeader
        id="so-vie-capture-heading"
        kicker="VIE"
        title="Surgical evidence capture"
        description="Guided Surgery Day protocol capture — required operative documentation without leaving the theatre workflow."
        className="mb-4"
      />

      {surgeries.length > 1 ? (
        <div className="mb-4">
          <label htmlFor="so-vie-surgery-select" className="text-xs font-medium text-[#94A3B8]">
            Active procedure
          </label>
          <select
            id="so-vie-surgery-select"
            value={selectedSurgery?.id ?? ""}
            onChange={(e) => setSurgeryId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[#334155] bg-[#0F172A] px-3 py-2 text-sm text-[#F8FAFC]"
          >
            {surgeries.map((s) => (
              <option key={s.id} value={s.id}>
                {s.patientLabel} · {s.procedurePhaseLabel}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {!capture ? (
        <p className="text-sm text-[#94A3B8]">Select an active procedure to view capture status.</p>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-[#334155] bg-[#0F172A]/60 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-[#64748B]">
                Surgical documentation
              </p>
              <p
                className={cn(
                  "mt-1 text-2xl font-semibold",
                  percentClass(capture.surgicalDocumentationPercent)
                )}
              >
                {capture.surgicalDocumentationPercent}%
              </p>
            </div>
            <div className="rounded-xl border border-[#334155] bg-[#0F172A]/60 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-[#64748B]">Donor documentation</p>
              <p
                className={cn(
                  "mt-1 text-2xl font-semibold",
                  percentClass(capture.donorDocumentationPercent)
                )}
              >
                {capture.donorDocumentationPercent}%
              </p>
            </div>
            <div className="rounded-xl border border-[#334155] bg-[#0F172A]/60 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-[#64748B]">Graft tray evidence</p>
              <p className={cn("mt-1 text-lg font-semibold", statusClass(capture.graftTrayStatus))}>
                {statusLabel(capture.graftTrayStatus)}
              </p>
            </div>
            <div className="rounded-xl border border-[#334155] bg-[#0F172A]/60 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-[#64748B]">Immediate post-op</p>
              <p
                className={cn(
                  "mt-1 text-lg font-semibold",
                  statusClass(capture.immediatePostOpStatus)
                )}
              >
                {statusLabel(capture.immediatePostOpStatus)}
              </p>
            </div>
          </div>

          {capture.outcomeReadiness ? (
            <div className="rounded-xl border border-[#334155] bg-[#0F172A]/60 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-[#64748B]">
                Outcome readiness (evidence quality)
              </p>
              <p className="mt-1 text-lg font-semibold text-[#F8FAFC]">
                {capture.outcomeReadiness.overall_score}%
                <span className="ml-2 text-sm font-normal text-[#94A3B8]">
                  {capture.outcomeReadiness.confidence_band} confidence
                </span>
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3 text-xs">
                <p className="text-[#94A3B8]">
                  Surgical healing:{" "}
                  <span
                    className={outcomeStatusClass(capture.outcomeReadiness.surgical_healing.status)}
                  >
                    {capture.outcomeReadiness.surgical_healing.status.replace(/_/g, " ")} (
                    {capture.outcomeReadiness.surgical_healing.evidence_count} evidence)
                  </span>
                </p>
                <p className="text-[#94A3B8]">
                  Donor recovery:{" "}
                  <span
                    className={outcomeStatusClass(capture.outcomeReadiness.donor_recovery.status)}
                  >
                    {capture.outcomeReadiness.donor_recovery.status.replace(/_/g, " ")} (
                    {capture.outcomeReadiness.donor_recovery.evidence_count} evidence)
                  </span>
                </p>
                <p className="text-[#94A3B8]">
                  Documentation:{" "}
                  <span
                    className={outcomeStatusClass(
                      capture.outcomeReadiness.documentation_readiness.status
                    )}
                  >
                    {capture.outcomeReadiness.documentation_readiness.status.replace(/_/g, " ")}
                  </span>
                </p>
              </div>
              {capture.outcomeReadiness.audit_ready ? (
                <p className="mt-2 text-xs text-emerald-300">
                  Audit-ready evidence signal — suitable for VIE-8 evidence packs
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-3 text-xs">
            <p className="rounded-lg border border-[#334155] px-3 py-2 text-[#94A3B8]">
              Donor extraction pair:{" "}
              <span className={comparisonPairClass(capture.comparisonStatus.donor_extraction_pair)}>
                {comparisonPairLabel(capture.comparisonStatus.donor_extraction_pair)}
              </span>
            </p>
            <p className="rounded-lg border border-[#334155] px-3 py-2 text-[#94A3B8]">
              Graft tray compare:{" "}
              <span className={comparisonPairClass(capture.comparisonStatus.graft_tray_pair)}>
                {comparisonPairLabel(capture.comparisonStatus.graft_tray_pair)}
              </span>
            </p>
            <p className="rounded-lg border border-[#334155] px-3 py-2 text-[#94A3B8]">
              Pre/post-op pair:{" "}
              <span
                className={comparisonPairClass(capture.comparisonStatus.immediate_post_op_pair)}
              >
                {comparisonPairLabel(capture.comparisonStatus.immediate_post_op_pair)}
              </span>
            </p>
          </div>

          {capture.warnings.length > 0 ? (
            <ul className="space-y-2">
              {capture.warnings.map((w) => (
                <li
                  key={`${w.kind}-${w.slotSlug ?? w.label}`}
                  className={cn(
                    "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
                    w.severity === "critical"
                      ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
                      : "border-amber-500/25 bg-amber-500/10 text-amber-100"
                  )}
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  {w.label}
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
              No critical capture warnings for this procedure.
            </div>
          )}

          <div className="space-y-3">
            {capture.phases.map((phase) => (
              <div key={phase.phase} className="rounded-xl border border-[#334155] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-[#F8FAFC]">{phase.label}</p>
                  <p className="text-xs text-[#94A3B8]">
                    {phase.acceptedCount}/{phase.requiredTotal} accepted
                    {phase.pendingReviewCount > 0
                      ? ` · ${phase.pendingReviewCount} pending review`
                      : null}
                    {phase.latestQualityScore != null
                      ? ` · Q${Math.round(phase.latestQualityScore)}`
                      : null}
                  </p>
                </div>
                {phase.nextRecommendedSlotLabel ? (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-[#64748B]">
                    <Circle className="h-3 w-3 text-cyan-400" aria-hidden />
                    Next: {phase.nextRecommendedSlotLabel}
                  </p>
                ) : phase.acceptedCount >= phase.requiredTotal && phase.requiredTotal > 0 ? (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" aria-hidden />
                    Phase complete
                  </p>
                ) : null}
              </div>
            ))}
          </div>

          {capture.longitudinalSurfacing ? (
            <div className="rounded-xl border border-[#334155] bg-[#0F172A]/60 px-4 py-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                Longitudinal intelligence
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <Link
                  href={capture.longitudinalSurfacing.review_queue_href}
                  className="rounded-lg border border-cyan-500/30 px-3 py-1.5 text-cyan-200 hover:bg-cyan-500/10"
                >
                  Review queue
                  {capture.longitudinalSurfacing.pending_review_count > 0
                    ? ` (${capture.longitudinalSurfacing.pending_review_count})`
                    : ""}
                </Link>
                <Link
                  href={capture.longitudinalSurfacing.patient_twin_href}
                  className="rounded-lg border border-[#334155] px-3 py-1.5 text-[#CBD5E1] hover:bg-white/5"
                >
                  Patient Twin
                </Link>
                <Link
                  href={capture.longitudinalSurfacing.imaging_gallery_href}
                  className="rounded-lg border border-[#334155] px-3 py-1.5 text-[#CBD5E1] hover:bg-white/5"
                >
                  Imaging gallery
                </Link>
                <Link
                  href={capture.longitudinalSurfacing.vie_compare_href}
                  className="rounded-lg border border-[#334155] px-3 py-1.5 text-[#CBD5E1] hover:bg-white/5"
                >
                  VIE compare
                </Link>
              </div>
              {capture.longitudinalSurfacing.retake_required_count > 0 ? (
                <p className="text-xs text-rose-300">
                  {capture.longitudinalSurfacing.retake_required_count} phase
                  {capture.longitudinalSurfacing.retake_required_count === 1 ? "" : "s"} may need
                  retake — staff review recommended.
                </p>
              ) : null}
              <ul className="grid gap-1 sm:grid-cols-2 text-xs text-[#94A3B8]">
                {capture.longitudinalSurfacing.slots.map((slot) => (
                  <li key={slot.phase} className="rounded border border-[#334155] px-2 py-1">
                    <span className="text-[#CBD5E1]">{slot.label}</span>
                    {": "}
                    <span className="capitalize">{slot.status.replace(/_/g, " ")}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <SurgeryOsCaptureEvidenceButton
              tenantId={tenantId}
              capture={capture}
              className={surgeryLinkButtonClass}
              onClosed={onMutated}
            />
            {capture.nextRecommendedSlotLabel ? (
              <p className="text-xs text-[#64748B]">
                Recommended next capture:{" "}
                <span className="text-[#CBD5E1]">{capture.nextRecommendedSlotLabel}</span>
              </p>
            ) : null}
          </div>
        </div>
      )}
    </DashboardCard>
  );
}
