import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { leadTitleFromRow, personMetadataDisplayLabel } from "@/src/lib/crm/crmLeadListDisplay";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { formatClinicalScalesSummary } from "@/src/lib/patients/hairLossScales";
import type { FiReminderJobRow, FiReminderJobWithTemplate } from "./reminderTypes";
import { REMINDER_JOB_STATUSES } from "./reminderConstants";
import type {
  ReminderJobStatus,
  ReminderTemplateType,
  ReminderTriggerEvent,
} from "./reminderConstants";
import { REMINDER_TEMPLATE_TYPES, REMINDER_TRIGGER_EVENTS } from "./reminderConstants";

function assertMetadataObject(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

function mapJobRow(row: Record<string, unknown>): FiReminderJobRow {
  const st = String(row.status);
  if (!REMINDER_JOB_STATUSES.includes(st as ReminderJobStatus)) {
    throw new Error(`Invalid reminder job status: ${st}`);
  }
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    template_id: String(row.template_id),
    booking_id: row.booking_id != null ? String(row.booking_id) : null,
    person_id: row.person_id != null ? String(row.person_id) : null,
    lead_id: row.lead_id != null ? String(row.lead_id) : null,
    scheduled_at: String(row.scheduled_at),
    status: st as ReminderJobStatus,
    attempt_count: Number(row.attempt_count ?? 0),
    last_attempt_at: row.last_attempt_at != null ? String(row.last_attempt_at) : null,
    delivered_at: row.delivered_at != null ? String(row.delivered_at) : null,
    error_log:
      row.error_log != null ? String(row.error_log) : row.error != null ? String(row.error) : null,
    metadata: assertMetadataObject(row.metadata),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

async function loadTemplatesByIds(
  supabase: SupabaseClient,
  tenantId: string,
  templateIds: string[]
): Promise<
  Map<string, { name: string; type: ReminderTemplateType; trigger_event: ReminderTriggerEvent }>
> {
  const out = new Map<
    string,
    { name: string; type: ReminderTemplateType; trigger_event: ReminderTriggerEvent }
  >();
  if (!templateIds.length) return out;
  const { data, error } = await supabase
    .from("fi_reminder_templates")
    .select("id, name, type, trigger_event")
    .eq("tenant_id", tenantId.trim())
    .in("id", templateIds);
  if (error) throw new Error(error.message);
  for (const r of data ?? []) {
    const row = r as Record<string, unknown>;
    const id = String(row.id);
    const type = String(row.type);
    const trig = String(row.trigger_event);
    if (!REMINDER_TEMPLATE_TYPES.includes(type as ReminderTemplateType)) continue;
    if (!REMINDER_TRIGGER_EVENTS.includes(trig as ReminderTriggerEvent)) continue;
    out.set(id, {
      name: String(row.name),
      type: type as ReminderTemplateType,
      trigger_event: trig as ReminderTriggerEvent,
    });
  }
  return out;
}

export async function cancelPendingReminderJobsForBooking(
  tenantId: string,
  bookingId: string,
  reason: string,
  client?: SupabaseClient
): Promise<void> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const bid = assertNonEmptyUuid(bookingId, "bookingId");
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("fi_reminder_jobs")
    .update({
      status: "cancelled",
      error_log: reason.slice(0, 2000),
      updated_at: nowIso,
    })
    .eq("tenant_id", tid)
    .eq("booking_id", bid)
    .eq("status", "pending");
  if (error) throw new Error(error.message);
}

export async function loadReminderJobsForBooking(
  tenantId: string,
  bookingId: string,
  client?: SupabaseClient
): Promise<FiReminderJobWithTemplate[]> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const bid = assertNonEmptyUuid(bookingId, "bookingId");

  const { data, error } = await supabase
    .from("fi_reminder_jobs")
    .select("*")
    .eq("tenant_id", tid)
    .eq("booking_id", bid)
    .order("scheduled_at", { ascending: true });

  if (error) throw new Error(error.message);
  const jobs = ((data ?? []) as Record<string, unknown>[]).map(mapJobRow);
  const tplIds = Array.from(new Set(jobs.map((j) => j.template_id)));
  const tplMap = await loadTemplatesByIds(supabase, tid, tplIds);

  return jobs.map((j) => {
    const t = tplMap.get(j.template_id);
    return {
      ...j,
      template_name: t?.name ?? "",
      template_type: t?.type ?? "email",
      template_trigger_event: t?.trigger_event ?? "booking_created",
    };
  });
}

