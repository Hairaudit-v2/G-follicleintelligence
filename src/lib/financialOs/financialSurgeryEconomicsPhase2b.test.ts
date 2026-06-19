import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assessSurgeryProfitabilitySnapshotReadiness,
  assertCostModelsTenantScoped,
  assertProfitabilitySnapshotsTenantScoped,
  buildProfitabilitySnapshotInsertRow,
  calculateSurgeryProfitability,
  defaultCostModelForProcedure,
  isSurgeryCompletionStatusMet,
  validateSurgeryEconomicsInputs,
  type FiSurgeryCostModel,
  type SurgeryEconomicsCalculationInput,
} from "@/src/lib/financialOs/financialSurgeryEconomicsCore";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function readyInput(overrides: Record<string, unknown> = {}) {
  return {
    tenant_id: TENANT_A,
    procedure_type: "fue",
    has_active_cost_model: true,
    surgery_invoice_count: 2,
    revenue_cents: 1_200_000,
    completion: {
      procedure_status: "completed",
      surgery_status: null,
      surgery_live_status: null,
      booking_status: null,
      graft_reconciliation_completed: false,
    },
    ...overrides,
  };
}

describe("financialSurgeryEconomics Phase 2B", () => {
  it("isSurgeryCompletionStatusMet — procedure completed", () => {
    assert.equal(
      isSurgeryCompletionStatusMet({
        procedure_status: "completed",
        surgery_status: null,
        surgery_live_status: null,
        booking_status: null,
        graft_reconciliation_completed: false,
      }),
      true
    );
  });

  it("isSurgeryCompletionStatusMet — graft reconciliation", () => {
    assert.equal(
      isSurgeryCompletionStatusMet({
        procedure_status: "in_progress",
        surgery_status: "active",
        surgery_live_status: "in_procedure",
        booking_status: "confirmed",
        graft_reconciliation_completed: true,
      }),
      true
    );
  });

  it("missing cost model returns Needs Configuration", () => {
    const r = assessSurgeryProfitabilitySnapshotReadiness(readyInput({ has_active_cost_model: false }));
    assert.equal(r.ready, false);
    assert.equal(r.status, "needs_configuration");
    assert.ok(r.reasons.some((x) => x.includes("cost model")));
  });

  it("no invoice returns Needs Configuration", () => {
    const r = assessSurgeryProfitabilitySnapshotReadiness(readyInput({ surgery_invoice_count: 0 }));
    assert.equal(r.ready, false);
    assert.ok(r.reasons.some((x) => x.includes("invoice")));
  });

  it("zero revenue returns Needs Configuration", () => {
    const r = assessSurgeryProfitabilitySnapshotReadiness(readyInput({ revenue_cents: 0 }));
    assert.equal(r.ready, false);
    assert.ok(r.reasons.some((x) => x.includes("revenue")));
  });

  it("no completion status returns Needs Configuration", () => {
    const r = assessSurgeryProfitabilitySnapshotReadiness(
      readyInput({
        completion: {
          procedure_status: "in_progress",
          surgery_status: "active",
          surgery_live_status: "waiting",
          booking_status: "confirmed",
          graft_reconciliation_completed: false,
        },
      })
    );
    assert.equal(r.ready, false);
    assert.ok(r.reasons.some((x) => x.includes("completed")));
  });

  it("inactive cost model cannot be used in calculation", () => {
    const model = defaultCostModelForProcedure(TENANT_A, "fue");
    model.is_active = false;
    const input: SurgeryEconomicsCalculationInput = {
      tenant_id: TENANT_A,
      procedure_type: "fue",
      cost_model: model,
      revenue: { revenue_cents: 500_000, collected_cents: 500_000, outstanding_cents: 0 },
      duration_minutes: 480,
      staff_counts: { rn_count: 1, technician_count: 1, assistant_count: 0 },
      treatment_addons: { prp: false, exosome: false },
      graft_count: 2000,
      hair_count: null,
    };
    const v = validateSurgeryEconomicsInputs(input);
    assert.equal(v.ok, false);
    if (!v.ok) assert.match(v.message, /active/);
  });

  it("manual recalculation creates distinct snapshot rows (immutable append)", () => {
    const profitability = calculateSurgeryProfitability({
      tenant_id: TENANT_A,
      procedure_type: "fue",
      cost_model: { ...defaultCostModelForProcedure(TENANT_A, "fue"), surgeon_cost_value_cents: 10_000 },
      revenue: { revenue_cents: 800_000, collected_cents: 800_000, outstanding_cents: 0 },
      duration_minutes: 360,
      staff_counts: { rn_count: 1, technician_count: 1, assistant_count: 0 },
      treatment_addons: { prp: false, exosome: false },
      graft_count: 2500,
      hair_count: null,
    });
    const first = buildProfitabilitySnapshotInsertRow({
      tenantId: TENANT_A,
      caseId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      surgeryId: null,
      patientId: null,
      invoiceId: null,
      profitability,
      sourceMetadata: { trigger_source: "manual_create", version: 1 },
      calculatedAt: "2026-06-19T10:00:00.000Z",
    });
    const second = buildProfitabilitySnapshotInsertRow({
      tenantId: TENANT_A,
      caseId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      surgeryId: null,
      patientId: null,
      invoiceId: null,
      profitability: { ...profitability, gross_profit_cents: profitability.gross_profit_cents - 5_000 },
      sourceMetadata: { trigger_source: "manual_recalculate", version: 2 },
      calculatedAt: "2026-06-19T11:00:00.000Z",
    });
    assert.notEqual(first.calculated_at, second.calculated_at);
    assert.equal(first.source_metadata.trigger_source, "manual_create");
    assert.equal(second.source_metadata.trigger_source, "manual_recalculate");
    assert.equal(first.gross_profit_cents, profitability.gross_profit_cents);
    assert.equal(second.gross_profit_cents, profitability.gross_profit_cents - 5_000);
  });

  it("tenant admin cost models tenant isolation", () => {
    const rows = [
      { tenant_id: TENANT_A } as FiSurgeryCostModel,
      { tenant_id: TENANT_A } as FiSurgeryCostModel,
    ];
    assert.equal(assertCostModelsTenantScoped(rows, TENANT_A), true);
    assert.equal(assertCostModelsTenantScoped(rows, TENANT_B), false);
  });

  it("dashboard filter tenant isolation on snapshots", () => {
    const rows = [{ tenant_id: TENANT_A }, { tenant_id: TENANT_A }];
    assert.equal(assertProfitabilitySnapshotsTenantScoped(rows, TENANT_A), true);
    assert.equal(assertProfitabilitySnapshotsTenantScoped(rows, TENANT_B), false);
  });
});
