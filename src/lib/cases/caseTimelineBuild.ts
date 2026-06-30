import type { CaseAdminDetail } from "@/src/lib/cases/caseLoaders";
import type { CaseFollowUpRow, CasePostOpTrackingRow } from "@/src/lib/cases/postOpLoaders";
import type { CaseProcedureRow } from "@/src/lib/cases/procedureDayLoaders";
import type { CaseSurgeryPlanRow } from "@/src/lib/cases/surgeryPlanningLoaders";
import {
  followUpCheckpointLabel,
  followUpStatusLabel,
  postOpStatusLabel,
} from "@/src/lib/cases/postOpLabels";
import { procedureStatusLabel } from "@/src/lib/cases/procedureDayLabels";
import { surgeryPlanningStatusLabel } from "@/src/lib/cases/surgeryPlanningLabels";
import type { CaseTimelineExtraSources, CaseTimelineItem } from "./caseTimelineTypes";

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export type CaseTimelineBuildInput = {
  tenantId: string;
  caseId: string;
  detail: CaseAdminDetail;
  surgeryPlan: CaseSurgeryPlanRow | null;
  procedureDay: CaseProcedureRow | null;
  postOpTracking: CasePostOpTrackingRow | null;
  followUps: CaseFollowUpRow[];
  extra: CaseTimelineExtraSources;
};

function validIso(s: string | null | undefined): string | null {
  if (!s?.trim()) return null;
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  return s.trim();
}

function noonUtcFromDateOnly(dateYmd: string): string {
  const t = dateYmd.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return dateYmd;
  return `${t}T12:00:00.000Z`;
}

function detailSummary(detail: Record<string, unknown>, max = 180): string | null {
  try {
    const keys = Object.keys(detail);
    if (keys.length === 0) return null;
    const s = JSON.stringify(detail);
    if (s.length <= max) return s;
    return `${s.slice(0, max)}…`;
  } catch {
    return null;
  }
}

function crmActivitySensitive(activityKind: string): boolean {
  const k = activityKind.toLowerCase();
  return /message|email|sms|note|call|communication/i.test(k);
}

function push(
  out: CaseTimelineItem[],
  item: Omit<CaseTimelineItem, "occurred_at"> & { occurred_at: string | null }
) {
  const iso = validIso(item.occurred_at);
  if (!iso) return;
  out.push({ ...item, occurred_at: iso });
}

/**
 * Aggregates case-linked rows into a single newest-first timeline (read-only).
 */
