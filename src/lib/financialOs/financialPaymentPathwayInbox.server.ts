import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { personMetadataDisplayLabel } from "@/src/lib/crm/crmLeadListDisplay";
import type { FiPaymentPathwayType } from "@/src/lib/financialOs/financialPaymentPathwayCore";
import type { FinancialPaymentPathwayRecord } from "@/src/lib/financialOs/financialPaymentPathways.server";
import {
  aggregatePathwayInboxDashboardCounts,
  computeTaskEscalationPriority,
  mapPathwayTypeToTaskType,
  OPEN_PATHWAY_TASK_STATUSES,
  type FiPaymentPathwayTaskPriority,
  type FiPaymentPathwayTaskRow,
  type FiPaymentPathwayTaskStatus,
  type FiPaymentPathwayTaskType,
  type PathwayInboxDashboardCounts,
} from "@/src/lib/financialOs/financialPaymentPathwayInboxCore";

export type FinancialPaymentPathwayTaskRecord = FiPaymentPathwayTaskRow & {
  tenant_id: string;
  payment_pathway_id: string;
  patient_id: string | null;
  case_id: string | null;
  booking_id: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
};

export type PaymentPathwayInboxRow = FinancialPaymentPathwayTaskRecord & {
  pathway_type: FiPaymentPathwayType;
  pathway_status: string;
  patient_label: string | null;
  case_label: string | null;
  assigned_to_email: string | null;
};

export type PaymentPathwayInboxFilters = {
  status?: FiPaymentPathwayTaskStatus | "all";
  priority?: FiPaymentPathwayTaskPriority | "all";
  assigned_to?: string | "all" | "unassigned";
  pathway_type?: FiPaymentPathwayType | "all";
};

const SELECT_COLUMNS =
  "id, tenant_id, payment_pathway_id, patient_id, case_id, booking_id, task_type, status, priority, assigned_to, due_date, notes, metadata, created_at, updated_at";

function mapTaskRow(raw: Record<string, unknown>): FinancialPaymentPathwayTaskRecord {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    payment_pathway_id: String(raw.payment_pathway_id),
    patient_id: raw.patient_id ? String(raw.patient_id) : null,
    case_id: raw.case_id ? String(raw.case_id) : null,
    booking_id: raw.booking_id ? String(raw.booking_id) : null,
    task_type: raw.task_type as FiPaymentPathwayTaskType,
    status: raw.status as FiPaymentPathwayTaskStatus,
    priority: raw.priority as FiPaymentPathwayTaskPriority,
    assigned_to: raw.assigned_to ? String(raw.assigned_to) : null,
    due_date: raw.due_date ? String(raw.due_date).slice(0, 10) : null,
    notes: raw.notes ? String(raw.notes) : null,
    metadata: (raw.metadata as Record<string, unknown>) ?? {},
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
  };
}

