"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  createConsultationFollowUpTaskFromSummaryAction,
  createConsultationPathologyRecommendationFromSummaryAction,
  createConsultationQuoteDraftFromSummaryAction,
  createSurgeryPlanningDraftFromConsultationSummaryAction,
} from "@/lib/actions/fi-consultation-form-actions";
import { FiCard } from "@/src/components/fi-design/FiCard";
import type { ConsultationCompletionSummary } from "@/src/lib/consultationForms/completion/consultationCompletionTypes";
import {
  followUpTaskRecommended,
  pathologyHandoffRecommended,
  surgeryPlanningHandoffEligible,
} from "@/src/lib/consultationForms/handoff/consultationHandoffPure";
import type {
  ConsultationHandoffInitialIds,
  ConsultationHandoffMutationResult,
} from "@/src/lib/consultationForms/handoff/consultationHandoffTypes";

type HandoffKey = "followUp" | "quote" | "pathology" | "surgery";

type HandoffCardModel = {
  key: HandoffKey;
  title: string;
  why: string;
  requirements: ReactNode;
  blocked: boolean;
  blockedDetail: string | null;
  cta: string;
  onClick: () => void;
  result: ConsultationHandoffMutationResult | null;
};

function surgeryBlockReason(summary: ConsultationCompletionSummary, caseId: string | null | undefined): string | null {
  const cid = caseId?.trim();
  if (!cid) return "Create/link a case before sending to SurgeryOS.";
  if (summary.outcomeType !== "proceed_surgery") {
    return "Not recommended from this summary — outcome is not proceed to surgery.";
  }
  const hasPlanSignal =
    Boolean(summary.recommendedProcedure.trim()) ||
    (summary.estimatedGraftsMin != null && summary.estimatedGraftsMax != null) ||
    summary.recommendedZones.length > 0;
  if (!hasPlanSignal) {
    return "Add a recommended procedure, graft estimates, or zones to the summary before opening SurgeryOS planning.";
  }
  return null;
}

function toResult(
  id: string | null,
  hrefForId: (id: string) => string | null
): ConsultationHandoffMutationResult | null {
  if (!id?.trim()) return null;
  const hid = id.trim();
  return { id: hid, reused: true, href: hrefForId(hid) };
}

