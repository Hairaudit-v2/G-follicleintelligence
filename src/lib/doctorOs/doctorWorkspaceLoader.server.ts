import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadBookingsForTenantRange } from "@/src/lib/bookings/bookings";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { calendarDateStringFromInstant, zonedMidnightUtcMs, zonedNextDayUtcMs } from "@/src/lib/calendar/calendarTimezone";
import { loadTenantOperationalCalendarSettings } from "@/src/lib/calendar/tenantOperationalCalendarSettings.server";
import { casePersonDisplayFromMetadata } from "@/src/lib/cases/caseLabels";
import { parseClinicalNoteSections } from "@/src/lib/clinicalNotes/clinicalNoteSchemas";
import { CRM_TASK_ACTIVE_STATUS_VALUES } from "@/src/lib/crm/crmTaskPolicy";
import { listConsultationsForTenant, type ConsultationIndexRow } from "@/src/lib/consultations/consultationLoaders.server";
import { loadMedicationReorderRequestsForTenant } from "@/src/lib/medicationReorder/medicationReorderLoaders.server";
import type { FiMedicationReorderRequestRow } from "@/src/lib/medicationReorder/medicationReorderTypes";
import { validateRepeatRulesPrescriberConfirmed } from "@/src/lib/prescribing/prescribingRepeatRules";
import type { FiPrescriptionItemRow } from "@/src/lib/prescribing/fiPrescribingTypes";

const AGENDA_BOOKING_STATUSES = new Set(["scheduled", "confirmed", "arrived"]);

function addHours(d: Date, hours: number): Date {
  return new Date(d.getTime() + hours * 3_600_000);
}

async function loadPatientLabels(tenantId: string, patientIds: string[]): Promise<Map<string, string>> {
  const uniq = Array.from(new Set(patientIds.filter(Boolean)));
  const map = new Map<string, string>();
  if (uniq.length === 0) return map;
  const supabase = supabaseAdmin();
  const { data: pRows, error: pe } = await supabase
    .from("fi_patients")
    .select("id, person_id")
    .eq("tenant_id", tenantId.trim())
    .in("id", uniq);
  if (pe || !pRows?.length) return map;

  const personIds = Array.from(new Set(pRows.map((r) => String((r as { person_id: string }).person_id))));
  const { data: personRows, error: e2 } = await supabase
    .from("fi_persons")
    .select("id, metadata")
    .eq("tenant_id", tenantId.trim())
    .in("id", personIds);
  if (e2) return map;

  const personMeta = new Map<string, Record<string, unknown>>();
  for (const raw of personRows ?? []) {
    const r = raw as { id: string; metadata: unknown };
    const m =
      r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
        ? (r.metadata as Record<string, unknown>)
        : {};
    personMeta.set(String(r.id), m);
  }

  for (const raw of pRows) {
    const r = raw as { id: string; person_id: string };
    const meta = personMeta.get(String(r.person_id)) ?? {};
    map.set(String(r.id), casePersonDisplayFromMetadata(meta).label);
  }
  return map;
}

export type DoctorWorkspaceTodayPatient = {
  patientId: string;
  patientLabel: string;
  nextStartAt: string;
  bookingId: string;
  bookingTitle: string | null;
  bookingType: string;
};

export type DoctorWorkspacePrescriptionRow = {
  id: string;
  patientId: string;
  patientLabel: string;
  updatedAt: string;
  statusLabel: string;
};

export type DoctorWorkspacePharmacyRow = {
  transmissionId: string;
  prescriptionId: string;
  patientId: string;
  patientLabel: string;
  status: string;
  errorMessage: string | null;
  updatedAt: string;
};

export type DoctorWorkspaceVoiceRow = {
  id: string;
  patientId: string;
  patientLabel: string;
  caseId: string | null;
  createdAt: string;
  preview: string;
};

export type DoctorWorkspaceTaskRow = {
  id: string;
  leadId: string;
  title: string;
  dueAt: string | null;
  taskType: string;
  isUnassigned: boolean;
};

export type DoctorWorkspaceReorderRow = FiMedicationReorderRequestRow & { patientLabel: string };

