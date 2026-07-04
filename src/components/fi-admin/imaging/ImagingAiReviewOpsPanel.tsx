"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import {
  markImagingAiReviewJobIgnoredAction,
  requeueStaleImagingAiReviewJobAction,
  retryFailedImagingAiReviewJobAction,
} from "@/lib/actions/fi-imaging-actions";
import type { ImagingAiReviewOpsHealthSummary } from "@/src/lib/imaging-os/imagingAiReviewOps.server";
import type { ImagingAiReviewOpsBucket } from "@/src/lib/imaging-os/imagingAiReviewOpsCore";

const BUCKET_LABELS: Record<ImagingAiReviewOpsBucket, string> = {
  queued: "Queued",
  running: "Running",
  stale_running: "Stale running",
  completed_awaiting_review: "Completed · awaiting review",
  failed: "Failed",
  low_confidence: "Low confidence",
  provider_unavailable: "Provider unavailable / stub",
  requires_staff_review: "Requires staff review",
  superseded: "Superseded / ignored",
};

const BUCKET_ORDER: ImagingAiReviewOpsBucket[] = [
  "failed",
  "stale_running",
  "running",
  "queued",
  "requires_staff_review",
  "completed_awaiting_review",
  "low_confidence",
  "provider_unavailable",
  "superseded",
];

type Props = {
  tenantId: string;
  health: ImagingAiReviewOpsHealthSummary;
};

