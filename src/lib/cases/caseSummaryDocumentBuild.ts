import "server-only";

import type { CaseAdminDetail, CaseLeadLink } from "@/src/lib/cases/caseLoaders";
import type { CaseReadinessReport } from "@/src/lib/cases/caseReadinessTypes";
import type { CaseFollowUpRow, CasePostOpTrackingRow } from "@/src/lib/cases/postOpLoaders";
import {
  followUpCheckpointLabel,
  followUpStatusLabel,
  postOpStatusLabel,
} from "@/src/lib/cases/postOpLabels";
import type { CaseProcedureRow } from "@/src/lib/cases/procedureDayLoaders";
import { procedureStatusLabel } from "@/src/lib/cases/procedureDayLabels";
import type { CaseSurgeryPlanRow } from "@/src/lib/cases/surgeryPlanningLoaders";
import { surgeryPlanningStatusLabel } from "@/src/lib/cases/surgeryPlanningLabels";
import type { CaseTimelineItem } from "@/src/lib/cases/caseTimelineTypes";
import type {
  CaseSummaryDocument,
  CaseSummaryFollowUpLine,
  CaseSummaryKeyValue,
  CaseSummaryLeadLine,
  CaseSummaryTimelinePreviewLine,
} from "@/src/lib/cases/caseSummaryDocumentTypes";

export type BuildCaseSummaryDocumentInput = {
  tenantId: string;
  detail: CaseAdminDetail;
  surgeryPlan: CaseSurgeryPlanRow | null;
  procedureDay: CaseProcedureRow | null;
  postOpTracking: CasePostOpTrackingRow | null;
  followUps: CaseFollowUpRow[];
  timelineItems: CaseTimelineItem[];
  readiness: CaseReadinessReport;
};

function row(label: string, value: string | null | undefined): CaseSummaryKeyValue {
  const v = value?.trim();
  return { label, value: v ? v : "—" };
}

function formatDateYmd(iso: string | null | undefined): string {
  if (!iso?.trim()) return "—";
  const s = iso.trim();
  if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const t = Date.parse(s);
  if (Number.isNaN(t)) return "—";
  return new Date(t).toISOString().slice(0, 10);
}

function formatIsoShort(iso: string | null | undefined): string {
  if (!iso?.trim()) return "—";
  const t = Date.parse(iso.trim());
  if (Number.isNaN(t)) return iso.trim().slice(0, 16);
  return new Date(t).toISOString().slice(0, 16).replace("T", " ");
}

function leadLinkReasonLabel(reason: CaseLeadLink["link_reason"]): string {
  return reason === "case_id" ? "Linked via patient" : "Converted to this patient";
}

function graftEstimate(plan: CaseSurgeryPlanRow | null): string | null {
  if (!plan) return null;
  const min = plan.estimated_grafts_min;
  const max = plan.estimated_grafts_max;
  if (min != null && max != null) return `${min.toLocaleString()}–${max.toLocaleString()} grafts`;
  if (min != null) return `≥ ${min.toLocaleString()} grafts`;
  if (max != null) return `≤ ${max.toLocaleString()} grafts`;
  return null;
}

function plannedZoneLabels(plan: CaseSurgeryPlanRow | null): string[] {
  if (!plan?.planned_zones?.length) return [];
  return plan.planned_zones.map((z) => (z.label?.trim() ? z.label.trim() : z.key));
}

const TIMELINE_PREVIEW = 18;

/**
 * Assembles a read-only case summary document from data already loaded for the case (Stages 5A–5I).
 */
