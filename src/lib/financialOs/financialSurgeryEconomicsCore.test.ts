import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FI_SURGERY_PROFITABILITY_SNAPSHOT_IMMUTABLE,
  aggregateSurgeryEconomicsDashboardMetrics,
  assertProfitabilitySnapshotsTenantScoped,
  buildProfitabilitySnapshotInsertRow,
  calculateConsumablesCost,
  calculateGrossMarginPercentage,
  calculateRoomCost,
  calculateStaffCost,
  calculateSurgeonCost,
  calculateSurgeryProfitability,
  calculateTreatmentAddonCost,
  defaultCostModelForProcedure,
  type FiSurgeryCostModel,
  type SurgeryEconomicsCalculationInput,
  validateSurgeryEconomicsInputs,
} from "@/src/lib/financialOs/financialSurgeryEconomicsCore";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function baseCostModel(overrides: Partial<FiSurgeryCostModel> = {}): FiSurgeryCostModel {
  return {
    ...defaultCostModelForProcedure(TENANT_A, "fue"),
    surgeon_cost_type: "fixed",
    surgeon_cost_value_cents: 50_000,
    rn_hourly_rate_cents: 6_000,
    technician_hourly_rate_cents: 4_500,
    assistant_hourly_rate_cents: 3_500,
    room_hourly_cost_cents: 12_000,
    consumables_base_cost_cents: 25_000,
    graft_consumable_cost_cents: 150,
    prp_cost_cents: 8_000,
    exosome_cost_cents: 15_000,
    medication_cost_cents: 5_000,
    default_duration_minutes: 480,
    ...overrides,
  };
}

function baseInput(
  overrides: Partial<SurgeryEconomicsCalculationInput> = {}
): SurgeryEconomicsCalculationInput {
  return {
    tenant_id: TENANT_A,
    procedure_type: "FUE",
    cost_model: baseCostModel(),
    revenue: { revenue_cents: 1_200_000, collected_cents: 400_000, outstanding_cents: 800_000 },
    duration_minutes: 480,
    staff_counts: { rn_count: 1, technician_count: 2, assistant_count: 1 },
    treatment_addons: { prp: false, exosome: false },
    graft_count: 3000,
    hair_count: 7200,
    ...overrides,
  };
}

