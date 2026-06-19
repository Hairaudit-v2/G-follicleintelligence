/**
 * FinancialOS Phase 2 — pure surgery economics engine.
 * All monetary maths in integer cents; safe for unit tests without DB.
 */

export const SURGEON_COST_TYPES = ["fixed", "percentage", "per_graft", "per_hour"] as const;
export type SurgeonCostType = (typeof SURGEON_COST_TYPES)[number];

export type FiSurgeryCostModel = {
  id?: string;
  tenant_id: string;
  procedure_type: string;
  surgeon_cost_type: SurgeonCostType;
  surgeon_cost_value_cents: number;
  rn_hourly_rate_cents: number;
  technician_hourly_rate_cents: number;
  assistant_hourly_rate_cents: number;
  room_hourly_cost_cents: number;
  consumables_base_cost_cents: number;
  graft_consumable_cost_cents: number;
  prp_cost_cents: number;
  exosome_cost_cents: number;
  medication_cost_cents: number;
  default_duration_minutes: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  archived_at?: string | null;
  created_by_fi_user_id?: string | null;
};

export type SurgeryProfitabilitySnapshotReadinessStatus = "ready" | "needs_configuration";

export type SurgeryProfitabilitySnapshotReadiness = {
  status: SurgeryProfitabilitySnapshotReadinessStatus;
  ready: boolean;
  reasons: string[];
};

export type SurgeryCompletionContext = {
  procedure_status: string | null;
  surgery_status: string | null;
  surgery_live_status: string | null;
  booking_status: string | null;
  graft_reconciliation_completed: boolean;
};

export type SurgeryProfitabilitySnapshotReadinessInput = {
  tenant_id: string;
  procedure_type: string | null;
  has_active_cost_model: boolean;
  surgery_invoice_count: number;
  revenue_cents: number;
  completion: SurgeryCompletionContext;
};

export type SurgeryEconomicsStaffCounts = {
  rn_count: number;
  technician_count: number;
  assistant_count: number;
};

export type SurgeryEconomicsTreatmentAddons = {
  prp: boolean;
  exosome: boolean;
};

export type SurgeryEconomicsRevenueInput = {
  revenue_cents: number;
  collected_cents: number;
  outstanding_cents: number;
};

export type SurgeryEconomicsCalculationInput = {
  tenant_id: string;
  procedure_type: string;
  cost_model: FiSurgeryCostModel;
  revenue: SurgeryEconomicsRevenueInput;
  duration_minutes: number;
  staff_counts: SurgeryEconomicsStaffCounts;
  treatment_addons: SurgeryEconomicsTreatmentAddons;
  graft_count: number | null;
  hair_count: number | null;
};

export type SurgeryEconomicsCostBreakdown = {
  surgeon_cost_cents: number;
  staff_cost_cents: number;
  room_cost_cents: number;
  consumables_cost_cents: number;
  treatment_addon_cost_cents: number;
  total_cost_cents: number;
};

export type SurgeryEconomicsProfitabilityResult = SurgeryEconomicsCostBreakdown & {
  revenue_cents: number;
  collected_cents: number;
  outstanding_cents: number;
  gross_profit_cents: number;
  gross_margin_percentage: number;
  graft_count: number | null;
  hair_count: number | null;
  revenue_per_graft_cents: number | null;
  cost_per_graft_cents: number | null;
  procedure_type: string;
};

export type SurgeryEconomicsValidationResult =
  | { ok: true }
  | { ok: false; message: string };

type FiniteNonNegativeIntResult = { ok: false; message: string } | { ok: true; value: number };

export type FiSurgeryProfitabilitySnapshotRow = {
  id?: string;
  tenant_id: string;
  case_id: string | null;
  surgery_id: string | null;
  patient_id: string | null;
  invoice_id: string | null;
  procedure_type: string;
  revenue_cents: number;
  collected_cents: number;
  outstanding_cents: number;
  surgeon_cost_cents: number;
  staff_cost_cents: number;
  room_cost_cents: number;
  consumables_cost_cents: number;
  treatment_addon_cost_cents: number;
  total_cost_cents: number;
  gross_profit_cents: number;
  gross_margin_percentage: number;
  graft_count: number | null;
  hair_count: number | null;
  revenue_per_graft_cents: number | null;
  cost_per_graft_cents: number | null;
  source_metadata: Record<string, unknown>;
  calculated_at: string;
};

