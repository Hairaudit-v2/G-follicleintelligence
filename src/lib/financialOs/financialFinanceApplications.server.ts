import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  aggregateFinanceApplicationsDashboardCounts,
  aggregateFinanceProviderAnalytics,
  requiresEscalatedFinanceApplicationAttention,
  type FiFinanceApplicationDocumentStatus,
  type FiFinanceApplicationDocumentType,
  type FiFinanceApplicationStatus,
  type FinanceApplicationsDashboardCounts,
  type FinanceProviderAnalytics,
} from "@/src/lib/financialOs/financialFinanceApplicationsCore";
import { loadFinanceProviders } from "@/src/lib/financialOs/financialFinanceProviders.server";

export type FinanceApplicationDocumentRecord = {
  id: string;
  tenant_id: string;
  finance_application_id: string;
  document_type: FiFinanceApplicationDocumentType;
  status: FiFinanceApplicationDocumentStatus;
  file_url: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type FinanceApplicationRecord = {
  id: string;
  tenant_id: string;
  patient_id: string | null;
  case_id: string | null;
  booking_id: string | null;
  payment_pathway_id: string;
  finance_provider_id: string;
  application_status: FiFinanceApplicationStatus;
  application_reference: string | null;
  requested_amount_cents: number | null;
  approved_amount_cents: number | null;
  submitted_at: string | null;
  approved_at: string | null;
  settled_at: string | null;
  expected_settlement_date: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  provider_name?: string;
  pathway_type?: string;
  documents?: FinanceApplicationDocumentRecord[];
};

const APP_SELECT =
  "id, tenant_id, patient_id, case_id, booking_id, payment_pathway_id, finance_provider_id, application_status, application_reference, requested_amount_cents, approved_amount_cents, submitted_at, approved_at, settled_at, expected_settlement_date, metadata, created_at, updated_at";

const DOC_SELECT =
  "id, tenant_id, finance_application_id, document_type, status, file_url, notes, metadata, created_at, updated_at";

function mapAppRow(raw: Record<string, unknown>): FinanceApplicationRecord {
  const meta = raw.metadata;
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    patient_id: raw.patient_id ? String(raw.patient_id) : null,
    case_id: raw.case_id ? String(raw.case_id) : null,
    booking_id: raw.booking_id ? String(raw.booking_id) : null,
    payment_pathway_id: String(raw.payment_pathway_id),
    finance_provider_id: String(raw.finance_provider_id),
    application_status: raw.application_status as FiFinanceApplicationStatus,
    application_reference: raw.application_reference ? String(raw.application_reference) : null,
    requested_amount_cents:
      raw.requested_amount_cents != null ? Number(raw.requested_amount_cents) : null,
    approved_amount_cents:
      raw.approved_amount_cents != null ? Number(raw.approved_amount_cents) : null,
    submitted_at: raw.submitted_at ? String(raw.submitted_at) : null,
    approved_at: raw.approved_at ? String(raw.approved_at) : null,
    settled_at: raw.settled_at ? String(raw.settled_at) : null,
    expected_settlement_date: raw.expected_settlement_date
      ? String(raw.expected_settlement_date).slice(0, 10)
      : null,
    metadata:
      meta && typeof meta === "object" && !Array.isArray(meta)
        ? (meta as Record<string, unknown>)
        : {},
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
    provider_name: raw.provider_name ? String(raw.provider_name) : undefined,
    pathway_type: raw.pathway_type ? String(raw.pathway_type) : undefined,
  };
}

function mapDocRow(raw: Record<string, unknown>): FinanceApplicationDocumentRecord {
  const meta = raw.metadata;
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    finance_application_id: String(raw.finance_application_id),
    document_type: raw.document_type as FiFinanceApplicationDocumentType,
    status: raw.status as FiFinanceApplicationDocumentStatus,
    file_url: raw.file_url ? String(raw.file_url) : null,
    notes: raw.notes ? String(raw.notes) : null,
    metadata:
      meta && typeof meta === "object" && !Array.isArray(meta)
        ? (meta as Record<string, unknown>)
        : {},
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
  };
}

async function assertMedicalFinancePathway(
  tenantId: string,
  paymentPathwayId: string
): Promise<void> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_payment_pathways")
    .select("id, pathway_type")
    .eq("tenant_id", tenantId.trim())
    .eq("id", paymentPathwayId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Payment pathway not found.");
  if (String((data as { pathway_type?: unknown }).pathway_type) !== "medical_finance") {
    throw new Error("Finance applications require a medical_finance payment pathway.");
  }
}