async function loadPatientLabels(tenantId: string, patientIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(patientIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_patients")
    .select("id, person_id")
    .eq("tenant_id", tenantId.trim())
    .in("id", ids);
  if (error) throw new Error(error.message);

  const personIds = [...new Set((data ?? []).map((r) => String((r as { person_id: string }).person_id)))];
  const personMeta = new Map<string, Record<string, unknown>>();
  if (personIds.length) {
    const { data: persons, error: pe } = await supabase.from("fi_persons").select("id, metadata").in("id", personIds);
    if (pe) throw new Error(pe.message);
    for (const row of persons ?? []) {
      const id = String((row as { id: string }).id);
      const m = (row as { metadata: unknown }).metadata;
      personMeta.set(id, m && typeof m === "object" && !Array.isArray(m) ? (m as Record<string, unknown>) : {});
    }
  }

  const out = new Map<string, string>();
  for (const raw of data ?? []) {
    const r = raw as { id: string; person_id: string };
    const label = personMetadataDisplayLabel(personMeta.get(String(r.person_id)) ?? {});
    if (label && label !== "—") out.set(String(r.id), label);
  }
  return out;
}

async function loadCaseLabels(tenantId: string, caseIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(caseIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_cases")
    .select("id, external_id, full_name")
    .eq("tenant_id", tenantId.trim())
    .in("id", ids);
  if (error) throw new Error(error.message);
  const out = new Map<string, string>();
  for (const raw of data ?? []) {
    const r = raw as { id: string; external_id?: string | null; full_name?: string | null };
    const label = r.full_name?.trim() || r.external_id?.trim() || null;
    if (label) out.set(String(r.id), label);
  }
  return out;
}

async function loadUserEmails(tenantId: string, userIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_users")
    .select("id, email")
    .eq("tenant_id", tenantId.trim())
    .in("id", ids);
  if (error) throw new Error(error.message);
  const out = new Map<string, string>();
  for (const raw of data ?? []) {
    const r = raw as { id: string; email?: string | null };
    out.set(String(r.id), r.email?.trim() || String(r.id));
  }
  return out;
}

async function loadPathwayTypesForTasks(
  tenantId: string,
  pathwayIds: string[]
): Promise<Map<string, { pathway_type: FiPaymentPathwayType; status: string }>> {
  const ids = [...new Set(pathwayIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_payment_pathways")
    .select("id, pathway_type, status")
    .eq("tenant_id", tenantId.trim())
    .in("id", ids);
  if (error) throw new Error(error.message);
  const out = new Map<string, { pathway_type: FiPaymentPathwayType; status: string }>();
  for (const raw of data ?? []) {
    const r = raw as { id: string; pathway_type: FiPaymentPathwayType; status: string };
    out.set(String(r.id), { pathway_type: r.pathway_type, status: String(r.status) });
  }
  return out;
}

async function enrichInboxRows(tenantId: string, tasks: FinancialPaymentPathwayTaskRecord[]): Promise<PaymentPathwayInboxRow[]> {
  const pathwayMeta = await loadPathwayTypesForTasks(tenantId, tasks.map((t) => t.payment_pathway_id));
  const patientLabels = await loadPatientLabels(tenantId, tasks.map((t) => t.patient_id ?? ""));
  const caseLabels = await loadCaseLabels(tenantId, tasks.map((t) => t.case_id ?? ""));
  const userEmails = await loadUserEmails(tenantId, tasks.map((t) => t.assigned_to ?? ""));

  return tasks.map((task) => {
    const pathway = pathwayMeta.get(task.payment_pathway_id);
    return {
      ...task,
      pathway_type: pathway?.pathway_type ?? "manual",
      pathway_status: pathway?.status ?? "selected",
      patient_label: task.patient_id ? patientLabels.get(task.patient_id) ?? task.patient_id.slice(0, 8) : null,
      case_label: task.case_id ? caseLabels.get(task.case_id) ?? task.case_id.slice(0, 8) : null,
      assigned_to_email: task.assigned_to ? userEmails.get(task.assigned_to) ?? null : null,
    };
  });
}

/**
 * Loads pathway inbox tasks with optional filters. Default limit 500.
 */
export async function loadPaymentPathwayInbox(
  tenantId: string,
  filters: PaymentPathwayInboxFilters = {},
  limit = 500
): Promise<PaymentPathwayInboxRow[]> {
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();
  let q = supabase.from("fi_payment_pathway_tasks").select(SELECT_COLUMNS).eq("tenant_id", tid).order("created_at", { ascending: false }).limit(limit);

  if (filters.status && filters.status !== "all") {
    q = q.eq("status", filters.status);
  }
  if (filters.priority && filters.priority !== "all") {
    q = q.eq("priority", filters.priority);
  }
  if (filters.assigned_to === "unassigned") {
    q = q.is("assigned_to", null);
  } else if (filters.assigned_to && filters.assigned_to !== "all") {
    q = q.eq("assigned_to", filters.assigned_to.trim());
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const tasks = (data ?? []).map((x) => mapTaskRow(x as Record<string, unknown>));
  const enriched = await enrichInboxRows(tid, tasks);

  if (filters.pathway_type && filters.pathway_type !== "all") {
    return enriched.filter((r) => r.pathway_type === filters.pathway_type);
  }
  return enriched;
}

/**
 * Auto-creates inbox task when a non-standard payment pathway is created.
 */
export async function createPaymentPathwayTaskForPathway(pathway: FinancialPaymentPathwayRecord): Promise<FinancialPaymentPathwayTaskRecord | null> {
  const taskType = mapPathwayTypeToTaskType(pathway.pathway_type);
  if (!taskType) return null;

  return createPaymentPathwayTask({
    tenantId: pathway.tenant_id,
    paymentPathwayId: pathway.id,
    patientId: pathway.patient_id,
    caseId: pathway.case_id,
    bookingId: pathway.booking_id,
    taskType,
  });
}

export async function createPaymentPathwayTask(args: {
  tenantId: string;
  paymentPathwayId: string;
  patientId?: string | null;
  caseId?: string | null;
  bookingId?: string | null;
  taskType: FiPaymentPathwayTaskType;
  status?: FiPaymentPathwayTaskStatus;
  priority?: FiPaymentPathwayTaskPriority;
  assignedTo?: string | null;
  dueDateYmd?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<FinancialPaymentPathwayTaskRecord> {
  const tid = args.tenantId.trim();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_payment_pathway_tasks")
    .insert({
      tenant_id: tid,
      payment_pathway_id: args.paymentPathwayId.trim(),
      patient_id: args.patientId?.trim() || null,
      case_id: args.caseId?.trim() || null,
      booking_id: args.bookingId?.trim() || null,
      task_type: args.taskType,
      status: args.status ?? "open",
      priority: args.priority ?? "normal",
      assigned_to: args.assignedTo?.trim() || null,
      due_date: args.dueDateYmd?.trim() || null,
      notes: args.notes?.trim() || null,
      metadata: args.metadata ?? {},
    })
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return mapTaskRow(data as Record<string, unknown>);
}

export async function addPaymentPathwayTaskNote(args: {
  tenantId: string;
  taskId: string;
  notes: string;
}): Promise<FinancialPaymentPathwayTaskRecord> {
  const tid = args.tenantId.trim();
  const supabase = supabaseAdmin();

  const { data: existing, error: fetchErr } = await supabase
    .from("fi_payment_pathway_tasks")
    .select("metadata")
    .eq("tenant_id", tid)
    .eq("id", args.taskId.trim())
    .maybeSingle();
  if (fetchErr) throw new Error(fetchErr.message);
  const currentMeta = ((existing as { metadata?: Record<string, unknown> } | null)?.metadata ?? {}) as Record<string, unknown>;

  const { data, error } = await supabase
    .from("fi_payment_pathway_tasks")
    .update({
      notes: args.notes.trim(),
      metadata: { ...currentMeta, last_note_at: new Date().toISOString() },
    })
    .eq("tenant_id", tid)
    .eq("id", args.taskId.trim())
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Payment pathway task not found.");
  return mapTaskRow(data as Record<string, unknown>);
}

export async function updatePaymentPathwayTaskStatus(args: {
  tenantId: string;
  taskId: string;
  status: FiPaymentPathwayTaskStatus;
  notes?: string | null;
  metadataPatch?: Record<string, unknown>;
}): Promise<FinancialPaymentPathwayTaskRecord> {
  const tid = args.tenantId.trim();
  const supabase = supabaseAdmin();
  const update: Record<string, unknown> = { status: args.status };
  if (args.notes !== undefined) update.notes = args.notes?.trim() || null;

  if (args.metadataPatch && Object.keys(args.metadataPatch).length > 0) {
    const { data: existing, error: fetchErr } = await supabase
      .from("fi_payment_pathway_tasks")
      .select("metadata")
      .eq("tenant_id", tid)
      .eq("id", args.taskId.trim())
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    const currentMeta = ((existing as { metadata?: Record<string, unknown> } | null)?.metadata ?? {}) as Record<string, unknown>;
    update.metadata = { ...currentMeta, ...args.metadataPatch };
  }

  const { data, error } = await supabase
    .from("fi_payment_pathway_tasks")
    .update(update)
    .eq("tenant_id", tid)
    .eq("id", args.taskId.trim())
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Payment pathway task not found.");
  return mapTaskRow(data as Record<string, unknown>);
}

export async function assignPaymentPathwayTask(args: {
  tenantId: string;
  taskId: string;
  assignedTo: string | null;
}): Promise<FinancialPaymentPathwayTaskRecord> {
  const tid = args.tenantId.trim();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_payment_pathway_tasks")
    .update({ assigned_to: args.assignedTo?.trim() || null })
    .eq("tenant_id", tid)
    .eq("id", args.taskId.trim())
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Payment pathway task not found.");
  return mapTaskRow(data as Record<string, unknown>);
}

/**
 * Marks unresolved open tasks for a booking as completed when pathway workflow is cleared.
 */
export async function resolveOpenPaymentPathwayTasksForBooking(tenantId: string, bookingId: string): Promise<number> {
  const tid = tenantId.trim();
  const bid = bookingId.trim();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_payment_pathway_tasks")
    .select("id")
    .eq("tenant_id", tid)
    .eq("booking_id", bid)
    .in("status", [...OPEN_PATHWAY_TASK_STATUSES]);
  if (error) throw new Error(error.message);
  const ids = (data ?? []).map((r) => String((r as { id: string }).id));
  if (!ids.length) return 0;

  const { error: upErr } = await supabase
    .from("fi_payment_pathway_tasks")
    .update({ status: "completed" })
    .eq("tenant_id", tid)
    .in("id", ids);
  if (upErr) throw new Error(upErr.message);
  return ids.length;
}

export async function loadPaymentPathwayAttentionCount(tenantId: string): Promise<number> {
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();
  const { count, error } = await supabase
    .from("fi_payment_pathway_tasks")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tid)
    .in("status", [...OPEN_PATHWAY_TASK_STATUSES]);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function loadPaymentPathwayInboxDashboardCounts(tenantId: string): Promise<PathwayInboxDashboardCounts> {
  const tid = tenantId.trim();
  const todayYmd = new Date().toISOString().slice(0, 10);
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_payment_pathway_tasks")
    .select("id, task_type, status, priority, assigned_to, due_date, created_at, updated_at")
    .eq("tenant_id", tid)
    .in("status", [...OPEN_PATHWAY_TASK_STATUSES])
    .limit(5000);
  if (error) throw new Error(error.message);
  const tasks = (data ?? []).map((raw) => {
    const r = raw as Record<string, unknown>;
    return {
      id: String(r.id),
      task_type: r.task_type as FiPaymentPathwayTaskType,
      status: r.status as FiPaymentPathwayTaskStatus,
      priority: r.priority as FiPaymentPathwayTaskPriority,
      assigned_to: r.assigned_to ? String(r.assigned_to) : null,
      due_date: r.due_date ? String(r.due_date).slice(0, 10) : null,
      created_at: String(r.created_at ?? ""),
      updated_at: String(r.updated_at ?? ""),
    };
  });
  return aggregatePathwayInboxDashboardCounts(tasks, todayYmd);
}

export async function loadUnresolvedPathwayTasksForBookings(
  tenantId: string,
  bookingIds: string[]
): Promise<Map<string, FiPaymentPathwayTaskRow[]>> {
  const ids = [...new Set(bookingIds.filter(Boolean))];
  const out = new Map<string, FiPaymentPathwayTaskRow[]>();
  for (const id of ids) out.set(id, []);
  if (!ids.length) return out;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_payment_pathway_tasks")
    .select("id, booking_id, task_type, status, priority, assigned_to, due_date, created_at, updated_at")
    .eq("tenant_id", tenantId.trim())
    .in("booking_id", ids)
    .in("status", [...OPEN_PATHWAY_TASK_STATUSES]);
  if (error) throw new Error(error.message);

  for (const raw of data ?? []) {
    const r = raw as Record<string, unknown>;
    const bid = r.booking_id ? String(r.booking_id) : null;
    if (!bid) continue;
    const row: FiPaymentPathwayTaskRow = {
      id: String(r.id),
      task_type: r.task_type as FiPaymentPathwayTaskType,
      status: r.status as FiPaymentPathwayTaskStatus,
      priority: r.priority as FiPaymentPathwayTaskPriority,
      assigned_to: r.assigned_to ? String(r.assigned_to) : null,
      due_date: r.due_date ? String(r.due_date).slice(0, 10) : null,
      created_at: String(r.created_at ?? ""),
      updated_at: String(r.updated_at ?? ""),
    };
    out.set(bid, [...(out.get(bid) ?? []), row]);
  }
  return out;
}

export type PathwayTaskEscalationResult = {
  tenantId: string;
  scanned: number;
  escalated: number;
  dryRun: boolean;
};

/**
 * Cron: escalates priority on unresolved open pathway tasks per Phase 2C rules.
 */
export async function runPaymentPathwayTaskEscalationForTenant(
  tenantId: string,
  args: { todayYmd: string; dryRun?: boolean; limit?: number }
): Promise<PathwayTaskEscalationResult> {
  const tid = tenantId.trim();
  const todayYmd = args.todayYmd;
  const dryRun = args.dryRun ?? false;
  const limit = args.limit ?? 500;
  const supabase = supabaseAdmin();

  const { data: taskRows, error: te } = await supabase
    .from("fi_payment_pathway_tasks")
    .select(SELECT_COLUMNS)
    .eq("tenant_id", tid)
    .in("status", [...OPEN_PATHWAY_TASK_STATUSES])
    .order("created_at", { ascending: true })
    .limit(limit);
  if (te) throw new Error(te.message);

  const tasks = (taskRows ?? []).map((x) => mapTaskRow(x as Record<string, unknown>));
  if (!tasks.length) return { tenantId: tid, scanned: 0, escalated: 0, dryRun };

  const pathwayIds = [...new Set(tasks.map((t) => t.payment_pathway_id))];
  const bookingIds = [...new Set(tasks.map((t) => t.booking_id).filter(Boolean) as string[])];

  const { data: pathwayRows, error: pe } = await supabase
    .from("fi_payment_pathways")
    .select("id, expected_settlement_date, booking_id")
    .eq("tenant_id", tid)
    .in("id", pathwayIds);
  if (pe) throw new Error(pe.message);

  const pathwaySettlement = new Map<string, string | null>();
  for (const raw of pathwayRows ?? []) {
    const r = raw as { id: string; expected_settlement_date?: string | null };
    pathwaySettlement.set(
      String(r.id),
      r.expected_settlement_date ? String(r.expected_settlement_date).slice(0, 10) : null
    );
  }

  const surgeryDates = new Map<string, string | null>();
  if (bookingIds.length) {
    const { data: bookings, error: be } = await supabase
      .from("fi_bookings")
      .select("id, start_at")
      .eq("tenant_id", tid)
      .in("id", bookingIds);
    if (be) throw new Error(be.message);
    for (const raw of bookings ?? []) {
      const r = raw as { id: string; start_at?: string | null };
      surgeryDates.set(String(r.id), r.start_at ? String(r.start_at).slice(0, 10) : null);
    }
  }

  let escalated = 0;
  for (const task of tasks) {
    const expectedSettlement = pathwaySettlement.get(task.payment_pathway_id) ?? null;
    const surgeryDate = task.booking_id ? surgeryDates.get(task.booking_id) ?? null : null;
    const targetPriority = computeTaskEscalationPriority({
      todayYmd,
      task,
      expectedSettlementDateYmd: expectedSettlement,
      surgeryDateYmd: surgeryDate,
    });
    if (!targetPriority) continue;

    const priorityRank: Record<FiPaymentPathwayTaskPriority, number> = { low: 0, normal: 1, high: 2, urgent: 3 };
    if (priorityRank[targetPriority] <= priorityRank[task.priority]) continue;

    escalated += 1;
    if (!dryRun) {
      await supabase
        .from("fi_payment_pathway_tasks")
        .update({ priority: targetPriority })
        .eq("tenant_id", tid)
        .eq("id", task.id);
    }
  }

  return { tenantId: tid, scanned: tasks.length, escalated, dryRun };
}

export async function runPaymentPathwayTaskEscalationCron(args: {
  todayYmd: string;
  dryRun?: boolean;
  limit?: number;
  tenantId?: string | null;
}): Promise<{ tenants: number; scanned: number; escalated: number; dryRun: boolean }> {
  const supabase = supabaseAdmin();
  let tenantIds: string[] = [];

  if (args.tenantId?.trim()) {
    tenantIds = [args.tenantId.trim()];
  } else {
    const { data, error } = await supabase.from("fi_tenants").select("id").limit(500);
    if (error) throw new Error(error.message);
    tenantIds = (data ?? []).map((r) => String((r as { id: string }).id));
  }

  let scanned = 0;
  let escalated = 0;
  for (const tid of tenantIds) {
    const res = await runPaymentPathwayTaskEscalationForTenant(tid, {
      todayYmd: args.todayYmd,
      dryRun: args.dryRun,
      limit: args.limit,
    });
    scanned += res.scanned;
    escalated += res.escalated;
  }

  return { tenants: tenantIds.length, scanned, escalated, dryRun: args.dryRun ?? false };
}