export const FI_SURGERY_PROFITABILITY_SNAPSHOT_IMMUTABLE = true as const;

function finiteNonNegativeInt(n: unknown, label: string): FiniteNonNegativeIntResult {
  if (!Number.isFinite(n)) return { ok: false, message: `${label} must be a finite number.` };
  const v = Math.floor(Number(n));
  if (v < 0) return { ok: false, message: `${label} cannot be negative.` };
  return { ok: true, value: v };
}

function normalizeProcedureType(procedureType: string): string {
  return procedureType.trim().toLowerCase();
}

/** Duration in fractional hours from minutes (minimum 1 minute). */
export function durationHoursFromMinutes(durationMinutes: number): number {
  const mins = Math.max(1, Math.floor(durationMinutes));
  return mins / 60;
}

/** Hourly rate × duration with cent rounding. */
export function calculateHourlyCostCents(hourlyRateCents: number, durationMinutes: number): number {
  const rate = Math.max(0, Math.floor(hourlyRateCents));
  const hours = durationHoursFromMinutes(durationMinutes);
  return Math.round(rate * hours);
}

export function calculateSurgeonCost(args: {
  surgeon_cost_type: SurgeonCostType;
  surgeon_cost_value_cents: number;
  revenue_cents: number;
  graft_count: number | null;
  duration_minutes: number;
}): number {
  const value = Math.max(0, Math.floor(args.surgeon_cost_value_cents));
  switch (args.surgeon_cost_type) {
    case "fixed":
      return value;
    case "percentage": {
      const revenue = Math.max(0, Math.floor(args.revenue_cents));
      // Basis points: 1500 = 15.00%
      return Math.round((revenue * value) / 10_000);
    }
    case "per_graft": {
      const grafts = args.graft_count != null && args.graft_count > 0 ? Math.floor(args.graft_count) : 0;
      return value * grafts;
    }
    case "per_hour":
      return calculateHourlyCostCents(value, args.duration_minutes);
    default:
      return 0;
  }
}

export function calculateStaffCost(args: {
  rn_hourly_rate_cents: number;
  technician_hourly_rate_cents: number;
  assistant_hourly_rate_cents: number;
  duration_minutes: number;
  staff_counts: SurgeryEconomicsStaffCounts;
}): number {
  const rn = calculateHourlyCostCents(args.rn_hourly_rate_cents, args.duration_minutes) * Math.max(0, Math.floor(args.staff_counts.rn_count));
  const tech =
    calculateHourlyCostCents(args.technician_hourly_rate_cents, args.duration_minutes) *
    Math.max(0, Math.floor(args.staff_counts.technician_count));
  const assistant =
    calculateHourlyCostCents(args.assistant_hourly_rate_cents, args.duration_minutes) *
    Math.max(0, Math.floor(args.staff_counts.assistant_count));
  return rn + tech + assistant;
}

export function calculateRoomCost(args: { room_hourly_cost_cents: number; duration_minutes: number }): number {
  return calculateHourlyCostCents(args.room_hourly_cost_cents, args.duration_minutes);
}

export function calculateConsumablesCost(args: {
  consumables_base_cost_cents: number;
  graft_consumable_cost_cents: number;
  medication_cost_cents: number;
  graft_count: number | null;
}): number {
  const base = Math.max(0, Math.floor(args.consumables_base_cost_cents));
  const perGraft = Math.max(0, Math.floor(args.graft_consumable_cost_cents));
  const medication = Math.max(0, Math.floor(args.medication_cost_cents));
  const grafts = args.graft_count != null && args.graft_count > 0 ? Math.floor(args.graft_count) : 0;
  return base + perGraft * grafts + medication;
}