async function loadProviderNameMap(tenantId: string): Promise<Map<string, string>> {
  const providers = await loadFinanceProviders(tenantId);
  return new Map(providers.map((p) => [p.id, p.name]));
}

async function enrichApplications(
  tenantId: string,
  rows: FinanceApplicationRecord[],
  includeDocuments = false
): Promise<FinanceApplicationRecord[]> {
  if (!rows.length) return rows;
  const supabase = supabaseAdmin();
  const tid = tenantId.trim();
  const providerNames = await loadProviderNameMap(tid);

  const pathwayIds = Array.from(new Set(rows.map((r) => r.payment_pathway_id)));
  const { data: pathways, error: pe } = await supabase
    .from("fi_payment_pathways")
    .select("id, pathway_type")
    .eq("tenant_id", tid)
    .in("id", pathwayIds);
  if (pe) throw new Error(pe.message);
  const pathwayTypes = new Map(
    (pathways ?? []).map((p) => [
      String((p as { id: string }).id),
      String((p as { pathway_type?: unknown }).pathway_type ?? ""),
    ])
  );

  const docsByApp = new Map<string, FinanceApplicationDocumentRecord[]>();
  if (includeDocuments) {
    const appIds = rows.map((r) => r.id);
    const { data: docs, error: de } = await supabase
      .from("fi_finance_application_documents")
      .select(DOC_SELECT)
      .eq("tenant_id", tid)
      .in("finance_application_id", appIds)
      .order("created_at", { ascending: true });
    if (de) throw new Error(de.message);
    for (const raw of docs ?? []) {
      const doc = mapDocRow(raw as Record<string, unknown>);
      docsByApp.set(doc.finance_application_id, [
        ...(docsByApp.get(doc.finance_application_id) ?? []),
        doc,
      ]);
    }
  }

  return rows.map((r) => ({
    ...r,
    provider_name: providerNames.get(r.finance_provider_id) ?? r.finance_provider_id,
    pathway_type: pathwayTypes.get(r.payment_pathway_id),
    documents: includeDocuments ? (docsByApp.get(r.id) ?? []) : undefined,
  }));
}