export function ConsultationHandoffPanel({
  tenantId,
  consultationId,
  formInstanceId,
  summary,
  leadId,
  patientId,
  caseId,
  handoffInitial,
}: {
  tenantId: string;
  consultationId: string;
  formInstanceId: string;
  summary: ConsultationCompletionSummary;
  leadId?: string | null;
  patientId?: string | null;
  caseId?: string | null;
  handoffInitial: ConsultationHandoffInitialIds;
}) {
  const router = useRouter();
  const tid = tenantId.trim();
  const cid = consultationId.trim();
  const fid = formInstanceId.trim();
  const lid = leadId?.trim() || null;
  const pid = patientId?.trim() || null;
  const kase = caseId?.trim() || null;

  const followUpHref = useCallback(
    () => (lid ? `/fi-admin/${tid}/crm/leads/${lid}` : null),
    [tid, lid]
  );
  const quoteWorkspaceHref = useCallback(() => {
    if (lid) return `/fi-admin/${tid}/crm/leads/${lid}`;
    if (kase) return `/fi-admin/${tid}/cases/${kase}`;
    return null;
  }, [tid, lid, kase]);
  const pathologyHrefFor = useCallback(
    (requestId: string) => (pid ? `/fi-admin/${tid}/patients/${pid}/blood-request/${requestId}` : null),
    [tid, pid]
  );
  const surgeryHref = useCallback(() => (kase ? `/fi-admin/${tid}/cases/${kase}` : null), [tid, kase]);

  const [busy, setBusy] = useState<HandoffKey | null>(null);
  const [errors, setErrors] = useState<Partial<Record<HandoffKey, string>>>({});

  const [followUpRes, setFollowUpRes] = useState<ConsultationHandoffMutationResult | null>(null);
  const [quoteRes, setQuoteRes] = useState<ConsultationHandoffMutationResult | null>(null);
  const [pathologyRes, setPathologyRes] = useState<ConsultationHandoffMutationResult | null>(null);
  const [surgeryRes, setSurgeryRes] = useState<ConsultationHandoffMutationResult | null>(null);

  useEffect(() => {
    setFollowUpRes(toResult(handoffInitial.followUpTaskId, () => followUpHref()));
    setQuoteRes(toResult(handoffInitial.quoteId, () => quoteWorkspaceHref()));
    setPathologyRes(toResult(handoffInitial.pathologyRequestId, pathologyHrefFor));
    setSurgeryRes(toResult(handoffInitial.surgeryPlanId, () => surgeryHref()));
  }, [handoffInitial, followUpHref, quoteWorkspaceHref, pathologyHrefFor, surgeryHref]);

  const followUpRecommended = followUpTaskRecommended(summary);
  const pathologyRecommended = pathologyHandoffRecommended(summary);
  const surgeryEligible = surgeryPlanningHandoffEligible(summary, kase);
  const surgeryReason = surgeryBlockReason(summary, kase);

  const quoteRequirementsMet = Boolean(lid || kase);
  const followUpRequirementsMet = Boolean(lid);
  const pathologyRequirementsMet = Boolean(pid);

  const run = useCallback(
    async (key: HandoffKey, fn: () => Promise<{ ok: true; result: ConsultationHandoffMutationResult } | { ok: false; error: string }>) => {
      setErrors((e) => ({ ...e, [key]: undefined }));
      setBusy(key);
      try {
        const res = await fn();
        if (!res.ok) {
          setErrors((e) => ({ ...e, [key]: res.error }));
          return;
        }
        const { result } = res;
        if (key === "followUp") setFollowUpRes(result);
        if (key === "quote") setQuoteRes(result);
        if (key === "pathology") setPathologyRes(result);
        if (key === "surgery") setSurgeryRes(result);
        router.refresh();
      } finally {
        setBusy(null);
      }
    },
    [router]
  );

  const body = useMemo(() => ({ formInstanceId: fid }), [fid]);

  const cards = useMemo((): HandoffCardModel[] => [
      {
        key: "followUp" as const,
        title: "Follow-up task",
        why: followUpRecommended
          ? "Summary indicates follow-up, review later, undecided, or blood tests — a CRM task helps the team close the loop."
          : "Not recommended from this summary — follow-up was not required and outcome does not imply a standing task.",
        requirements: (
          <ul className="mt-1 list-inside list-disc text-xs text-slate-600 dark:text-slate-400">
            <li>CRM lead linked: {followUpRequirementsMet ? "yes" : "no (required)"}</li>
            <li>Guided form locked with completion summary: yes</li>
          </ul>
        ),
        blocked: !followUpRecommended || !followUpRequirementsMet,
        blockedDetail: !followUpRequirementsMet
          ? "Link a CRM lead on the consultation to create follow-up tasks."
          : !followUpRecommended
            ? null
            : null,
        cta: "Create follow-up task",
        onClick: (): void => {
          void run("followUp", () => createConsultationFollowUpTaskFromSummaryAction(tid, cid, body));
        },
        result: followUpRes,
      },
      {
        key: "quote" as const,
        title: "Quote draft",
        why: "Capture consultation plan, graft range, and treatments as a draft quote for pricing and consent workflows.",
        requirements: (
          <ul className="mt-1 list-inside list-disc text-xs text-slate-600 dark:text-slate-400">
            <li>CRM lead or case linked: {quoteRequirementsMet ? "yes" : "no (need at least one)"}</li>
          </ul>
        ),
        blocked: !quoteRequirementsMet,
        blockedDetail: !quoteRequirementsMet
          ? "Link a CRM lead or a case on the consultation before creating a quote draft."
          : null,
        cta: "Create quote draft",
        onClick: (): void => {
          void run("quote", () => createConsultationQuoteDraftFromSummaryAction(tid, cid, body));
        },
        result: quoteRes,
      },
      {
        key: "pathology" as const,
        title: "Pathology request",
        why: pathologyRecommended
          ? "Screening or labs were flagged — this opens a saved blood/pathology request draft for clinical review."
          : "Not recommended from this summary — pathology was not flagged.",
        requirements: (
          <ul className="mt-1 list-inside list-disc text-xs text-slate-600 dark:text-slate-400">
            <li>Patient linked: {pathologyRequirementsMet ? "yes" : "no (required)"}</li>
            <li>Pathology recommended in summary: {pathologyRecommended ? "yes" : "no"}</li>
          </ul>
        ),
        blocked: !pathologyRecommended || !pathologyRequirementsMet,
        blockedDetail: !pathologyRequirementsMet
          ? "Link a patient on the consultation before preparing a pathology request."
          : !pathologyRecommended
            ? null
            : null,
        cta: "Prepare pathology request",
        onClick: (): void => {
          void run("pathology", () => createConsultationPathologyRecommendationFromSummaryAction(tid, cid, body));
        },
        result: pathologyRes,
      },
      {
        key: "surgery" as const,
        title: "SurgeryOS planning",
        why: "Push structured zones, graft estimates, and strategy notes into the case surgery plan as a draft (does not approve the case).",
        requirements: (
          <ul className="mt-1 list-inside list-disc text-xs text-slate-600 dark:text-slate-400">
            <li>Case linked: {kase ? "yes" : "no (required)"}</li>
            <li>Outcome proceed to surgery with plan details: {surgeryEligible ? "yes" : "no"}</li>
          </ul>
        ),
        blocked: !surgeryEligible,
        blockedDetail: surgeryReason,
        cta: "Send to SurgeryOS planning",
        onClick: (): void => {
          void run("surgery", () => createSurgeryPlanningDraftFromConsultationSummaryAction(tid, cid, body));
        },
        result: surgeryRes,
      },
    ],
    [
      body,
      cid,
      followUpRecommended,
      followUpRequirementsMet,
      followUpRes,
      kase,
      pathologyRecommended,
      pathologyRequirementsMet,
      pathologyRes,
      quoteRequirementsMet,
      quoteRes,
      run,
      surgeryEligible,
      surgeryReason,
      surgeryRes,
      tid,
    ]
  );

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Guided hand-offs</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Actions below are clinician-triggered. Nothing is created automatically when you complete the consultation. No patient
        emails are sent from here.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((c) => (
          <FiCard key={c.key} className="flex flex-col gap-3 p-4">
            <div>
              <h4 className="text-base font-semibold text-slate-900 dark:text-slate-50">{c.title}</h4>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{c.why}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Requirements</p>
              {c.requirements}
            </div>
            {c.blockedDetail ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                {c.blockedDetail}
              </p>
            ) : null}
            {errors[c.key] ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-900" role="alert">
                {errors[c.key]}
              </p>
            ) : null}
            <div className="mt-auto flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={c.blocked || busy !== null}
                onClick={c.onClick}
                className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                {busy === c.key ? "Working…" : c.cta}
              </button>
              {c.result ? (
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {c.result.reused ? "Already exists" : "Created"}
                  {c.result.detail ? ` — ${c.result.detail}` : null}
                  {c.result.href ? (
                    <>
                      {" · "}
                      <Link href={c.result.href} className="font-semibold text-sky-700 underline hover:text-sky-800 dark:text-sky-400">
                        Open
                      </Link>
                    </>
                  ) : null}
                </span>
              ) : null}
            </div>
          </FiCard>
        ))}
      </div>
    </div>
  );
}