export function calculateTreatmentAddonCost(args: {
  prp_cost_cents: number;
  exosome_cost_cents: number;
  treatment_addons: SurgeryEconomicsTreatmentAddons;
}): number {
  let total = 0;
  if (args.treatment_addons.prp) total += Math.max(0, Math.floor(args.prp_cost_cents));
  if (args.treatment_addons.exosome) total += Math.max(0, Math.floor(args.exosome_cost_cents));
  return total;
}

export function calculateGrossMarginPercentage(revenueCents: number, grossProfitCents: number): number {
  const revenue = Math.max(0, Math.floor(revenueCents));
  if (revenue <= 0) return 0;
  const profit = Math.floor(grossProfitCents);
  return Math.round((profit / revenue) * 10_000) / 100;
}

export function calculatePerGraftMetrics(args: {
  graft_count: number | null;
  revenue_cents: number;
  total_cost_cents: number;
}): { revenue_per_graft_cents: number | null; cost_per_graft_cents: number | null } {
  const grafts = args.graft_count != null && args.graft_count > 0 ? Math.floor(args.graft_count) : null;
  if (grafts == null || grafts <= 0) {
    return { revenue_per_graft_cents: null, cost_per_graft_cents: null };
  }
  const revenue = Math.max(0, Math.floor(args.revenue_cents));
  const cost = Math.max(0, Math.floor(args.total_cost_cents));
  return {
    revenue_per_graft_cents: Math.round(revenue / grafts),
    cost_per_graft_cents: Math.round(cost / grafts),
  };
}

export function validateSurgeryEconomicsInputs(input: SurgeryEconomicsCalculationInput): SurgeryEconomicsValidationResult {
  const tid = input.tenant_id?.trim();
  if (!tid) return { ok: false, message: "tenant_id is required." };
  if (tid !== input.cost_model.tenant_id.trim()) {
    return { ok: false, message: "cost_model tenant_id must match input tenant_id." };
  }

  const procedureType = input.procedure_type?.trim();
  if (!procedureType) return { ok: false, message: "procedure_type is required." };

  if (!input.cost_model.is_active) return { ok: false, message: "cost_model must be active." };

  const revenueFields: Array<[unknown, string]> = [
    [input.revenue.revenue_cents, "revenue_cents"],
    [input.revenue.collected_cents, "collected_cents"],
    [input.revenue.outstanding_cents, "outstanding_cents"],
  ];
  for (const [val, label] of revenueFields) {
    const r = finiteNonNegativeInt(val, label);
    if (!r.ok) return r;
  }

  const duration = finiteNonNegativeInt(input.duration_minutes, "duration_minutes");
  if (!duration.ok) return duration;
  if (duration.value <= 0) return { ok: false, message: "duration_minutes must be greater than zero." };

  if (input.graft_count != null) {
    const grafts = finiteNonNegativeInt(input.graft_count, "graft_count");
    if (!grafts.ok) return grafts;
  }
  if (input.hair_count != null) {
    const hairs = finiteNonNegativeInt(input.hair_count, "hair_count");
    if (!hairs.ok) return hairs;
  }

  const staffFields: Array<[number, string]> = [
    [input.staff_counts.rn_count, "rn_count"],
    [input.staff_counts.technician_count, "technician_count"],
    [input.staff_counts.assistant_count, "assistant_count"],
  ];
  for (const [val, label] of staffFields) {
    const r = finiteNonNegativeInt(val, label);
    if (!r.ok) return r;
  }

  return { ok: true };
}

