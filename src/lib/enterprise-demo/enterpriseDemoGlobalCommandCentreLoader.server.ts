import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  isInvoiceOpenForCollection,
  type FiInvoiceStatus,
} from "@/src/lib/revenueOs/revenueInvoiceModel";

import { ENTERPRISE_DEMO_CLINICS, ENTERPRISE_DEMO_CODE_NAME } from "./enterpriseDemoConstants";
import {
  aggregateClinicRows,
  aggregateNetworkKpis,
  aggregateOutcomeSnapshot,
  aggregateSurgicalSnapshot,
  buildClinicRiskTable,
  buildEnterpriseDemoGlobalCommandCentreAlerts,
  isDateInWeek,
  type GlobalCommandCentreAlert,
  type GlobalCommandCentreClinicRiskRow,
  type GlobalCommandCentreNetworkKpis,
  type GlobalCommandCentreOutcomeSnapshot,
  type GlobalCommandCentreRawCaseRiskRow,
  type GlobalCommandCentreRawFinancialRow,
  type GlobalCommandCentreRawOutcomeRow,
  type GlobalCommandCentreRawProtocolRow,
  type GlobalCommandCentreRawSurgeryRow,
  type GlobalCommandCentreSurgicalSnapshot,
} from "./enterpriseDemoGlobalCommandCentreModel";
import { resolveEnterpriseDemoTenant } from "./enterpriseDemoTenantAccess.server";

