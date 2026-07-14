import Link from "next/link";

import {
  mergeReadinessLabel,
  type LegacyPatientVisibilitySummary,
} from "@/src/lib/patients/legacyPatientVisibilityCore";
import { buildReturningPatientFlowHref } from "@/src/lib/followUpEncounters/followUpImagingRoutes";
import { imagingAiReviewStatusLabel } from "@/src/lib/followUpEncounters/followUpEncounterTypes";
import { pwsCard, pwsCardPad, pwsMeta, pwsTitle } from "./patientWorkspaceStyles";

export function LegacyPatientFollowUpSummaryCard({
  tenantId,
  patientId,
  visibility,
}: {
  tenantId: string;
  patientId: string;
  visibility: LegacyPatientVisibilitySummary;
}) {
  if (!visibility.has_legacy_source && !visibility.has_follow_up_encounter) return null;

  const followUpHref = buildReturningPatientFlowHref(tenantId, {
    patientId,
    intent: "follow_up",
  });
  const photosHref = buildReturningPatientFlowHref(tenantId, {
    patientId,
    intent: "photos",
  });
  const bookingHref = visibility.latest_booking_id
    ? `/fi-admin/${tenantId}/appointments/${visibility.latest_booking_id}`
    : null;

  return (
    <section className={pwsCard}>
      <div className={pwsCardPad}>
        <h2 className={pwsTitle}>Legacy follow-up continuity</h2>
        <p className={pwsMeta}>
          Operational summary for returning patients — historical Timely data stays outside FI OS.
        </p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Follow-up encounters
            </dt>
            <dd className="mt-1 text-slate-100">{visibility.follow_up_encounter_count}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Imaging sessions
            </dt>
            <dd className="mt-1 text-slate-100">{visibility.follow_up_imaging_session_count}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Latest follow-up
            </dt>
            <dd className="mt-1 text-slate-100">
              {visibility.latest_follow_up_type?.replace(/_/g, " ") ?? "—"}
              {visibility.latest_follow_up_at
                ? ` · ${visibility.latest_follow_up_at.slice(0, 10)}`
                : ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              AI review status
            </dt>
            <dd className="mt-1 text-slate-100">
              {visibility.latest_ai_review_status
                ? imagingAiReviewStatusLabel(visibility.latest_ai_review_status as never)
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Merge readiness
            </dt>
            <dd className="mt-1 text-slate-100">
              {mergeReadinessLabel(visibility.merge_readiness)}
            </dd>
          </div>
          {visibility.legacy_external_id ? (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Legacy reference
              </dt>
              <dd className="mt-1 font-mono text-xs text-slate-300">
                {visibility.legacy_source} · {visibility.legacy_external_id}
              </dd>
            </div>
          ) : null}
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={followUpHref}
            className="inline-flex items-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
          >
            Add today&apos;s follow-up
          </Link>
          <Link
            href={photosHref}
            className="inline-flex items-center rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/5"
          >
            Capture photos
          </Link>
          {bookingHref ? (
            <Link
              href={bookingHref}
              className="inline-flex items-center rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/5"
            >
              Open latest booking
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