export function calculateSurgeryProfitability(input: SurgeryEconomicsCalculationInput): SurgeryEconomicsProfitabilityResult {
  const validation = validateSurgeryEconomicsInputs(input);
  if (!validation.ok) throw new Error(validation.message);

  const model = input.cost_model;
  const revenueCents = Math.max(0, Math.floor(input.revenue.revenue_cents));
  const collectedCents = Math.max(0, Math.floor(input.revenue.collected_cents));
  const outstandingCents = Math.max(0, Math.floor(input.revenue.outstanding_cents));
  const durationMinutes = Math.max(1, Math.floor(input.duration_minutes));
  const graftCount = input.graft_count != null ? Math.max(0, Math.floor(input.graft_count)) : null;
  const hairCount = input.hair_count != null ? Math.max(0, Math.floor(input.hair_count)) : null;

  const surgeon_cost_cents = calculateSurgeonCost({
    surgeon_cost_type: model.surgeon_cost_type,
    surgeon_cost_value_cents: model.surgeon_cost_value_cents,
    revenue_cents: revenueCents,
    graft_count: graftCount,
    duration_minutes: durationMinutes,
  });

  const staff_cost_cents = calculateStaffCost({
    rn_hourly_rate_cents: model.rn_hourly_rate_cents,
    technician_hourly_rate_cents: model.technician_hourly_rate_cents,
    assistant_hourly_rate_cents: model.assistant_hourly_rate_cents,
    duration_minutes: durationMinutes,
    staff_counts: input.staff_counts,
  });

  const room_cost_cents = calculateRoomCost({
    room_hourly_cost_cents: model.room_hourly_cost_cents,
    duration_minutes: durationMinutes,
  });

  const consumables_cost_cents = calculateConsumablesCost({
    consumables_base_cost_cents: model.consumables_base_cost_cents,
    graft_consumable_cost_cents: model.graft_consumable_cost_cents,
    medication_cost_cents: model.medication_cost_cents,
    graft_count: graftCount,
  });

  const treatment_addon_cost_cents = calculateTreatmentAddonCost({
    prp_cost_cents: model.prp_cost_cents,
    exosome_cost_cents: model.exosome_cost_cents,
    treatment_addons: input.treatment_addons,
  });

  const total_cost_cents =
    surgeon_cost_cents + staff_cost_cents + room_cost_cents + consumables_cost_cents + treatment_addon_cost_cents;
  const gross_profit_cents = revenueCents - total_cost_cents;
  const gross_margin_percentage = calculateGrossMarginPercentage(revenueCents, gross_profit_cents);
  const perGraft = calculatePerGraftMetrics({
    graft_count: graftCount,
    revenue_cents: revenueCents,
    total_cost_cents,
  });

  return {
    procedure_type: normalizeProcedureType(input.procedure_type),
    revenue_cents: revenueCents,
    collected_cents: collectedCents,
    outstanding_cents: outstandingCents,
    surgeon_cost_cents,
    staff_cost_cents,
    room_cost_cents,
    consumables_cost_cents,
    treatment_addon_cost_cents,
    total_cost_cents,
    gross_profit_cents,
    gross_margin_percentage,
    graft_count: graftCount,
    hair_count: hairCount,
    revenue_per_graft_cents: perGraft.revenue_per_graft_cents,
    cost_per_graft_cents: perGraft.cost_per_graft_cents,
  };
}

export function buildProfitabilitySnapshotInsertRow(args: {
  tenantId: string;
  caseId: string | null;
  surgeryId: string | null;
  patientId: string | null;
  invoiceId: string | null;
  profitability: SurgeryEconomicsProfitabilityResult;
  sourceMetadata: Record<string, unknown>;
  calculatedAt?: string;
}): FiSurgeryProfitabilitySnapshotRow {
  return {
    tenant_id: args.tenantId.trim(),
    case_id: args.caseId?.trim() || null,
    surgery_id: args.surgeryId?.trim() || null,
    patient_id: args.patientId?.trim() || null,
    invoice_id: args.invoiceId?.trim() || null,
    procedure_type: args.profitability.procedure_type,
    revenue_cents: args.profitability.revenue_cents,
    collected_cents: args.profitability.collected_cents,
    outstanding_cents: args.profitability.outstanding_cents,
    surgeon_cost_cents: args.profitability.surgeon_cost_cents,
    staff_cost_cents: args.profitability.staff_cost_cents,
    room_cost_cents: args.profitability.room_cost_cents,
    consumables_cost_cents: args.profitability.consumables_cost_cents,
    treatment_addon_cost_cents: args.profitability.treatment_addon_cost_cents,
    total_cost_cents: args.profitability.total_cost_cents,
    gross_profit_cents: args.profitability.gross_profit_cents,
    gross_margin_percentage: args.profitability.gross_margin_percentage,
    graft_count: args.profitability.graft_count,
    hair_count: args.profitability.hair_count,
    revenue_per_graft_cents: args.profitability.revenue_per_graft_cents,
    cost_per_graft_cents: args.profitability.cost_per_graft_cents,
    source_metadata: args.sourceMetadata,
    calculated_at: args.calculatedAt ?? new Date().toISOString(),
  };
}

