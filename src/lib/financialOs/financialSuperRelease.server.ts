import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  aggregateSuperReleaseAnalytics,
  aggregateSuperReleaseDashboardCounts,
  requiresEscalatedSuperReleaseAttention,
  type FiSuperReleaseApplicationStatus,
  type FiSuperReleaseClinicalLetterStatus,
  type FiSuperReleaseDocumentStatus,
  type FiSuperReleaseDocumentType,
  type SuperReleaseAnalytics,
  type SuperReleaseDashboardCounts,
} from "@/src/lib/financialOs/financialSuperReleaseCore";

export type SuperReleaseDocumentRecord = {
  id: string;
  tenant_id: string;
  super_release_application_id: string;
  document_type: FiSuperReleaseDocumentType;
  status: FiSuperReleaseDocumentStatus;
  file_url: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type SuperReleaseClinicalLetterRecord = {
  id: string;
  tenant_id: string;
  super_release_application_id: string;
  generated_by: string | null;
  letter_status: FiSuperReleaseClinicalLetterStatus;
  issued_at: string | null;
  file_url: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type SuperReleaseApplicationRecord = {
  id: string;
  tenant_id: string;
  patient_id: string | null;
  case_id: string | null;
  booking_id: string | null;
  payment_pathway_id: string;
  provider_name: string | null;
  application_status: FiSuperReleaseApplicationStatus;
  requested_amount_cents: number | null;
  approved_amount_cents: number | null;
  submitted_at: string | null;
  approved_at: string | null;
  funds_released_at: string | null;
  expected_release_date: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  pathway_type?: string;
  documents?: SuperReleaseDocumentRecord[];
  clinical_letters?: SuperReleaseClinicalLetterRecord[];
};

const APP_SELECT =
  "id, tenant_id, patient_id, case_id, booking_id, payment_pathway_id, provider_name, application_status, requested_amount_cents, approved_amount_cents, submitted_at, approved_at, funds_released_at, expected_release_date, metadata, created_at, updated_at";

const DOC_SELECT =
  "id, tenant_id, super_release_application_id, document_type, status, file_url, notes, metadata, created_at, updated_at";

const LETTER_SELECT =
  "id, tenant_id, super_release_application_id, generated_by, letter_status, issued_at, file_url, notes, metadata, created_at, updated_at";

function mapAppRow(raw: Record<string, unknown>): SuperReleaseApplicationRecord {
  const meta = raw.metadata;
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    patient_id: raw.patient_id ? String(raw.patient_id) : null,
    case_id: raw.case_id ? String(raw.case_id) : null,
    booking_id: raw.booking_id ? String(raw.booking_id) : null,
    payment_pathway_id: String(raw.payment_pathway_id),
    provider_name: raw.provider_name ? String(raw.provider_name) : null,
    application_status: raw.application_status as FiSuperReleaseApplicationStatus,
    requested_amount_cents: raw.requested_amount_cents != null ? Number(raw.requested_amount_cents) : null,
    approved_amount_cents: raw.approved_amount_cents != null ? Number(raw.approved_amount_cents) : null,
    submitted_at: raw.submitted_at ? String(raw.submitted_at) : null,
    approved_at: raw.approved_at ? String(raw.approved_at) : null,
    funds_released_at: raw.funds_released_at ? String(raw.funds_released_at) : null,
    expected_release_date: raw.expected_release_date ? String(raw.expected_release_date).slice(0, 10) : null,
    metadata: meta && typeof meta === "object" && !Array.isArray(meta) ? (meta as Record<string, unknown>) : {},
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
    pathway_type: raw.pathway_type ? String(raw.pathway_type) : undefined,
  };
}

function mapDocRow(raw: Record<string, unknown>): SuperReleaseDocumentRecord {
  const meta = raw.metadata;
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    super_release_application_id: String(raw.super_release_application_id),
    document_type: raw.document_type as FiSuperReleaseDocumentType,
    status: raw.status as FiSuperReleaseDocumentStatus,
    file_url: raw.file_url ? String(raw.file_url) : null,
    notes: raw.notes ? String(raw.notes) : null,
    metadata: meta && typeof meta === "object" && !Array.isArray(meta) ? (meta as Record<string, unknown>) : {},
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
  };
}