export type GlobalCommandCentrePayload = {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  codename: typeof ENTERPRISE_DEMO_CODE_NAME;
  generatedAt: string;
  todayYmd: string;
  networkKpis: GlobalCommandCentreNetworkKpis;
  clinicRiskRows: GlobalCommandCentreClinicRiskRow[];
  alerts: GlobalCommandCentreAlert[];
  surgicalSnapshot: GlobalCommandCentreSurgicalSnapshot;
  outcomeSnapshot: GlobalCommandCentreOutcomeSnapshot;
  readOnly: true;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function metadataString(metadata: unknown, key: string): string | null {
  const m = asRecord(metadata);
  const value = m?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function metadataNumber(metadata: unknown, key: string): number | null {
  const m = asRecord(metadata);
  const value = m?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function metadataBoolean(metadata: unknown, key: string): boolean {
  const m = asRecord(metadata);
  return m?.[key] === true;
}

function metadataStringArray(metadata: unknown, key: string): string[] {
  const m = asRecord(metadata);
  const value = m?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function nestedDemoRecord(metadata: unknown): Record<string, unknown> | null {
  const progress = asRecord(metadata)?.progress ?? metadata;
  const demo = asRecord(progress)?._demo ?? asRecord(progress)?.demo;
  return asRecord(demo);
}

type ClinicRow = {
  id: string;
  display_name: string | null;
  metadata: unknown;
};

function mapClinicRow(
  row: ClinicRow
): { id: string; slug: string; name: string; city: string; country: string } | null {
  const metadata = asRecord(row.metadata);
  const slug = metadataString(metadata, "slug");
  if (!slug) return null;

  const catalog = ENTERPRISE_DEMO_CLINICS.find((c) => c.slug === slug);
  return {
    id: String(row.id),
    slug,
    name: row.display_name?.trim() || catalog?.name || slug,
    city: catalog?.city ?? metadataString(metadata, "city") ?? "—",
    country: catalog?.country ?? metadataString(metadata, "country") ?? "—",
  };
}

export async function loadGlobalCommandCentrePayload(
  tenantIdOrSlug: string,
  referenceDate: Date = new Date()
): Promise<GlobalCommandCentrePayload> {
  const tenant = await resolveEnterpriseDemoTenant(tenantIdOrSlug);
  if (!tenant) {
    throw new Error("Tenant not found");
  }

  const tid = tenant.tenantId;
  const supabase = supabaseAdmin();
  const todayYmd = referenceDate.toISOString().slice(0, 10);

  const { data: clinicRaw, error: clinicErr } = await supabase
    .from("fi_clinics")
    .select("id, display_name, metadata")
    .eq("tenant_id", tid);
  if (clinicErr) throw new Error(clinicErr.message);

  const clinics = (clinicRaw ?? [])
    .map((row) => mapClinicRow(row as ClinicRow))
    .filter((row): row is NonNullable<typeof row> => row != null);

  const clinicSlugById = new Map(clinics.map((c) => [c.id, c.slug]));

  const { data: invoiceRaw, error: invoiceErr } = await supabase
    .from("fi_invoices")
    .select("clinic_id, total_cents, amount_paid_cents, status, currency, metadata")
    .eq("tenant_id", tid)
    .limit(5000);
  if (invoiceErr) throw new Error(invoiceErr.message);

  const financialRows: GlobalCommandCentreRawFinancialRow[] = [];
  let currency = "USD";
  for (const row of invoiceRaw ?? []) {
    const raw = row as {
      clinic_id: string | null;
      total_cents: number | null;
      amount_paid_cents: number | null;
      status: string;
      currency: string | null;
      metadata: unknown;
    };
    const metadata = asRecord(raw.metadata);
    if (metadata?.enterprise_demo !== true && metadata?.enterprise_demo_invoice !== true) continue;

    const clinicSlug =
      metadataString(metadata, "demo_clinic_slug") ??
      (raw.clinic_id ? (clinicSlugById.get(String(raw.clinic_id)) ?? null) : null);
    const status = String(raw.status ?? "");
    currency = raw.currency?.trim().toUpperCase() || currency;

    financialRows.push({
      clinicSlug,
      totalCents: Number(raw.total_cents ?? 0),
      amountPaidCents: Number(raw.amount_paid_cents ?? 0),
      status,
      isOpen: isInvoiceOpenForCollection(status as FiInvoiceStatus),
    });
  }

  const { data: caseRaw, error: caseErr } = await supabase
    .from("fi_cases")
    .select("id, metadata")
    .eq("tenant_id", tid)
    .limit(5000);
  if (caseErr) throw new Error(caseErr.message);

  const caseClinicSlugById = new Map<string, string>();
  const caseRiskRows: GlobalCommandCentreRawCaseRiskRow[] = [];
  for (const row of caseRaw ?? []) {
    const raw = row as { id: string; metadata: unknown };
    const metadata = asRecord(raw.metadata);
    const clinicSlug = metadataString(metadata, "demo_clinic_slug");
    if (clinicSlug) caseClinicSlugById.set(String(raw.id), clinicSlug);

    if (!metadata?.enterprise_demo_franchise_risk && !metadata?.enterprise_demo_case) continue;
    if (metadata.franchise_risk_score == null && !metadata.enterprise_demo_franchise_risk) continue;

    caseRiskRows.push({
      clinicSlug,
      franchiseRiskScore: Number(metadata.franchise_risk_score ?? 0),
      revenueVarianceFlag: metadataBoolean(metadata, "revenue_variance_flag"),
      inventoryToGraftVarianceFlag: metadataBoolean(metadata, "inventory_to_graft_variance_flag"),
      paymentReconciliationStatus: metadataString(metadata, "payment_reconciliation_status"),
      riskReasonCodes: metadataStringArray(metadata, "risk_reason_codes"),
    });
  }

  const { data: protocolRaw, error: protocolErr } = await supabase
    .from("fi_imaging_protocol_sessions")
    .select("progress, case_id")
    .eq("tenant_id", tid)
    .limit(5000);
  if (protocolErr) throw new Error(protocolErr.message);

  const protocolRows: GlobalCommandCentreRawProtocolRow[] = [];
  for (const row of protocolRaw ?? []) {
    const raw = row as { progress: unknown; case_id: string | null };
    const demo = nestedDemoRecord(raw.progress);
    if (!demo?.enterprise_demo_protocol_session && !demo?.demo_protocol_session_key) continue;

    protocolRows.push({
      clinicSlug:
        metadataString(demo, "demo_clinic_slug") ??
        (raw.case_id ? (caseClinicSlugById.get(String(raw.case_id)) ?? null) : null),
      protocolCompletionStatus: metadataString(demo, "protocol_completion_status"),
      missingSlots: metadataStringArray(demo, "missing_slots"),
      qualityFlaggedSlots: metadataStringArray(demo, "quality_flagged_slots"),
    });
  }

  const { data: surgeryRaw, error: surgeryErr } = await supabase
    .from("fi_surgeries")
    .select("id, clinic_id, scheduled_date, metadata")
    .eq("tenant_id", tid)
    .limit(5000);
  if (surgeryErr) throw new Error(surgeryErr.message);

  const surgeryIdToRow = new Map<string, GlobalCommandCentreRawSurgeryRow>();
  const surgeryRows: GlobalCommandCentreRawSurgeryRow[] = [];
  const surgeryIds: string[] = [];

  for (const row of surgeryRaw ?? []) {
    const raw = row as {
      id: string;
      clinic_id: string | null;
      scheduled_date: string;
      metadata: unknown;
    };
    const metadata = asRecord(raw.metadata);
    if (metadata?.enterprise_demo_surgery !== true && metadata?.enterprise_demo !== true) continue;

    const scheduledDate = String(raw.scheduled_date ?? "").slice(0, 10);
    const surgeryId = String(raw.id);
    surgeryIds.push(surgeryId);

    const mapped: GlobalCommandCentreRawSurgeryRow = {
      clinicSlug:
        metadataString(metadata, "demo_clinic_slug") ??
        (raw.clinic_id ? (clinicSlugById.get(String(raw.clinic_id)) ?? null) : null),
      scheduledDate,
      transectionRatePercent: metadataNumber(metadata, "transection_rate_percent"),
      performanceProfile: metadataString(metadata, "performance_profile"),
      reconciliationStatus: null,
      isToday: scheduledDate === todayYmd,
      isThisWeek: isDateInWeek(scheduledDate, todayYmd),
    };
    surgeryRows.push(mapped);
    surgeryIdToRow.set(surgeryId, mapped);
  }

  const graftTotals = {
    extracted: 0,
    implanted: 0,
    totalHairs: 0,
    transectionRates: [] as number[],
    reconciliationCompleted: 0,
    reconciliationPending: 0,
    reconciliationMismatch: 0,
  };

  if (surgeryIds.length > 0) {
    const { data: graftRaw, error: graftErr } = await supabase
      .from("fi_surgery_graft_sessions")
      .select("surgery_id, extracted_grafts, implanted_grafts, total_hairs, reconciliation_status")
      .eq("tenant_id", tid)
      .in("surgery_id", surgeryIds);
    if (graftErr) throw new Error(graftErr.message);

    for (const row of graftRaw ?? []) {
      const raw = row as {
        surgery_id: string;
        extracted_grafts: number | null;
        implanted_grafts: number | null;
        total_hairs: number | null;
        reconciliation_status: string | null;
      };
      graftTotals.extracted += Number(raw.extracted_grafts ?? 0);
      graftTotals.implanted += Number(raw.implanted_grafts ?? 0);
      graftTotals.totalHairs += Number(raw.total_hairs ?? 0);

      const status = String(raw.reconciliation_status ?? "pending");
      const surgeryRow = surgeryIdToRow.get(String(raw.surgery_id));
      if (surgeryRow) surgeryRow.reconciliationStatus = status;

      if (status === "completed" || status === "balanced") graftTotals.reconciliationCompleted += 1;
      else if (status === "mismatch") graftTotals.reconciliationMismatch += 1;
      else graftTotals.reconciliationPending += 1;
    }
  }

  for (const surgery of surgeryRows) {
    if (surgery.transectionRatePercent != null) {
      graftTotals.transectionRates.push(surgery.transectionRatePercent);
    }
  }

  const { data: outcomeRaw, error: outcomeErr } = await supabase
    .from("fi_patient_outcome_measurements")
    .select("metric_values, metadata")
    .eq("tenant_id", tid)
    .limit(5000);
  if (outcomeErr) throw new Error(outcomeErr.message);

  const outcomeRows: GlobalCommandCentreRawOutcomeRow[] = [];
  for (const row of outcomeRaw ?? []) {
    const raw = row as { metric_values: unknown; metadata: unknown };
    const metadata = asRecord(raw.metadata);
    if (metadata?.enterprise_demo_audit !== true && metadata?.enterprise_demo !== true) continue;

    const metrics = asRecord(raw.metric_values);
    outcomeRows.push({
      clinicSlug: metadataString(metadata, "demo_clinic_slug"),
      graftSurvivalEstimate: metadataNumber(metrics, "graft_survival_estimate"),
      donorRecoveryScore: metadataNumber(metrics, "donor_recovery_score"),
      satisfactionScore: metadataNumber(metrics, "patient_satisfaction_score"),
      auditStatus: metadataString(metadata, "audit_status"),
      warnings: metadataStringArray(metadata, "warnings"),
    });
  }

  const clinicAggregates = aggregateClinicRows(
    clinics,
    financialRows,
    caseRiskRows,
    protocolRows,
    surgeryRows,
    outcomeRows
  );
  const clinicRiskRows = buildClinicRiskTable(clinicAggregates);

  const networkKpis = aggregateNetworkKpis({
    activeClinics: clinics.length,
    surgeryRows,
    caseRiskRows,
    protocolRows,
    outcomeRows,
    financialRows,
    currency,
  });

  return {
    tenantId: tid,
    tenantSlug: tenant.tenantSlug,
    tenantName: tenant.tenantName,
    codename: ENTERPRISE_DEMO_CODE_NAME,
    generatedAt: referenceDate.toISOString(),
    todayYmd,
    networkKpis,
    clinicRiskRows,
    alerts: buildEnterpriseDemoGlobalCommandCentreAlerts(referenceDate, clinicRiskRows),
    surgicalSnapshot: aggregateSurgicalSnapshot(graftTotals),
    outcomeSnapshot: aggregateOutcomeSnapshot(outcomeRows),
    readOnly: true,
  };
}
