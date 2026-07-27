import { buildCalendarHref } from "@/src/lib/bookings/calendarQuery";
import { formatClinicalScalesSummary } from "@/src/lib/patients/hairLossScales";
import {
  followUpEncounterTimelineTitle,
  imagingAiReviewStatusLabel,
} from "@/src/lib/followUpEncounters/followUpEncounterTypes";
import type {
  FollowUpEncounterType,
  LegacyPatientSource,
} from "@/src/lib/followUpEncounters/followUpEncounterTypes";
import { crmActivityTimelineTitle } from "./patientTimelineLabels";
import { sortPatientTimelineItems } from "./patientTimelineFilters";
import type {
  PatientTimelineActivityInput,
  PatientTimelineBuildOptions,
  PatientTimelineBuildResult,
  PatientTimelineHrefContext,
  PatientTimelineItem,
  PatientTimelineSourceBundle,
} from "./patientTimelineTypes";
import { isGenericEmailActivityKind } from "@/src/lib/integrations/genericEmail/genericEmailActivityCore";
import { treatmentImagingTimelineSummary } from "@/src/lib/imaging-os/treatmentImagingProtocol";

const EXCLUDED_DUPLICATE_ACTIVITY_KINDS = new Set([
  "booking.created",
  "booking.completed",
  "booking.cancelled",
  "lead.created",
  "lead.converted_to_person",
  "lead.case_seeded",
]);

function hrefForLead(ctx: PatientTimelineHrefContext, leadId: string, tab?: string): string {
  const base = `/fi-admin/${ctx.tenantId.trim()}/crm/leads/${leadId}`;
  const t = tab?.trim();
  return t ? `${base}?tab=${encodeURIComponent(t)}` : base;
}

function hrefForCase(ctx: PatientTimelineHrefContext, caseId: string): string {
  return `/fi-admin/${ctx.tenantId.trim()}/cases/${caseId}`;
}

function hrefForBooking(ctx: PatientTimelineHrefContext, startAtIso: string): string {
  const d = String(startAtIso).slice(0, 10);
  return buildCalendarHref(ctx.tenantId.trim(), { date: d });
}

/** Patient-app / CRM message preview kinds that should open lead Documents & notes. */
function isPatientMessageActivityKind(kind: string): boolean {
  const k = kind.trim();
  return k === "patient_app.message.received" || k === "message.logged";
}

function isSensitiveActivityKind(kind: string): boolean {
  const k = kind.trim();
  return (
    isGenericEmailActivityKind(k) ||
    k === "message.logged" ||
    k === "patient_app.message.received" ||
    k.startsWith("lead_communication.") ||
    k.startsWith("lead_note.") ||
    k === "note.created"
  );
}

