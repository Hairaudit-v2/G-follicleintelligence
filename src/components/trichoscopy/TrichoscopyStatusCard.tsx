import Link from "next/link";

import type { FiosTrichoscopyStatus } from "@/src/lib/integrations/hliTrichoscopy/types";
import { resolveFiosTrichoscopyReadiness } from "@/src/lib/integrations/hliTrichoscopy/mappers";

const STATUS_LABELS: Record<FiosTrichoscopyStatus, string> = {
  not_requested: "Not requested",
  requested: "Requested",
  linked: "Linked",
  capture_due: "Capture due",
  capture_in_progress: "Capture in progress",
  capture_complete: "Capture complete",
  analysis_pending: "Analysis pending",
  review_pending: "Review pending",
  confirmed: "Confirmed",
  confirmed_with_limitations: "Confirmed with limitations",
  repeat_capture_required: "Repeat capture required",
  medical_review_required: "Medical review required",
  completed: "Completed",
  cancelled: "Cancelled",
  integration_error: "Integration error",
};

export type TrichoscopyStatusCardProps = {
  tenantId: string;
  patientId: string;
  linkId?: string;
  purpose: string;
  status: FiosTrichoscopyStatus;
  episodeCreatedAt?: string | null;
  sitesCompleted?: number;
  sitesMissing?: number;
  latestConfirmedLabel?: string | null;
  limitations?: string[];
  outstandingAction?: string | null;
  lastSyncedAt?: string | null;
  canRequest?: boolean;
  canRetrySync?: boolean;
  historicalReadOnly?: boolean;
};

export function TrichoscopyStatusCard(props: TrichoscopyStatusCardProps) {
  const readiness = resolveFiosTrichoscopyReadiness({ status: props.status, required: true });
  const workspaceHref = `/fi-admin/${props.tenantId}/patients/${props.patientId}/trichoscopy`;

  return (
    <section
      className="rounded-xl border border-white/[0.08] bg-[#0F1629]/80 p-4 backdrop-blur-md"
      aria-labelledby={`trichoscopy-status-${props.linkId ?? "new"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Trichoscopy
          </p>
          <h2
            id={`trichoscopy-status-${props.linkId ?? "new"}`}
            className="mt-1 text-base font-semibold text-slate-100"
          >
            Status: {STATUS_LABELS[props.status] ?? props.status}
          </h2>
          <p className="mt-1 text-sm text-slate-400">Purpose: {props.purpose.replace(/_/g, " ")}</p>
        </div>
        {props.historicalReadOnly ? (
          <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-200">
            Read-only
          </span>
        ) : null}
      </div>

      <dl className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
        {props.episodeCreatedAt ? (
          <div>
            <dt className="text-slate-500">Episode created</dt>
            <dd>{new Date(props.episodeCreatedAt).toLocaleString()}</dd>
          </div>
        ) : null}
        {typeof props.sitesCompleted === "number" ? (
          <div>
            <dt className="text-slate-500">Sites captured</dt>
            <dd>
              {props.sitesCompleted}
              {typeof props.sitesMissing === "number" ? ` of ${props.sitesCompleted + props.sitesMissing}` : ""}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="text-slate-500">Latest confirmed evidence</dt>
          <dd>{props.latestConfirmedLabel ?? "Not yet available"}</dd>
        </div>
        {props.outstandingAction || readiness.nextAction ? (
          <div>
            <dt className="text-slate-500">Outstanding</dt>
            <dd>{props.outstandingAction ?? readiness.nextAction?.replace(/_/g, " ")}</dd>
          </div>
        ) : null}
        {props.limitations?.length ? (
          <div className="sm:col-span-2">
            <dt className="text-slate-500">Limitations</dt>
            <dd>{props.limitations.join(", ")}</dd>
          </div>
        ) : null}
        {props.lastSyncedAt ? (
          <div>
            <dt className="text-slate-500">Last sync</dt>
            <dd>{new Date(props.lastSyncedAt).toLocaleString()}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={workspaceHref}
          className="inline-flex rounded-lg border border-white/[0.12] px-3 py-1.5 text-xs font-medium text-slate-100 hover:border-cyan-400/40"
        >
          Open workspace
        </Link>
        {props.canRequest && !props.historicalReadOnly ? (
          <Link
            href={`${workspaceHref}?action=request`}
            className="inline-flex rounded-lg bg-gradient-to-r from-cyan-600 to-sky-600 px-3 py-1.5 text-xs font-semibold text-white"
          >
            Request trichoscopy
          </Link>
        ) : null}
      </div>
    </section>
  );
}
