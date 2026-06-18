/**
 * ReceptionOS Phase 2 — Daily Brief pure model (derived from board payload + open tasks).
 */

import {
  compareReceptionOsSeverity,
  RECEPTION_OS_SEVERITIES,
  type ReceptionOsSeverity,
} from "@/src/lib/receptionOs/receptionOsBoardModel";
import type { ReceptionOsActionAlert, ReceptionOsBoardPayload } from "@/src/lib/receptionOs/receptionOsBoardModel.types";
import type { ReceptionTaskRow } from "@/src/lib/receptionOs/receptionTasks.types";
import { OPEN_RECEPTION_TASK_STATUSES } from "@/src/lib/receptionOs/receptionTaskPolicy";

export type ReceptionOsDailyBrief = {
  todayPatientCount: number;
  outstandingDepositCount: number;
  overdueDepositCount: number;
  surgeryNext14Count: number;
  surgeryRiskCount: number;
  followUpNeededCount: number;
  openTaskCount: number;
  alertsBySeverity: Record<ReceptionOsSeverity, number>;
  projectedOperationalRisk: ReceptionOsSeverity;
  summaryLines: string[];
};

function emptySeverityCounts(): Record<ReceptionOsSeverity, number> {
  return { info: 0, warning: 0, critical: 0, blocked: 0 };
}

function countAlertsBySeverity(alerts: ReceptionOsActionAlert[]): Record<ReceptionOsSeverity, number> {
  const out = emptySeverityCounts();
  for (const a of alerts) {
    if (RECEPTION_OS_SEVERITIES.includes(a.severity)) out[a.severity] += 1;
  }
  return out;
}

function maxSeverity(...severities: ReceptionOsSeverity[]): ReceptionOsSeverity {
  let best: ReceptionOsSeverity = "info";
  for (const s of severities) {
    if (compareReceptionOsSeverity(s, best) < 0) best = s;
  }
  return best;
}

export function buildReceptionOsDailyBrief(
  board: Pick<
    ReceptionOsBoardPayload,
    "todaysPatients" | "outstandingDeposits" | "upcomingSurgeries" | "actionAlerts"
  >,
  openTasks: readonly ReceptionTaskRow[],
): ReceptionOsDailyBrief {
  const alertsBySeverity = countAlertsBySeverity(board.actionAlerts);
  const overdueDepositCount = board.outstandingDeposits.filter((d) => d.isOverdue).length;
  const surgeryRiskCount = board.upcomingSurgeries.filter(
    (s) => s.severity === "critical" || s.severity === "blocked" || s.severity === "warning",
  ).length;
  const followUpNeededCount = board.actionAlerts.filter((a) => a.kind === "no_follow_up_after_consultation").length;
  const openTaskCount = openTasks.filter((t) => OPEN_RECEPTION_TASK_STATUSES.includes(t.status)).length;

  const projectedOperationalRisk = maxSeverity(
    overdueDepositCount > 0 ? "critical" : "info",
    surgeryRiskCount > 0 ? maxSeverity(...board.upcomingSurgeries.map((s) => s.severity)) : "info",
    alertsBySeverity.blocked > 0
      ? "blocked"
      : alertsBySeverity.critical > 0
        ? "critical"
        : alertsBySeverity.warning > 0
          ? "warning"
          : "info",
    openTaskCount >= 8 ? "warning" : "info",
  );

  const summaryLines: string[] = [
    `${board.todaysPatients.length} patient${board.todaysPatients.length === 1 ? "" : "s"} scheduled today`,
    `${board.outstandingDeposits.length} outstanding deposit${board.outstandingDeposits.length === 1 ? "" : "s"}${overdueDepositCount ? ` (${overdueDepositCount} overdue)` : ""}`,
    `${board.upcomingSurgeries.length} surger${board.upcomingSurgeries.length === 1 ? "y" : "ies"} in next 14 days${surgeryRiskCount ? ` · ${surgeryRiskCount} need attention` : ""}`,
    followUpNeededCount
      ? `${followUpNeededCount} consultation${followUpNeededCount === 1 ? "" : "s"} needing follow-up`
      : "No consultation follow-up gaps flagged",
    `${openTaskCount} open reception task${openTaskCount === 1 ? "" : "s"}`,
    `Projected operational risk: ${projectedOperationalRisk}`,
  ];

  return {
    todayPatientCount: board.todaysPatients.length,
    outstandingDepositCount: board.outstandingDeposits.length,
    overdueDepositCount,
    surgeryNext14Count: board.upcomingSurgeries.length,
    surgeryRiskCount,
    followUpNeededCount,
    openTaskCount,
    alertsBySeverity,
    projectedOperationalRisk,
    summaryLines,
  };
}