export function ImagingAiReviewOpsPanel({ tenantId, health }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adminKey, setAdminKey] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [ignoreReasons, setIgnoreReasons] = useState<Record<string, string>>({});
  const [activeBucket, setActiveBucket] = useState<ImagingAiReviewOpsBucket | "all">("all");

  const withAdmin = useCallback(
    <T extends Record<string, unknown>>(body: T): T & { adminKey?: string } => {
      const k = adminKey.trim();
      return k ? { ...body, adminKey: k } : body;
    },
    [adminKey]
  );

  const run = useCallback(
    (action: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
      setMsg(null);
      startTransition(async () => {
        const res = await action();
        if (!res.ok) {
          setMsg(res.error);
          return;
        }
        setMsg("Job updated.");
        router.refresh();
      });
    },
    [router]
  );

  const filteredJobs =
    activeBucket === "all"
      ? health.jobs
      : health.jobs.filter((job) => job.buckets.includes(activeBucket));

  return (
    <div className="space-y-4">
      <label className="block text-xs text-slate-400">
        Optional admin key (CRM write gate)
        <input
          type="password"
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
          className="mt-1 w-full max-w-md rounded border border-slate-700 bg-[#020617] px-3 py-2 text-sm"
          autoComplete="off"
        />
      </label>

      {msg ? (
        <p className="rounded border border-slate-600/40 bg-slate-900/60 px-3 py-2 text-sm text-slate-200">
          {msg}
        </p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {BUCKET_ORDER.map((bucket) => (
          <button
            key={bucket}
            type="button"
            onClick={() => setActiveBucket((prev) => (prev === bucket ? "all" : bucket))}
            className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
              activeBucket === bucket
                ? "border-violet-500/50 bg-violet-950/30 text-violet-100"
                : "border-white/10 bg-slate-900/50 text-slate-300 hover:border-white/20"
            }`}
          >
            <p className="font-semibold">{BUCKET_LABELS[bucket]}</p>
            <p className="mt-1 text-lg font-bold tabular-nums">{health.bucketCounts[bucket] ?? 0}</p>
          </button>
        ))}
      </div>

      <p className="text-xs text-slate-500">
        Showing {filteredJobs.length} of {health.totalJobs} jobs · kind{" "}
        <span className="font-mono text-slate-300">{health.analysisKind}</span>
        {activeBucket !== "all" ? (
          <>
            {" "}
            · filter <span className="text-violet-300">{BUCKET_LABELS[activeBucket]}</span>
          </>
        ) : null}
      </p>

      <div className="overflow-x-auto rounded-lg border border-white/[0.08]">
        <table className="min-w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900/80 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Job</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Buckets</th>
              <th className="px-3 py-2">Provider</th>
              <th className="px-3 py-2">Review</th>
              <th className="px-3 py-2">Attempts / error</th>
              <th className="px-3 py-2">Timestamps</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredJobs.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                  No jobs in this view.
                </td>
              </tr>
            ) : (
              filteredJobs.map((job) => (
                <tr key={job.jobId} className="border-t border-white/[0.06] align-top">
                  <td className="px-3 py-2 font-mono text-[10px]">
                    <div>{job.jobId.slice(0, 8)}…</div>
                    <div className="mt-1 text-slate-500">img {job.patientImageId.slice(0, 8)}…</div>
                  </td>
                  <td className="px-3 py-2 capitalize">{job.jobStatus.replace(/_/g, " ")}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {job.buckets.map((bucket) => (
                        <span
                          key={bucket}
                          className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-200"
                        >
                          {BUCKET_LABELS[bucket]}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2">{job.provider ?? "—"}</td>
                  <td className="px-3 py-2">
                    {job.graftTrayReviewStatus ? (
                      <span className="capitalize">{job.graftTrayReviewStatus.replace(/_/g, " ")}</span>
                    ) : (
                      "—"
                    )}
                    {job.replayBlockedReason ? (
                      <p className="mt-1 text-[10px] text-amber-300">{job.replayBlockedReason}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <p>Attempts: {job.attemptCount}</p>
                    {job.lastError ? (
                      <p className="mt-1 text-[10px] text-rose-300">{job.lastError}</p>
                    ) : null}
                    {job.supersedeReason ? (
                      <p className="mt-1 text-[10px] text-slate-500">Superseded: {job.supersedeReason}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-[10px] text-slate-500">
                    <p>Queued {new Date(job.queuedAt).toLocaleString()}</p>
                    {job.startedAt ? <p>Started {new Date(job.startedAt).toLocaleString()}</p> : null}
                    {job.completedAt ? (
                      <p>Completed {new Date(job.completedAt).toLocaleString()}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex min-w-[180px] flex-col gap-1">
                      {job.imagingHref ? (
                        <Link href={job.imagingHref} className="text-violet-300 hover:underline">
                          Open image
                        </Link>
                      ) : null}
                      {job.reviewHref ? (
                        <Link href={job.reviewHref} className="text-sky-300 hover:underline">
                          Open review queue
                        </Link>
                      ) : null}
                      {job.jobStatus === "failed" && !job.replayBlockedReason ? (
                        <button
                          type="button"
                          disabled={pending}
                          className="rounded bg-emerald-900/40 px-2 py-1 text-[10px] text-emerald-100 disabled:opacity-40"
                          onClick={() =>
                            run(() =>
                              retryFailedImagingAiReviewJobAction(
                                tenantId,
                                withAdmin({ jobId: job.jobId })
                              )
                            )
                          }
                        >
                          Retry failed job
                        </button>
                      ) : null}
                      {job.buckets.includes("stale_running") && !job.replayBlockedReason ? (
                        <button
                          type="button"
                          disabled={pending}
                          className="rounded bg-amber-900/40 px-2 py-1 text-[10px] text-amber-100 disabled:opacity-40"
                          onClick={() =>
                            run(() =>
                              requeueStaleImagingAiReviewJobAction(
                                tenantId,
                                withAdmin({ jobId: job.jobId })
                              )
                            )
                          }
                        >
                          Requeue stale job
                        </button>
                      ) : null}
                      {job.jobStatus !== "superseded" && !job.replayBlockedReason ? (
                        <div className="mt-1 space-y-1">
                          <input
                            type="text"
                            placeholder="Ignore reason"
                            value={ignoreReasons[job.jobId] ?? ""}
                            onChange={(e) =>
                              setIgnoreReasons((prev) => ({ ...prev, [job.jobId]: e.target.value }))
                            }
                            className="w-full rounded border border-slate-700 bg-[#020617] px-2 py-1 text-[10px]"
                          />
                          <button
                            type="button"
                            disabled={pending || !ignoreReasons[job.jobId]?.trim()}
                            className="rounded bg-slate-800 px-2 py-1 text-[10px] text-slate-200 disabled:opacity-40"
                            onClick={() =>
                              run(() =>
                                markImagingAiReviewJobIgnoredAction(
                                  tenantId,
                                  withAdmin({
                                    jobId: job.jobId,
                                    reason: ignoreReasons[job.jobId] ?? "",
                                  })
                                )
                              )
                            }
                          >
                            Mark ignored
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}