import { buildCalendarHref } from "@/src/lib/bookings/calendarQuery";
import { formatClinicalScalesSummary } from "@/src/lib/patients/hairLossScales";
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

const EXCLUDED_DUPLICATE_ACTIVITY_KINDS = new Set([
  "booking.created",
  "booking.completed",
  "booking.cancelled",
  "lead.created",
  "lead.converted_to_person",
  "lead.case_seeded",
]);

function hrefForLead(ctx: PatientTimelineHrefContext, leadId: string): string {
  return `/fi-admin/${ctx.tenantId.trim()}/crm/leads/${leadId}`;
}

function hrefForCase(ctx: PatientTimelineHrefContext, caseId: string): string {
  return `/fi-admin/${ctx.tenantId.trim()}/cases/${caseId}`;
}

function hrefForBooking(ctx: PatientTimelineHrefContext, startAtIso: string): string {
  const d = String(startAtIso).slice(0, 10);
  return buildCalendarHref(ctx.tenantId.trim(), { date: d });
}

function isSensitiveActivityKind(kind: string): boolean {
  const k = kind.trim();
  return (
    k === "message.logged" ||
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
    const sens = isSensitiveActivityKind(ev.activity_kind);
    const meta = ev.detail && typeof ev.detail === "object" && !Array.isArray(ev.detail) ? ev.detail : {};
    const summary = safeActivityMetadataSummary(ev.activity_kind, meta as Record<string, unknown>);
    let href: string | null = hrefForLead(ctx, ev.lead_id);
    if (ev.case_id) href = hrefForCase(ctx, ev.case_id);
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
      items.push({
        id: `image_uploaded:${im.id}`,
        occurred_at: im.created_at,
        item_type: "image_uploaded",
        title: "Clinical image uploaded",
        subtitle: null,
        source_type: "image",
        source_id: im.id,
        severity: im.image_status,
        href: null,
        metadata_summary: `Category: ${cat}`,
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
export function mapActivityRowForTimeline(row: Record<string, unknown>): PatientTimelineActivityInput {
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
    lead_id: String(row.lead_id),
    case_id: row.case_id != null ? String(row.case_id) : null,
    patient_id: row.patient_id != null ? String(row.patient_id) : null,
    detail,
  };
}