export function buildCaseTimeline(input: CaseTimelineBuildInput): CaseTimelineItem[] {
  const { tenantId, caseId, detail, surgeryPlan, procedureDay, postOpTracking, followUps, extra } =
    input;
  const out: CaseTimelineItem[] = [];

  const crmLeadHref = (leadId: string) => `/fi-admin/${tenantId}/crm/leads/${leadId}`;

  push(out, {
    id: `case-${detail.id}-created`,
    kind: "case_lifecycle",
    source: "fi_cases",
    title: "Patient opened",
    description: detail.treatment_type ? `Treatment type: ${detail.treatment_type}.` : null,
    occurred_at: detail.created_at,
    status: detail.status,
    href: null,
    metadata_summary: detail.case_type ? `Patient type: ${detail.case_type}` : null,
  });

  if (detail.updated_at.trim() && detail.updated_at !== detail.created_at) {
    push(out, {
      id: `case-${detail.id}-updated`,
      kind: "case_lifecycle",
      source: "fi_cases",
      title: "Patient profile updated",
      description: "Core patient fields or planning notes reference changed.",
      occurred_at: detail.updated_at,
      status: detail.status,
      href: null,
      metadata_summary: null,
    });
  }

  const seenLead = new Set<string>();
  for (const lead of extra.linkedLeads) {
    if (seenLead.has(lead.id)) continue;
    seenLead.add(lead.id);

    push(out, {
      id: `lead-${lead.id}-created`,
      kind: "lead",
      source: "fi_crm_leads",
      title: "CRM lead record",
      description: lead.summary?.trim() ? lead.summary.trim() : null,
      occurred_at: lead.created_at,
      status: lead.status,
      href: crmLeadHref(lead.id),
      metadata_summary:
        lead.case_id === caseId
          ? "Linked via patient"
          : lead.converted_case_id === caseId
            ? "Converted to this patient"
            : null,
    });

    if (lead.converted_case_id === caseId && lead.converted_at?.trim()) {
      push(out, {
        id: `lead-${lead.id}-converted`,
        kind: "lead",
        source: "fi_crm_leads",
        title: "Lead converted to this patient",
        description: lead.summary?.trim() ? lead.summary.trim() : null,
        occurred_at: lead.converted_at,
        status: lead.status,
        href: crmLeadHref(lead.id),
        metadata_summary: null,
      });
    }
  }

  for (const b of detail.bookings) {
    push(out, {
      id: `booking-${b.id}-start`,
      kind: "booking",
      source: "fi_bookings",
      title: b.title?.trim() ? `Booking: ${b.title.trim()}` : "Booking scheduled",
      description: `${b.booking_type} · window ${b.start_at.slice(0, 16)}–${b.end_at.slice(0, 16)}`,
      occurred_at: b.start_at,
      status: b.booking_status,
      href: null,
      metadata_summary: null,
    });
  }

  for (const im of detail.images) {
    push(out, {
      id: `image-${im.id}-created`,
      kind: "image",
      source: "fi_patient_images",
      title: "Case image added",
      description: im.caption?.trim() ? im.caption.trim() : null,
      occurred_at: im.created_at,
      status: im.image_status,
      href: null,
      metadata_summary: `${im.image_category} · ${im.storage_path.slice(-48)}`,
    });
  }

  if (surgeryPlan) {
    push(out, {
      id: `surgery-plan-${surgeryPlan.id}-created`,
      kind: "surgery_plan",
      source: "fi_case_surgery_plans",
      title: "Surgery plan record created",
      description: surgeryPlan.surgical_plan_summary?.trim()
        ? surgeryPlan.surgical_plan_summary.trim().slice(0, 280)
        : null,
      occurred_at: surgeryPlan.created_at,
      status: surgeryPlanningStatusLabel(surgeryPlan.planning_status),
      href: null,
      metadata_summary: surgeryPlan.planned_procedure_type ?? null,
    });
    if (surgeryPlan.updated_at !== surgeryPlan.created_at) {
      push(out, {
        id: `surgery-plan-${surgeryPlan.id}-updated`,
        kind: "surgery_plan",
        source: "fi_case_surgery_plans",
        title: "Surgery plan updated",
        description: null,
        occurred_at: surgeryPlan.updated_at,
        status: surgeryPlanningStatusLabel(surgeryPlan.planning_status),
        href: null,
        metadata_summary: null,
      });
    }
  }

  if (procedureDay) {
    push(out, {
      id: `procedure-${procedureDay.id}-created`,
      kind: "procedure_day",
      source: "fi_case_procedures",
      title: "Procedure day record created",
      description: procedureDay.completion_summary?.trim()
        ? procedureDay.completion_summary.trim().slice(0, 280)
        : null,
      occurred_at: procedureDay.created_at,
      status: procedureStatusLabel(procedureDay.procedure_status),
      href: null,
      metadata_summary: procedureDay.procedure_date
        ? `Procedure date ${procedureDay.procedure_date}`
        : null,
    });
    if (procedureDay.updated_at !== procedureDay.created_at) {
      push(out, {
        id: `procedure-${procedureDay.id}-updated`,
        kind: "procedure_day",
        source: "fi_case_procedures",
        title: "Procedure day updated",
        description: null,
        occurred_at: procedureDay.updated_at,
        status: procedureStatusLabel(procedureDay.procedure_status),
        href: null,
        metadata_summary: null,
      });
    }
  }

  if (postOpTracking) {
    push(out, {
      id: `postop-${postOpTracking.id}-created`,
      kind: "post_op",
      source: "fi_case_post_op_tracking",
      title: "Post-op tracking started",
      description: postOpTracking.outcome_notes?.trim()
        ? postOpTracking.outcome_notes.trim().slice(0, 240)
        : null,
      occurred_at: postOpTracking.created_at,
      status: postOpStatusLabel(postOpTracking.post_op_status),
      href: null,
      metadata_summary:
        postOpTracking.patient_satisfaction_score != null
          ? `Satisfaction ${postOpTracking.patient_satisfaction_score}/10`
          : null,
    });
    if (postOpTracking.updated_at !== postOpTracking.created_at) {
      push(out, {
        id: `postop-${postOpTracking.id}-updated`,
        kind: "post_op",
        source: "fi_case_post_op_tracking",
        title: "Post-op tracking updated",
        description: null,
        occurred_at: postOpTracking.updated_at,
        status: postOpStatusLabel(postOpTracking.post_op_status),
        href: null,
        metadata_summary: null,
      });
    }
  }

  for (const fu of followUps) {
    if (fu.scheduled_date?.trim()) {
      push(out, {
        id: `followup-${fu.id}-scheduled`,
        kind: "follow_up",
        source: "fi_case_follow_ups",
        title: `Follow-up scheduled (${followUpCheckpointLabel(fu.checkpoint)})`,
        description: fu.notes?.trim() ? fu.notes.trim().slice(0, 240) : null,
        occurred_at: noonUtcFromDateOnly(fu.scheduled_date),
        status: followUpStatusLabel(fu.follow_up_status),
        href: null,
        metadata_summary: fu.linked_image_ids.length
          ? `${fu.linked_image_ids.length} linked image(s)`
          : null,
      });
    }
    if (fu.completed_date?.trim()) {
      push(out, {
        id: `followup-${fu.id}-completed`,
        kind: "follow_up",
        source: "fi_case_follow_ups",
        title: `Follow-up completed (${followUpCheckpointLabel(fu.checkpoint)})`,
        description: fu.notes?.trim() ? fu.notes.trim().slice(0, 240) : null,
        occurred_at: noonUtcFromDateOnly(fu.completed_date),
        status: followUpStatusLabel(fu.follow_up_status),
        href: null,
        metadata_summary: fu.linked_image_ids.length
          ? `${fu.linked_image_ids.length} linked image(s)`
          : null,
      });
    }
  }

  for (const ev of extra.foundationTimelineEvents) {
    push(out, {
      id: `fi-timeline-${ev.id}`,
      kind: "foundation_timeline",
      source: "fi_timeline_events",
      title: ev.title?.trim() ? ev.title.trim() : ev.event_kind || "Timeline event",
      description: detailSummary(asObj(ev.detail)),
      occurred_at: ev.occurred_at,
      status: ev.event_kind || null,
      href: null,
      metadata_summary: ev.event_kind || null,
    });
  }

  for (const act of extra.crmActivityEvents) {
    const href =
      act.lead_id != null
        ? crmLeadHref(act.lead_id)
        : act.patient_id != null
          ? `/fi-admin/${tenantId}/patients/${act.patient_id}`
          : null;
    const meta =
      act.lead_id != null
        ? `lead ${act.lead_id.slice(0, 8)}…`
        : act.patient_id != null
          ? "Patient-scoped activity"
          : null;
    push(out, {
      id: `crm-act-${act.id}`,
      kind: "crm_activity",
      source: "fi_crm_activity_events",
      title: act.title?.trim() ? act.title.trim() : act.activity_kind,
      description: detailSummary(act.detail),
      occurred_at: act.occurred_at,
      status: act.activity_kind,
      href,
      metadata_summary: meta,
      is_sensitive: crmActivitySensitive(act.activity_kind),
    });
  }

  out.sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at));
  return out;
}