export function buildCaseSummaryDocument(
  input: BuildCaseSummaryDocumentInput
): CaseSummaryDocument {
  const {
    tenantId,
    detail,
    surgeryPlan,
    procedureDay,
    postOpTracking,
    followUps,
    timelineItems,
    readiness,
  } = input;
  const tid = tenantId.trim();
  const cid = detail.id;

  const caseSummary: CaseSummaryKeyValue[] = [
    row("Patient ID", cid),
    row("Status", detail.status),
    row("Treatment type", detail.treatment_type),
    row("Patient type", detail.case_type),
    row("External ID", detail.external_id),
    row("Created", formatIsoShort(detail.created_at)),
    row("Updated", formatIsoShort(detail.updated_at)),
  ];

  const patientId =
    detail.patient?.foundation_patient_id ??
    detail.foundation_patient_id ??
    detail.legacy_patient_id;
  const linkedPatient = {
    linked: !!detail.patient,
    rows: detail.patient
      ? ([
          row("Person", detail.patient.person_label),
          row("Email", detail.patient.person_email),
          row("Patient record ID", detail.patient.foundation_patient_id),
          row("Person ID", detail.patient.person_id),
        ] satisfies CaseSummaryKeyValue[])
      : ([
          row("Foundation patient ID", detail.foundation_patient_id),
          row("Legacy patient ID", detail.legacy_patient_id),
        ] satisfies CaseSummaryKeyValue[]),
    patientProfileHref: patientId ? `/fi-admin/${tid}/patients/${patientId}` : null,
  };

  const linkedLeads: CaseSummaryLeadLine[] = detail.leads.map((L) => ({
    title: L.title,
    status: L.status,
    linkReasonLabel: leadLinkReasonLabel(L.link_reason),
    leadDetailHref: `/fi-admin/${tid}/crm/leads/${L.id}`,
  }));

  const treatmentProfile: CaseSummaryKeyValue[] = [
    row("Treatment type", detail.treatment_type),
    row("Patient type", detail.case_type),
    row("Clinic ID", detail.clinic_id),
    row("Organisation ID", detail.organisation_id),
    row("Partner ID", detail.partner_id),
  ];

  const surgeryRows: CaseSummaryKeyValue[] = surgeryPlan
    ? [
        row("Planning status", surgeryPlanningStatusLabel(surgeryPlan.planning_status)),
        row("Planned procedure type", surgeryPlan.planned_procedure_type),
        row("Planned session type", surgeryPlan.planned_session_type),
        row("Plan updated", formatIsoShort(surgeryPlan.updated_at)),
      ]
    : [];

  const procedureRows: CaseSummaryKeyValue[] = procedureDay
    ? [
        row("Procedure date", formatDateYmd(procedureDay.procedure_date)),
        row("Status", procedureStatusLabel(procedureDay.procedure_status)),
        row("Location", procedureDay.procedure_location),
        row("Room", procedureDay.procedure_room),
        row("Start", procedureDay.start_time),
        row("Finish", procedureDay.finish_time),
        row("Extraction method", procedureDay.extraction_method),
        row("Implantation method", procedureDay.implantation_method),
        row("Punch size", procedureDay.punch_size),
        row(
          "Grafts extracted",
          procedureDay.grafts_extracted != null ? String(procedureDay.grafts_extracted) : null
        ),
        row(
          "Grafts implanted",
          procedureDay.grafts_implanted != null ? String(procedureDay.grafts_implanted) : null
        ),
        row(
          "Hairs implanted",
          procedureDay.hairs_implanted != null ? String(procedureDay.hairs_implanted) : null
        ),
      ]
    : [];

  const postOpRows: CaseSummaryKeyValue[] = postOpTracking
    ? [
        row("Post-op status", postOpStatusLabel(postOpTracking.post_op_status)),
        row("Instructions given", postOpTracking.instructions_given ? "Yes" : "No"),
        row(
          "Patient satisfaction (1–10)",
          postOpTracking.patient_satisfaction_score != null
            ? String(postOpTracking.patient_satisfaction_score)
            : null
        ),
        row("Aftercare notes", postOpTracking.aftercare_notes),
        row("Donor recovery notes", postOpTracking.donor_recovery_notes),
        row("Recipient recovery notes", postOpTracking.recipient_recovery_notes),
        row("Complication notes", postOpTracking.complication_notes),
        row("Outcome notes", postOpTracking.outcome_notes),
      ]
    : [];

  const followUpCheckpoints: CaseSummaryFollowUpLine[] = followUps.map((fu) => ({
    checkpointLabel: followUpCheckpointLabel(fu.checkpoint),
    scheduled: formatDateYmd(fu.scheduled_date),
    completed: formatDateYmd(fu.completed_date),
    statusLabel: followUpStatusLabel(fu.follow_up_status),
    notes: fu.notes?.trim() ? fu.notes.trim() : null,
    linkedImages: fu.linked_image_ids.length,
  }));

  const preview: CaseSummaryTimelinePreviewLine[] = timelineItems
    .slice(0, TIMELINE_PREVIEW)
    .map((it) => ({
      occurredOn: formatIsoShort(it.occurred_at),
      title: it.title,
      status: it.status ?? null,
      sensitive: it.is_sensitive === true,
    }));

  const readinessSections = readiness.sections.map((s) => ({
    title: s.title,
    health: s.health,
    summary: s.summary,
  }));

  return {
    meta: {
      tenantId: tid,
      caseId: cid,
      generatedAtIso: new Date().toISOString(),
    },
    caseSummary,
    linkedPatient,
    linkedLeads: { leads: linkedLeads },
    treatmentProfile,
    planningNotes: detail.planning_notes?.trim() ? detail.planning_notes : null,
    surgeryPlan: {
      present: !!surgeryPlan,
      rows: surgeryRows,
      zones: plannedZoneLabels(surgeryPlan),
      graftEstimate: graftEstimate(surgeryPlan),
      surgicalPlanSummary: surgeryPlan?.surgical_plan_summary?.trim()
        ? surgeryPlan.surgical_plan_summary.trim()
        : null,
    },
    procedureDay: {
      present: !!procedureDay,
      rows: procedureRows,
      completionSummary: procedureDay?.completion_summary?.trim()
        ? procedureDay.completion_summary.trim()
        : null,
    },
    postOp: {
      present: !!postOpTracking,
      rows: postOpRows,
    },
    followUpCheckpoints,
    linkedImageCount: detail.images.length,
    timeline: {
      eventCount: timelineItems.length,
      preview,
    },
    readiness: {
      overallPercent: readiness.overallPercent,
      requiredSatisfied: readiness.requiredSatisfied,
      requiredTotal: readiness.requiredTotal,
      nextRecommendedStep: readiness.nextRecommendedStep,
      sections: readinessSections,
    },
  };
}
