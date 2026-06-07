import { fiCaseStatusLabel } from "@/src/lib/cases/caseLabels";
import { caseReadinessSectionTitle } from "@/src/lib/cases/caseReadinessLabels";
import { postOpStatusLabel } from "@/src/lib/cases/postOpLabels";
import { procedureStatusLabel } from "@/src/lib/cases/procedureDayLabels";
import { surgeryPlanningStatusLabel } from "@/src/lib/cases/surgeryPlanningLabels";
import type { CaseWorklistRow, CasesWorklistReadinessBucket } from "@/src/lib/cases/casesIndexTypes";

const TERMINAL_PROCEDURE = new Set(["cancelled", "aborted"]);

/** Local calendar YYYY-MM-DD for the given instant (server render uses host timezone). */
export function dashboardTodayYmd(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addCalendarDaysToYmd(ymd: string, days: number): string {
  const parts = ymd.split("-").map((x) => Number(x));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return ymd;
  const [ys, ms, ds] = parts;
  const dt = new Date(ys, ms - 1, ds);
  dt.setDate(dt.getDate() + days);
  return dashboardTodayYmd(dt);
}

export function isDashboardActiveCase(row: CaseWorklistRow): boolean {
  const s = row.status.trim().toLowerCase();
  return s !== "complete" && s !== "failed";
}

export function plannedZonesShortLabel(row: CaseWorklistRow): string | null {
  const zones = row.surgeryPlan?.planned_zones;
  if (!zones?.length) return null;
  const parts = zones.map((z) => (z.label?.trim() ? z.label.trim() : z.key)).filter(Boolean);
  if (!parts.length) return null;
  const head = parts.slice(0, 4).join(", ");
  return parts.length > 4 ? `${head}…` : head;
}

export function hasDueFollowUp(row: CaseWorklistRow, todayYmd: string): boolean {
  for (const fu of row.followUps) {
    const st = fu.follow_up_status?.trim().toLowerCase() ?? "";
    if (st === "completed" || st === "skipped" || st === "cancelled") continue;
    const sd = fu.scheduled_date?.trim().slice(0, 10);
    if (sd && sd <= todayYmd) return true;
  }
  return false;
}

export function isSurgeryPlanningQueueCase(row: CaseWorklistRow): boolean {
  if (!row.surgeryPlan) return true;
  return row.readinessSurgeryPlanningHealth !== "complete";
}

export function isTodaySurgeryRow(row: CaseWorklistRow, todayYmd: string): boolean {
  if (!row.procedureDate || row.procedureDate !== todayYmd) return false;
  const ps = row.procedureDay?.procedure_status?.trim().toLowerCase() ?? "";
  return !TERMINAL_PROCEDURE.has(ps);
}

/** Tomorrow through `endYmd` (inclusive), excluding completed/cancelled/aborted procedures. */
export function isUpcomingSurgeryWindowRow(row: CaseWorklistRow, todayYmd: string, endYmd: string): boolean {
  if (!row.procedureDate) return false;
  const d = row.procedureDate;
  const tomorrow = addCalendarDaysToYmd(todayYmd, 1);
  if (d < tomorrow || d > endYmd) return false;
  const ps = row.procedureDay?.procedure_status?.trim().toLowerCase() ?? "";
  if (!ps || TERMINAL_PROCEDURE.has(ps) || ps === "completed") return false;
  return true;
}

export function isRecentlyCompletedProcedure(row: CaseWorklistRow, todayYmd: string): boolean {
  const ps = row.procedureDay?.procedure_status?.trim().toLowerCase();
  if (ps !== "completed" || !row.procedureDate) return false;
  const proc = row.procedureDate;
  const start = addCalendarDaysToYmd(todayYmd, -14);
  return proc >= start && proc <= todayYmd;
}

export type SurgeryOsDashboardRef = {
  caseId: string;
  personLabel: string;
  caseStatusLabel: string;
  procedureDate: string | null;
  procedureStatusLabel: string | null;
  planningStatusLabel: string | null;
  zonesLabel: string | null;
  readinessBucket: CasesWorklistReadinessBucket;
  postOpStatusLabel: string | null;
};

export type SurgeryOsReadinessAlertRef = SurgeryOsDashboardRef & { gapSummary: string };

function rowToRef(row: CaseWorklistRow): SurgeryOsDashboardRef {
  return {
    caseId: row.id,
    personLabel: row.person_label,
    caseStatusLabel: fiCaseStatusLabel(row.status),
    procedureDate: row.procedureDate,
    procedureStatusLabel: row.procedureDay ? procedureStatusLabel(row.procedureDay.procedure_status) : null,
    planningStatusLabel: row.surgeryPlan ? surgeryPlanningStatusLabel(row.surgeryPlan.planning_status) : null,
    zonesLabel: plannedZonesShortLabel(row),
    readinessBucket: row.readinessBucket,
    postOpStatusLabel: row.postOpTracking ? postOpStatusLabel(row.postOpTracking.post_op_status) : null,
  };
}

function gapSummaryForReadiness(row: CaseWorklistRow): string {
  const parts: string[] = [];
  if (row.readinessCaseProfileHealth !== "complete") parts.push(caseReadinessSectionTitle("case_profile"));
  if (row.readinessSurgeryPlanningHealth !== "complete") parts.push(caseReadinessSectionTitle("surgery_planning"));
  if (row.readinessProcedureDayHealth !== "complete") parts.push(caseReadinessSectionTitle("procedure_day"));
  if (row.readinessPostOpHealth !== "complete") parts.push(caseReadinessSectionTitle("post_op"));
  if (row.readinessFollowUpsHealth !== "complete") parts.push(caseReadinessSectionTitle("follow_ups"));
  return parts.slice(0, 4).join(" · ") || "Open the case to review readiness";
}

const SORT_PROC_DATE_ASC = (a: CaseWorklistRow, b: CaseWorklistRow) => {
  const ad = a.procedureDate ?? "";
  const bd = b.procedureDate ?? "";
  if (ad !== bd) return ad.localeCompare(bd);
  return a.person_label.localeCompare(b.person_label);
};

const SORT_PROC_DATE_DESC = (a: CaseWorklistRow, b: CaseWorklistRow) => {
  const ad = a.procedureDate ?? "";
  const bd = b.procedureDate ?? "";
  if (ad !== bd) return bd.localeCompare(ad);
  return a.person_label.localeCompare(b.person_label);
};

export type SurgeryOsDashboardModel = {
  todayYmd: string;
  todaySurgeries: SurgeryOsDashboardRef[];
  upcomingSurgeries: SurgeryOsDashboardRef[];
  readinessAlerts: SurgeryOsReadinessAlertRef[];
  followUpQueue: SurgeryOsDashboardRef[];
  recentCompleted: SurgeryOsDashboardRef[];
  planningQueue: SurgeryOsDashboardRef[];
  metrics: {
    totalActiveCases: number;
    upcomingSurgeries: number;
    readinessReviewCases: number;
    followUpsDueCases: number;
    incompletePlanningCases: number;
  };
};

const LIST_CAP = 10;

/**
 * Read-only aggregates for the SurgeryOS dashboard from enriched worklist rows (same cap as index loader).
 */
export function deriveSurgeryOsDashboardModel(rows: CaseWorklistRow[], now = new Date()): SurgeryOsDashboardModel {
  const todayYmd = dashboardTodayYmd(now);
  const endUpcoming = addCalendarDaysToYmd(todayYmd, 30);

  const active = rows.filter(isDashboardActiveCase);

  const todayRows = active.filter((r) => isTodaySurgeryRow(r, todayYmd)).sort(SORT_PROC_DATE_ASC);
  const upcomingRows = active.filter((r) => isUpcomingSurgeryWindowRow(r, todayYmd, endUpcoming)).sort(SORT_PROC_DATE_ASC);

  const readinessRows = active
    .filter((r) => r.readinessBucket === "needs_attention")
    .sort((a, b) => a.readinessPercent - b.readinessPercent || a.person_label.localeCompare(b.person_label));

  const followRows = active.filter((r) => hasDueFollowUp(r, todayYmd)).sort(SORT_PROC_DATE_ASC);

  const recentDone = active
    .filter((r) => isRecentlyCompletedProcedure(r, todayYmd))
    .sort(SORT_PROC_DATE_DESC)
    .slice(0, LIST_CAP);

  const planningRows = active.filter((r) => isSurgeryPlanningQueueCase(r)).sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  const metrics = {
    totalActiveCases: active.length,
    upcomingSurgeries: upcomingRows.length,
    readinessReviewCases: active.filter((r) => r.readinessBucket === "needs_attention").length,
    followUpsDueCases: active.filter((r) => hasDueFollowUp(r, todayYmd)).length,
    incompletePlanningCases: active.filter((r) => isSurgeryPlanningQueueCase(r)).length,
  };

  return {
    todayYmd,
    todaySurgeries: todayRows.slice(0, LIST_CAP).map(rowToRef),
    upcomingSurgeries: upcomingRows.slice(0, LIST_CAP).map(rowToRef),
    readinessAlerts: readinessRows.slice(0, LIST_CAP).map((r) => ({
      ...rowToRef(r),
      gapSummary: gapSummaryForReadiness(r),
    })),
    followUpQueue: followRows.slice(0, LIST_CAP).map(rowToRef),
    recentCompleted: recentDone.map(rowToRef),
    planningQueue: planningRows.slice(0, LIST_CAP).map(rowToRef),
    metrics,
  };
}
