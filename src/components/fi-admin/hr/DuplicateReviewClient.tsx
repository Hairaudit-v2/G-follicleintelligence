"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { DashboardCard, InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { HrOsSubNav } from "@/src/components/fi/hr-os/HrOsSubNav";
import {
  dismissDuplicateCandidateAction,
  keepDuplicateSeparateAction,
} from "@/src/lib/actions/workforce-phase-1c-sprint-2-actions";
import { approveDuplicateMergeRecommendationAction } from "@/src/lib/actions/workforce-phase-1c-sprint-35-actions";
import type { DuplicateDecisionCard } from "@/src/lib/workforce/duplicateMergeRecommendation.server";
import type { StaffOperationalHistory } from "@/src/lib/workforce/staffOperationalHistoryCore";
import { cn } from "@/lib/utils";

function confidenceClass(confidence: number): string {
  if (confidence >= 85) return "text-emerald-300";
  if (confidence >= 60) return "text-amber-300";
  return "text-rose-300";
}

function RecordSummary({ history }: { history: StaffOperationalHistory }) {
  return (
    <div className="space-y-1 text-sm">
      <p className="font-medium text-slate-100">{history.fullName}</p>
      <p className="text-xs text-slate-400">{history.email ?? "—"}</p>
      <ul className="mt-2 space-y-0.5 text-xs text-slate-400">
        <li>Training: {history.trainingCount}</li>
        <li>Surgeries: {history.surgeryAssignmentCount}</li>
        <li>Calendar: {history.calendarAssignmentCount}</li>
        <li>Created {history.daysSinceCreated} days ago</li>
      </ul>
    </div>
  );
}

export function DuplicateReviewClient({
  tenantId,
  decisionCards,
  canManage,
}: {
  tenantId: string;
  decisionCards: DuplicateDecisionCard[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const runAction = useCallback(
    (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string) => {
      setError(null);
      setMessage(null);
      startTransition(async () => {
        const result = await fn();
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setMessage(success);
        router.refresh();
      });
    },
    [router]
  );

  return (
    <div className="relative z-[1] mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <HrOsSubNav tenantId={tenantId} />

      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">Duplicate Review</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Merge recommendations compare operational history across duplicate pairs. Nothing merges
          without explicit approval.
        </p>
      </header>

      {error ? (
        <InfoNotice variant="warning" title="Action failed" className="mt-6">
          <p className="text-sm">{error}</p>
        </InfoNotice>
      ) : null}
      {message ? (
        <InfoNotice variant="success" title="Success" className="mt-6">
          <p className="text-sm">{message}</p>
        </InfoNotice>
      ) : null}

      <div className="mt-8 space-y-6">
        {decisionCards.length === 0 ? (
          <DashboardCard className="p-8 text-center" elevated>
            <p className="text-sm text-slate-400">No open duplicate candidates.</p>
          </DashboardCard>
        ) : (
          decisionCards.map((card) => (
            <DashboardCard key={card.candidateId} className="p-5 sm:p-6" elevated>
              <h2 className="text-lg font-semibold uppercase tracking-wide text-slate-100">
                {card.staffA.fullName}
              </h2>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-white/[0.08] p-4">
                  <p className="text-xs uppercase text-slate-500">Record A</p>
                  <RecordSummary history={card.staffA} />
                </div>
                <div className="rounded-lg border border-white/[0.08] p-4">
                  <p className="text-xs uppercase text-slate-500">Record B</p>
                  <RecordSummary history={card.staffB} />
                </div>
              </div>

              <div className="mt-5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Recommendation</p>
                <p className="mt-2 text-base font-semibold text-emerald-200">
                  KEEP {card.keepStaffName.toUpperCase()}
                </p>
                <p className="text-sm text-slate-300">
                  MERGE {card.archiveStaffName.toUpperCase()} INTO {card.keepStaffName.toUpperCase()}
                </p>
                <p className={cn("mt-3 text-2xl font-semibold tabular-nums", confidenceClass(card.recommendation.confidence))}>
                  Confidence: {card.recommendation.confidence}%
                </p>
                <ul className="mt-3 space-y-1 text-xs text-slate-300">
                  {card.recommendation.reasoning.map((line) => (
                    <li key={line}>✓ {line}</li>
                  ))}
                </ul>
              </div>

              {canManage ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      runAction(
                        () =>
                          approveDuplicateMergeRecommendationAction(
                            tenantId,
                            card.candidateId,
                            card.recommendation.keepStaffId,
                            card.recommendation.archiveStaffId
                          ),
                        "Merge approved and executed."
                      )
                    }
                  >
                    Approve merge
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      runAction(
                        () => keepDuplicateSeparateAction(tenantId, card.candidateId),
                        "Marked as separate records."
                      )
                    }
                  >
                    Keep separate
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      runAction(
                        () => dismissDuplicateCandidateAction(tenantId, card.candidateId),
                        "Duplicate dismissed."
                      )
                    }
                  >
                    Dismiss
                  </Button>
                </div>
              ) : (
                <p className="mt-4 text-xs text-slate-500">View only</p>
              )}
            </DashboardCard>
          ))
        )}
      </div>

      <p className="mt-4 text-xs text-slate-500">
        <Link
          href={`/fi-admin/${tenantId}/hr-os/staff-reconciliation`}
          className="text-cyan-400 hover:text-cyan-300"
        >
          Staff reconciliation
        </Link>
      </p>
    </div>
  );
}