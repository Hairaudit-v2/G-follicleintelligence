"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { DashboardCard, InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { HrOsSubNav } from "@/src/components/fi/hr-os/HrOsSubNav";
import {
  approveReconciliationRecommendationAction,
  requestManualReviewReconciliationAction,
} from "@/src/lib/actions/workforce-phase-1c-sprint-35-actions";
import type { StaffReconciliationDecisionCard } from "@/src/lib/workforce/staffReconciliationRecommendation.server";
import type { StaffOperationalHistory } from "@/src/lib/workforce/staffOperationalHistoryCore";
import { cn } from "@/lib/utils";

function confidenceClass(confidence: number): string {
  if (confidence >= 85) return "text-emerald-300";
  if (confidence >= 60) return "text-amber-300";
  return "text-rose-300";
}

function RecordPanel({
  title,
  history,
  iiohrMeta,
}: {
  title: string;
  history: StaffOperationalHistory;
  iiohrMeta?: {
    employmentStatus: string | null;
    roleCode: string | null;
    linked: boolean;
  } | null;
}) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-[#0B1220]/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 font-medium text-slate-100">{history.fullName}</p>
      <p className="text-xs text-slate-400">{history.email ?? "—"}</p>
      <dl className="mt-3 grid gap-1 text-xs text-slate-400">
        <div className="flex justify-between gap-2">
          <dt>Role</dt>
          <dd className="text-slate-200 capitalize">{(history.roleCode ?? "—").replace(/_/g, " ")}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Created</dt>
          <dd className="text-slate-200">
            {history.createdAt
              ? `${history.daysSinceCreated} days ago`
              : "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Training</dt>
          <dd className="text-slate-200">{history.trainingCount}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Surgery assignments</dt>
          <dd className="text-slate-200">{history.surgeryAssignmentCount}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Calendar assignments</dt>
          <dd className="text-slate-200">{history.calendarAssignmentCount}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Compliance history</dt>
          <dd className="text-slate-200">{history.complianceHistoryCount}</dd>
        </div>
        {iiohrMeta ? (
          <>
            <div className="flex justify-between gap-2">
              <dt>Employment status</dt>
              <dd className="text-slate-200 capitalize">
                {(iiohrMeta.employmentStatus ?? "active").replace(/_/g, " ")}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Linked identity</dt>
              <dd className="text-slate-200">{iiohrMeta.linked ? "Yes" : "No"}</dd>
            </div>
          </>
        ) : null}
      </dl>
    </div>
  );
}

export function StaffReconciliationDecisionClient({
  tenantId,
  decisionCards,
  canManage,
}: {
  tenantId: string;
  decisionCards: StaffReconciliationDecisionCard[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const run = useCallback(
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
    <div className="relative z-[1] mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <HrOsSubNav tenantId={tenantId} />

      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
          Staff Reconciliation
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Decision intelligence for linking FI OS staff to IIOHR identities. Recommendations are
          advisory — every action requires explicit admin approval.
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
            <p className="text-sm text-slate-400">All active staff have HR identity links.</p>
          </DashboardCard>
        ) : (
          decisionCards.map((card) => (
            <DashboardCard key={card.staffMemberId} className="p-5 sm:p-6" elevated>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1 space-y-4">
                  <h2 className="text-lg font-semibold text-slate-50">{card.fiRecord.fullName}</h2>
                  <div className="grid gap-4 md:grid-cols-2">
                    <RecordPanel title="FI OS Record" history={card.fiRecord} />
                    {card.iiohrRecord ? (
                      <RecordPanel
                        title="IIOHR Record"
                        history={
                          card.iiohrRecord.operationalHistory ?? {
                            ...card.fiRecord,
                            staffMemberId: card.iiohrRecord.externalId,
                            fullName: card.iiohrRecord.externalName ?? card.iiohrRecord.externalId,
                            email: card.iiohrRecord.externalEmail,
                          }
                        }
                        iiohrMeta={{
                          employmentStatus: card.iiohrRecord.employmentStatus,
                          roleCode: card.iiohrRecord.roleCode,
                          linked: card.iiohrRecord.linked,
                        }}
                      />
                    ) : (
                      <div className="rounded-lg border border-dashed border-white/[0.1] p-4 text-sm text-slate-500">
                        No IIOHR candidate identified — manual review required.
                      </div>
                    )}
                  </div>
                </div>

                <div className="w-full max-w-sm shrink-0 space-y-4 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      System recommendation
                    </p>
                    <p className="mt-1 text-base font-semibold text-cyan-200">
                      {card.recommendationLabel}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Confidence</p>
                    <p
                      className={cn(
                        "mt-1 text-3xl font-semibold tabular-nums",
                        confidenceClass(card.recommendation.confidence)
                      )}
                    >
                      {card.recommendation.confidence}%
                    </p>
                  </div>
                  {card.recommendation.reasoning.length ? (
                    <ul className="space-y-1 text-xs text-slate-300">
                      {card.recommendation.reasoning.map((line) => (
                        <li key={line} className="flex gap-2">
                          <span className="text-emerald-400">✓</span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {canManage ? (
                    <div className="flex flex-col gap-2 pt-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={pending || card.recommendation.recommendation === "MANUAL_REVIEW_REQUIRED"}
                        onClick={() =>
                          run(
                            () =>
                              approveReconciliationRecommendationAction(tenantId, {
                                staffMemberId: card.staffMemberId,
                                recommendation: card.recommendation.recommendation,
                                externalId: card.recommendation.suggestedExternalId,
                                sourceSystem: card.iiohrRecord?.sourceSystem ?? null,
                                targetStaffMemberId:
                                  card.recommendation.suggestedTargetStaffMemberId,
                                sourceStaffMemberId:
                                  card.recommendation.suggestedSourceStaffMemberId,
                                reasoning: card.recommendation.reasoning,
                                confidence: card.recommendation.confidence,
                              }),
                            "Recommendation approved."
                          )
                        }
                      >
                        Approve recommendation
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          run(
                            () =>
                              requestManualReviewReconciliationAction(
                                tenantId,
                                card.staffMemberId,
                                `Deferred: ${card.recommendationLabel}`
                              ),
                            "Flagged for manual review."
                          )
                        }
                      >
                        Manual review
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">View only</p>
                  )}
                </div>
              </div>
            </DashboardCard>
          ))
        )}
      </div>

      <p className="mt-4 text-xs text-slate-500">
        <Link href={`/fi-admin/${tenantId}/hr-os/sync-health`} className="text-cyan-400 hover:text-cyan-300">
          Sync health
        </Link>
        {" · "}
        <Link href={`/fi-admin/${tenantId}/hr-os/duplicates`} className="text-cyan-400 hover:text-cyan-300">
          Duplicate review
        </Link>
      </p>
    </div>
  );
}