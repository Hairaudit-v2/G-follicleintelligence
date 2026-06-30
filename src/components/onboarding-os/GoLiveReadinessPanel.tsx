"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  approveTenantGoLiveAction,
  markGoLiveChecklistItemReviewedAction,
  markOwnerReviewCompleteAction,
  markPlatformReviewCompleteAction,
} from "@/lib/actions/fi-onboarding-os-go-live-readiness-actions";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { canPlatformAdminApproveGoLive } from "@/src/lib/onboarding-os/goLiveReadinessCore";
import type { GoLiveReadinessSnapshot } from "@/src/lib/onboarding-os/goLiveReadinessTypes";
import {
  GO_LIVE_READINESS_AREA_LABELS,
  GO_LIVE_READINESS_STATUS_BADGES,
} from "@/src/lib/onboarding-os/goLiveReadinessTypes";

const BADGE_CLASSES: Record<string, string> = {
  neutral: "bg-slate-500/15 text-slate-300",
  info: "bg-cyan-500/15 text-cyan-300",
  success: "bg-emerald-500/15 text-emerald-300",
  warning: "bg-amber-500/15 text-amber-300",
  danger: "bg-red-500/15 text-red-300",
};

const CHECK_STATE_CLASSES: Record<string, string> = {
  pass: "text-emerald-400",
  fail: "text-red-400",
  skipped: "text-slate-500",
};

type Props = {
  snapshot: GoLiveReadinessSnapshot;
  mode: "platform" | "tenant";
};

