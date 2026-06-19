import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  aggregateRevenueAttributionDashboard,
  buildRevenueAttributionEvent,
  calculateAttributedRevenue,
  FI_REVENUE_ATTRIBUTION_SOURCES,
  type FiRevenueAttributionConfidence,
  type FiRevenueAttributionEventRow,
  type FiRevenueAttributionManualOverrideRow,
  type FiRevenueAttributionSource,
  type RevenueAttributionDashboardFilters,
  type RevenueAttributionDashboardPayload,
  type RevenueAttributionEventSummary,
} from "@/src/lib/financialOs/financialRevenueAttributionCore";
import type { FiFinancialTransactionRow } from "@/src/lib/financialOs/financialTransactionCore";
import type { FiInvoiceRow } from "@/src/lib/revenueOs/revenueInvoiceModel";

export type {
  FiRevenueAttributionConfidence,
  FiRevenueAttributionEventRow,
  FiRevenueAttributionManualOverrideRow,
  FiRevenueAttributionSource,
  RevenueAttributionDashboardFilters,
  RevenueAttributionDashboardPayload,
};
export { FI_REVENUE_ATTRIBUTION_SOURCES };

function mapOverrideRow(raw: Record<string, unknown>): FiRevenueAttributionManualOverrideRow {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    case_id: String(raw.case_id),
    attribution_source:
      raw.attribution_source != null
        ? (String(raw.attribution_source) as FiRevenueAttributionManualOverrideRow["attribution_source"])
        : null,
    campaign_name: raw.campaign_name != null ? String(raw.campaign_name) : null,
    campaign_id: raw.campaign_id != null ? String(raw.campaign_id) : null,
    consultant_fi_user_id: raw.consultant_fi_user_id != null ? String(raw.consultant_fi_user_id) : null,
    updated_by_fi_user_id: raw.updated_by_fi_user_id != null ? String(raw.updated_by_fi_user_id) : null,
    updated_at: String(raw.updated_at ?? ""),
  };
}

export function mapRevenueAttributionEventRow(raw: Record<string, unknown>): FiRevenueAttributionEventRow {
  const sourceMetadata =
    raw.source_metadata && typeof raw.source_metadata === "object" && !Array.isArray(raw.source_metadata)
      ? (raw.source_metadata as Record<string, unknown>)
      : {};
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    patient_id: raw.patient_id != null ? String(raw.patient_id) : null,
    lead_id: raw.lead_id != null ? String(raw.lead_id) : null,
    case_id: raw.case_id != null ? String(raw.case_id) : null,
    consultation_id: raw.consultation_id != null ? String(raw.consultation_id) : null,
    surgery_id: raw.surgery_id != null ? String(raw.surgery_id) : null,
    invoice_id: raw.invoice_id != null ? String(raw.invoice_id) : null,
    payment_id: raw.payment_id != null ? String(raw.payment_id) : null,
    transaction_id: raw.transaction_id != null ? String(raw.transaction_id) : null,
    attribution_source: String(raw.attribution_source ?? "unknown") as FiRevenueAttributionEventRow["attribution_source"],
    campaign_name: raw.campaign_name != null ? String(raw.campaign_name) : null,
    campaign_id: raw.campaign_id != null ? String(raw.campaign_id) : null,
    ad_group: raw.ad_group != null ? String(raw.ad_group) : null,
    keyword: raw.keyword != null ? String(raw.keyword) : null,
    referral_contact_id: raw.referral_contact_id != null ? String(raw.referral_contact_id) : null,
    consultant_fi_user_id: raw.consultant_fi_user_id != null ? String(raw.consultant_fi_user_id) : null,
    clinic_id: raw.clinic_id != null ? String(raw.clinic_id) : null,
    attributed_revenue_cents: Number(raw.attributed_revenue_cents ?? 0),
    attributed_collected_cents: Number(raw.attributed_collected_cents ?? 0),
    gross_profit_cents: raw.gross_profit_cents != null ? Number(raw.gross_profit_cents) : null,
    attribution_confidence: String(raw.attribution_confidence ?? "inferred") as FiRevenueAttributionEventRow["attribution_confidence"],
    source_metadata: sourceMetadata,
    idempotency_key: raw.idempotency_key != null ? String(raw.idempotency_key) : null,
    occurred_at: String(raw.occurred_at ?? ""),
    created_at: String(raw.created_at ?? ""),
  };
}

