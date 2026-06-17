import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  aggregateInternationalTransferAnalytics,
  aggregateInternationalTransferDashboardCounts,
  requiresEscalatedInternationalTransferAttention,
  type FiInternationalTransferMethod,
  type FiInternationalTransferProofStatus,
  type FiInternationalTransferProofType,
  type FiInternationalTransferStatus,
  type InternationalTransferAnalytics,
  type InternationalTransferDashboardCounts,
} from "@/src/lib/financialOs/financialInternationalTransferCore";

export type InternationalTransferProofRecord = {
  id: string;
  tenant_id: string;
  international_transfer_application_id: string;
  proof_type: FiInternationalTransferProofType;
  status: FiInternationalTransferProofStatus;
  file_url: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type InternationalTransferApplicationRecord = {
  id: string;
  tenant_id: string;
  patient_id: string | null;
  case_id: string | null;
  booking_id: string | null;
  payment_pathway_id: string;
  transfer_method: FiInternationalTransferMethod;
  transfer_status: FiInternationalTransferStatus;
  source_country_code: string | null;
  source_currency_code: string | null;
  settlement_currency_code: string;
  expected_amount_cents: number | null;
  expected_settlement_amount_cents: number | null;
  received_amount_cents: number | null;
  expected_exchange_rate: number | null;
  actual_exchange_rate: number | null;
  fx_fee_cents: number | null;
  settlement_variance_cents: number | null;
  expected_settlement_date: string | null;
  actual_settlement_date: string | null;
  payment_reference: string | null;
  transfer_instructions: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  pathway_type?: string;
  proofs?: InternationalTransferProofRecord[];
};

const APP_SELECT =
  "id, tenant_id, patient_id, case_id, booking_id, payment_pathway_id, transfer_method, transfer_status, source_country_code, source_currency_code, settlement_currency_code, expected_amount_cents, expected_settlement_amount_cents, received_amount_cents, expected_exchange_rate, actual_exchange_rate, fx_fee_cents, settlement_variance_cents, expected_settlement_date, actual_settlement_date, payment_reference, transfer_instructions, metadata, created_at, updated_at";

const PROOF_SELECT =
  "id, tenant_id, international_transfer_application_id, proof_type, status, file_url, notes, metadata, created_at, updated_at";

function mapAppRow(raw: Record<string, unknown>): InternationalTransferApplicationRecord {
  const meta = raw.metadata;
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    patient_id: raw.patient_id ? String(raw.patient_id) : null,
    case_id: raw.case_id ? String(raw.case_id) : null,
    booking_id: raw.booking_id ? String(raw.booking_id) : null,
    payment_pathway_id: String(raw.payment_pathway_id),
    transfer_method: raw.transfer_method as FiInternationalTransferMethod,
    transfer_status: raw.transfer_status as FiInternationalTransferStatus,
    source_country_code: raw.source_country_code ? String(raw.source_country_code) : null,
    source_currency_code: raw.source_currency_code ? String(raw.source_currency_code) : null,
    settlement_currency_code: raw.settlement_currency_code ? String(raw.settlement_currency_code) : "AUD",
    expected_amount_cents: raw.expected_amount_cents != null ? Number(raw.expected_amount_cents) : null,
    expected_settlement_amount_cents:
      raw.expected_settlement_amount_cents != null ? Number(raw.expected_settlement_amount_cents) : null,
    received_amount_cents: raw.received_amount_cents != null ? Number(raw.received_amount_cents) : null,
    expected_exchange_rate: raw.expected_exchange_rate != null ? Number(raw.expected_exchange_rate) : null,
    actual_exchange_rate: raw.actual_exchange_rate != null ? Number(raw.actual_exchange_rate) : null,
    fx_fee_cents: raw.fx_fee_cents != null ? Number(raw.fx_fee_cents) : null,
    settlement_variance_cents: raw.settlement_variance_cents != null ? Number(raw.settlement_variance_cents) : null,
    expected_settlement_date: raw.expected_settlement_date ? String(raw.expected_settlement_date).slice(0, 10) : null,
    actual_settlement_date: raw.actual_settlement_date ? String(raw.actual_settlement_date).slice(0, 10) : null,
    payment_reference: raw.payment_reference ? String(raw.payment_reference) : null,
    transfer_instructions: raw.transfer_instructions ? String(raw.transfer_instructions) : null,
    metadata: meta && typeof meta === "object" && !Array.isArray(meta) ? (meta as Record<string, unknown>) : {},
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
    pathway_type: raw.pathway_type ? String(raw.pathway_type) : undefined,
  };
}