export function GoLiveReadinessPanel({ snapshot: initialSnapshot, mode }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const statusBadge = GO_LIVE_READINESS_STATUS_BADGES[snapshot.status];
  const isReadOnly = mode === "tenant";
  const isApproved = snapshot.reviews.goLiveApproved;

  const blockedChecks = snapshot.checks.filter(
    (c) => c.state === "fail" && c.severity === "required"
  );
  const warningChecks = snapshot.checks.filter(
    (c) => c.state === "fail" && c.severity === "optional"
  );
  const readyChecks = snapshot.checks.filter((c) => c.state === "pass" || c.state === "skipped");

  const approvalGate = canPlatformAdminApproveGoLive({
    isPlatformAdmin: mode === "platform",
    snapshot,
  });

  function runAction(
    label: string,
    fn: () => Promise<{ ok: boolean; error?: string; snapshot?: GoLiveReadinessSnapshot }>
  ) {
    setMessage(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setMessage({ kind: "err", text: res.error ?? `${label} failed.` });
        return;
      }
      if (res.snapshot) setSnapshot(res.snapshot);
      setMessage({ kind: "ok", text: `${label} succeeded.` });
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-white/[0.08] bg-[#060d18]/80 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={fiOsChromeClasses.sectionEyebrow}>OnboardingOS · Phase E</p>
          <h3 className="text-sm font-semibold text-slate-200">Go-Live Readiness Command Centre</h3>
          <p className="mt-1 text-xs text-slate-500">
            {isReadOnly
              ? "Read-only view of provisioning readiness before production launch."
              : "Review checklist, sign-offs, and platform go-live approval."}
          </p>
        </div>
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_CLASSES[statusBadge.tone] ?? BADGE_CLASSES.neutral}`}
        >
          {statusBadge.label}
        </span>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Readiness score</span>
          <span>{snapshot.score.percent}%</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={`h-full rounded-full transition-all ${
              snapshot.status === "blocked"
                ? "bg-red-500"
                : snapshot.status === "warning"
                  ? "bg-amber-500"
                  : "bg-emerald-500"
            }`}
            style={{ width: `${snapshot.score.percent}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Required {snapshot.score.requiredPassed}/{snapshot.score.requiredTotal} · Optional{" "}
          {snapshot.score.optionalPassed}/{snapshot.score.optionalTotal}
        </p>
      </div>

      {message ? (
        <p
          className={
            message.kind === "ok" ? "mt-3 text-sm text-emerald-400" : "mt-3 text-sm text-red-400"
          }
          role="status"
        >
          {message.text}
        </p>
      ) : null}

      <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
        <ReviewMetric
          label="Owner review"
          complete={snapshot.reviews.ownerReviewComplete}
          reviewedAt={snapshot.reviews.ownerReviewedAt}
          reviewer={snapshot.reviews.ownerReviewerLabel}
        />
        <ReviewMetric
          label="Platform review"
          complete={snapshot.reviews.platformReviewComplete}
          reviewedAt={snapshot.reviews.platformReviewedAt}
          reviewer={snapshot.reviews.platformReviewerLabel}
        />
      </dl>

      {!isReadOnly && !isApproved ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {!snapshot.reviews.ownerReviewComplete ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                runAction("Owner review", () => markOwnerReviewCompleteAction(snapshot.sessionId))
              }
              className="rounded-lg border border-amber-500/40 px-3 py-1.5 text-sm font-medium text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
            >
              Mark owner review complete
            </button>
          ) : null}
          {!snapshot.reviews.platformReviewComplete ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                runAction("Platform review", () =>
                  markPlatformReviewCompleteAction(snapshot.sessionId)
                )
              }
              className="rounded-lg border border-cyan-500/40 px-3 py-1.5 text-sm font-medium text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-50"
            >
              Mark platform review complete
            </button>
          ) : null}
          <button
            type="button"
            disabled={pending || !approvalGate.allowed}
            title={approvalGate.reason ?? undefined}
            onClick={() =>
              runAction("Go-live approval", () => approveTenantGoLiveAction(snapshot.sessionId))
            }
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Approve go-live
          </button>
        </div>
      ) : null}

      {isApproved ? (
        <p className="mt-3 text-sm text-cyan-300">
          Go-live approved
          {snapshot.reviews.goLiveApprovedAt
            ? ` on ${new Date(snapshot.reviews.goLiveApprovedAt).toLocaleString()}`
            : ""}
          . Billing activation and sandbox cleanup are not performed automatically.
        </p>
      ) : null}

      {!isReadOnly && approvalGate.reason && !approvalGate.allowed && !isApproved ? (
        <p className="mt-2 text-xs text-slate-500">{approvalGate.reason}</p>
      ) : null}

      {snapshot.recommendations.length > 0 ? (
        <div className="mt-5 border-t border-white/[0.06] pt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Recommendations
          </h4>
          <ul className="mt-3 space-y-2">
            {snapshot.recommendations.map((rec) => (
              <li
                key={rec.code}
                className={`rounded-lg px-3 py-2 text-xs ${
                  rec.severity === "blocker"
                    ? "border border-red-500/20 bg-red-950/20 text-red-200"
                    : rec.severity === "warning"
                      ? "border border-amber-500/20 bg-amber-950/20 text-amber-200"
                      : "border border-white/[0.06] bg-white/[0.03] text-slate-300"
                }`}
              >
                <span className="font-medium">{rec.title}</span>
                <span className="mt-0.5 block text-[11px] opacity-90">{rec.message}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ChecklistGroup
        title="Blocked"
        checks={blockedChecks}
        snapshot={snapshot}
        isReadOnly={isReadOnly}
        pending={pending}
        onReview={runAction}
      />
      <ChecklistGroup
        title="Warnings"
        checks={warningChecks}
        snapshot={snapshot}
        isReadOnly={isReadOnly}
        pending={pending}
        onReview={runAction}
      />
      <ChecklistGroup
        title="Ready"
        checks={readyChecks}
        snapshot={snapshot}
        isReadOnly={isReadOnly}
        pending={pending}
        onReview={runAction}
      />
    </section>
  );
}

function ReviewMetric({
  label,
  complete,
  reviewedAt,
  reviewer,
}: {
  label: string;
  complete: boolean;
  reviewedAt: string | null;
  reviewer: string | null;
}) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-3 py-2">
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd className={`mt-1 font-medium ${complete ? "text-emerald-300" : "text-amber-300"}`}>
        {complete ? "Complete" : "Pending"}
      </dd>
      {reviewer ? <dd className="mt-0.5 text-slate-500">{reviewer}</dd> : null}
      {reviewedAt ? (
        <dd className="mt-0.5 text-slate-400">{new Date(reviewedAt).toLocaleString()}</dd>
      ) : null}
    </div>
  );
}

function ChecklistGroup({
  title,
  checks,
  snapshot,
  isReadOnly,
  pending,
  onReview,
}: {
  title: string;
  checks: GoLiveReadinessSnapshot["checks"][number][];
  snapshot: GoLiveReadinessSnapshot;
  isReadOnly: boolean;
  pending: boolean;
  onReview: (
    label: string,
    fn: () => Promise<{ ok: boolean; error?: string; snapshot?: GoLiveReadinessSnapshot }>
  ) => void;
}) {
  if (checks.length === 0) return null;

  return (
    <div className="mt-5 border-t border-white/[0.06] pt-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      <ul className="mt-3 divide-y divide-white/[0.06] rounded-lg border border-white/[0.06]">
        {checks.map((check) => (
          <li
            key={check.code}
            className="flex flex-wrap items-start justify-between gap-3 px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-slate-200">{check.label}</p>
                <span className="text-[10px] uppercase tracking-wide text-slate-400">
                  {GO_LIVE_READINESS_AREA_LABELS[check.area]}
                </span>
                <span
                  className={`text-xs font-medium ${CHECK_STATE_CLASSES[check.state] ?? "text-slate-400"}`}
                >
                  {check.state}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">{check.description}</p>
              {check.detail ? <p className="mt-1 text-xs text-amber-400">{check.detail}</p> : null}
            </div>
            {!isReadOnly && check.state === "fail" && !check.reviewed ? (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  onReview("Acknowledge item", () =>
                    markGoLiveChecklistItemReviewedAction(snapshot.sessionId, check.code)
                  )
                }
                className="shrink-0 rounded-lg border border-white/[0.08] px-2 py-1 text-xs text-slate-300 hover:bg-white/[0.06] disabled:opacity-50"
              >
                Acknowledge
              </button>
            ) : null}
            {check.reviewed ? (
              <span className="shrink-0 text-xs text-slate-400">Reviewed</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