export type DoctorWorkspaceBundle = {
  tenantId: string;
  todayPatients: DoctorWorkspaceTodayPatient[];
  pendingConsultations: ConsultationIndexRow[];
  draftPrescriptionsInProgress: DoctorWorkspacePrescriptionRow[];
  prescriptionsAwaitingSignature: DoctorWorkspacePrescriptionRow[];
  pharmacyQueue: DoctorWorkspacePharmacyRow[];
  medicationReorders: DoctorWorkspaceReorderRow[];
  followUpTasks: DoctorWorkspaceTaskRow[];
  voiceNotesPendingApproval: DoctorWorkspaceVoiceRow[];
  includeCrmTasks: boolean;
};

function asItemRow(raw: Record<string, unknown>): FiPrescriptionItemRow {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    prescription_id: String(raw.prescription_id),
    catalogue_id: raw.catalogue_id != null ? String(raw.catalogue_id) : null,
    medication_name: String(raw.medication_name ?? ""),
    form_type: raw.form_type as FiPrescriptionItemRow["form_type"],
    quantity_label: String(raw.quantity_label ?? ""),
    dose_instructions: String(raw.dose_instructions ?? ""),
    repeats_instructions: raw.repeats_instructions != null ? String(raw.repeats_instructions) : null,
    reorder_rule: raw.reorder_rule != null ? String(raw.reorder_rule) : null,
    repeat_rules_prescriber_confirmed: Boolean(raw.repeat_rules_prescriber_confirmed),
    sort_order: Number(raw.sort_order ?? 0),
    created_at: String(raw.created_at ?? ""),
  };
}

async function loadTodayPatients(tenantId: string, now: Date): Promise<DoctorWorkspaceTodayPatient[]> {
  const tid = tenantId.trim();
  const { calendarTimezone } = await loadTenantOperationalCalendarSettings(tid);
  const todayYmd = calendarDateStringFromInstant(now, calendarTimezone);
  const localDayStartMs = zonedMidnightUtcMs(todayYmd, calendarTimezone);
  const localDayEndMs = zonedNextDayUtcMs(todayYmd, calendarTimezone);
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const dayEnd = addHours(dayStart, 24);
  const localStartIso = localDayStartMs != null ? new Date(localDayStartMs).toISOString() : dayStart.toISOString();
  const localEndIso = localDayEndMs != null ? new Date(localDayEndMs).toISOString() : dayEnd.toISOString();

  const raw = await loadBookingsForTenantRange(tid, localStartIso, localEndIso);
  const filtered = raw.filter((b: FiBookingRow) => {
    if (!b.patient_id?.trim()) return false;
    if (b.booking_status === "cancelled" || b.booking_status === "completed" || b.booking_status === "no_show") {
      return false;
    }
    return AGENDA_BOOKING_STATUSES.has(b.booking_status);
  });
  filtered.sort((a, b) => a.start_at.localeCompare(b.start_at));

  const byPatient = new Map<string, FiBookingRow>();
  for (const b of filtered) {
    const pid = b.patient_id!.trim();
    if (!byPatient.has(pid)) byPatient.set(pid, b);
  }

  const patientIds = Array.from(byPatient.keys());
  const labels = await loadPatientLabels(tid, patientIds);

  return patientIds.slice(0, 25).map((patientId) => {
    const b = byPatient.get(patientId)!;
    return {
      patientId,
      patientLabel: labels.get(patientId) ?? `Patient ${patientId.slice(0, 8)}…`,
      nextStartAt: b.start_at,
      bookingId: b.id,
      bookingTitle: b.title,
      bookingType: b.booking_type,
    };
  });
}

