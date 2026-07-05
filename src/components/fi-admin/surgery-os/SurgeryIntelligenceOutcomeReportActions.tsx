"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import { linkHairAuditOutcomeReportAction } from "@/lib/actions/fi-hairaudit-outcome-report-actions";
import {
  formatHairAuditOutcomeReportActionLabel,
  type HairAuditOutcomeReportAction,
} from "@/src/lib/outcomeIntelligence/hairAuditOutcomeReportWorkflowCore";
import type { SurgeryIntelligenceDashboardTableRow } from "@/src/lib/outcomeIntelligence/surgeryIntelligenceDashboardTypes";

function actionButtonClass(disabled: boolean): string {
  return `rounded-md border border-white/10 px-2 py-1 text-xs ${
    disabled
      ? "cursor-not-allowed text-[#64748B]"
      : "text-[#22C1FF] hover:border-[#22C1FF]/40"
  }`;
}

export function SurgeryIntelligenceOutcomeReportActions({
  tenantId,
  row,
}: {
  tenantId: string;
  row: SurgeryIntelligenceDashboardTableRow;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checklistOpen, setChecklistOpen] = useState(false);

  const runMutation = useCallback(
    (options: { dryRun?: boolean; sendToReview?: boolean }) => {
      if (!row.caseId) return;
      setError(null);
      setMessage(null);
      startTransition(async () => {
        const result = await linkHairAuditOutcomeReportAction(tenantId, {
          surgery_id: row.surgeryId,
          case_id: row.caseId!,
          dryRun: options.dryRun,
          sendToReview: options.sendToReview,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setMessage(result.message);
        if (!result.data.dryRun && result.data.outcome.kind === "linked") {
          router.refresh();
        }
      });
    },
    [tenantId, row.caseId, row.surgeryId, router]
  );

  const renderAction = (action: HairAuditOutcomeReportAction) => {
    switch (action) {
      case "open_report":
        return row.outcomeReportLink ? (
          <Link
            key={action}
            href={row.outcomeReportLink}
            className={actionButtonClass(false)}
          >
            {formatHairAuditOutcomeReportActionLabel(action)}
          </Link>
        ) : null;
      case "create_or_link_report":
        return (
          <button
            key={action}
            type="button"
            disabled={pending || !row.caseId}
            className={actionButtonClass(pending || !row.caseId)}
            onClick={() => runMutation({ dryRun: false })}
          >
            {formatHairAuditOutcomeReportActionLabel(action)}
          </button>
        );
      case "send_to_hairaudit_review":
        return (
          <button
            key={action}
            type="button"
            disabled={pending || !row.caseId}
            className={actionButtonClass(pending || !row.caseId)}
            onClick={() => runMutation({ sendToReview: true })}
          >
            {formatHairAuditOutcomeReportActionLabel(action)}
          </button>
        );
      case "mark_missing_follow_up_imaging":
        return row.imagingHref ? (
          <Link
            key={action}
            href={row.imagingHref}
            className={actionButtonClass(false)}
          >
            {formatHairAuditOutcomeReportActionLabel(action)}
          </Link>
        ) : null;
      case "view_missing_evidence_checklist":
        return (
          <button
            key={action}
            type="button"
            className={actionButtonClass(false)}
            onClick={() => setChecklistOpen((open) => !open)}
          >
            {formatHairAuditOutcomeReportActionLabel(action)}
          </button>
        );
      default:
        return null;
    }
  };

  const actions = row.outcomeReportAvailableActions.length
    ? row.outcomeReportAvailableActions
    : [row.outcomeReportRecommendedAction];

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <span
          className={
            row.outcomeReportStatus === "report_complete"
              ? "text-emerald-300"
              : row.outcomeReportStatus === "ready_for_review"
                ? "text-sky-300"
                : row.outcomeReportStatus === "linkage_conflict"
                  ? "text-amber-300"
                  : "text-[#CBD5E1]"
          }
        >
          {row.outcomeReportStatusLabel}
        </span>
        {row.outcomeReportMissingEvidence.length > 0 ? (
          <div className="text-xs text-[#64748B]">
            {row.outcomeReportMissingEvidence.length} evidence gap
            {row.outcomeReportMissingEvidence.length === 1 ? "" : "s"}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => renderAction(action))}
      </div>
      {checklistOpen ? (
        <ul className="rounded-md border border-white/10 bg-[#0c1426]/60 px-2 py-2 text-xs text-[#94A3B8]">
          {row.outcomeReportMissingEvidence.length ? (
            row.outcomeReportMissingEvidence.map((item) => (
              <li key={item} className="py-0.5">
                {item.replaceAll("_", " ")}
              </li>
            ))
          ) : (
            <li>No missing evidence flagged.</li>
          )}
        </ul>
      ) : null}
      {message ? <p className="text-xs text-emerald-300/90">{message}</p> : null}
      {error ? <p className="text-xs text-rose-300/90">{error}</p> : null}
    </div>
  );
}