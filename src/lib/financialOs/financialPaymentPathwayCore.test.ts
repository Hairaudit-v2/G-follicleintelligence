import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildPaymentPathwayAttentionSummary,
  type FiPaymentPathwayRow,
} from "@/src/lib/financialOs/financialPaymentPathwayCore";

function basePathway(
  p: Partial<FiPaymentPathwayRow> & Pick<FiPaymentPathwayRow, "pathway_type" | "status">
): FiPaymentPathwayRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    provider: null,
    provider_reference: null,
    expected_settlement_date: null,
    actual_settlement_date: null,
    expected_amount_cents: null,
    settled_amount_cents: null,
    currency_code: "AUD",
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    ...p,
  };
}

describe("financialPaymentPathwayCore", () => {
  it("pay_in_full selected does not require attention", () => {
    const s = buildPaymentPathwayAttentionSummary({
      todayYmd: "2026-06-16",
      surgeryDateYmd: "2026-06-20",
      pathway: basePathway({ pathway_type: "pay_in_full", status: "selected" }),
    });
    assert.equal(s.hasActivePathway, true);
    assert.equal(s.pathway_attention_required, false);
  });

  it("deposit_balance selected does not require attention", () => {
    const s = buildPaymentPathwayAttentionSummary({
      todayYmd: "2026-06-16",
      surgeryDateYmd: "2026-07-01",
      pathway: basePathway({ pathway_type: "deposit_balance", status: "selected" }),
    });
    assert.equal(s.pathway_attention_required, false);
  });

  it("medical_finance pending_provider within 14 days requires attention", () => {
    const s = buildPaymentPathwayAttentionSummary({
      todayYmd: "2026-06-16",
      surgeryDateYmd: "2026-06-25",
      pathway: basePathway({ pathway_type: "medical_finance", status: "pending_provider" }),
    });
    assert.equal(s.pathway_attention_required, true);
    assert.match(s.pathway_attention_reason ?? "", /medical finance/i);
  });

  it("medical_finance pending_provider beyond 14 days does not require attention", () => {
    const s = buildPaymentPathwayAttentionSummary({
      todayYmd: "2026-06-16",
      surgeryDateYmd: "2026-08-01",
      pathway: basePathway({ pathway_type: "medical_finance", status: "pending_provider" }),
    });
    assert.equal(s.pathway_attention_required, false);
  });

  it("super_release overdue expected settlement requires attention", () => {
    const s = buildPaymentPathwayAttentionSummary({
      todayYmd: "2026-06-16",
      surgeryDateYmd: "2026-08-01",
      pathway: basePathway({
        pathway_type: "super_release",
        status: "pending_provider",
        expected_settlement_date: "2026-05-01",
      }),
    });
    assert.equal(s.pathway_attention_required, true);
    assert.match(s.pathway_attention_reason ?? "", /expected settlement/i);
  });

  it("super_release pending_patient_action within 14 days requires attention", () => {
    const s = buildPaymentPathwayAttentionSummary({
      todayYmd: "2026-06-16",
      surgeryDateYmd: "2026-06-22",
      pathway: basePathway({ pathway_type: "super_release", status: "pending_patient_action" }),
    });
    assert.equal(s.pathway_attention_required, true);
    assert.match(s.pathway_attention_reason ?? "", /super release/i);
  });

  it("international_transfer settlement_pending within 7 days requires attention", () => {
    const s = buildPaymentPathwayAttentionSummary({
      todayYmd: "2026-06-16",
      surgeryDateYmd: "2026-06-20",
      pathway: basePathway({
        pathway_type: "international_transfer",
        status: "settlement_pending",
      }),
    });
    assert.equal(s.pathway_attention_required, true);
    assert.match(s.pathway_attention_reason ?? "", /international transfer/i);
  });

  it("international_transfer settlement_pending beyond 7 days does not require attention", () => {
    const s = buildPaymentPathwayAttentionSummary({
      todayYmd: "2026-06-16",
      surgeryDateYmd: "2026-06-30",
      pathway: basePathway({
        pathway_type: "international_transfer",
        status: "settlement_pending",
      }),
    });
    assert.equal(s.pathway_attention_required, false);
  });

  it("rejected pathway always requires attention", () => {
    const s = buildPaymentPathwayAttentionSummary({
      todayYmd: "2026-06-16",
      surgeryDateYmd: null,
      pathway: basePathway({ pathway_type: "manual", status: "rejected" }),
    });
    assert.equal(s.pathway_attention_required, true);
    assert.match(s.pathway_attention_reason ?? "", /rejected/i);
  });

  it("settled pathway does not require attention even if expected date passed", () => {
    const s = buildPaymentPathwayAttentionSummary({
      todayYmd: "2026-06-16",
      surgeryDateYmd: "2026-06-18",
      pathway: basePathway({
        pathway_type: "medical_finance",
        status: "settled",
        expected_settlement_date: "2026-05-01",
      }),
    });
    assert.equal(s.pathway_attention_required, false);
  });

  it("no pathway falls back to hasActivePathway false with no attention", () => {
    const s = buildPaymentPathwayAttentionSummary({
      todayYmd: "2026-06-16",
      surgeryDateYmd: "2026-06-18",
      pathway: null,
    });
    assert.equal(s.hasActivePathway, false);
    assert.equal(s.pathway_attention_required, false);
    assert.equal(s.pathway_type, null);
  });
});