/**
 * Reminder jobs for an appointment: booking-scoped jobs plus lead-scoped jobs when `leadId` is set (deduped by id).
 */
export async function loadReminderJobsForAppointment(
  tenantId: string,
  bookingId: string,
  leadId?: string | null,
  client?: SupabaseClient
): Promise<FiReminderJobWithTemplate[]> {
  const bookingJobs = await loadReminderJobsForBooking(tenantId, bookingId, client);
  const lid = leadId?.trim();
  if (!lid) return bookingJobs;
  const leadJobs = await loadReminderJobsForLead(tenantId, lid, client);
  const byId = new Map<string, FiReminderJobWithTemplate>();
  for (const j of [...bookingJobs, ...leadJobs]) byId.set(j.id, j);
  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  );
}

export async function loadReminderJobsForLead(
  tenantId: string,
  leadId: string,
  client?: SupabaseClient
): Promise<FiReminderJobWithTemplate[]> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const lid = assertNonEmptyUuid(leadId, "leadId");

  const { data, error } = await supabase
    .from("fi_reminder_jobs")
    .select("*")
    .eq("tenant_id", tid)
    .eq("lead_id", lid)
    .order("scheduled_at", { ascending: true });

  if (error) throw new Error(error.message);
  const jobs = ((data ?? []) as Record<string, unknown>[]).map(mapJobRow);
  const tplIds = Array.from(new Set(jobs.map((j) => j.template_id)));
  const tplMap = await loadTemplatesByIds(supabase, tid, tplIds);

  return jobs.map((j) => {
    const t = tplMap.get(j.template_id);
    return {
      ...j,
      template_name: t?.name ?? "",
      template_type: t?.type ?? "email",
      template_trigger_event: t?.trigger_event ?? "booking_created",
    };
  });
}

export type UpcomingReminderDashboardItem = {
  jobId: string;
  scheduled_at: string;
  status: ReminderJobStatus;
  templateName: string;
  templateType: string;
  bookingId: string;
  bookingTitle: string | null;
  bookingStartAt: string;
};

/**
 * Pending (or processing) reminder jobs scheduled in [fromIso, toIso) for dashboard widgets.
 */
export async function loadUpcomingReminderJobsForTenantRange(
  tenantId: string,
  fromIso: string,
  toIso: string,
  limit: number,
  client?: SupabaseClient
): Promise<UpcomingReminderDashboardItem[]> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const cap = Math.min(Math.max(limit, 1), 100);

  const { data, error } = await supabase
    .from("fi_reminder_jobs")
    .select("id, scheduled_at, status, booking_id, template_id")
    .eq("tenant_id", tid)
    .in("status", ["pending", "processing"])
    .gte("scheduled_at", fromIso.trim())
    .lt("scheduled_at", toIso.trim())
    .order("scheduled_at", { ascending: true })
    .limit(cap);

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Record<string, unknown>[];
  const bookingIds = Array.from(
    new Set(
      rows
        .map((r) => (r.booking_id != null ? String(r.booking_id) : null))
        .filter((x): x is string => Boolean(x))
    )
  );
  const templateIds = Array.from(new Set(rows.map((r) => String(r.template_id))));

  const bookingMeta = new Map<string, { title: string | null; start_at: string }>();
  if (bookingIds.length) {
    const { data: bk, error: be } = await supabase
      .from("fi_bookings")
      .select("id, title, start_at")
      .eq("tenant_id", tid)
      .in("id", bookingIds);
    if (be) throw new Error(be.message);
    for (const b of bk ?? []) {
      const br = b as Record<string, unknown>;
      bookingMeta.set(String(br.id), {
        title: br.title != null ? String(br.title) : null,
        start_at: br.start_at != null ? String(br.start_at) : "",
      });
    }
  }

  const tplMap = await loadTemplatesByIds(supabase, tid, templateIds);

  return rows.map((row) => {
    const bid = row.booking_id != null ? String(row.booking_id) : "";
    const bk = bid ? bookingMeta.get(bid) : undefined;
    const tpl = tplMap.get(String(row.template_id));
    return {
      jobId: String(row.id),
      scheduled_at: String(row.scheduled_at),
      status: String(row.status) as ReminderJobStatus,
      templateName: tpl?.name ?? "Reminder",
      templateType: tpl?.type ?? "email",
      bookingId: bid,
      bookingTitle: bk?.title ?? null,
      bookingStartAt: bk?.start_at ?? "",
    };
  });
}