async function loadDraftPrescriptionBuckets(tenantId: string): Promise<{
  inProgress: DoctorWorkspacePrescriptionRow[];
  awaitingSignature: DoctorWorkspacePrescriptionRow[];
}> {
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();
  const { data: rxRows, error } = await supabase
    .from("fi_patient_prescriptions")
    .select("id, patient_id, status, updated_at")
    .eq("tenant_id", tid)
    .eq("status", "draft")
    .order("updated_at", { ascending: false })
    .limit(45);
  if (error) throw new Error(error.message);
  const drafts = (rxRows ?? []) as { id: string; patient_id: string; updated_at: string }[];
  if (drafts.length === 0) return { inProgress: [], awaitingSignature: [] };

  const ids = drafts.map((r) => r.id);
  const { data: itemRows, error: ie } = await supabase
    .from("fi_prescription_items")
    .select("*")
    .eq("tenant_id", tid)
    .in("prescription_id", ids);
  if (ie) throw new Error(ie.message);

  const itemsByRx = new Map<string, FiPrescriptionItemRow[]>();
  for (const raw of itemRows ?? []) {
    const it = asItemRow(raw as Record<string, unknown>);
    const arr = itemsByRx.get(it.prescription_id) ?? [];
    arr.push(it);
    itemsByRx.set(it.prescription_id, arr);
  }

  const patientIds = drafts.map((r) => r.patient_id);
  const labels = await loadPatientLabels(tid, patientIds);

  const inProgress: DoctorWorkspacePrescriptionRow[] = [];
  const awaitingSignature: DoctorWorkspacePrescriptionRow[] = [];

  for (const r of drafts) {
    const items = itemsByRx.get(r.id) ?? [];
    const label = labels.get(r.patient_id) ?? `Patient ${r.patient_id.slice(0, 8)}…`;
    const row: DoctorWorkspacePrescriptionRow = {
      id: r.id,
      patientId: r.patient_id,
      patientLabel: label,
      updatedAt: r.updated_at,
      statusLabel: "Draft",
    };
    if (items.length > 0 && validateRepeatRulesPrescriberConfirmed(items) == null) {
      awaitingSignature.push(row);
    } else {
      inProgress.push(row);
    }
  }

  return {
    inProgress: inProgress.slice(0, 18),
    awaitingSignature: awaitingSignature.slice(0, 18),
  };
}

async function loadPharmacyQueue(tenantId: string): Promise<DoctorWorkspacePharmacyRow[]> {
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_pharmacy_transmissions")
    .select("id, prescription_id, status, error_message, updated_at")
    .eq("tenant_id", tid)
    .in("status", ["pending", "failed"])
    .order("updated_at", { ascending: false })
    .limit(22);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as {
    id: string;
    prescription_id: string;
    status: string;
    error_message: string | null;
    updated_at: string;
  }[];
  if (rows.length === 0) return [];

  const rxIds = Array.from(new Set(rows.map((r) => r.prescription_id)));
  const { data: rxData, error: rxe } = await supabase
    .from("fi_patient_prescriptions")
    .select("id, patient_id")
    .eq("tenant_id", tid)
    .in("id", rxIds);
  if (rxe) throw new Error(rxe.message);
  const patientByRx = new Map<string, string>();
  for (const raw of rxData ?? []) {
    const r = raw as { id: string; patient_id: string };
    patientByRx.set(String(r.id), String(r.patient_id));
  }

  const patientIds = Array.from(new Set(Array.from(patientByRx.values())));
  const labels = await loadPatientLabels(tid, patientIds);

  return rows.map((r) => {
    const pid = patientByRx.get(r.prescription_id) ?? "";
    return {
      transmissionId: r.id,
      prescriptionId: r.prescription_id,
      patientId: pid,
      patientLabel: pid ? labels.get(pid) ?? `Patient ${pid.slice(0, 8)}…` : "Unknown patient",
      status: r.status,
      errorMessage: r.error_message,
      updatedAt: r.updated_at,
    };
  });
}

async function loadVoiceDrafts(tenantId: string): Promise<DoctorWorkspaceVoiceRow[]> {
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_clinical_notes")
    .select("id, patient_id, case_id, created_at, sections, record_status")
    .eq("tenant_id", tid)
    .eq("record_status", "ai_draft")
    .order("created_at", { ascending: false })
    .limit(18);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as {
    id: string;
    patient_id: string;
    case_id: string | null;
    created_at: string;
    sections: unknown;
  }[];
  if (rows.length === 0) return [];

  const patientIds = rows.map((r) => r.patient_id);
  const labels = await loadPatientLabels(tid, patientIds);

  return rows.map((r) => {
    const sections = parseClinicalNoteSections(r.sections);
    const previewRaw =
      sections.presenting_concern?.trim() ||
      sections.assessment?.trim() ||
      sections.plan?.trim() ||
      "(no preview)";
    const preview = previewRaw.length > 140 ? `${previewRaw.slice(0, 137)}…` : previewRaw;
    return {
      id: r.id,
      patientId: r.patient_id,
      patientLabel: labels.get(r.patient_id) ?? `Patient ${r.patient_id.slice(0, 8)}…`,
      caseId: r.case_id,
      createdAt: r.created_at,
      preview,
    };
  });
}