export function mapProfitabilitySnapshotRow(raw: Record<string, unknown>): FiSurgeryProfitabilitySnapshotRow {
  const metadata =
    raw.source_metadata && typeof raw.source_metadata === "object" && !Array.isArray(raw.source_metadata)
      ? (raw.source_metadata as Record<string, unknown>)
      : {};
  return {
    id: raw.id != null ? String(raw.id) : undefined,
    tenant_id: String(raw.tenant_id),
    case_id: raw.case_id != null ? String(raw.case_id) : null,
    surgery_id: raw.surgery_id != null ? String(raw.surgery_id) : null,
    patient_id: raw.patient_id != null ? String(raw.patient_id) : null,
    invoice_id: raw.invoice_id != null ? String(raw.invoice_id) : null,
    procedure_type: String(raw.procedure_type ?? ""),
    revenue_cents: Number(raw.revenue_cents ?? 0),
    collected_cents: Number(raw.collected_cents ?? 0),
    outstanding_cents: Number(raw.outstanding_cents ?? 0),
    surgeon_cost_cents: Number(raw.surgeon_cost_cents ?? 0),
    staff_cost_cents: Number(raw.staff_cost_cents ?? 0),
    room_cost_cents: Number(raw.room_cost_cents ?? 0),
    consumables_cost_cents: Number(raw.consumables_cost_cents ?? 0),
    treatment_addon_cost_cents: Number(raw.treatment_addon_cost_cents ?? 0),
    total_cost_cents: Number(raw.total_cost_cents ?? 0),
    gross_profit_cents: Number(raw.gross_profit_cents ?? 0),
    gross_margin_percentage: Number(raw.gross_margin_percentage ?? 0),
    graft_count: raw.graft_count != null ? Number(raw.graft_count) : null,
    hair_count: raw.hair_count != null ? Number(raw.hair_count) : null,
    revenue_per_graft_cents: raw.revenue_per_graft_cents != null ? Number(raw.revenue_per_graft_cents) : null,
    cost_per_graft_cents: raw.cost_per_graft_cents != null ? Number(raw.cost_per_graft_cents) : null,
    source_metadata: metadata,
    calculated_at: String(raw.calculated_at ?? ""),
  };
}

export function assertProfitabilitySnapshotsTenantScoped(
  rows: Array<{ tenant_id: string }>,
  expectedTenantId: string
): boolean {
  const tid = expectedTenantId.trim();
  return rows.every((r) => String(r.tenant_id) === tid);
}

export type SurgeryEconomicsDashboardMetrics = {
  average_margin_percentage: number;
  average_revenue_per_graft_cents: number | null;
  average_cost_per_graft_cents: number | null;
  outstanding_surgery_balances_cents: number;
  most_profitable_procedure_type: string | null;
};