function mapLetterRow(raw: Record<string, unknown>): SuperReleaseClinicalLetterRecord {
  const meta = raw.metadata;
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    super_release_application_id: String(raw.super_release_application_id),
    generated_by: raw.generated_by ? String(raw.generated_by) : null,
    letter_status: raw.letter_status as FiSuperReleaseClinicalLetterStatus,
    issued_at: raw.issued_at ? String(raw.issued_at) : null,
    file_url: raw.file_url ? String(raw.file_url) : null,
    notes: raw.notes ? String(raw.notes) : null,
    metadata: meta && typeof meta === "object" && !Array.isArray(meta) ? (meta as Record<string, unknown>) : {},
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
  };
}

async function assertSuperReleasePathway(tenantId: string, paymentPathwayId: string): Promise<void> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_payment_pathways")
    .select("id, pathway_type")
    .eq("tenant_id", tenantId.trim())
    .eq("id", paymentPathwayId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Payment pathway not found.");
  if (String((data as { pathway_type?: unknown }).pathway_type) !== "super_release") {
    throw new Error("Super release applications require a super_release payment pathway.");
  }
}

async function enrichApplications(
  tenantId: string,
  rows: SuperReleaseApplicationRecord[],
  includeDetails = false
): Promise<SuperReleaseApplicationRecord[]> {
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
  const pathwayTypes = new Map((pathways ?? []).map((p) => [String((p as { id: string }).id), String((p as { pathway_type?: unknown }).pathway_type ?? "")]));

  const docsByApp = new Map<string, SuperReleaseDocumentRecord[]>();
  const lettersByApp = new Map<string, SuperReleaseClinicalLetterRecord[]>();

  if (includeDetails) {
    const appIds = rows.map((r) => r.id);
    const [{ data: docs, error: de }, { data: letters, error: le }] = await Promise.all([
      supabase
        .from("fi_super_release_documents")
        .select(DOC_SELECT)
        .eq("tenant_id", tid)
        .in("super_release_application_id", appIds)
        .order("created_at", { ascending: true }),
      supabase
        .from("fi_super_release_clinical_letters")
        .select(LETTER_SELECT)
        .eq("tenant_id", tid)
        .in("super_release_application_id", appIds)
        .order("created_at", { ascending: true }),
    ]);
    if (de) throw new Error(de.message);
    if (le) throw new Error(le.message);
    for (const raw of docs ?? []) {
      const doc = mapDocRow(raw as Record<string, unknown>);
      docsByApp.set(doc.super_release_application_id, [...(docsByApp.get(doc.super_release_application_id) ?? []), doc]);
    }
    for (const raw of letters ?? []) {
      const letter = mapLetterRow(raw as Record<string, unknown>);
      lettersByApp.set(letter.super_release_application_id, [...(lettersByApp.get(letter.super_release_application_id) ?? []), letter]);
    }
  }

  return rows.map((r) => ({
    ...r,
    pathway_type: pathwayTypes.get(r.payment_pathway_id),
    documents: includeDetails ? docsByApp.get(r.id) ?? [] : undefined,
    clinical_letters: includeDetails ? lettersByApp.get(r.id) ?? [] : undefined,
  }));
}

export async function createSuperReleaseApplication(args: {
  tenantId: string;
  paymentPathwayId: string;
  patientId?: string | null;
  caseId?: string | null;
  bookingId?: string | null;
  providerName?: string | null;
  requestedAmountCents?: number | null;
  metadata?: Record<string, unknown>;
}): Promise<SuperReleaseApplicationRecord> {
  const tid = args.tenantId.trim();
  await assertSuperReleasePathway(tid, args.paymentPathwayId);

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_super_release_applications")
    .insert({
      tenant_id: tid,
      payment_pathway_id: args.paymentPathwayId.trim(),
      patient_id: args.patientId?.trim() || null,
      case_id: args.caseId?.trim() || null,
      booking_id: args.bookingId?.trim() || null,
      provider_name: args.providerName?.trim() || null,
      requested_amount_cents: args.requestedAmountCents ?? null,
      application_status: "draft",
      metadata: args.metadata ?? {},
    })
    .select(APP_SELECT)
    .single();
  if (error) throw new Error(error.message);
  const [enriched] = await enrichApplications(tid, [mapAppRow(data as Record<string, unknown>)]);
  return enriched!;
}

