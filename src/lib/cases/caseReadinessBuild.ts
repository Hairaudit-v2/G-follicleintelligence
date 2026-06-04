import type { CaseAdminDetail } from "@/src/lib/cases/caseLoaders";
import type { CaseFollowUpRow, CasePostOpTrackingRow } from "@/src/lib/cases/postOpLoaders";
import type { CaseProcedureRow } from "@/src/lib/cases/procedureDayLoaders";
import type { CaseSurgeryPlanRow } from "@/src/lib/cases/surgeryPlanningLoaders";
import type { CaseTimelineItem } from "@/src/lib/cases/caseTimelineTypes";
import type { CaseReadinessHealth, CaseReadinessReport, CaseReadinessSection } from "./caseReadinessTypes";
import { caseReadinessSectionTitle } from "./caseReadinessLabels";
import type { FollowUpCheckpointValue } from "@/src/lib/cases/postOpTypes";

export type CaseReadinessBuildInput = {
  detail: CaseAdminDetail;
  surgeryPlan: CaseSurgeryPlanRow | null;
  procedureDay: CaseProcedureRow | null;
  postOpTracking: CasePostOpTrackingRow | null;
  followUps: CaseFollowUpRow[];
  timelineItems: CaseTimelineItem[];
};

function hasLinkedPatient(d: CaseAdminDetail): boolean {
  return !!(
    d.patient?.foundation_patient_id?.trim() ||
    d.foundation_patient_id?.trim() ||
    d.legacy_patient_id?.trim()
  );
}

function treatmentOrCaseType(d: CaseAdminDetail): boolean {
  return !!(d.treatment_type?.trim() || d.case_type?.trim());
}

function followUpRow(cp: FollowUpCheckpointValue, rows: CaseFollowUpRow[]): CaseFollowUpRow | undefined {
  return rows.find((r) => r.checkpoint === cp);
}

function followUpScheduledOrDone(row: CaseFollowUpRow | undefined): boolean {
  if (!row) return false;
  if (row.scheduled_date?.trim() || row.completed_date?.trim()) return true;
  const st = row.follow_up_status?.trim().toLowerCase();
  return st === "completed" || st === "skipped";
}

function sectionHealth(checks: { ok: boolean; optional?: boolean }[]): CaseReadinessHealth {
  const required = checks.filter((c) => !c.optional);
  if (required.length === 0) return "not_started";
  const okN = required.filter((c) => c.ok).length;
  if (okN === required.length) return "complete";
  if (okN === 0) return "not_started";
  return "in_progress";
}

function deriveHealthWithContext(
  checks: { ok: boolean; optional?: boolean }[],
  hasAnyContext: boolean
): CaseReadinessHealth {
  const base = sectionHealth(checks);
  if (base === "not_started" && hasAnyContext) return "needs_attention";
  return base;
}

function isPlanningActiveStatus(status: string | null | undefined): boolean {
  const s = status?.trim() ?? "";
  return ["in_progress", "ready_for_review", "approved", "on_hold"].includes(s);
}

function missingLabels(checks: { id: string; label: string; ok: boolean; optional?: boolean }[]): string[] {
  return checks.filter((c) => !c.optional && !c.ok).map((c) => c.label);
}

function requiredProgressFrom(checks: { ok: boolean; optional?: boolean }[]): { ok: number; total: number } {
  const req = checks.filter((c) => !c.optional);
  return { ok: req.filter((c) => c.ok).length, total: req.length };
}

function finalizeSection(
  partial: Omit<CaseReadinessSection, "requiredProgress" | "checks" | "missing"> & {
    checks: { id: string; label: string; ok: boolean; optional?: boolean }[];
  }
): CaseReadinessSection {
  return {
    ...partial,
    checks: partial.checks,
    missing: missingLabels(partial.checks),
    requiredProgress: requiredProgressFrom(partial.checks),
  };
}

export type BuildCaseReadinessOptions = {
  /**
   * When true, readiness excludes the timeline section (used on the cases index worklist where
   * full timeline rows are not loaded).
   */
  worklistMode?: boolean;
};

/**
 * Computes SurgeryOS-style readiness from data already loaded on the case detail route (read-only).
 */
