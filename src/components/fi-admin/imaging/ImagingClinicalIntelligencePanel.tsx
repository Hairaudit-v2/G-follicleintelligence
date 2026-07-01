"use client";

import Link from "next/link";
import type { ImagingClinicalIntelligenceView } from "@/src/lib/imaging-os/imagingClinicalIntelligenceSurfacing";

function AssessmentCard({
  title,
  assessment,
}: {
  title: string;
  assessment: ImagingClinicalIntelligenceView["donorAssessment"];
}) {
  if (!assessment) {
    return (
      <div className="rounded border border-white/[0.06] bg-white/[0.02] p-3">
        <p className="text-xs font-semibold text-slate-300">{title}</p>
        <p className="mt-1 text-xs text-slate-500">No staff assessment recorded for this image.</p>
      </div>
    );
  }
  return (
    <div className="rounded border border-white/[0.06] bg-white/[0.02] p-3">
      <p className="text-xs font-semibold text-slate-300">{title}</p>
      <p className="mt-1 text-[11px] capitalize text-slate-400">
        Status: {assessment.status.replace(/_/g, " ")}
        {assessment.confidence > 0 ? ` · ${Math.round(assessment.confidence * 100)}% confidence` : ""}
      </p>
      {assessment.observations.length > 0 ? (
        <ul className="mt-2 space-y-0.5 text-xs text-slate-400">
          {assessment.observations.slice(0, 4).map((o, i) => (
            <li key={i}>{o}</li>
          ))}
        </ul>
      ) : null}
      {assessment.review_required ? (
        <p className="mt-2 text-[11px] text-amber-300/90">Staff review recommended.</p>
      ) : null}
    </div>
  );
}

type Props = {
  view: ImagingClinicalIntelligenceView;
};

export function ImagingClinicalIntelligencePanel({ view }: Props) {
  return (
    <div className="space-y-3 rounded-lg border border-white/[0.08] bg-[#0F1629]/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Clinical intelligence
          </p>
          <p className="text-xs text-slate-400">
            Staff-facing summary only — not a patient diagnosis.
          </p>
        </div>
        {view.reviewRequired ? (
          <Link
            href={view.reviewQueueHref}
            className="text-xs font-medium text-sky-400 hover:text-sky-300"
          >
            Open review queue
          </Link>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-xs">
        <div className="rounded bg-white/[0.03] p-2">
          <p className="text-slate-500">View</p>
          <p className="font-medium text-slate-200">{view.viewType ?? "—"}</p>
        </div>
        <div className="rounded bg-white/[0.03] p-2">
          <p className="text-slate-500">Quality</p>
          <p className="font-medium capitalize text-slate-200">
            {view.qualityStatus ?? "—"}
            {view.qualityScore != null ? ` (${view.qualityScore})` : ""}
          </p>
        </div>
        <div className="rounded bg-white/[0.03] p-2">
          <p className="text-slate-500">Classification</p>
          <p className="font-medium text-slate-200">
            {view.classificationConfidence != null
              ? `${Math.round(view.classificationConfidence * 100)}%`
              : "—"}
          </p>
        </div>
        <div className="rounded bg-white/[0.03] p-2">
          <p className="text-slate-500">Staff review</p>
          <p className="font-medium capitalize text-slate-200">
            {view.staffReviewStatus?.replace(/_/g, " ") ?? (view.reviewRequired ? "Pending" : "—")}
          </p>
        </div>
      </div>

      {(view.missingScalpRegion || view.retakeRequired) && (
        <div className="flex flex-wrap gap-2 text-[11px]">
          {view.missingScalpRegion ? (
            <span className="rounded bg-amber-500/10 px-2 py-0.5 text-amber-200">
              Missing scalp region
            </span>
          ) : null}
          {view.retakeRequired ? (
            <span className="rounded bg-rose-500/10 px-2 py-0.5 text-rose-200">Retake required</span>
          ) : null}
        </div>
      )}

      {view.reviewReasons.length > 0 ? (
        <p className="text-[11px] text-amber-200/80">
          Review flags: {view.reviewReasons.map((r) => r.replace(/_/g, " ")).join(" · ")}
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <AssessmentCard title="Donor assessment" assessment={view.donorAssessment} />
        <AssessmentCard title="Recipient assessment" assessment={view.recipientAssessment} />
      </div>

      {view.jobSummaries.density_estimate || view.jobSummaries.norwood_grade ? (
        <div className="grid gap-2 md:grid-cols-2">
          {view.jobSummaries.density_estimate ? (
            <div className="rounded border border-white/[0.06] p-2 text-xs text-slate-400">
              <p className="font-medium text-slate-300">Density summary (staff)</p>
              <p className="capitalize">{view.jobSummaries.density_estimate.summary_status}</p>
              {view.jobSummaries.density_estimate.limitations[0] ? (
                <p className="mt-1 text-[11px]">{view.jobSummaries.density_estimate.limitations[0]}</p>
              ) : null}
            </div>
          ) : null}
          {view.jobSummaries.norwood_grade ? (
            <div className="rounded border border-white/[0.06] p-2 text-xs text-slate-400">
              <p className="font-medium text-slate-300">Pattern summary (staff)</p>
              <p className="capitalize">{view.jobSummaries.norwood_grade.summary_status}</p>
              {view.jobSummaries.norwood_grade.limitations[0] ? (
                <p className="mt-1 text-[11px]">{view.jobSummaries.norwood_grade.limitations[0]}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}