function mapProofRow(raw: Record<string, unknown>): InternationalTransferProofRecord {
  const meta = raw.metadata;
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    international_transfer_application_id: String(raw.international_transfer_application_id),
    proof_type: raw.proof_type as FiInternationalTransferProofType,
    status: raw.status as FiInternationalTransferProofStatus,
    file_url: raw.file_url ? String(raw.file_url) : null,
    notes: raw.notes ? String(raw.notes) : null,
    metadata: meta && typeof meta === "object" && !Array.isArray(meta) ? (meta as Record<string, unknown>) : {},
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
  };
}

async function assertInternationalTransferPathway(tenantId: string, paymentPathwayId: string): Promise<void> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_payment_pathways")
    .select("id, pathway_type")
    .eq("tenant_id", tenantId.trim())
    .eq("id", paymentPathwayId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Payment pathway not found.");
  if (String((data as { pathway_type?: unknown }).pathway_type) !== "international_transfer") {
    throw new Error("International transfer applications require an international_transfer payment pathway.");
  }
}

async function enrichApplications(
  tenantId: string,
  rows: InternationalTransferApplicationRecord[],
  includeDetails = false
): Promise<InternationalTransferApplicationRecord[]> {
  if (!rows.length) return rows;
  const supabase = supabaseAdmin();
  const tid = tenantId.trim();

  const pathwayIds = Array.from(new Set(rows.map((r) => r.payment_pathway_id)));
  const { data: pathways, error: pe } = await supabase
    .from("fi_payment_pathways")
    .select("id, pathway_type")
    .eq("tenant_id", tid)
    .in("id", pathwayIds);
  if (pe) throw new Error(pe.message);
  const pathwayTypes = new Map(
    (pathways ?? []).map((p) => [String((p as { id: string }).id), String((p as { pathway_type?: unknown }).pathway_type ?? "")])
  );

  const proofsByApp = new Map<string, InternationalTransferProofRecord[]>();

  if (includeDetails) {
    const appIds = rows.map((r) => r.id);
    const { data: proofs, error: de } = await supabase
      .from("fi_international_transfer_proofs")
      .select(PROOF_SELECT)
      .eq("tenant_id", tid)
      .in("international_transfer_application_id", appIds)
      .order("created_at", { ascending: true });
    if (de) throw new Error(de.message);
    for (const raw of proofs ?? []) {
      const proof = mapProofRow(raw as Record<string, unknown>);
      proofsByApp.set(proof.international_transfer_application_id, [
        ...(proofsByApp.get(proof.international_transfer_application_id) ?? []),
        proof,
      ]);
    }
  }

  return rows.map((r) => ({
    ...r,
    pathway_type: pathwayTypes.get(r.payment_pathway_id),
    proofs: includeDetails ? proofsByApp.get(r.id) ?? [] : undefined,
  }));
}

function computeSettlementVariance(
  expectedSettlementCents: number | null | undefined,
  receivedCents: number | null | undefined
): number | null {
  if (expectedSettlementCents == null || receivedCents == null) return null;
  return receivedCents - expectedSettlementCents;
}

