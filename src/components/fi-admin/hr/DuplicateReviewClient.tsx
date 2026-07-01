"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { DashboardCard, InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { HrOsSubNav } from "@/src/components/fi/hr-os/HrOsSubNav";
import {
  approveDuplicateMergeAction,
  dismissDuplicateCandidateAction,
  keepDuplicateSeparateAction,
} from "@/src/lib/actions/workforce-phase-1c-sprint-2-actions";
import type { DuplicateCandidateRow } from "@/src/lib/workforce/duplicateReview.server";

export function DuplicateReviewClient({
  tenantId,
  candidates,
  canManage,
}: {
  tenantId: string;
  candidates: DuplicateCandidateRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [mergeTargetByCandidate, setMergeTargetByCandidate] = useState<Record<string, string>>(
    {}
  );

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
          Review open duplicate staff pairs detected during HR sync. Merges require explicit admin
          approval — nothing is automatic.
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

      <div className="mt-8 space-y-4">
        {candidates.length === 0 ? (
          <DashboardCard className="p-8 text-center">
            <p className="text-sm text-slate-400">No open duplicate candidates.</p>
          </DashboardCard>
        ) : (
          candidates.map((c) => (
            <DashboardCard key={c.id} className="p-5" elevated>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Staff A</p>
                    <p className="font-medium text-slate-100">{c.staffAName}</p>
                    <p className="text-xs text-slate-400">{c.staffAEmail ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Staff B</p>
                    <p className="font-medium text-slate-100">{c.staffBName}</p>
                    <p className="text-xs text-slate-400">{c.staffBEmail ?? "—"}</p>
                  </div>
                  <p className="text-sm text-slate-300">
                    Similarity score:{" "}
                    <span className="font-semibold text-cyan-300">{c.similarityScore}</span>
                  </p>
                  <ul className="flex flex-wrap gap-2 text-xs">
                    {c.matchEmail ? <MatchPill label="Email Match" /> : null}
                    {c.matchName ? <MatchPill label="Name Match" /> : null}
                    {c.matchPhone ? <MatchPill label="Phone Match" /> : null}
                    {c.roleSimilarity ? <MatchPill label="Role Similarity" /> : null}
                  </ul>
                </div>

                {canManage ? (
                  <div className="flex w-full max-w-sm flex-col gap-2">
                    <label className="text-xs text-slate-500">Merge target (keep record)</label>
                    <select
                      className="rounded-lg border border-white/[0.1] bg-[#0B1220] px-3 py-2 text-sm text-slate-200"
                      value={mergeTargetByCandidate[c.id] ?? c.staffBId}
                      onChange={(e) =>
                        setMergeTargetByCandidate((prev) => ({
                          ...prev,
                          [c.id]: e.target.value,
                        }))
                      }
                    >
                      <option value={c.staffAId}>Keep {c.staffAName}</option>
                      <option value={c.staffBId}>Keep {c.staffBName}</option>
                    </select>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          runAction(
                            () => dismissDuplicateCandidateAction(tenantId, c.id),
                            "Duplicate dismissed."
                          )
                        }
                      >
                        Dismiss
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          runAction(
                            () => keepDuplicateSeparateAction(tenantId, c.id),
                            "Marked as separate records."
                          )
                        }
                      >
                        Keep Separate
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={pending}
                        onClick={() => {
                          const targetId = mergeTargetByCandidate[c.id] ?? c.staffBId;
                          const sourceId =
                            targetId === c.staffAId ? c.staffBId : c.staffAId;
                          runAction(
                            () =>
                              approveDuplicateMergeAction(
                                tenantId,
                                c.id,
                                sourceId,
                                targetId
                              ),
                            "Merge approved and executed."
                          );
                        }}
                      >
                        Approve Merge
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">View only</p>
                )}
              </div>
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

function MatchPill({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-medium text-amber-200 ring-1 ring-inset ring-amber-500/25">
      {label}
    </span>
  );
}