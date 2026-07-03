"use client";

import { useEffect, useState } from "react";

import {
  loadPatientFollowUpImagingSessionsAction,
  updateFollowUpAiReviewAction,
} from "@/lib/actions/fi-follow-up-encounter-actions";
import { FiCard } from "@/src/components/fi-design/FiCard";
import {
  imagingAiReviewStatusLabel,
  type ImagingSessionAiReviewStatus,
} from "@/src/lib/followUpEncounters/followUpEncounterTypes";

type ImagingSessionRow = {
  id: string;
  template_slug: string;
  ai_review_status: string | null;
  session_completeness_status: string | null;
};

/**
 * Placeholder clinician review UI for AI imaging summaries (advisory only until approved).
 */
export function FollowUpEncounterAiReviewPanel({
  tenantId,
  patientId,
}: {
  tenantId: string;
  patientId: string;
}) {
  const [sessions, setSessions] = useState<ImagingSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busySessionId, setBusySessionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const r = await loadPatientFollowUpImagingSessionsAction(tenantId, patientId);
      if (!cancelled && r.ok) setSessions(r.sessions);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId, patientId]);

  async function onReview(sessionId: string, status: "clinician_approved" | "clinician_rejected") {
    setBusySessionId(sessionId);
    setMessage(null);
    try {
      const r = await updateFollowUpAiReviewAction(tenantId, { sessionId, reviewStatus: status });
      if (!r.ok) {
        setMessage(r.error);
        return;
      }
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, ai_review_status: status } : s))
      );
      setMessage(
        status === "clinician_approved"
          ? "AI imaging summary approved. Advisory outputs remain clinician-governed."
          : "AI imaging summary rejected."
      );
    } finally {
      setBusySessionId(null);
    }
  }

  if (loading) return null;
  if (sessions.length === 0) return null;

  return (
    <FiCard className="space-y-3 p-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-100">AI imaging review</h2>
        <p className="mt-1 text-xs text-slate-400">
          AI outputs are advisory only. AI imaging review pending clinician approval before any
          patient-facing use.
        </p>
      </div>

      <ul className="space-y-2">
        {sessions.map((sess) => {
          const reviewStatus = (sess.ai_review_status as ImagingSessionAiReviewStatus | null) ?? "ai_pending";
          const needsReview =
            reviewStatus === "ai_pending" || reviewStatus === "ai_ready_for_review";
          return (
            <li
              key={sess.id}
              className="rounded-lg border border-white/[0.06] bg-[#0F1629]/60 px-3 py-2 text-sm"
            >
              <p className="font-medium text-slate-200">
                {sess.template_slug.replace(/_/g, " ")}
              </p>
              <p className="text-xs text-slate-400">{imagingAiReviewStatusLabel(reviewStatus)}</p>
              {sess.session_completeness_status ? (
                <p className="text-xs text-slate-500">
                  Completeness: {sess.session_completeness_status.replace(/_/g, " ")}
                </p>
              ) : null}
              {needsReview ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busySessionId != null}
                    className="rounded-md bg-emerald-800/80 px-2.5 py-1 text-xs font-medium text-emerald-100 hover:bg-emerald-700/80 disabled:opacity-60"
                    onClick={() => void onReview(sess.id, "clinician_approved")}
                  >
                    Approve summary
                  </button>
                  <button
                    type="button"
                    disabled={busySessionId != null}
                    className="rounded-md bg-rose-900/60 px-2.5 py-1 text-xs font-medium text-rose-200 hover:bg-rose-800/60 disabled:opacity-60"
                    onClick={() => void onReview(sess.id, "clinician_rejected")}
                  >
                    Reject summary
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {message ? <p className="text-xs text-slate-400">{message}</p> : null}
    </FiCard>
  );
}