type AttributionContextBundle = {
  leadMetadata: Record<string, unknown>;
  leadSourceSystems: string[];
  leadClinicId: string | null;
  leadPrimaryOwnerUserId: string | null;
  patientMetadata: Record<string, unknown>;
  patientSourceSystems: string[];
  consultationSource: string | null;
  consultationMetadata: Record<string, unknown>;
  consultationOwnerFiUserId: string | null;
  consultationStaffFiUserId: string | null;
  quoteCreatorFiUserId: string | null;
  caseClinicId: string | null;
  caseOwnerFiUserId: string | null;
  manualOverride: FiRevenueAttributionManualOverrideRow | null;
  resolvedLeadId: string | null;
  resolvedConsultationId: string | null;
  resolvedPatientId: string | null;
};

async function loadManualOverride(
  tenantId: string,
  caseId: string | null,
  client: SupabaseClient
): Promise<FiRevenueAttributionManualOverrideRow | null> {
  if (!caseId?.trim()) return null;
  const { data, error } = await client
    .from("fi_revenue_attribution_overrides")
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .eq("case_id", caseId.trim())
    .maybeSingle();
  if (error || !data) return null;
  return mapOverrideRow(data as Record<string, unknown>);
}

async function loadAttributionContextForAnchors(args: {
  tenantId: string;
  patientId?: string | null;
  leadId?: string | null;
  caseId?: string | null;
  consultationId?: string | null;
  client?: SupabaseClient;
}): Promise<AttributionContextBundle> {
  const tid = args.tenantId.trim();
  const supabase = args.client ?? supabaseAdmin();

  let leadId = args.leadId?.trim() || null;
  let caseId = args.caseId?.trim() || null;
  let consultationId = args.consultationId?.trim() || null;
  let patientId = args.patientId?.trim() || null;

  let leadMetadata: Record<string, unknown> = {};
  let leadSourceSystems: string[] = [];
  let leadClinicId: string | null = null;
  let leadPrimaryOwnerUserId: string | null = null;
  let caseClinicId: string | null = null;
  let caseOwnerFiUserId: string | null = null;
  let consultationSource: string | null = null;
  let consultationMetadata: Record<string, unknown> = {};
  let consultationOwnerFiUserId: string | null = null;
  let consultationStaffFiUserId: string | null = null;
  let quoteCreatorFiUserId: string | null = null;
  let patientMetadata: Record<string, unknown> = {};
  let patientSourceSystems: string[] = [];

  if (caseId) {
    const { data: caseRow } = await supabase
      .from("fi_cases")
      .select("patient_id, clinic_id, created_by")
      .eq("tenant_id", tid)
      .eq("id", caseId)
      .maybeSingle();
    if (caseRow) {
      const c = caseRow as Record<string, unknown>;
      patientId = patientId ?? (c.patient_id != null ? String(c.patient_id) : null);
      caseClinicId = c.clinic_id != null ? String(c.clinic_id) : null;
      caseOwnerFiUserId = c.created_by != null ? String(c.created_by) : null;
    }
  }

  if (leadId) {
    const [{ data: leadRow }, { data: sourceRows }] = await Promise.all([
      supabase
        .from("fi_crm_leads")
        .select("metadata, clinic_id, primary_owner_user_id, patient_id")
        .eq("tenant_id", tid)
        .eq("id", leadId)
        .maybeSingle(),
      supabase.from("fi_crm_lead_source_ids").select("source_system").eq("tenant_id", tid).eq("lead_id", leadId),
    ]);
    if (leadRow) {
      const l = leadRow as Record<string, unknown>;
      leadMetadata =
        l.metadata && typeof l.metadata === "object" && !Array.isArray(l.metadata)
          ? (l.metadata as Record<string, unknown>)
          : {};
      leadClinicId = l.clinic_id != null ? String(l.clinic_id) : null;
      leadPrimaryOwnerUserId = l.primary_owner_user_id != null ? String(l.primary_owner_user_id) : null;
      patientId = patientId ?? (l.patient_id != null ? String(l.patient_id) : null);
    }
    leadSourceSystems = (sourceRows ?? [])
      .map((r) => String((r as { source_system?: string }).source_system ?? "").trim())
      .filter(Boolean);
  }

  if (!consultationId && caseId) {
    const { data: consultRow } = await supabase
      .from("fi_consultations")
      .select("id")
      .eq("tenant_id", tid)
      .eq("case_id", caseId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (consultRow) consultationId = String((consultRow as { id: string }).id);
  }

  if (!consultationId && leadId) {
    const { data: consultRow } = await supabase
      .from("fi_consultations")
      .select("id")
      .eq("tenant_id", tid)
      .eq("lead_id", leadId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (consultRow) consultationId = String((consultRow as { id: string }).id);
  }

  if (consultationId) {
    const { data: consult } = await supabase
      .from("fi_consultations")
      .select("structured_data, quote_data, created_by, consultant_staff_id, lead_id")
      .eq("tenant_id", tid)
      .eq("id", consultationId)
      .maybeSingle();
    if (consult) {
      const c = consult as Record<string, unknown>;
      leadId = leadId ?? (c.lead_id != null ? String(c.lead_id) : null);
      const structured =
        c.structured_data && typeof c.structured_data === "object" && !Array.isArray(c.structured_data)
          ? (c.structured_data as Record<string, unknown>)
          : {};
      const quote =
        c.quote_data && typeof c.quote_data === "object" && !Array.isArray(c.quote_data)
          ? (c.quote_data as Record<string, unknown>)
          : {};
      consultationMetadata = { ...structured, ...quote };
      consultationSource =
        typeof structured.source === "string"
          ? structured.source
          : typeof structured.lead_source === "string"
            ? structured.lead_source
            : null;
      consultationOwnerFiUserId = c.created_by != null ? String(c.created_by) : null;
      const staffId = c.consultant_staff_id != null ? String(c.consultant_staff_id) : null;
      if (staffId) {
        const { data: staff } = await supabase
          .from("fi_staff")
          .select("fi_user_id")
          .eq("tenant_id", tid)
          .eq("id", staffId)
          .maybeSingle();
        consultationStaffFiUserId =
          staff && (staff as { fi_user_id?: string | null }).fi_user_id
            ? String((staff as { fi_user_id: string }).fi_user_id)
            : null;
      }
    }

    const { data: quoteRow } = await supabase
      .from("fi_crm_quotes")
      .select("metadata")
      .eq("tenant_id", tid)
      .eq("consultation_id", consultationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (quoteRow) {
      const meta =
        (quoteRow as { metadata?: unknown }).metadata &&
        typeof (quoteRow as { metadata?: unknown }).metadata === "object" &&
        !Array.isArray((quoteRow as { metadata?: unknown }).metadata)
          ? ((quoteRow as { metadata: Record<string, unknown> }).metadata as Record<string, unknown>)
          : {};
      const creator = meta.created_by_fi_user_id ?? meta.quote_creator_fi_user_id ?? meta.owner_fi_user_id;
      if (typeof creator === "string" && creator.trim()) quoteCreatorFiUserId = creator.trim();
    }
  }

  if (patientId) {
    const [{ data: patientRow }, { data: patientSources }] = await Promise.all([
      supabase.from("fi_patients").select("metadata").eq("tenant_id", tid).eq("id", patientId).maybeSingle(),
      supabase.from("fi_patient_source_ids").select("source_system").eq("tenant_id", tid).eq("patient_id", patientId),
    ]);
    if (patientRow) {
      const p = patientRow as Record<string, unknown>;
      patientMetadata =
        p.metadata && typeof p.metadata === "object" && !Array.isArray(p.metadata)
          ? (p.metadata as Record<string, unknown>)
          : {};
    }
    patientSourceSystems = (patientSources ?? [])
      .map((r) => String((r as { source_system?: string }).source_system ?? "").trim())
      .filter(Boolean);
  }

  const manualOverride = await loadManualOverride(tid, caseId, supabase);

  return {
    leadMetadata,
    leadSourceSystems,
    leadClinicId,
    leadPrimaryOwnerUserId,
    patientMetadata,
    patientSourceSystems,
    consultationSource,
    consultationMetadata,
    consultationOwnerFiUserId,
    consultationStaffFiUserId,
    quoteCreatorFiUserId,
    caseClinicId,
    caseOwnerFiUserId,
    manualOverride,
    resolvedLeadId: leadId,
    resolvedConsultationId: consultationId,
    resolvedPatientId: patientId,
  };
}

function buildEventFromContext(
  ctx: AttributionContextBundle,
  args: {
    tenantId: string;
    patientId?: string | null;
    leadId?: string | null;
    caseId?: string | null;
    consultationId?: string | null;
    surgeryId?: string | null;
    invoiceId?: string | null;
    paymentId?: string | null;
    transactionId?: string | null;
    invoiceClinicId?: string | null;
    amounts: ReturnType<typeof calculateAttributedRevenue>;
    triggerSource: string;
    idempotencyKey?: string | null;
    occurredAt?: string;
    invoiceTotalCents?: number | null;
    procedureType?: string | null;
  }
) {
  const override = ctx.manualOverride;
  return buildRevenueAttributionEvent({
    tenant_id: args.tenantId,
    patient_id: args.patientId ?? ctx.resolvedPatientId,
    lead_id: args.leadId ?? ctx.resolvedLeadId,
    case_id: args.caseId ?? null,
    consultation_id: args.consultationId ?? ctx.resolvedConsultationId,
    surgery_id: args.surgeryId ?? null,
    invoice_id: args.invoiceId ?? null,
    payment_id: args.paymentId ?? null,
    transaction_id: args.transactionId ?? null,
    lead_context: {
      lead_id: args.leadId ?? ctx.resolvedLeadId,
      lead_metadata: ctx.leadMetadata,
      lead_source_systems: ctx.leadSourceSystems,
      lead_clinic_id: ctx.leadClinicId,
      lead_primary_owner_user_id: ctx.leadPrimaryOwnerUserId,
      patient_metadata: ctx.patientMetadata,
      patient_source_systems: ctx.patientSourceSystems,
      consultation_source: ctx.consultationSource,
      consultation_metadata: ctx.consultationMetadata,
      manual_override: override
        ? {
            attribution_source: override.attribution_source,
            campaign_name: override.campaign_name,
            campaign_id: override.campaign_id,
            consultant_fi_user_id: override.consultant_fi_user_id,
          }
        : null,
    },
    consultant_context: {
      manual_consultant_fi_user_id: override?.consultant_fi_user_id ?? null,
      lead_primary_owner_user_id: ctx.leadPrimaryOwnerUserId,
      consultation_owner_fi_user_id: ctx.consultationOwnerFiUserId,
      consultation_staff_fi_user_id: ctx.consultationStaffFiUserId,
      quote_creator_fi_user_id: ctx.quoteCreatorFiUserId,
      case_owner_fi_user_id: ctx.caseOwnerFiUserId,
    },
    clinic_context: {
      invoice_clinic_id: args.invoiceClinicId ?? null,
      case_clinic_id: ctx.caseClinicId,
      lead_clinic_id: ctx.leadClinicId,
    },
    campaign_context: {
      lead_metadata: ctx.leadMetadata,
      consultation_metadata: ctx.consultationMetadata,
      manual_campaign_name: override?.campaign_name ?? null,
      manual_campaign_id: override?.campaign_id ?? null,
    },
    amounts: args.amounts,
    trigger_source: args.triggerSource,
    idempotency_key: args.idempotencyKey,
    occurred_at: args.occurredAt,
    invoice_total_cents: args.invoiceTotalCents,
    procedure_type: args.procedureType,
  });
}

async function persistRevenueAttributionEvent(
  draft: ReturnType<typeof buildRevenueAttributionEvent>
): Promise<FiRevenueAttributionEventRow | null> {
  const supabase = supabaseAdmin();
  const tid = draft.tenant_id.trim();

  if (draft.idempotency_key) {
    const { data: existing } = await supabase
      .from("fi_revenue_attribution_events")
      .select("*")
      .eq("tenant_id", tid)
      .eq("idempotency_key", draft.idempotency_key)
      .maybeSingle();
    if (existing) return mapRevenueAttributionEventRow(existing as Record<string, unknown>);
  }

  const insert = {
    tenant_id: tid,
    patient_id: draft.patient_id,
    lead_id: draft.lead_id,
    case_id: draft.case_id,
    consultation_id: draft.consultation_id,
    surgery_id: draft.surgery_id,
    invoice_id: draft.invoice_id,
    payment_id: draft.payment_id,
    transaction_id: draft.transaction_id,
    attribution_source: draft.attribution_source,
    campaign_name: draft.campaign_name,
    campaign_id: draft.campaign_id,
    ad_group: draft.ad_group,
    keyword: draft.keyword,
    referral_contact_id: draft.referral_contact_id,
    consultant_fi_user_id: draft.consultant_fi_user_id,
    clinic_id: draft.clinic_id,
    attributed_revenue_cents: draft.attributed_revenue_cents,
    attributed_collected_cents: draft.attributed_collected_cents,
    gross_profit_cents: draft.gross_profit_cents,
    attribution_confidence: draft.attribution_confidence,
    source_metadata: draft.source_metadata,
    idempotency_key: draft.idempotency_key,
    occurred_at: draft.occurred_at,
  };

  const { data, error } = await supabase.from("fi_revenue_attribution_events").insert(insert).select("*").single();
  if (error) {
    if (draft.idempotency_key && error.code === "23505") {
      const { data: dup } = await supabase
        .from("fi_revenue_attribution_events")
        .select("*")
        .eq("tenant_id", tid)
        .eq("idempotency_key", draft.idempotency_key)
        .maybeSingle();
      if (dup) return mapRevenueAttributionEventRow(dup as Record<string, unknown>);
    }
    throw new Error(error.message);
  }

  const row = mapRevenueAttributionEventRow(data as Record<string, unknown>);

  try {
    await supabase.from("fi_financial_transaction_audit_events").insert({
      tenant_id: tid,
      financial_transaction_id: row.transaction_id,
      event_kind: "revenue_attribution_recorded",
      payload: {
        attribution_event_id: row.id,
        attribution_source: row.attribution_source,
        attributed_collected_cents: row.attributed_collected_cents,
        idempotency_key: row.idempotency_key,
      },
    });
  } catch {
    /* audit best-effort */
  }

  return row;
}

export async function triggerRevenueAttributionOnPaymentReceived(args: {
  tenantId: string;
  invoice: FiInvoiceRow;
  paymentId: string;
  amountCents: number;
  transaction?: FiFinancialTransactionRow | null;
}): Promise<FiRevenueAttributionEventRow | null> {
  const tid = args.tenantId.trim();
  if (!tid || args.amountCents <= 0) return null;

  try {
    const ctx = await loadAttributionContextForAnchors({
      tenantId: tid,
      patientId: args.invoice.patient_id,
      leadId: args.invoice.lead_id,
      caseId: args.invoice.case_id,
      consultationId: args.invoice.consultation_id,
    });

    const draft = buildEventFromContext(ctx, {
      tenantId: tid,
      patientId: args.invoice.patient_id,
      leadId: args.invoice.lead_id,
      caseId: args.invoice.case_id,
      consultationId: args.invoice.consultation_id,
      invoiceId: args.invoice.id,
      paymentId: args.paymentId,
      transactionId: args.transaction?.id ?? null,
      invoiceClinicId: args.invoice.clinic_id,
      amounts: calculateAttributedRevenue({ payment_amount_cents: args.amountCents }),
      triggerSource: "payment_received",
      idempotencyKey: `payment:${args.paymentId}`,
      occurredAt: args.transaction?.created_at ?? new Date().toISOString(),
      invoiceTotalCents: args.invoice.total_cents,
    });

    return await persistRevenueAttributionEvent(draft);
  } catch {
    return null;
  }
}

export async function triggerRevenueAttributionOnInvoicePaid(args: {
  tenantId: string;
  invoice: FiInvoiceRow;
}): Promise<FiRevenueAttributionEventRow | null> {
  const tid = args.tenantId.trim();
  const inv = args.invoice;
  if (!tid || inv.total_cents <= 0) return null;

  try {
    const ctx = await loadAttributionContextForAnchors({
      tenantId: tid,
      patientId: inv.patient_id,
      leadId: inv.lead_id,
      caseId: inv.case_id,
      consultationId: inv.consultation_id,
    });

    const draft = buildEventFromContext(ctx, {
      tenantId: tid,
      patientId: inv.patient_id,
      leadId: inv.lead_id,
      caseId: inv.case_id,
      consultationId: inv.consultation_id,
      invoiceId: inv.id,
      invoiceClinicId: inv.clinic_id,
      amounts: calculateAttributedRevenue({
        invoice_total_cents: inv.total_cents,
        collected_cents: inv.amount_paid_cents,
      }),
      triggerSource: "invoice_paid",
      idempotencyKey: `invoice_paid:${inv.id}`,
      occurredAt: inv.paid_at ?? new Date().toISOString(),
      invoiceTotalCents: inv.total_cents,
    });

    return await persistRevenueAttributionEvent(draft);
  } catch {
    return null;
  }
}

export async function triggerRevenueAttributionOnSurgerySnapshot(args: {
  tenantId: string;
  caseId: string;
  surgeryId?: string | null;
  patientId?: string | null;
  invoiceId?: string | null;
  snapshotId: string;
  revenueCents: number;
  collectedCents: number;
  grossProfitCents: number;
  procedureType: string;
}): Promise<FiRevenueAttributionEventRow | null> {
  const tid = args.tenantId.trim();
  if (!tid) return null;

  try {
    const ctx = await loadAttributionContextForAnchors({
      tenantId: tid,
      caseId: args.caseId,
      patientId: args.patientId ?? null,
    });

    const draft = buildEventFromContext(ctx, {
      tenantId: tid,
      caseId: args.caseId,
      surgeryId: args.surgeryId ?? null,
      patientId: args.patientId ?? ctx.resolvedPatientId,
      invoiceId: args.invoiceId ?? null,
      amounts: calculateAttributedRevenue({
        invoice_total_cents: args.revenueCents,
        collected_cents: args.collectedCents,
        gross_profit_cents: args.grossProfitCents,
      }),
      triggerSource: "surgery_profitability_snapshot",
      idempotencyKey: `snapshot:${args.snapshotId}`,
      procedureType: args.procedureType,
    });

    return await persistRevenueAttributionEvent(draft);
  } catch {
    return null;
  }
}

export async function triggerManualRevenueAttributionRecalculation(args: {
  tenantId: string;
  caseId: string;
  actorFiUserId?: string | null;
}): Promise<FiRevenueAttributionEventRow | null> {
  const tid = args.tenantId.trim();
  const cid = args.caseId.trim();
  if (!tid || !cid) return null;

  try {
    const ctx = await loadAttributionContextForAnchors({ tenantId: tid, caseId: cid });
    const draft = buildEventFromContext(ctx, {
      tenantId: tid,
      caseId: cid,
      patientId: ctx.resolvedPatientId,
      leadId: ctx.resolvedLeadId,
      consultationId: ctx.resolvedConsultationId,
      amounts: calculateAttributedRevenue({ payment_amount_cents: 0 }),
      triggerSource: "manual_recalculation",
      idempotencyKey: `manual_recalc:${cid}:${Date.now()}`,
    });
    draft.source_metadata = {
      ...draft.source_metadata,
      actor_fi_user_id: args.actorFiUserId ?? null,
      manual_recalculation: true,
    };

    return await persistRevenueAttributionEvent(draft);
  } catch {
    return null;
  }
}

export async function upsertRevenueAttributionOverride(args: {
  tenantId: string;
  caseId: string;
  attributionSource?: string | null;
  campaignName?: string | null;
  campaignId?: string | null;
  consultantFiUserId?: string | null;
  updatedByFiUserId?: string | null;
}): Promise<FiRevenueAttributionManualOverrideRow> {
  const tid = args.tenantId.trim();
  const cid = args.caseId.trim();
  const supabase = supabaseAdmin();

  const payload = {
    tenant_id: tid,
    case_id: cid,
    attribution_source: args.attributionSource?.trim() || null,
    campaign_name: args.campaignName?.trim() || null,
    campaign_id: args.campaignId?.trim() || null,
    consultant_fi_user_id: args.consultantFiUserId?.trim() || null,
    updated_by_fi_user_id: args.updatedByFiUserId?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("fi_revenue_attribution_overrides")
    .upsert(payload, { onConflict: "tenant_id,case_id" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapOverrideRow(data as Record<string, unknown>);
}

export async function loadRevenueAttributionOverrideForCase(
  tenantId: string,
  caseId: string
): Promise<FiRevenueAttributionManualOverrideRow | null> {
  return loadManualOverride(tenantId, caseId, supabaseAdmin());
}

function eventToSummary(row: FiRevenueAttributionEventRow): RevenueAttributionEventSummary {
  const procedureType =
    typeof row.source_metadata.procedure_type === "string" ? row.source_metadata.procedure_type : null;
  return {
    id: row.id,
    attribution_source: row.attribution_source,
    campaign_name: row.campaign_name,
    lead_id: row.lead_id,
    consultation_id: row.consultation_id,
    invoice_id: row.invoice_id,
    attributed_collected_cents: row.attributed_collected_cents,
    gross_profit_cents: row.gross_profit_cents,
    attribution_confidence: row.attribution_confidence,
    procedure_type: procedureType,
  };
}

export async function loadRevenueAttributionDashboardPayload(
  tenantId: string,
  filters?: RevenueAttributionDashboardFilters
): Promise<RevenueAttributionDashboardPayload> {
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();

  let q = supabase
    .from("fi_revenue_attribution_events")
    .select("*")
    .eq("tenant_id", tid)
    .order("occurred_at", { ascending: false })
    .limit(2000);

  if (filters?.dateFrom?.trim()) q = q.gte("occurred_at", `${filters.dateFrom.trim()}T00:00:00.000Z`);
  if (filters?.dateTo?.trim()) q = q.lte("occurred_at", `${filters.dateTo.trim()}T23:59:59.999Z`);
  if (filters?.source?.trim()) q = q.eq("attribution_source", filters.source.trim());
  if (filters?.campaign?.trim()) q = q.ilike("campaign_name", `%${filters.campaign.trim()}%`);
  if (filters?.consultantFiUserId?.trim()) q = q.eq("consultant_fi_user_id", filters.consultantFiUserId.trim());
  if (filters?.clinicId?.trim()) q = q.eq("clinic_id", filters.clinicId.trim());

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  let rows = (data ?? []).map((r) => mapRevenueAttributionEventRow(r as Record<string, unknown>));

  if (filters?.procedureType?.trim()) {
    const pt = filters.procedureType.trim().toLowerCase();
    rows = rows.filter((r) => {
      const p = r.source_metadata.procedure_type;
      return typeof p === "string" && p.toLowerCase() === pt;
    });
  }

  const summaries = rows.map(eventToSummary);
  const aggregated = aggregateRevenueAttributionDashboard(summaries);

  return {
    tenantId: tid,
    currency: "AUD",
    filters: filters ?? {},
    metrics: aggregated.metrics,
    rows: aggregated.rows,
    recentEvents: rows.slice(0, 20),
  };
}

export async function loadRevenueAttributionFilterOptions(tenantId: string): Promise<{
  sources: string[];
  campaigns: string[];
  consultantOptions: Array<{ value: string; label: string }>;
  clinicOptions: Array<{ value: string; label: string }>;
  procedureTypes: string[];
}> {
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();

  const [{ data: events }, { data: clinics }, { data: consultantRows }] = await Promise.all([
    supabase
      .from("fi_revenue_attribution_events")
      .select("campaign_name, source_metadata, consultant_fi_user_id")
      .eq("tenant_id", tid)
      .order("occurred_at", { ascending: false })
      .limit(500),
    supabase.from("fi_clinics").select("id, name").eq("tenant_id", tid).order("name").limit(50),
    supabase
      .from("fi_revenue_attribution_events")
      .select("consultant_fi_user_id")
      .eq("tenant_id", tid)
      .not("consultant_fi_user_id", "is", null)
      .limit(100),
  ]);

  const campaignSet = new Set<string>();
  const procedureSet = new Set<string>();
  const consultantIds = new Set<string>();
  for (const row of events ?? []) {
    const r = row as Record<string, unknown>;
    const cn = r.campaign_name != null ? String(r.campaign_name).trim() : "";
    if (cn) campaignSet.add(cn);
    const meta =
      r.source_metadata && typeof r.source_metadata === "object" && !Array.isArray(r.source_metadata)
        ? (r.source_metadata as Record<string, unknown>)
        : {};
    const pt = meta.procedure_type;
    if (typeof pt === "string" && pt.trim()) procedureSet.add(pt.trim());
  }
  for (const row of consultantRows ?? []) {
    const id = (row as { consultant_fi_user_id?: string }).consultant_fi_user_id;
    if (id?.trim()) consultantIds.add(id.trim());
  }

  const consultantLabels = new Map<string, string>();
  if (consultantIds.size > 0) {
    const { data: users } = await supabase
      .from("fi_users")
      .select("id, email, display_name")
      .eq("tenant_id", tid)
      .in("id", Array.from(consultantIds));
    for (const u of users ?? []) {
      const row = u as { id: string; email?: string; display_name?: string };
      consultantLabels.set(row.id, row.display_name?.trim() || row.email?.trim() || row.id.slice(0, 8));
    }
  }

  return {
    sources: [...FI_REVENUE_ATTRIBUTION_SOURCES],
    campaigns: Array.from(campaignSet).sort(),
    consultantOptions: Array.from(consultantIds).map((id) => ({
      value: id,
      label: consultantLabels.get(id) ?? id.slice(0, 8),
    })),
    clinicOptions: (clinics ?? []).map((c) => ({
      value: String((c as { id: string }).id),
      label: String((c as { name?: string }).name ?? "Clinic"),
    })),
    procedureTypes: Array.from(procedureSet).sort((a, b) => a.localeCompare(b)),
  };
}