function readString(detail: Record<string, unknown>, key: string): string | null {
  const v = detail[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function safeActivityMetadataSummary(kind: string, detail: Record<string, unknown>): string | null {
  const k = kind.trim();
  if (k === "stage.changed") {
    const slug = readString(detail, "to_stage_slug");
    if (slug) return `Stage: ${slug}`;
    return "Stage updated";
  }
  if (k.startsWith("lead_communication.")) {
    const dir = readString(detail, "direction");
    const typ = readString(detail, "communication_type");
    const parts = [typ, dir].filter(Boolean);
    return parts.length ? parts.join(" · ") : "Contact log";
  }
  if (isGenericEmailActivityKind(k)) {
    const dir = readString(detail, "direction");
    const preview = readString(detail, "subject_preview");
    if (preview) return `${dir === "outbound" ? "Outbound" : "Inbound"} · ${preview}`;
    return dir === "outbound" ? "Outbound clinic email" : "Inbound clinic email";
  }
  if (k.startsWith("task.")) {
    return "Task";
  }
  if (k === "booking.updated") {
    const ck = detail.changed_keys;
    if (Array.isArray(ck) && ck.length) return `${ck.length} field(s) updated`;
    return "Booking details updated";
  }
  if (k === "lead.updated") {
    return "Lead fields updated";
  }
  if (k === "lead.converted_to_person" || k === "lead.case_seeded") {
    return "Conversion workflow";
  }
  if (k.startsWith("lead_note.") || k === "note.created") {
    return "Note activity";
  }
  if (k === "message.logged") {
    const ch = readString(detail, "channel");
    return ch ? `Channel: ${ch}` : "Message logged";
  }
  if (k === "pathology.blood_request.created") {
    const tpl = readString(detail, "template_used");
    const n = detail.test_count;
    const count = typeof n === "number" && Number.isFinite(n) ? n : null;
    if (tpl && count != null) return `Template: ${tpl.replace(/_/g, " ")} · ${count} test(s)`;
    if (tpl) return `Template: ${tpl.replace(/_/g, " ")}`;
    return "Blood request";
  }
  if (k === "pathology.blood_request.sent") {
    return "PDF emailed to patient";
  }
  if (k === "pathology.blood_request.cancelled") {
    const tpl = readString(detail, "template_used");
    return tpl ? `Template: ${tpl.replace(/_/g, " ")}` : "Request voided";
  }
  if (
    k === "pathology.blood_result.uploaded" ||
    k === "pathology.blood_result.reviewed" ||
    k === "pathology.blood_result.archived"
  ) {
    const rd = readString(detail, "result_date");
    const prov = readString(detail, "provider_name");
    const n = detail.marker_count;
    const count = typeof n === "number" && Number.isFinite(n) ? n : null;
    const req = readString(detail, "pathology_request_id");
    const parts: string[] = [];
    if (rd) parts.push(`Date: ${rd}`);
    if (prov) parts.push(`Provider: ${prov}`);
    if (count != null) parts.push(`${count} marker(s)`);
    if (req) parts.push("Linked request");
    return parts.length ? parts.join(" · ") : "Blood result";
  }
  if (k.startsWith("pathology.ai_interpretation.")) {
    const hair = detail.hair_loss_relevance_score;
    const surgery = detail.surgical_readiness_score;
    const flags = detail.major_risk_flags_count;
    const parts: string[] = [];
    if (typeof hair === "number" && Number.isFinite(hair))
      parts.push(`Hair relevance: ${hair}/100`);
    if (typeof surgery === "number" && Number.isFinite(surgery))
      parts.push(`Surgery readiness: ${surgery}/100`);
    if (typeof flags === "number" && Number.isFinite(flags)) parts.push(`${flags} risk flag(s)`);
    return parts.length ? parts.join(" · ") : "AI interpretation";
  }
  return null;
}

export function buildPatientTimeline(
  bundle: PatientTimelineSourceBundle,
  options: PatientTimelineBuildOptions
): PatientTimelineBuildResult {
  const ctx = options.hrefContext;
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
  const offset = Math.max(options.offset ?? 0, 0);
  const sort = options.sort ?? "newest_first";

  const items: PatientTimelineItem[] = [];

  for (const lead of bundle.leads) {
    items.push({
      id: `lead_created:${lead.id}`,
      occurred_at: lead.created_at,
      item_type: "lead_created",
      title: "Lead linked",
      subtitle: lead.stageLabel ? `Stage: ${lead.stageLabel}` : null,
      source_type: "lead",
      source_id: lead.id,
      severity: lead.status,
      href: hrefForLead(ctx, lead.id),
      metadata_summary: lead.stageLabel ? `Current stage: ${lead.stageLabel}` : "Lead opened",
      is_sensitive: false,
    });

    if (lead.converted_at) {
      items.push({
        id: `lead_converted:${lead.id}:${lead.converted_at}`,
        occurred_at: lead.converted_at,
        item_type: "lead_converted",
        title: "Lead converted",
        subtitle: null,
        source_type: "lead",
        source_id: lead.id,
        severity: null,
        href: hrefForLead(ctx, lead.id),
        metadata_summary: lead.converted_case_id ? "Case anchor assigned" : "Person/patient link",
        is_sensitive: false,
      });
    }
  }

  for (const ev of bundle.activity) {
    if (EXCLUDED_DUPLICATE_ACTIVITY_KINDS.has(ev.activity_kind.trim())) continue;
    if (isGenericEmailActivityKind(ev.activity_kind) && options.viewerCanReadClinicalPhi !== true) {
      continue;
    }
    const sens = isSensitiveActivityKind(ev.activity_kind);
    const meta =
      ev.detail && typeof ev.detail === "object" && !Array.isArray(ev.detail) ? ev.detail : {};
    const summary = safeActivityMetadataSummary(ev.activity_kind, meta as Record<string, unknown>);
    let href: string | null = null;
    const kind = ev.activity_kind.trim();
    if (ev.case_id) href = hrefForCase(ctx, ev.case_id);
    else if (ev.lead_id) {
      href = isPatientMessageActivityKind(kind)
        ? hrefForLead(ctx, ev.lead_id, "documents")
        : hrefForLead(ctx, ev.lead_id);
    } else if (ev.patient_id) {
      const pid = String(ev.patient_id);
      const tid = ctx.tenantId.trim();
      const prid = readString(meta as Record<string, unknown>, "pathology_request_id");
      const resid = readString(meta as Record<string, unknown>, "pathology_result_id");
      if (prid && kind.startsWith("pathology.blood_request.")) {
        href = `/fi-admin/${tid}/patients/${pid}/blood-request/${prid}`;
      } else if (
        resid &&
        (kind.startsWith("pathology.blood_result.") ||
          kind.startsWith("pathology.ai_interpretation."))
      ) {
        href = `/fi-admin/${tid}/patients/${pid}/blood-results/${resid}`;
      } else if (isPatientMessageActivityKind(kind)) {
        // Historical patient-app messages without a lead must not fake-link to this page.
        href = null;
      } else {
        href = `/fi-admin/${tid}/patients/${pid}`;
      }
    }
    items.push({
      id: `crm_activity:${ev.id}`,
      occurred_at: ev.occurred_at,
      item_type: "crm_activity",
      title: crmActivityTimelineTitle(ev.activity_kind),
      subtitle: null,
      source_type: "crm_activity",
      source_id: ev.id,
      severity: ev.activity_kind,
      href,
      metadata_summary: summary,
      is_sensitive: sens,
    });
  }

  for (const b of bundle.bookings) {
    const st = String(b.booking_status).toLowerCase();
    const typeLabel = String(b.booking_type).replace(/_/g, " ");

    items.push({
      id: `booking_scheduled:${b.id}`,
      occurred_at: b.created_at,
      item_type: "booking_scheduled",
      title: "Booking scheduled",
      subtitle: null,
      source_type: "booking",
      source_id: b.id,
      severity: b.booking_status,
      href: hrefForBooking(ctx, b.start_at),
      metadata_summary: `${typeLabel} · starts ${b.start_at.slice(0, 16).replace("T", " ")}`,
      is_sensitive: false,
    });

    if (st === "completed") {
      items.push({
        id: `booking_completed:${b.id}`,
        occurred_at: b.updated_at,
        item_type: "booking_completed",
        title: "Booking completed",
        subtitle: null,
        source_type: "booking",
        source_id: b.id,
        severity: "completed",
        href: hrefForBooking(ctx, b.start_at),
        metadata_summary: typeLabel,
        is_sensitive: false,
      });
    } else if (st === "cancelled") {
      const when = b.cancelled_at ?? b.updated_at;
      items.push({
        id: `booking_cancelled:${b.id}`,
        occurred_at: when,
        item_type: "booking_cancelled",
        title: "Booking cancelled",
        subtitle: null,
        source_type: "booking",
        source_id: b.id,
        severity: "cancelled",
        href: hrefForBooking(ctx, b.start_at),
        metadata_summary: typeLabel,
        is_sensitive: false,
      });
    } else if (st === "no_show") {
      items.push({
        id: `booking_noshow:${b.id}`,
        occurred_at: b.updated_at,
        item_type: "other",
        title: "Booking marked as no-show",
        subtitle: null,
        source_type: "booking",
        source_id: b.id,
        severity: "no_show",
        href: hrefForBooking(ctx, b.start_at),
        metadata_summary: typeLabel,
        is_sensitive: false,
      });
    }
  }

  for (const c of bundle.cases) {
    items.push({
      id: `case_created:${c.id}`,
      occurred_at: c.created_at,
      item_type: "case_created",
      title: "Case created",
      subtitle: c.case_type ? `Type: ${c.case_type}` : null,
      source_type: "case",
      source_id: c.id,
      severity: c.status,
      href: hrefForCase(ctx, c.id),
      metadata_summary: `Status: ${c.status}`,
      is_sensitive: false,
    });
  }

  if (bundle.clinical) {
    const row = bundle.clinical;
    const scaleSummary =
      formatClinicalScalesSummary({
        norwood_scale: row.norwood_scale,
        ludwig_scale: row.ludwig_scale,
        hairline_pattern: row.hairline_pattern,
        primary_concern: row.primary_concern,
      }) ?? "Structured fields captured";
    items.push({
      id: `clinical_created:${row.patient_id}`,
      occurred_at: row.created_at,
      item_type: "clinical_details_updated",
      title: "Clinical details recorded",
      subtitle: null,
      source_type: "clinical",
      source_id: row.patient_id,
      severity: null,
      href: null,
      metadata_summary: scaleSummary,
      is_sensitive: false,
    });
    if (row.updated_at !== row.created_at) {
      items.push({
        id: `clinical_updated:${row.patient_id}:${row.updated_at}`,
        occurred_at: row.updated_at,
        item_type: "clinical_details_updated",
        title: "Clinical details updated",
        subtitle: null,
        source_type: "clinical",
        source_id: row.patient_id,
        severity: null,
        href: null,
        metadata_summary: scaleSummary,
        is_sensitive: false,
      });
    }
  }

  for (const im of bundle.images) {
    const cat = String(im.image_category).replace(/_/g, " ");
    if (im.image_status === "active") {
      const isFollowUpPhoto = Boolean(im.follow_up_encounter_id);
      const treatmentSummary = treatmentImagingTimelineSummary(im);
      items.push({
        id: `image_uploaded:${im.id}`,
        occurred_at: im.created_at,
        item_type: isFollowUpPhoto ? "follow_up_photos_captured" : "image_uploaded",
        title: treatmentSummary
          ? "Treatment session photo"
          : isFollowUpPhoto
            ? "Photos captured"
            : "Clinical image uploaded",
        subtitle: treatmentSummary ? null : null,
        source_type: "image",
        source_id: im.id,
        severity: im.image_status,
        href: isFollowUpPhoto
          ? `/fi-admin/${ctx.tenantId.trim()}/patients/${bundle.foundationPatientId}/imaging`
          : treatmentSummary && im.booking_id
            ? buildCalendarHref(ctx.tenantId.trim(), {
                date: String(im.created_at).slice(0, 10),
              })
            : null,
        metadata_summary:
          treatmentSummary ?? (isFollowUpPhoto ? "Follow-up imaging session" : `Category: ${cat}`),
        is_sensitive: false,
      });
    }
    if (im.image_status === "archived" && im.archived_at) {
      items.push({
        id: `image_archived:${im.id}:${im.archived_at}`,
        occurred_at: im.archived_at,
        item_type: "image_archived",
        title: "Clinical image archived",
        subtitle: null,
        source_type: "image",
        source_id: im.id,
        severity: "archived",
        href: null,
        metadata_summary: `Category: ${cat}`,
        is_sensitive: false,
      });
    }
  }

  for (const enc of bundle.followUpEncounters) {
    const encType = enc.encounter_type as FollowUpEncounterType;
    const legacySource = enc.legacy_source as LegacyPatientSource | null;
    const title = followUpEncounterTimelineTitle(encType, legacySource);
    const when = enc.completed_at ?? enc.created_at;
    items.push({
      id: `follow_up_encounter:${enc.id}`,
      occurred_at: when,
      item_type: "follow_up_encounter",
      title,
      subtitle: enc.visit_reason,
      source_type: "follow_up",
      source_id: enc.id,
      severity: enc.status,
      href: `/fi-admin/${ctx.tenantId.trim()}/patients/returning?patientId=${encodeURIComponent(bundle.foundationPatientId)}&encounterId=${encodeURIComponent(enc.id)}`,
      metadata_summary:
        enc.legacy_source === "timely"
          ? "Returning patient from Timely · Continue care in FI OS"
          : enc.status === "draft"
            ? "Draft follow-up"
            : "Follow-up completed",
      is_sensitive: Boolean(enc.clinical_note),
    });
  }

  for (const sess of bundle.followUpImagingSessions) {
    const reviewLabel = imagingAiReviewStatusLabel(
      sess.ai_review_status as Parameters<typeof imagingAiReviewStatusLabel>[0]
    );
    const needsReview =
      sess.ai_review_status === "ai_pending" || sess.ai_review_status === "ai_ready_for_review";
    items.push({
      id: `follow_up_imaging:${sess.id}`,
      occurred_at: sess.created_at,
      item_type: needsReview ? "follow_up_ai_review_pending" : "follow_up_photos_captured",
      title: needsReview ? reviewLabel : "Follow-up imaging session",
      subtitle: sess.template_slug.replace(/_/g, " "),
      source_type: "follow_up",
      source_id: sess.id,
      severity: sess.ai_status,
      href: `/fi-admin/${ctx.tenantId.trim()}/patients/${bundle.foundationPatientId}/imaging`,
      metadata_summary: sess.session_completeness_status
        ? `Completeness: ${sess.session_completeness_status.replace(/_/g, " ")}`
        : reviewLabel,
      is_sensitive: false,
    });
  }

  const p = bundle.patient;
  if (p.updated_at !== p.created_at) {
    items.push({
      id: `patient_admin:${p.id}:${p.updated_at}`,
      occurred_at: p.updated_at,
      item_type: "patient_admin_updated",
      title: "Patient admin metadata updated",
      subtitle: null,
      source_type: "patient",
      source_id: p.id,
      severity: p.patient_status,
      href: null,
      metadata_summary: "Status or admin fields changed",
      is_sensitive: false,
    });
  }

  const totalBuilt = items.length;
  const sorted = sortPatientTimelineItems(items, sort);
  const page = sorted.slice(offset, offset + limit);
  return {
    items: page,
    totalBuilt,
    hasMore: offset + page.length < totalBuilt,
  };
}

/** Map raw Supabase activity row including JSON detail. */
export function mapActivityRowForTimeline(
  row: Record<string, unknown>
): PatientTimelineActivityInput {
  const detailRaw = row.detail;
  const detail =
    detailRaw && typeof detailRaw === "object" && !Array.isArray(detailRaw)
      ? (detailRaw as Record<string, unknown>)
      : {};
  return {
    id: String(row.id),
    occurred_at: String(row.occurred_at),
    activity_kind: String(row.activity_kind),
    title: row.title != null ? String(row.title) : null,
    lead_id: row.lead_id != null ? String(row.lead_id) : null,
    case_id: row.case_id != null ? String(row.case_id) : null,
    patient_id: row.patient_id != null ? String(row.patient_id) : null,
    detail,
  };
}