const MS_DAY = 86_400_000;

function readPatientLabelFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const o = metadata as Record<string, unknown>;
  const dn = o.display_name;
  const pn = o.patient_name;
  if (typeof dn === "string" && dn.trim()) return dn.trim();
  if (typeof pn === "string" && pn.trim()) return pn.trim();
  return null;
}

function humanizeBookingType(type: string): string {
  const t = type.trim();
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function anchorLabelForBooking(
  row: {
    patient_id: string | null;
    lead_id: string | null;
    person_id: string | null;
    case_id: string | null;
    title: string | null;
    booking_type: string;
  },
  patientLabels: Map<string, string>,
  leadDisplayById: Map<string, string>
): string {
  if (row.patient_id?.trim()) {
    const lab = patientLabels.get(row.patient_id.trim());
    if (lab) return lab;
    return `Patient ${row.patient_id.trim().slice(0, 8)}…`;
  }
  if (row.lead_id?.trim()) {
    const t = leadDisplayById.get(row.lead_id.trim());
    if (t) return t;
    return `Lead ${row.lead_id.trim().slice(0, 8)}…`;
  }
  if (row.person_id?.trim()) return `Person ${row.person_id.trim().slice(0, 8)}…`;
  if (row.case_id?.trim()) return `Case ${row.case_id.trim().slice(0, 8)}…`;
  return row.title?.trim() || humanizeBookingType(row.booking_type);
}

function detailPathForBookingAnchors(
  tenantId: string,
  row: {
    case_id: string | null;
    patient_id: string | null;
    lead_id: string | null;
  }
): string {
  const base = `/fi-admin/${tenantId.trim()}`;
  if (row.case_id?.trim()) return `${base}/cases/${row.case_id.trim()}`;
  if (row.patient_id?.trim()) return `${base}/patients/${row.patient_id.trim()}`;
  if (row.lead_id?.trim()) return `${base}/crm/leads/${row.lead_id.trim()}`;
  return `${base}/calendar`;
}

type ClinicalLite = {
  norwood_scale: string | null;
  ludwig_scale: string | null;
  hairline_pattern: string | null;
  primary_concern: string | null;
  primary_hair_concern: string | null;
};

/** Row shape for the tenant operational dashboard “Upcoming reminders” widget (server-serialized). */
export type OperationalDashboardReminderItem = {
  jobId: string;
  scheduled_at: string;
  status: ReminderJobStatus;
  templateName: string;
  templateType: string;
  bookingId: string | null;
  bookingTitle: string | null;
  bookingStartAt: string | null;
  bookingTimezone: string | null;
  leadId: string | null;
  patientId: string | null;
  recipientLabel: string;
  clinicalSummaryLine: string | null;
  bookingAssigneeFiUserId: string | null;
  leadPrimaryOwnerFiUserId: string | null;
  detailHref: string;
};

/**
 * Pending/processing reminder jobs in the next N days for the tenant home dashboard.
 * Enriches patient/lead labels, booking anchors, clinical scale summary, and ownership for “My” filtering.
 */
export async function loadOperationalDashboardReminderJobs(
  tenantId: string,
  now: Date,
  options?: { horizonDays?: number; limit?: number; client?: SupabaseClient }
): Promise<OperationalDashboardReminderItem[]> {
  const supabase = options?.client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const horizonDays = Math.min(Math.max(options?.horizonDays ?? 7, 1), 30);
  const cap = Math.min(Math.max(options?.limit ?? 10, 1), 25);
  const fromIso = now.toISOString();
  const endIso = new Date(now.getTime() + horizonDays * MS_DAY).toISOString();

  const { data, error } = await supabase
    .from("fi_reminder_jobs")
    .select("id, scheduled_at, status, booking_id, lead_id, person_id, template_id, metadata")
    .eq("tenant_id", tid)
    .in("status", ["pending", "processing"])
    .gte("scheduled_at", fromIso)
    .lt("scheduled_at", endIso)
    .order("scheduled_at", { ascending: true })
    .limit(cap);

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Record<string, unknown>[];
  if (rows.length === 0) return [];

  const templateIds = Array.from(new Set(rows.map((r) => String(r.template_id))));
  const bookingIds = Array.from(
    new Set(
      rows
        .map((r) => (r.booking_id != null ? String(r.booking_id) : null))
        .filter((x): x is string => Boolean(x))
    )
  );
  const leadIdsDirect = Array.from(
    new Set(
      rows
        .map((r) => (r.lead_id != null ? String(r.lead_id) : null))
        .filter((x): x is string => Boolean(x))
    )
  );

  const tplMap = await loadTemplatesByIds(supabase, tid, templateIds);

  type BookingLite = {
    id: string;
    title: string | null;
    start_at: string;
    timezone: string | null;
    assigned_user_id: string | null;
    patient_id: string | null;
    lead_id: string | null;
    person_id: string | null;
    case_id: string | null;
    booking_type: string;
  };
  const bookingById = new Map<string, BookingLite>();
  if (bookingIds.length) {
    const { data: bk, error: be } = await supabase
      .from("fi_bookings")
      .select(
        "id, title, start_at, timezone, assigned_user_id, patient_id, lead_id, person_id, case_id, booking_type"
      )
      .eq("tenant_id", tid)
      .in("id", bookingIds);
    if (be) throw new Error(be.message);
    for (const b of bk ?? []) {
      const br = b as Record<string, unknown>;
      bookingById.set(String(br.id), {
        id: String(br.id),
        title: br.title != null ? String(br.title) : null,
        start_at: br.start_at != null ? String(br.start_at) : "",
        timezone: br.timezone != null ? String(br.timezone) : null,
        assigned_user_id: br.assigned_user_id != null ? String(br.assigned_user_id) : null,
        patient_id: br.patient_id != null ? String(br.patient_id) : null,
        lead_id: br.lead_id != null ? String(br.lead_id) : null,
        person_id: br.person_id != null ? String(br.person_id) : null,
        case_id: br.case_id != null ? String(br.case_id) : null,
        booking_type: br.booking_type != null ? String(br.booking_type) : "",
      });
    }
  }

  const leadIdsNeeded = new Set<string>(leadIdsDirect);
  for (const b of Array.from(bookingById.values())) {
    if (b.lead_id?.trim()) leadIdsNeeded.add(b.lead_id.trim());
  }

  type LeadLite = {
    id: string;
    summary: string | null;
    person_id: string;
    primary_owner_user_id: string | null;
    patient_id: string | null;
  };
  const leadById = new Map<string, LeadLite>();
  const personIdsNeeded = new Set<string>();
  for (const r of rows) {
    if (r.person_id != null) personIdsNeeded.add(String(r.person_id));
  }

  if (leadIdsNeeded.size) {
    const { data: ld, error: le } = await supabase
      .from("fi_crm_leads")
      .select("id, summary, person_id, primary_owner_user_id, patient_id")
      .eq("tenant_id", tid)
      .in("id", Array.from(leadIdsNeeded));
    if (le) throw new Error(le.message);
    for (const raw of ld ?? []) {
      const row = raw as Record<string, unknown>;
      const lid = String(row.id);
      const pid = row.person_id != null ? String(row.person_id) : "";
      leadById.set(lid, {
        id: lid,
        summary: row.summary != null ? String(row.summary) : null,
        person_id: pid,
        primary_owner_user_id:
          row.primary_owner_user_id != null ? String(row.primary_owner_user_id) : null,
        patient_id: row.patient_id != null ? String(row.patient_id) : null,
      });
      if (pid) personIdsNeeded.add(pid);
    }
  }

  const personMetaById = new Map<string, unknown>();
  if (personIdsNeeded.size) {
    const { data: pr, error: pe } = await supabase
      .from("fi_persons")
      .select("id, metadata")
      .in("id", Array.from(personIdsNeeded));
    if (pe) throw new Error(pe.message);
    for (const raw of pr ?? []) {
      const row = raw as { id: string; metadata: unknown };
      personMetaById.set(String(row.id), row.metadata);
    }
  }

  const patientIdsForLabels = new Set<string>();
  const patientIdsForClinical = new Set<string>();
  for (const r of rows) {
    const meta =
      r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
        ? (r.metadata as Record<string, unknown>)
        : null;
    const mp = meta?.patient_id;
    if (typeof mp === "string" && mp.trim()) {
      patientIdsForLabels.add(mp.trim());
      patientIdsForClinical.add(mp.trim());
    }
  }
  for (const b of Array.from(bookingById.values())) {
    if (b.patient_id?.trim()) {
      patientIdsForLabels.add(b.patient_id.trim());
      patientIdsForClinical.add(b.patient_id.trim());
    }
  }
  for (const l of Array.from(leadById.values())) {
    if (l.patient_id?.trim()) {
      patientIdsForLabels.add(l.patient_id.trim());
      patientIdsForClinical.add(l.patient_id.trim());
    }
  }

  const patientLabels = new Map<string, string>();
  if (patientIdsForLabels.size) {
    const { data: pts, error: pte } = await supabase
      .from("fi_patients")
      .select("id, metadata")
      .eq("tenant_id", tid)
      .in("id", Array.from(patientIdsForLabels));
    if (pte) throw new Error(pte.message);
    for (const raw of pts ?? []) {
      const row = raw as { id: string; metadata: unknown };
      const lab = readPatientLabelFromMetadata(row.metadata);
      if (lab) patientLabels.set(String(row.id), lab);
    }
  }

  const clinicalByPatient = new Map<string, ClinicalLite>();
  if (patientIdsForClinical.size) {
    const { data: cd, error: ce } = await supabase
      .from("fi_patient_clinical_details")
      .select(
        "patient_id, norwood_scale, ludwig_scale, hairline_pattern, primary_concern, primary_hair_concern"
      )
      .eq("tenant_id", tid)
      .in("patient_id", Array.from(patientIdsForClinical));
    if (ce) throw new Error(ce.message);
    for (const raw of cd ?? []) {
      const row = raw as Record<string, unknown>;
      clinicalByPatient.set(String(row.patient_id), {
        norwood_scale: row.norwood_scale != null ? String(row.norwood_scale) : null,
        ludwig_scale: row.ludwig_scale != null ? String(row.ludwig_scale) : null,
        hairline_pattern: row.hairline_pattern != null ? String(row.hairline_pattern) : null,
        primary_concern: row.primary_concern != null ? String(row.primary_concern) : null,
        primary_hair_concern:
          row.primary_hair_concern != null ? String(row.primary_hair_concern) : null,
      });
    }
  }

  const leadDisplayById = new Map<string, string>();
  for (const [lid, lead] of Array.from(leadById.entries())) {
    const meta = personMetaById.get(lead.person_id);
    const metaObj =
      meta && typeof meta === "object" && !Array.isArray(meta)
        ? (meta as Record<string, unknown>)
        : null;
    const personLabel = personMetadataDisplayLabel(metaObj);
    const summaryTitle = leadTitleFromRow(lead.summary, lead.id);
    leadDisplayById.set(
      lid,
      personLabel !== "—" ? `${summaryTitle} · ${personLabel}` : summaryTitle
    );
  }

  const out: OperationalDashboardReminderItem[] = [];

  for (const r of rows) {
    const jobId = String(r.id);
    const scheduled_at = String(r.scheduled_at);
    const st = String(r.status);
    if (!REMINDER_JOB_STATUSES.includes(st as ReminderJobStatus)) continue;
    const status = st as ReminderJobStatus;
    const bookingId = r.booking_id != null ? String(r.booking_id) : null;
    const leadId = r.lead_id != null ? String(r.lead_id) : null;
    const personId = r.person_id != null ? String(r.person_id) : null;
    const tpl = tplMap.get(String(r.template_id));

    const meta =
      r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
        ? (r.metadata as Record<string, unknown>)
        : null;
    const metaPatient = meta?.patient_id;
    const metaPatientId =
      typeof metaPatient === "string" && metaPatient.trim() ? metaPatient.trim() : null;

    const booking = bookingId ? bookingById.get(bookingId) : undefined;
    const lead = leadId ? leadById.get(leadId) : undefined;

    let recipientLabel = "Reminder";
    let detailHref = `/fi-admin/${tid}/settings/reminders`;
    let patientId: string | null = metaPatientId;
    let bookingAssigneeFiUserId: string | null = null;
    let leadPrimaryOwnerFiUserId: string | null = null;

    if (booking) {
      recipientLabel = anchorLabelForBooking(booking, patientLabels, leadDisplayById);
      detailHref = detailPathForBookingAnchors(tid, booking);
      patientId = booking.patient_id?.trim() || metaPatientId;
      bookingAssigneeFiUserId = booking.assigned_user_id?.trim() || null;
      if (booking.lead_id?.trim()) {
        const lb = leadById.get(booking.lead_id.trim());
        leadPrimaryOwnerFiUserId = lb?.primary_owner_user_id?.trim() ?? null;
      }
    } else if (lead) {
      recipientLabel = leadDisplayById.get(lead.id) ?? leadTitleFromRow(lead.summary, lead.id);
      detailHref = `/fi-admin/${tid}/crm/leads/${lead.id}`;
      patientId = lead.patient_id?.trim() || metaPatientId;
      leadPrimaryOwnerFiUserId = lead.primary_owner_user_id?.trim() || null;
    } else if (personId) {
      const metaP = personMetaById.get(personId);
      const metaObj =
        metaP && typeof metaP === "object" && !Array.isArray(metaP)
          ? (metaP as Record<string, unknown>)
          : null;
      const personLabel = personMetadataDisplayLabel(metaObj);
      recipientLabel = personLabel !== "—" ? personLabel : `Person ${personId.slice(0, 8)}…`;
      detailHref = `/fi-admin/${tid}/directory`;
    }

    const clin = patientId?.trim() ? clinicalByPatient.get(patientId.trim()) : undefined;
    const clinicalSummaryLine = clin
      ? formatClinicalScalesSummary({
          norwood_scale: clin.norwood_scale,
          ludwig_scale: clin.ludwig_scale,
          hairline_pattern: clin.hairline_pattern,
          primary_concern: clin.primary_concern ?? clin.primary_hair_concern,
        })
      : null;

    out.push({
      jobId,
      scheduled_at,
      status,
      templateName: tpl?.name ?? "Reminder",
      templateType: tpl?.type ?? "email",
      bookingId,
      bookingTitle: booking?.title ?? null,
      bookingStartAt: booking?.start_at ?? null,
      bookingTimezone: booking?.timezone ?? null,
      leadId,
      patientId: patientId?.trim() || null,
      recipientLabel,
      clinicalSummaryLine,
      bookingAssigneeFiUserId,
      leadPrimaryOwnerFiUserId,
      detailHref,
    });
  }

  return out;
}

export async function loadReminderJobsForBookings(
  tenantId: string,
  bookingIds: string[],
  client?: SupabaseClient
): Promise<Map<string, FiReminderJobWithTemplate[]>> {
  const out = new Map<string, FiReminderJobWithTemplate[]>();
  if (!bookingIds.length) return out;
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const ids = bookingIds.map((id) => assertNonEmptyUuid(id, "bookingId"));

  const { data, error } = await supabase
    .from("fi_reminder_jobs")
    .select("*")
    .eq("tenant_id", tid)
    .in("booking_id", ids)
    .order("scheduled_at", { ascending: true });

  if (error) throw new Error(error.message);
  const jobs = ((data ?? []) as Record<string, unknown>[]).map(mapJobRow);
  const tplIds = Array.from(new Set(jobs.map((j) => j.template_id)));
  const tplMap = await loadTemplatesByIds(supabase, tid, tplIds);

  for (const j of jobs) {
    const bid = j.booking_id;
    if (!bid) continue;
    const t = tplMap.get(j.template_id);
    const item: FiReminderJobWithTemplate = {
      ...j,
      template_name: t?.name ?? "",
      template_type: t?.type ?? "email",
      template_trigger_event: t?.trigger_event ?? "booking_created",
    };
    const arr = out.get(bid) ?? [];
    arr.push(item);
    out.set(bid, arr);
  }
  return out;
}