describe("financialSurgeryEconomicsCore", () => {
  it("calculateSurgeonCost — fixed", () => {
    assert.equal(
      calculateSurgeonCost({
        surgeon_cost_type: "fixed",
        surgeon_cost_value_cents: 75_000,
        revenue_cents: 1_000_000,
        graft_count: 2500,
        duration_minutes: 360,
      }),
      75_000
    );
  });

  it("calculateSurgeonCost — percentage (basis points)", () => {
    assert.equal(
      calculateSurgeonCost({
        surgeon_cost_type: "percentage",
        surgeon_cost_value_cents: 1500,
        revenue_cents: 1_000_000,
        graft_count: 2500,
        duration_minutes: 360,
      }),
      150_000
    );
  });

  it("calculateSurgeonCost — per_graft", () => {
    assert.equal(
      calculateSurgeonCost({
        surgeon_cost_type: "per_graft",
        surgeon_cost_value_cents: 25,
        revenue_cents: 1_000_000,
        graft_count: 3000,
        duration_minutes: 360,
      }),
      75_000
    );
  });

  it("calculateSurgeonCost — per_hour", () => {
    assert.equal(
      calculateSurgeonCost({
        surgeon_cost_type: "per_hour",
        surgeon_cost_value_cents: 10_000,
        revenue_cents: 1_000_000,
        graft_count: 3000,
        duration_minutes: 120,
      }),
      20_000
    );
  });

  it("calculateStaffCost — hourly staff costs", () => {
    const staff = calculateStaffCost({
      rn_hourly_rate_cents: 6_000,
      technician_hourly_rate_cents: 4_500,
      assistant_hourly_rate_cents: 3_500,
      duration_minutes: 60,
      staff_counts: { rn_count: 1, technician_count: 2, assistant_count: 1 },
    });
    assert.equal(staff, 6_000 + 9_000 + 3_500);
  });

  it("calculateRoomCost — duration-based room cost", () => {
    assert.equal(
      calculateRoomCost({ room_hourly_cost_cents: 12_000, duration_minutes: 90 }),
      18_000
    );
  });

  it("calculateTreatmentAddonCost — addon treatment costs", () => {
    assert.equal(
      calculateTreatmentAddonCost({
        prp_cost_cents: 8_000,
        exosome_cost_cents: 15_000,
        treatment_addons: { prp: true, exosome: true },
      }),
      23_000
    );
    assert.equal(
      calculateTreatmentAddonCost({
        prp_cost_cents: 8_000,
        exosome_cost_cents: 15_000,
        treatment_addons: { prp: true, exosome: false },
      }),
      8_000
    );
  });

  it("calculateConsumablesCost — graft-based consumables", () => {
    assert.equal(
      calculateConsumablesCost({
        consumables_base_cost_cents: 10_000,
        graft_consumable_cost_cents: 100,
        medication_cost_cents: 2_000,
        graft_count: 2000,
      }),
      10_000 + 200_000 + 2_000
    );
  });

  it("missing graft count handling — per-graft metrics null", () => {
    const result = calculateSurgeryProfitability(baseInput({ graft_count: null }));
    assert.equal(result.graft_count, null);
    assert.equal(result.revenue_per_graft_cents, null);
    assert.equal(result.cost_per_graft_cents, null);
    assert.equal(
      calculateSurgeonCost({
        surgeon_cost_type: "per_graft",
        surgeon_cost_value_cents: 50,
        revenue_cents: 500_000,
        graft_count: null,
        duration_minutes: 240,
      }),
      0
    );
  });

  it("zero revenue safety — margin percentage is zero", () => {
    const result = calculateSurgeryProfitability(
      baseInput({ revenue: { revenue_cents: 0, collected_cents: 0, outstanding_cents: 0 } })
    );
    assert.equal(result.gross_margin_percentage, 0);
    assert.equal(calculateGrossMarginPercentage(0, -50_000), 0);
  });

  it("margin percentage calculation", () => {
    const result = calculateSurgeryProfitability(baseInput());
    const expectedMargin =
      Math.round((result.gross_profit_cents / result.revenue_cents) * 10_000) / 100;
    assert.equal(result.gross_margin_percentage, expectedMargin);
    assert.ok(result.gross_margin_percentage > 0);
  });

  it("validateSurgeryEconomicsInputs — tenant isolation on cost model", () => {
    const input = baseInput({
      tenant_id: TENANT_A,
      cost_model: baseCostModel({ tenant_id: TENANT_B }),
    });
    const v = validateSurgeryEconomicsInputs(input);
    assert.equal(v.ok, false);
    if (!v.ok) assert.match(v.message, /tenant_id/);
  });

  it("immutable snapshot behaviour flag", () => {
    assert.equal(FI_SURGERY_PROFITABILITY_SNAPSHOT_IMMUTABLE, true);
    const row = buildProfitabilitySnapshotInsertRow({
      tenantId: TENANT_A,
      caseId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      surgeryId: null,
      patientId: null,
      invoiceId: null,
      profitability: calculateSurgeryProfitability(baseInput()),
      sourceMetadata: { trigger: "unit_test" },
      calculatedAt: "2026-06-19T12:00:00.000Z",
    });
    assert.equal(row.tenant_id, TENANT_A);
    assert.equal(row.calculated_at, "2026-06-19T12:00:00.000Z");
    assert.equal(row.source_metadata.trigger, "unit_test");
  });

  it("tenant isolation — assertProfitabilitySnapshotsTenantScoped", () => {
    const rows = [{ tenant_id: TENANT_A }, { tenant_id: TENANT_A }];
    assert.equal(assertProfitabilitySnapshotsTenantScoped(rows, TENANT_A), true);
    assert.equal(assertProfitabilitySnapshotsTenantScoped(rows, TENANT_B), false);
  });

  it("aggregateSurgeryEconomicsDashboardMetrics", () => {
    const p1 = calculateSurgeryProfitability(baseInput({ procedure_type: "fue" }));
    const p2 = calculateSurgeryProfitability(
      baseInput({
        procedure_type: "fut",
        revenue: { revenue_cents: 900_000, collected_cents: 900_000, outstanding_cents: 0 },
      })
    );
    const metrics = aggregateSurgeryEconomicsDashboardMetrics([
      buildProfitabilitySnapshotInsertRow({
        tenantId: TENANT_A,
        caseId: "c1",
        surgeryId: null,
        patientId: null,
        invoiceId: null,
        profitability: p1,
        sourceMetadata: {},
      }),
      buildProfitabilitySnapshotInsertRow({
        tenantId: TENANT_A,
        caseId: "c2",
        surgeryId: null,
        patientId: null,
        invoiceId: null,
        profitability: p2,
        sourceMetadata: {},
      }),
    ]);
    assert.ok(metrics.average_margin_percentage > 0);
    assert.ok(metrics.average_revenue_per_graft_cents != null);
    assert.equal(metrics.outstanding_surgery_balances_cents, 800_000);
    assert.ok(metrics.most_profitable_procedure_type);
  });
});