export function buildCaseReadiness(input: CaseReadinessBuildInput, options?: BuildCaseReadinessOptions): CaseReadinessReport {
  const { detail, surgeryPlan, procedureDay, postOpTracking, followUps, timelineItems } = input;
  const worklistMode = options?.worklistMode === true;

  const fu1 = followUpRow("day_1", followUps);
  const fu7 = followUpRow("day_7", followUps);
  const laterCps: FollowUpCheckpointValue[] = ["day_14", "month_1", "month_3", "month_6", "month_12"];
  const laterPending = laterCps.filter((cp) => !followUpScheduledOrDone(followUpRow(cp, followUps)));

  const profileChecks = [
    { id: "status", label: "Case status set", ok: !!detail.status?.trim() },
    { id: "type", label: "Treatment type or case type", ok: treatmentOrCaseType(detail) },
    { id: "patient", label: "Linked patient / person", ok: hasLinkedPatient(detail) },
  ];
  const profileSection = finalizeSection({
    key: "case_profile",
    title: caseReadinessSectionTitle("case_profile"),
    health: sectionHealth(profileChecks),
    summary:
      profileChecks.every((c) => c.ok) ? "Profile identifiers are in good shape." : "Complete core case profile fields.",
    checks: profileChecks,
  });

  const planChecks = surgeryPlan
    ? [
        {
          id: "status",
          label: "Planning status in progress or approved",
          ok: isPlanningActiveStatus(surgeryPlan.planning_status),
        },
        { id: "proc_type", label: "Planned procedure type", ok: !!surgeryPlan.planned_procedure_type?.trim() },
        { id: "zones", label: "At least one planned zone", ok: surgeryPlan.planned_zones.length > 0 },
        {
          id: "graft_range",
          label: "Estimated graft range (min & max)",
          ok:
            surgeryPlan.estimated_grafts_min != null &&
            surgeryPlan.estimated_grafts_max != null &&
            surgeryPlan.estimated_grafts_max >= surgeryPlan.estimated_grafts_min,
        },
      ]
    : [
        { id: "plan", label: "Surgery plan record exists", ok: false },
        { id: "status", label: "Planning status in progress or approved", ok: false, optional: true },
        { id: "proc_type", label: "Planned procedure type", ok: false, optional: true },
        { id: "zones", label: "At least one planned zone", ok: false, optional: true },
        { id: "graft_range", label: "Estimated graft range (min & max)", ok: false, optional: true },
      ];

  const surgerySection = finalizeSection({
    key: "surgery_planning",
    title: caseReadinessSectionTitle("surgery_planning"),
    health: surgeryPlan ? deriveHealthWithContext(planChecks, true) : "not_started",
    summary: surgeryPlan
      ? surgeryPlan.planning_status === "cancelled"
        ? "Surgery plan is cancelled — reopen or replace before proceeding."
        : "Surgery plan row present — fill required planning fields."
      : "Create a surgery plan for this case.",
    checks: planChecks,
  });

  const procComplete = procedureDay?.procedure_status === "completed";
  const procedureChecks: { id: string; label: string; ok: boolean; optional?: boolean }[] = procedureDay
    ? [
        { id: "date", label: "Procedure date", ok: !!procedureDay.procedure_date?.trim() },
        { id: "status", label: "Procedure status", ok: !!procedureDay.procedure_status?.trim() },
        { id: "surgeon", label: "Surgeon assigned", ok: !!procedureDay.surgeon_user_id?.trim() },
        { id: "ext", label: "Extraction method", ok: !!procedureDay.extraction_method?.trim() },
        { id: "imp", label: "Implantation method", ok: !!procedureDay.implantation_method?.trim() },
      ]
    : [{ id: "row", label: "Procedure day record exists", ok: false }];

  if (procedureDay && procComplete) {
    procedureChecks.push(
      { id: "ge", label: "Grafts extracted recorded", ok: procedureDay.grafts_extracted != null },
      { id: "gi", label: "Grafts implanted recorded", ok: procedureDay.grafts_implanted != null }
    );
  }

  const procedureSection = finalizeSection({
    key: "procedure_day",
    title: caseReadinessSectionTitle("procedure_day"),
    health: procedureDay ? deriveHealthWithContext(procedureChecks, true) : "not_started",
    summary: procedureDay
      ? procComplete
        ? "Procedure marked complete — confirm graft counts are logged."
        : "Procedure day captured — finish intra-op details before completion."
      : "Add procedure day details when the session is scheduled.",
    checks: procedureChecks,
  });

  const postOpChecks = postOpTracking
    ? [
        {
          id: "status",
          label: "Post-op status beyond “not started”",
          ok: !!postOpTracking.post_op_status?.trim() && postOpTracking.post_op_status !== "not_started",
        },
        { id: "instr", label: "Post-op instructions given", ok: postOpTracking.instructions_given === true },
        {
          id: "notes",
          label: "Donor or recipient recovery notes",
          ok:
            !!postOpTracking.donor_recovery_notes?.trim() ||
            !!postOpTracking.recipient_recovery_notes?.trim(),
        },
      ]
    : [{ id: "row", label: "Post-op tracking record exists", ok: false }];

  const postOpSection = finalizeSection({
    key: "post_op",
    title: caseReadinessSectionTitle("post_op"),
    health: postOpTracking ? deriveHealthWithContext(postOpChecks, true) : "not_started",
    summary: postOpTracking ? "Post-op row present — capture recovery instructions and notes." : "Start post-op tracking after the procedure.",
    checks: postOpChecks,
  });

  const fuChecks = [
    {
      id: "d1",
      label: "Day 1 follow-up scheduled or completed",
      ok: followUpScheduledOrDone(fu1),
    },
    {
      id: "d7",
      label: "Day 7 follow-up scheduled or completed",
      ok: followUpScheduledOrDone(fu7),
    },
    ...laterCps.map((cp) => ({
      id: cp,
      label: `${cp.replace(/_/g, " ")} (later checkpoint)`,
      ok: followUpScheduledOrDone(followUpRow(cp, followUps)),
      optional: true as boolean,
    })),
  ];

  const followSection = finalizeSection({
    key: "follow_ups",
    title: caseReadinessSectionTitle("follow_ups"),
    health: sectionHealth(fuChecks),
    summary:
      followUpScheduledOrDone(fu1) && followUpScheduledOrDone(fu7)
        ? laterPending.length
          ? `Early checkpoints set — ${laterPending.length} later checkpoint(s) still open when due.`
          : "Early follow-ups are scheduled or completed."
        : "Schedule at least day 1 and day 7 follow-ups.",
    checks: fuChecks,
  });

  const imageChecks = [{ id: "count", label: "At least one case-linked image", ok: detail.images.length >= 1 }];
  const imageSection = finalizeSection({
    key: "images",
    title: caseReadinessSectionTitle("images"),
    health: sectionHealth(imageChecks),
    summary:
      detail.images.length === 0
        ? "Upload at least one case image for documentation."
        : `${detail.images.length} image(s) linked to this case.`,
    checks: imageChecks,
  });

  const bookingChecks = [{ id: "count", label: "At least one linked booking", ok: detail.bookings.length >= 1 }];
  const bookingSection = finalizeSection({
    key: "bookings",
    title: caseReadinessSectionTitle("bookings"),
    health: sectionHealth(bookingChecks),
    summary:
      detail.bookings.length === 0
        ? "No bookings on this case yet — add when scheduling."
        : `${detail.bookings.length} booking(s) linked.`,
    checks: bookingChecks,
  });

  const timelineRich =
    timelineItems.some((i) => i.kind !== "case_lifecycle") || timelineItems.filter((i) => i.kind === "case_lifecycle").length >= 2;

  const timelineChecks = [{ id: "activity", label: "Timeline shows activity beyond case creation", ok: timelineRich }];
  const timelineSection = finalizeSection({
    key: "timeline",
    title: caseReadinessSectionTitle("timeline"),
    health: sectionHealth(timelineChecks),
    summary: timelineRich ? "Timeline shows linked clinical or operational activity." : "Add bookings, images, CRM, or clinical rows to populate the timeline.",
    checks: timelineChecks,
  });

  const sections: CaseReadinessSection[] = [
    profileSection,
    surgerySection,
    procedureSection,
    postOpSection,
    followSection,
    imageSection,
    bookingSection,
    ...(worklistMode ? [] : [timelineSection]),
  ];

  const allChecks = sections.flatMap((s) => s.checks);
  const requiredChecks = allChecks.filter((c) => !c.optional);
  const requiredTotal = requiredChecks.length;
  const requiredSatisfied = requiredChecks.filter((c) => c.ok).length;
  const overallPercent = requiredTotal === 0 ? 0 : Math.round((100 * requiredSatisfied) / requiredTotal);

  const warnings = sections.flatMap((s) => s.missing.map((m) => `${s.title}: ${m}`));

  const nextRecommendedStep = pickNextStep(sections);

  return {
    sections,
    requiredSatisfied,
    requiredTotal,
    overallPercent,
    warnings,
    nextRecommendedStep,
  };
}

function pickNextStep(sections: CaseReadinessSection[]): string {
  const order: CaseReadinessSection["key"][] = [
    "case_profile",
    "surgery_planning",
    "procedure_day",
    "post_op",
    "follow_ups",
    "images",
    "bookings",
    "timeline",
  ];
  for (const key of order) {
    const s = sections.find((x) => x.key === key);
    if (!s) continue;
    if (s.health === "complete") continue;
    if (s.missing.length) {
      return `Next: ${s.title} — ${s.missing[0]}.`;
    }
    if (s.health === "not_started") {
      return `Next: start ${s.title.toLowerCase()} for this case.`;
    }
    return `Next: finish remaining items in ${s.title.toLowerCase()}.`;
  }
  return "Case readiness looks strong — review sections for any optional polish.";
}