export async function createFinanceApplication(args: {
  tenantId: string;
  paymentPathwayId: string;
  financeProviderId: string;
  patientId?: string | null;
  caseId?: string | null;
  bookingId?: string | null;
  requestedAmountCents?: number | null;
  applicationReference?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<FinanceApplicationRecord> {
  const tid = args.tenantId.trim();
  await assertMedicalFinancePathway(tid, args.paymentPathwayId);

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_finance_applications")
    .insert({
      tenant_id: tid,
      payment_pathway_id: args.paymentPathwayId.trim(),
      finance_provider_id: args.financeProviderId.trim(),
      patient_id: args.patientId?.trim() || null,
      case_id: args.caseId?.trim() || null,
      booking_id: args.bookingId?.trim() || null,
      requested_amount_cents: args.requestedAmountCents ?? null,
      application_reference: args.applicationReference?.trim() || null,
      application_status: "draft",
      metadata: args.metadata ?? {},
    })
    .select(APP_SELECT)
    .single();
  if (error) throw new Error(error.message);
  const [enriched] = await enrichApplications(tid, [mapAppRow(data as Record<string, unknown>)]);
  return enriched!;
}

export async function loadFinanceApplications(
  tenantId: string,
  filters?: { status?: FiFinanceApplicationStatus | "all"; providerId?: string | "all" }
): Promise<FinanceApplicationRecord[]> {
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();
  let q = supabase
    .from("fi_finance_applications")
    .select(APP_SELECT)
    .eq("tenant_id", tid)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (filters?.status && filters.status !== "all") q = q.eq("application_status", filters.status);
  if (filters?.providerId && filters.providerId !== "all")
    q = q.eq("finance_provider_id", filters.providerId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return enrichApplications(
    tid,
    (data ?? []).map((r) => mapAppRow(r as Record<string, unknown>)),
    true
  );
}

export async function loadFinanceApplicationById(
  tenantId: string,
  applicationId: string
): Promise<FinanceApplicationRecord | null> {
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_finance_applications")
    .select(APP_SELECT)
    .eq("tenant_id", tid)
    .eq("id", applicationId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [enriched] = await enrichApplications(
    tid,
    [mapAppRow(data as Record<string, unknown>)],
    true
  );
  return enriched ?? null;
}

export async function updateFinanceApplicationStatus(args: {
  tenantId: string;
  applicationId: string;
  status: FiFinanceApplicationStatus;
  approvedAmountCents?: number | null;
  expectedSettlementDate?: string | null;
  applicationReference?: string | null;
  metadataPatch?: Record<string, unknown>;
}): Promise<FinanceApplicationRecord> {
  const tid = args.tenantId.trim();
  const supabase = supabaseAdmin();
  const { data: existing, error: fe } = await supabase
    .from("fi_finance_applications")
    .select(APP_SELECT)
    .eq("tenant_id", tid)
    .eq("id", args.applicationId.trim())
    .maybeSingle();
  if (fe) throw new Error(fe.message);
  if (!existing) throw new Error("Finance application not found.");
  const row = mapAppRow(existing as Record<string, unknown>);

  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = { application_status: args.status };
  if (args.applicationReference !== undefined)
    patch.application_reference = args.applicationReference?.trim() || null;
  if (args.approvedAmountCents !== undefined)
    patch.approved_amount_cents = args.approvedAmountCents;
  if (args.expectedSettlementDate !== undefined) {
    patch.expected_settlement_date = args.expectedSettlementDate?.trim() || null;
  }
  if (args.metadataPatch) patch.metadata = { ...row.metadata, ...args.metadataPatch };

  if (args.status === "submitted" && !row.submitted_at) patch.submitted_at = nowIso;
  if (["approved", "settlement_pending", "settled"].includes(args.status) && !row.approved_at) {
    patch.approved_at = nowIso;
  }
  if (args.status === "settled" && !row.settled_at) patch.settled_at = nowIso;

  const { data, error } = await supabase
    .from("fi_finance_applications")
    .update(patch)
    .eq("tenant_id", tid)
    .eq("id", args.applicationId.trim())
    .select(APP_SELECT)
    .single();
  if (error) throw new Error(error.message);
  const [enriched] = await enrichApplications(
    tid,
    [mapAppRow(data as Record<string, unknown>)],
    true
  );
  return enriched!;
}

export async function addFinanceApplicationDocument(args: {
  tenantId: string;
  applicationId: string;
  documentType: FiFinanceApplicationDocumentType;
  status?: FiFinanceApplicationDocumentStatus;
  fileUrl?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<FinanceApplicationDocumentRecord> {
  const tid = args.tenantId.trim();
  const supabase = supabaseAdmin();
  const { data: app, error: ae } = await supabase
    .from("fi_finance_applications")
    .select("id")
    .eq("tenant_id", tid)
    .eq("id", args.applicationId.trim())
    .maybeSingle();
  if (ae) throw new Error(ae.message);
  if (!app) throw new Error("Finance application not found.");

  const { data, error } = await supabase
    .from("fi_finance_application_documents")
    .insert({
      tenant_id: tid,
      finance_application_id: args.applicationId.trim(),
      document_type: args.documentType,
      status: args.status ?? "pending",
      file_url: args.fileUrl?.trim() || null,
      notes: args.notes?.trim() || null,
      metadata: args.metadata ?? {},
    })
    .select(DOC_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return mapDocRow(data as Record<string, unknown>);
}

export async function updateFinanceApplicationDocument(args: {
  tenantId: string;
  documentId: string;
  status?: FiFinanceApplicationDocumentStatus;
  fileUrl?: string | null;
  notes?: string | null;
  metadataPatch?: Record<string, unknown>;
}): Promise<FinanceApplicationDocumentRecord> {
  const tid = args.tenantId.trim();
  const supabase = supabaseAdmin();
  const { data: existing, error: fe } = await supabase
    .from("fi_finance_application_documents")
    .select(DOC_SELECT)
    .eq("tenant_id", tid)
    .eq("id", args.documentId.trim())
    .maybeSingle();
  if (fe) throw new Error(fe.message);
  if (!existing) throw new Error("Finance application document not found.");
  const row = mapDocRow(existing as Record<string, unknown>);

  const patch: Record<string, unknown> = {};
  if (args.status !== undefined) patch.status = args.status;
  if (args.fileUrl !== undefined) patch.file_url = args.fileUrl?.trim() || null;
  if (args.notes !== undefined) patch.notes = args.notes?.trim() || null;
  if (args.metadataPatch) patch.metadata = { ...row.metadata, ...args.metadataPatch };

  const { data, error } = await supabase
    .from("fi_finance_application_documents")
    .update(patch)
    .eq("tenant_id", tid)
    .eq("id", args.documentId.trim())
    .select(DOC_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return mapDocRow(data as Record<string, unknown>);
}

export async function resolveFinanceApplicationAttention(
  tenantId: string,
  applicationId: string
): Promise<FinanceApplicationRecord> {
  return updateFinanceApplicationStatus({
    tenantId,
    applicationId,
    status: "settled",
  });
}

async function loadSurgeryDatesByBookingIds(
  tenantId: string,
  bookingIds: string[]
): Promise<Map<string, string>> {
  const ids = bookingIds.filter(Boolean);
  const out = new Map<string, string>();
  if (!ids.length) return out;
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_bookings")
    .select("id, start_at")
    .eq("tenant_id", tenantId.trim())
    .in("id", ids);
  if (error) throw new Error(error.message);
  for (const raw of data ?? []) {
    const id = String((raw as { id: string }).id);
    const start = (raw as { start_at?: string }).start_at;
    if (start) out.set(id, String(start).slice(0, 10));
  }
  return out;
}

export async function loadFinanceApplicationsRequiringAttention(
  tenantId: string
): Promise<FinanceApplicationRecord[]> {
  const tid = tenantId.trim();
  const todayYmd = new Date().toISOString().slice(0, 10);
  const apps = await loadFinanceApplications(tid);
  const bookingIds = apps.map((a) => a.booking_id).filter(Boolean) as string[];
  const surgeryDates = await loadSurgeryDatesByBookingIds(tid, bookingIds);

  return apps.filter((app) =>
    requiresEscalatedFinanceApplicationAttention({
      todayYmd,
      application: app,
      surgeryDateYmd: app.booking_id ? (surgeryDates.get(app.booking_id) ?? null) : null,
    })
  );
}

export async function loadFinanceApplicationAttentionCount(tenantId: string): Promise<number> {
  const rows = await loadFinanceApplicationsRequiringAttention(tenantId);
  return rows.length;
}

export async function loadFinanceApplicationsDashboardCounts(
  tenantId: string
): Promise<FinanceApplicationsDashboardCounts> {
  const tid = tenantId.trim();
  const todayYmd = new Date().toISOString().slice(0, 10);
  const apps = await loadFinanceApplications(tid);
  const providerNames = await loadProviderNameMap(tid);
  const bookingIds = apps.map((a) => a.booking_id).filter(Boolean) as string[];
  const surgeryDates = await loadSurgeryDatesByBookingIds(tid, bookingIds);
  return aggregateFinanceApplicationsDashboardCounts(apps, todayYmd, providerNames, surgeryDates);
}

export async function loadFinanceProviderAnalytics(
  tenantId: string
): Promise<FinanceProviderAnalytics[]> {
  const tid = tenantId.trim();
  const apps = await loadFinanceApplications(tid);
  const providerNames = await loadProviderNameMap(tid);
  return aggregateFinanceProviderAnalytics(apps, providerNames);
}

export async function loadUnresolvedFinanceApplicationsForBookings(
  tenantId: string,
  bookingIds: string[]
): Promise<Map<string, FinanceApplicationRecord[]>> {
  const out = new Map<string, FinanceApplicationRecord[]>();
  const ids = bookingIds.filter(Boolean);
  for (const id of ids) out.set(id, []);
  if (!ids.length) return out;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_finance_applications")
    .select(APP_SELECT)
    .eq("tenant_id", tenantId.trim())
    .in("booking_id", ids)
    .not("application_status", "in", '("settled","cancelled")');
  if (error) throw new Error(error.message);

  const rows = await enrichApplications(
    tenantId,
    (data ?? []).map((r) => mapAppRow(r as Record<string, unknown>))
  );
  for (const row of rows) {
    if (!row.booking_id) continue;
    out.set(row.booking_id, [...(out.get(row.booking_id) ?? []), row]);
  }
  return out;
}

export async function loadUnresolvedFinanceApplicationsForPathways(
  tenantId: string,
  pathwayIds: string[]
): Promise<Map<string, FinanceApplicationRecord>> {
  const out = new Map<string, FinanceApplicationRecord>();
  const ids = pathwayIds.filter(Boolean);
  if (!ids.length) return out;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_finance_applications")
    .select(APP_SELECT)
    .eq("tenant_id", tenantId.trim())
    .in("payment_pathway_id", ids)
    .not("application_status", "in", '("settled","cancelled")')
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);

  const rows = await enrichApplications(
    tenantId,
    (data ?? []).map((r) => mapAppRow(r as Record<string, unknown>))
  );
  for (const row of rows) {
    if (!out.has(row.payment_pathway_id)) out.set(row.payment_pathway_id, row);
  }
  return out;
}