async function loadFollowUpTasks(
  tenantId: string,
  viewerFiUserId: string | null,
  now: Date,
  enabled: boolean
): Promise<DoctorWorkspaceTaskRow[]> {
  if (!enabled) return [];
  const tid = tenantId.trim();
  const horizon = addHours(now, 14 * 24).toISOString();
  const supabase = supabaseAdmin();

  let q = supabase
    .from("fi_crm_tasks")
    .select("id, lead_id, title, status, task_type, due_at, assignee_user_id")
    .eq("tenant_id", tid)
    .in("status", [...CRM_TASK_ACTIVE_STATUS_VALUES]);

  if (viewerFiUserId) {
    q = q.or(`assignee_user_id.eq.${viewerFiUserId},assignee_user_id.is.null`);
  } else {
    q = q.is("assignee_user_id", null);
  }

  const { data, error } = await q.order("due_at", { ascending: true, nullsFirst: false }).limit(40);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as {
    id: string;
    lead_id: string;
    title: string;
    status: string;
    task_type: string;
    due_at: string | null;
    assignee_user_id: string | null;
  }[];

  const filtered = rows.filter((r) => {
    if (!r.due_at) return true;
    return r.due_at <= horizon;
  });

  return filtered.slice(0, 20).map((r) => ({
    id: r.id,
    leadId: r.lead_id,
    title: r.title,
    dueAt: r.due_at,
    taskType: r.task_type,
    isUnassigned: r.assignee_user_id == null,
  }));
}

/**
 * DoctorOS 2A — aggregated clinical queue for `/fi-admin/[tenantId]/doctor`.
 * `includeCrmTasks`: pass false when the viewer lacks CRM shell nav (LeadFlow) so task links stay consistent with route gates.
 */
export async function loadDoctorWorkspace(
  tenantId: string,
  opts: { viewerFiUserId: string | null; includeCrmTasks: boolean }
): Promise<DoctorWorkspaceBundle> {
  const tid = tenantId.trim();
  const now = new Date();

  const [
    todayPatients,
    pendingConsultations,
    draftBuckets,
    pharmacyQueue,
    medicationReordersRaw,
    followUpTasks,
    voiceNotesPendingApproval,
  ] = await Promise.all([
    loadTodayPatients(tid, now),
    listConsultationsForTenant(tid, { statusIn: ["draft", "in_progress"], limit: 20 }),
    loadDraftPrescriptionBuckets(tid),
    loadPharmacyQueue(tid),
    loadMedicationReorderRequestsForTenant(tid, { statusIn: ["requested", "doctor_review_required"] }),
    loadFollowUpTasks(tid, opts.viewerFiUserId, now, opts.includeCrmTasks),
    loadVoiceDrafts(tid),
  ]);

  const reorderSlice = medicationReordersRaw.slice(0, 20);
  const reorderPatientLabels = await loadPatientLabels(
    tid,
    reorderSlice.map((r) => r.patient_id)
  );
  const medicationReorders: DoctorWorkspaceReorderRow[] = reorderSlice.map((r) => ({
    ...r,
    patientLabel: reorderPatientLabels.get(r.patient_id) ?? `Patient ${r.patient_id.slice(0, 8)}…`,
  }));

  return {
    tenantId: tid,
    todayPatients,
    pendingConsultations,
    draftPrescriptionsInProgress: draftBuckets.inProgress,
    prescriptionsAwaitingSignature: draftBuckets.awaitingSignature,
    pharmacyQueue,
    medicationReorders,
    followUpTasks,
    voiceNotesPendingApproval,
    includeCrmTasks: opts.includeCrmTasks,
  };
}