export async function loadSuperReleaseApplications(
  tenantId: string,
  filters?: { status?: FiSuperReleaseApplicationStatus | "all" }
): Promise<SuperReleaseApplicationRecord[]> {
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();
  let q = supabase
    .from("fi_super_release_applications")
    .select(APP_SELECT)
    .eq("tenant_id", tid)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (filters?.status && filters.status !== "all") q = q.eq("application_status", filters.status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return enrichApplications(tid, (data ?? []).map((r) => mapAppRow(r as Record<string, unknown>)), true);
}

export async function loadSuperReleaseApplicationById(
  tenantId: string,
  applicationId: string
): Promise<SuperReleaseApplicationRecord | null> {
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_super_release_applications")
    .select(APP_SELECT)
    .eq("tenant_id", tid)
    .eq("id", applicationId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [enriched] = await enrichApplications(tid, [mapAppRow(data as Record<string, unknown>)], true);
  return enriched ?? null;
}

export async function updateSuperReleaseStatus(args: {
  tenantId: string;
  applicationId: string;
  status: FiSuperReleaseApplicationStatus;
  approvedAmountCents?: number | null;
  expectedReleaseDate?: string | null;
  providerName?: string | null;
  metadataPatch?: Record<string, unknown>;
}): Promise<SuperReleaseApplicationRecord> {
  const tid = args.tenantId.trim();
  const supabase = supabaseAdmin();
  const { data: existing, error: fe } = await supabase
    .from("fi_super_release_applications")
    .select(APP_SELECT)
    .eq("tenant_id", tid)
    .eq("id", args.applicationId.trim())
    .maybeSingle();
  if (fe) throw new Error(fe.message);
  if (!existing) throw new Error("Super release application not found.");
  const row = mapAppRow(existing as Record<string, unknown>);

  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = { application_status: args.status };
  if (args.providerName !== undefined) patch.provider_name = args.providerName?.trim() || null;
  if (args.approvedAmountCents !== undefined) patch.approved_amount_cents = args.approvedAmountCents;
  if (args.expectedReleaseDate !== undefined) patch.expected_release_date = args.expectedReleaseDate?.trim() || null;
  if (args.metadataPatch) patch.metadata = { ...row.metadata, ...args.metadataPatch };

  if (args.status === "submitted" && !row.submitted_at) patch.submitted_at = nowIso;
  if (["approved", "release_pending", "funds_released"].includes(args.status) && !row.approved_at) {
    patch.approved_at = nowIso;
  }
  if (args.status === "funds_released" && !row.funds_released_at) patch.funds_released_at = nowIso;

  const { data, error } = await supabase
    .from("fi_super_release_applications")
    .update(patch)
    .eq("tenant_id", tid)
    .eq("id", args.applicationId.trim())
    .select(APP_SELECT)
    .single();
  if (error) throw new Error(error.message);
  const [enriched] = await enrichApplications(tid, [mapAppRow(data as Record<string, unknown>)], true);
  return enriched!;
}

export async function addSuperReleaseDocument(args: {
  tenantId: string;
  applicationId: string;
  documentType: FiSuperReleaseDocumentType;
  status?: FiSuperReleaseDocumentStatus;
  fileUrl?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<SuperReleaseDocumentRecord> {
  const tid = args.tenantId.trim();
  const supabase = supabaseAdmin();
  const { data: app, error: ae } = await supabase
    .from("fi_super_release_applications")
    .select("id")
    .eq("tenant_id", tid)
    .eq("id", args.applicationId.trim())
    .maybeSingle();
  if (ae) throw new Error(ae.message);
  if (!app) throw new Error("Super release application not found.");

  const { data, error } = await supabase
    .from("fi_super_release_documents")
    .insert({
      tenant_id: tid,
      super_release_application_id: args.applicationId.trim(),
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

export async function updateSuperReleaseDocument(args: {
  tenantId: string;
  documentId: string;
  status?: FiSuperReleaseDocumentStatus;
  fileUrl?: string | null;
  notes?: string | null;
  metadataPatch?: Record<string, unknown>;
}): Promise<SuperReleaseDocumentRecord> {
  const tid = args.tenantId.trim();
  const supabase = supabaseAdmin();
  const { data: existing, error: fe } = await supabase
    .from("fi_super_release_documents")
    .select(DOC_SELECT)
    .eq("tenant_id", tid)
    .eq("id", args.documentId.trim())
    .maybeSingle();
  if (fe) throw new Error(fe.message);
  if (!existing) throw new Error("Super release document not found.");
  const row = mapDocRow(existing as Record<string, unknown>);

  const patch: Record<string, unknown> = {};
  if (args.status !== undefined) patch.status = args.status;
  if (args.fileUrl !== undefined) patch.file_url = args.fileUrl?.trim() || null;
  if (args.notes !== undefined) patch.notes = args.notes?.trim() || null;
  if (args.metadataPatch) patch.metadata = { ...row.metadata, ...args.metadataPatch };

  const { data, error } = await supabase
    .from("fi_super_release_documents")
    .update(patch)
    .eq("tenant_id", tid)
    .eq("id", args.documentId.trim())
    .select(DOC_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return mapDocRow(data as Record<string, unknown>);
}

export async function createClinicalLetterRecord(args: {
  tenantId: string;
  applicationId: string;
  generatedBy?: string | null;
  letterStatus?: FiSuperReleaseClinicalLetterStatus;
  fileUrl?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<SuperReleaseClinicalLetterRecord> {
  const tid = args.tenantId.trim();
  const supabase = supabaseAdmin();
  const { data: app, error: ae } = await supabase
    .from("fi_super_release_applications")
    .select("id")
    .eq("tenant_id", tid)
    .eq("id", args.applicationId.trim())
    .maybeSingle();
  if (ae) throw new Error(ae.message);
  if (!app) throw new Error("Super release application not found.");

  const { data, error } = await supabase
    .from("fi_super_release_clinical_letters")
    .insert({
      tenant_id: tid,
      super_release_application_id: args.applicationId.trim(),
      generated_by: args.generatedBy?.trim() || null,
      letter_status: args.letterStatus ?? "draft",
      file_url: args.fileUrl?.trim() || null,
      notes: args.notes?.trim() || null,
      metadata: args.metadata ?? {},
    })
    .select(LETTER_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return mapLetterRow(data as Record<string, unknown>);
}

export async function updateClinicalLetterStatus(args: {
  tenantId: string;
  letterId: string;
  letterStatus: FiSuperReleaseClinicalLetterStatus;
  fileUrl?: string | null;
  notes?: string | null;
  metadataPatch?: Record<string, unknown>;
}): Promise<SuperReleaseClinicalLetterRecord> {
  const tid = args.tenantId.trim();
  const supabase = supabaseAdmin();
  const { data: existing, error: fe } = await supabase
    .from("fi_super_release_clinical_letters")
    .select(LETTER_SELECT)
    .eq("tenant_id", tid)
    .eq("id", args.letterId.trim())
    .maybeSingle();
  if (fe) throw new Error(fe.message);
  if (!existing) throw new Error("Clinical letter not found.");
  const row = mapLetterRow(existing as Record<string, unknown>);

  const patch: Record<string, unknown> = { letter_status: args.letterStatus };
  if (args.fileUrl !== undefined) patch.file_url = args.fileUrl?.trim() || null;
  if (args.notes !== undefined) patch.notes = args.notes?.trim() || null;
  if (args.metadataPatch) patch.metadata = { ...row.metadata, ...args.metadataPatch };
  if (args.letterStatus === "issued" && !row.issued_at) patch.issued_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("fi_super_release_clinical_letters")
    .update(patch)
    .eq("tenant_id", tid)
    .eq("id", args.letterId.trim())
    .select(LETTER_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return mapLetterRow(data as Record<string, unknown>);
}

export async function resolveSuperReleaseAttention(tenantId: string, applicationId: string): Promise<SuperReleaseApplicationRecord> {
  return updateSuperReleaseStatus({
    tenantId,
    applicationId,
    status: "funds_released",
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

async function loadAllClinicalLetters(tenantId: string): Promise<SuperReleaseClinicalLetterRecord[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_super_release_clinical_letters")
    .select(LETTER_SELECT)
    .eq("tenant_id", tenantId.trim())
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapLetterRow(r as Record<string, unknown>));
}

export async function loadSuperReleaseApplicationsRequiringAttention(tenantId: string): Promise<SuperReleaseApplicationRecord[]> {
  const tid = tenantId.trim();
  const todayYmd = new Date().toISOString().slice(0, 10);
  const apps = await loadSuperReleaseApplications(tid);
  const bookingIds = apps.map((a) => a.booking_id).filter(Boolean) as string[];
  const surgeryDates = await loadSurgeryDatesByBookingIds(tid, bookingIds);

  return apps.filter((app) =>
    requiresEscalatedSuperReleaseAttention({
      todayYmd,
      application: app,
      surgeryDateYmd: app.booking_id ? surgeryDates.get(app.booking_id) ?? null : null,
    })
  );
}

export async function loadSuperReleaseAttentionCount(tenantId: string): Promise<number> {
  const rows = await loadSuperReleaseApplicationsRequiringAttention(tenantId);
  return rows.length;
}

export async function loadSuperReleaseDashboardCounts(tenantId: string): Promise<SuperReleaseDashboardCounts> {
  const tid = tenantId.trim();
  const todayYmd = new Date().toISOString().slice(0, 10);
  const [apps, clinicalLetters] = await Promise.all([loadSuperReleaseApplications(tid), loadAllClinicalLetters(tid)]);
  const bookingIds = apps.map((a) => a.booking_id).filter(Boolean) as string[];
  const surgeryDates = await loadSurgeryDatesByBookingIds(tid, bookingIds);
  return aggregateSuperReleaseDashboardCounts(apps, todayYmd, clinicalLetters, surgeryDates);
}

export async function loadSuperReleaseAnalytics(tenantId: string): Promise<SuperReleaseAnalytics> {
  const tid = tenantId.trim();
  const [apps, clinicalLetters] = await Promise.all([loadSuperReleaseApplications(tid), loadAllClinicalLetters(tid)]);
  return aggregateSuperReleaseAnalytics(apps, clinicalLetters);
}

export async function loadUnresolvedSuperReleaseApplicationsForBookings(
  tenantId: string,
  bookingIds: string[]
): Promise<Map<string, SuperReleaseApplicationRecord[]>> {
  const out = new Map<string, SuperReleaseApplicationRecord[]>();
  const ids = bookingIds.filter(Boolean);
  for (const id of ids) out.set(id, []);
  if (!ids.length) return out;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_super_release_applications")
    .select(APP_SELECT)
    .eq("tenant_id", tenantId.trim())
    .in("booking_id", ids)
    .not("application_status", "in", '("funds_released","cancelled")');
  if (error) throw new Error(error.message);

  const rows = await enrichApplications(tenantId, (data ?? []).map((r) => mapAppRow(r as Record<string, unknown>)));
  for (const row of rows) {
    if (!row.booking_id) continue;
    out.set(row.booking_id, [...(out.get(row.booking_id) ?? []), row]);
  }
  return out;
}

export async function loadUnresolvedSuperReleaseApplicationsForPathways(
  tenantId: string,
  pathwayIds: string[]
): Promise<Map<string, SuperReleaseApplicationRecord>> {
  const out = new Map<string, SuperReleaseApplicationRecord>();
  const ids = pathwayIds.filter(Boolean);
  if (!ids.length) return out;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_super_release_applications")
    .select(APP_SELECT)
    .eq("tenant_id", tenantId.trim())
    .in("payment_pathway_id", ids)
    .not("application_status", "in", '("funds_released","cancelled")')
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);

  const rows = await enrichApplications(tenantId, (data ?? []).map((r) => mapAppRow(r as Record<string, unknown>)));
  for (const row of rows) {
    if (!out.has(row.payment_pathway_id)) out.set(row.payment_pathway_id, row);
  }
  return out;
}