export async function createInternationalTransferApplication(args: {
  tenantId: string;
  paymentPathwayId: string;
  patientId?: string | null;
  caseId?: string | null;
  bookingId?: string | null;
  transferMethod?: FiInternationalTransferMethod;
  sourceCountryCode?: string | null;
  sourceCurrencyCode?: string | null;
  settlementCurrencyCode?: string;
  expectedAmountCents?: number | null;
  expectedSettlementAmountCents?: number | null;
  expectedSettlementDate?: string | null;
  paymentReference?: string | null;
  transferInstructions?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<InternationalTransferApplicationRecord> {
  const tid = args.tenantId.trim();
  await assertInternationalTransferPathway(tid, args.paymentPathwayId);

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_international_transfer_applications")
    .insert({
      tenant_id: tid,
      payment_pathway_id: args.paymentPathwayId.trim(),
      patient_id: args.patientId?.trim() || null,
      case_id: args.caseId?.trim() || null,
      booking_id: args.bookingId?.trim() || null,
      transfer_method: args.transferMethod ?? "bank_transfer",
      transfer_status: "instructions_required",
      source_country_code: args.sourceCountryCode?.trim().toUpperCase() || null,
      source_currency_code: args.sourceCurrencyCode?.trim().toUpperCase() || null,
      settlement_currency_code: args.settlementCurrencyCode?.trim().toUpperCase() || "AUD",
      expected_amount_cents: args.expectedAmountCents ?? null,
      expected_settlement_amount_cents: args.expectedSettlementAmountCents ?? null,
      expected_settlement_date: args.expectedSettlementDate?.trim() || null,
      payment_reference: args.paymentReference?.trim() || null,
      transfer_instructions: args.transferInstructions?.trim() || null,
      metadata: args.metadata ?? {},
    })
    .select(APP_SELECT)
    .single();
  if (error) throw new Error(error.message);
  const [enriched] = await enrichApplications(tid, [mapAppRow(data as Record<string, unknown>)]);
  return enriched!;
}

export async function loadInternationalTransferApplications(
  tenantId: string,
  filters?: { status?: FiInternationalTransferStatus | "all" }
): Promise<InternationalTransferApplicationRecord[]> {
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();
  let q = supabase
    .from("fi_international_transfer_applications")
    .select(APP_SELECT)
    .eq("tenant_id", tid)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (filters?.status && filters.status !== "all") q = q.eq("transfer_status", filters.status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return enrichApplications(tid, (data ?? []).map((r) => mapAppRow(r as Record<string, unknown>)), true);
}

export async function loadInternationalTransferApplicationById(
  tenantId: string,
  applicationId: string
): Promise<InternationalTransferApplicationRecord | null> {
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_international_transfer_applications")
    .select(APP_SELECT)
    .eq("tenant_id", tid)
    .eq("id", applicationId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [enriched] = await enrichApplications(tid, [mapAppRow(data as Record<string, unknown>)], true);
  return enriched ?? null;
}

export async function updateInternationalTransferStatus(args: {
  tenantId: string;
  applicationId: string;
  status: FiInternationalTransferStatus;
  transferInstructions?: string | null;
  paymentReference?: string | null;
  metadataPatch?: Record<string, unknown>;
}): Promise<InternationalTransferApplicationRecord> {
  const tid = args.tenantId.trim();
  const supabase = supabaseAdmin();
  const { data: existing, error: fe } = await supabase
    .from("fi_international_transfer_applications")
    .select(APP_SELECT)
    .eq("tenant_id", tid)
    .eq("id", args.applicationId.trim())
    .maybeSingle();
  if (fe) throw new Error(fe.message);
  if (!existing) throw new Error("International transfer application not found.");
  const row = mapAppRow(existing as Record<string, unknown>);

  const patch: Record<string, unknown> = { transfer_status: args.status };
  if (args.transferInstructions !== undefined) patch.transfer_instructions = args.transferInstructions?.trim() || null;
  if (args.paymentReference !== undefined) patch.payment_reference = args.paymentReference?.trim() || null;
  if (args.metadataPatch) patch.metadata = { ...row.metadata, ...args.metadataPatch };

  const { data, error } = await supabase
    .from("fi_international_transfer_applications")
    .update(patch)
    .eq("tenant_id", tid)
    .eq("id", args.applicationId.trim())
    .select(APP_SELECT)
    .single();
  if (error) throw new Error(error.message);
  const [enriched] = await enrichApplications(tid, [mapAppRow(data as Record<string, unknown>)], true);
  return enriched!;
}

export async function updateInternationalTransferSettlement(args: {
  tenantId: string;
  applicationId: string;
  status?: FiInternationalTransferStatus;
  receivedAmountCents?: number | null;
  expectedSettlementAmountCents?: number | null;
  expectedExchangeRate?: number | null;
  actualExchangeRate?: number | null;
  fxFeeCents?: number | null;
  expectedSettlementDate?: string | null;
  actualSettlementDate?: string | null;
  sourceCountryCode?: string | null;
  sourceCurrencyCode?: string | null;
  settlementCurrencyCode?: string | null;
  metadataPatch?: Record<string, unknown>;
}): Promise<InternationalTransferApplicationRecord> {
  const tid = args.tenantId.trim();
  const supabase = supabaseAdmin();
  const { data: existing, error: fe } = await supabase
    .from("fi_international_transfer_applications")
    .select(APP_SELECT)
    .eq("tenant_id", tid)
    .eq("id", args.applicationId.trim())
    .maybeSingle();
  if (fe) throw new Error(fe.message);
  if (!existing) throw new Error("International transfer application not found.");
  const row = mapAppRow(existing as Record<string, unknown>);

  const patch: Record<string, unknown> = {};
  if (args.status !== undefined) patch.transfer_status = args.status;
  if (args.receivedAmountCents !== undefined) patch.received_amount_cents = args.receivedAmountCents;
  if (args.expectedSettlementAmountCents !== undefined) {
    patch.expected_settlement_amount_cents = args.expectedSettlementAmountCents;
  }
  if (args.expectedExchangeRate !== undefined) patch.expected_exchange_rate = args.expectedExchangeRate;
  if (args.actualExchangeRate !== undefined) patch.actual_exchange_rate = args.actualExchangeRate;
  if (args.fxFeeCents !== undefined) patch.fx_fee_cents = args.fxFeeCents;
  if (args.expectedSettlementDate !== undefined) {
    patch.expected_settlement_date = args.expectedSettlementDate?.trim() || null;
  }
  if (args.actualSettlementDate !== undefined) patch.actual_settlement_date = args.actualSettlementDate?.trim() || null;
  if (args.sourceCountryCode !== undefined) patch.source_country_code = args.sourceCountryCode?.trim().toUpperCase() || null;
  if (args.sourceCurrencyCode !== undefined) {
    patch.source_currency_code = args.sourceCurrencyCode?.trim().toUpperCase() || null;
  }
  if (args.settlementCurrencyCode !== undefined) {
    patch.settlement_currency_code = args.settlementCurrencyCode?.trim().toUpperCase() || "AUD";
  }
  if (args.metadataPatch) patch.metadata = { ...row.metadata, ...args.metadataPatch };

  const expectedSettlement =
    args.expectedSettlementAmountCents !== undefined ? args.expectedSettlementAmountCents : row.expected_settlement_amount_cents;
  const received = args.receivedAmountCents !== undefined ? args.receivedAmountCents : row.received_amount_cents;
  const variance = computeSettlementVariance(expectedSettlement, received);
  if (variance !== null) patch.settlement_variance_cents = variance;

  const { data, error } = await supabase
    .from("fi_international_transfer_applications")
    .update(patch)
    .eq("tenant_id", tid)
    .eq("id", args.applicationId.trim())
    .select(APP_SELECT)
    .single();
  if (error) throw new Error(error.message);
  const [enriched] = await enrichApplications(tid, [mapAppRow(data as Record<string, unknown>)], true);
  return enriched!;
}

export async function addInternationalTransferProof(args: {
  tenantId: string;
  applicationId: string;
  proofType: FiInternationalTransferProofType;
  status?: FiInternationalTransferProofStatus;
  fileUrl?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<InternationalTransferProofRecord> {
  const tid = args.tenantId.trim();
  const supabase = supabaseAdmin();
  const { data: app, error: ae } = await supabase
    .from("fi_international_transfer_applications")
    .select("id")
    .eq("tenant_id", tid)
    .eq("id", args.applicationId.trim())
    .maybeSingle();
  if (ae) throw new Error(ae.message);
  if (!app) throw new Error("International transfer application not found.");

  const { data, error } = await supabase
    .from("fi_international_transfer_proofs")
    .insert({
      tenant_id: tid,
      international_transfer_application_id: args.applicationId.trim(),
      proof_type: args.proofType,
      status: args.status ?? "pending",
      file_url: args.fileUrl?.trim() || null,
      notes: args.notes?.trim() || null,
      metadata: args.metadata ?? {},
    })
    .select(PROOF_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return mapProofRow(data as Record<string, unknown>);
}

export async function updateInternationalTransferProof(args: {
  tenantId: string;
  proofId: string;
  status?: FiInternationalTransferProofStatus;
  fileUrl?: string | null;
  notes?: string | null;
  metadataPatch?: Record<string, unknown>;
}): Promise<InternationalTransferProofRecord> {
  const tid = args.tenantId.trim();
  const supabase = supabaseAdmin();
  const { data: existing, error: fe } = await supabase
    .from("fi_international_transfer_proofs")
    .select(PROOF_SELECT)
    .eq("tenant_id", tid)
    .eq("id", args.proofId.trim())
    .maybeSingle();
  if (fe) throw new Error(fe.message);
  if (!existing) throw new Error("International transfer proof not found.");
  const row = mapProofRow(existing as Record<string, unknown>);

  const patch: Record<string, unknown> = {};
  if (args.status !== undefined) patch.status = args.status;
  if (args.fileUrl !== undefined) patch.file_url = args.fileUrl?.trim() || null;
  if (args.notes !== undefined) patch.notes = args.notes?.trim() || null;
  if (args.metadataPatch) patch.metadata = { ...row.metadata, ...args.metadataPatch };

  const { data, error } = await supabase
    .from("fi_international_transfer_proofs")
    .update(patch)
    .eq("tenant_id", tid)
    .eq("id", args.proofId.trim())
    .select(PROOF_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return mapProofRow(data as Record<string, unknown>);
}

export async function resolveInternationalTransferAttention(
  tenantId: string,
  applicationId: string
): Promise<InternationalTransferApplicationRecord> {
  return updateInternationalTransferStatus({
    tenantId,
    applicationId,
    status: "settled",
  });
}

async function loadSurgeryDatesByBookingIds(tenantId: string, bookingIds: string[]): Promise<Map<string, string>> {
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

async function loadAllProofs(tenantId: string): Promise<InternationalTransferProofRecord[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_international_transfer_proofs")
    .select(PROOF_SELECT)
    .eq("tenant_id", tenantId.trim())
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapProofRow(r as Record<string, unknown>));
}

export async function loadInternationalTransferApplicationsRequiringAttention(
  tenantId: string
): Promise<InternationalTransferApplicationRecord[]> {
  const tid = tenantId.trim();
  const todayYmd = new Date().toISOString().slice(0, 10);
  const apps = await loadInternationalTransferApplications(tid);
  const bookingIds = apps.map((a) => a.booking_id).filter(Boolean) as string[];
  const surgeryDates = await loadSurgeryDatesByBookingIds(tid, bookingIds);

  return apps.filter((app) =>
    requiresEscalatedInternationalTransferAttention({
      todayYmd,
      application: app,
      surgeryDateYmd: app.booking_id ? surgeryDates.get(app.booking_id) ?? null : null,
    })
  );
}

export async function loadInternationalTransferAttentionCount(tenantId: string): Promise<number> {
  const rows = await loadInternationalTransferApplicationsRequiringAttention(tenantId);
  return rows.length;
}

export async function loadInternationalTransferDashboardCounts(
  tenantId: string
): Promise<InternationalTransferDashboardCounts> {
  const tid = tenantId.trim();
  const todayYmd = new Date().toISOString().slice(0, 10);
  const apps = await loadInternationalTransferApplications(tid);
  const bookingIds = apps.map((a) => a.booking_id).filter(Boolean) as string[];
  const surgeryDates = await loadSurgeryDatesByBookingIds(tid, bookingIds);
  return aggregateInternationalTransferDashboardCounts(apps, todayYmd, surgeryDates);
}

export async function loadInternationalTransferAnalytics(tenantId: string): Promise<InternationalTransferAnalytics> {
  const tid = tenantId.trim();
  const [apps, proofs] = await Promise.all([loadInternationalTransferApplications(tid), loadAllProofs(tid)]);
  return aggregateInternationalTransferAnalytics(
    apps,
    proofs.map((p) => ({
      id: p.id,
      international_transfer_application_id: p.international_transfer_application_id,
      proof_type: p.proof_type,
      status: p.status,
      created_at: p.created_at,
      updated_at: p.updated_at,
    }))
  );
}

export async function loadUnresolvedInternationalTransferApplicationsForBookings(
  tenantId: string,
  bookingIds: string[]
): Promise<Map<string, InternationalTransferApplicationRecord[]>> {
  const out = new Map<string, InternationalTransferApplicationRecord[]>();
  const ids = bookingIds.filter(Boolean);
  for (const id of ids) out.set(id, []);
  if (!ids.length) return out;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_international_transfer_applications")
    .select(APP_SELECT)
    .eq("tenant_id", tenantId.trim())
    .in("booking_id", ids)
    .not("transfer_status", "in", '("settled","cancelled")');
  if (error) throw new Error(error.message);

  const rows = await enrichApplications(tenantId, (data ?? []).map((r) => mapAppRow(r as Record<string, unknown>)));
  for (const row of rows) {
    if (!row.booking_id) continue;
    out.set(row.booking_id, [...(out.get(row.booking_id) ?? []), row]);
  }
  return out;
}

export async function loadUnresolvedInternationalTransferApplicationsForPathways(
  tenantId: string,
  pathwayIds: string[]
): Promise<Map<string, InternationalTransferApplicationRecord>> {
  const out = new Map<string, InternationalTransferApplicationRecord>();
  const ids = pathwayIds.filter(Boolean);
  if (!ids.length) return out;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_international_transfer_applications")
    .select(APP_SELECT)
    .eq("tenant_id", tenantId.trim())
    .in("payment_pathway_id", ids)
    .not("transfer_status", "in", '("settled","cancelled")')
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);

  const rows = await enrichApplications(tenantId, (data ?? []).map((r) => mapAppRow(r as Record<string, unknown>)));
  for (const row of rows) {
    if (!out.has(row.payment_pathway_id)) out.set(row.payment_pathway_id, row);
  }
  return out;
}