export function aggregateSurgeryEconomicsDashboardMetrics(
  snapshots: FiSurgeryProfitabilitySnapshotRow[]
): SurgeryEconomicsDashboardMetrics {
  if (!snapshots.length) {
    return {
      average_margin_percentage: 0,
      average_revenue_per_graft_cents: null,
      average_cost_per_graft_cents: null,
      outstanding_surgery_balances_cents: 0,
      most_profitable_procedure_type: null,
    };
  }

  let marginSum = 0;
  let revenuePerGraftSum = 0;
  let revenuePerGraftCount = 0;
  let costPerGraftSum = 0;
  let costPerGraftCount = 0;
  let outstanding = 0;

  const marginByProcedure = new Map<string, { sum: number; count: number }>();

  for (const s of snapshots) {
    marginSum += s.gross_margin_percentage;
    outstanding += Math.max(0, s.outstanding_cents);
    if (s.revenue_per_graft_cents != null) {
      revenuePerGraftSum += s.revenue_per_graft_cents;
      revenuePerGraftCount += 1;
    }
    if (s.cost_per_graft_cents != null) {
      costPerGraftSum += s.cost_per_graft_cents;
      costPerGraftCount += 1;
    }
    const key = s.procedure_type.trim().toLowerCase();
    const entry = marginByProcedure.get(key) ?? { sum: 0, count: 0 };
    entry.sum += s.gross_margin_percentage;
    entry.count += 1;
    marginByProcedure.set(key, entry);
  }

  let mostProfitable: string | null = null;
  let bestAvg = -Infinity;
  for (const [procedure, stats] of marginByProcedure) {
    const avg = stats.sum / stats.count;
    if (avg > bestAvg) {
      bestAvg = avg;
      mostProfitable = procedure;
    }
  }

  return {
    average_margin_percentage: Math.round((marginSum / snapshots.length) * 100) / 100,
    average_revenue_per_graft_cents: revenuePerGraftCount > 0 ? Math.round(revenuePerGraftSum / revenuePerGraftCount) : null,
    average_cost_per_graft_cents: costPerGraftCount > 0 ? Math.round(costPerGraftSum / costPerGraftCount) : null,
    outstanding_surgery_balances_cents: outstanding,
    most_profitable_procedure_type: mostProfitable,
  };
}

export function isSurgeryCompletionStatusMet(completion: SurgeryCompletionContext): boolean {
  const proc = completion.procedure_status?.trim().toLowerCase();
  if (proc === "completed") return true;
  const surgeryStatus = completion.surgery_status?.trim().toLowerCase();
  if (surgeryStatus === "completed") return true;
  const liveStatus = completion.surgery_live_status?.trim().toLowerCase();
  if (liveStatus === "completed") return true;
  const booking = completion.booking_status?.trim().toLowerCase();
  if (booking === "completed") return true;
  if (completion.graft_reconciliation_completed) return true;
  return false;
}

export function assessSurgeryProfitabilitySnapshotReadiness(
  input: SurgeryProfitabilitySnapshotReadinessInput
): SurgeryProfitabilitySnapshotReadiness {
  const reasons: string[] = [];
  const tid = input.tenant_id?.trim();
  if (!tid) reasons.push("Tenant context is missing.");

  const procedureType = input.procedure_type?.trim();
  if (!procedureType) reasons.push("Procedure type is not configured for this case.");

  if (input.surgery_invoice_count <= 0) reasons.push("No surgery invoice exists for this case.");
  if (input.revenue_cents <= 0) reasons.push("Surgery invoice revenue is zero.");

  if (!input.has_active_cost_model) {
    reasons.push("No active cost model exists for this procedure type.");
  }

  if (!isSurgeryCompletionStatusMet(input.completion)) {
    reasons.push("Surgery is not marked completed.");
  }

  const ready = reasons.length === 0;
  return {
    status: ready ? "ready" : "needs_configuration",
    ready,
    reasons,
  };
}

export function assertCostModelsTenantScoped(rows: Array<{ tenant_id: string }>, expectedTenantId: string): boolean {
  const tid = expectedTenantId.trim();
  return rows.every((r) => String(r.tenant_id) === tid);
}

export function defaultCostModelForProcedure(tenantId: string, procedureType: string): FiSurgeryCostModel {
  return {
    tenant_id: tenantId.trim(),
    procedure_type: procedureType.trim().toLowerCase(),
    surgeon_cost_type: "fixed",
    surgeon_cost_value_cents: 0,
    rn_hourly_rate_cents: 0,
    technician_hourly_rate_cents: 0,
    assistant_hourly_rate_cents: 0,
    room_hourly_cost_cents: 0,
    consumables_base_cost_cents: 0,
    graft_consumable_cost_cents: 0,
    prp_cost_cents: 0,
    exosome_cost_cents: 0,
    medication_cost_cents: 0,
    default_duration_minutes: 480,
    is_active: true,
  };
}
