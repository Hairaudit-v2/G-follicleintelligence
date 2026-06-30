import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  aggregateRevenueAttributionDashboard,
  assertRevenueAttributionEventsTenantScoped,
  buildRevenueAttributionEvent,
  calculateAttributedRevenue,
  calculateAttributionConfidence,
  resolveCampaignAttribution,
  resolveConsultantAttribution,
  resolveLeadSourceAttribution,
  type LeadSourceContext,
} from "@/src/lib/financialOs/financialRevenueAttributionCore";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function baseLeadContext(overrides: Partial<LeadSourceContext> = {}): LeadSourceContext {
  return {
    lead_id: "lead-1",
    lead_metadata: {},
    lead_source_systems: [],
    lead_clinic_id: null,
    lead_primary_owner_user_id: null,
    patient_metadata: {},
    patient_source_systems: [],
    consultation_source: null,
    consultation_metadata: {},
    manual_override: null,
    ...overrides,
  };
}

describe("financialRevenueAttributionCore", () => {
  it("direct lead source attribution from lead_source_system", () => {
    const result = resolveLeadSourceAttribution(
      baseLeadContext({ lead_source_systems: ["google_ads"] })
    );
    assert.equal(result.attribution_source, "google_ads");
    assert.equal(result.resolution_channel, "lead_source_system");
  });

  it("inferred patient source attribution", () => {
    const result = resolveLeadSourceAttribution(
      baseLeadContext({
        lead_source_systems: [],
        lead_metadata: {},
        patient_source_systems: ["hubspot"],
        lead_id: null,
      })
    );
    assert.equal(result.attribution_source, "existing_patient");
    assert.equal(result.resolution_channel, "patient_or_lead_link_inferred");
  });

  it("unknown fallback when no signals", () => {
    const result = resolveLeadSourceAttribution(
      baseLeadContext({ lead_id: null, lead_source_systems: [], patient_source_systems: [] })
    );
    assert.equal(result.attribution_source, "unknown");
    assert.equal(result.resolution_channel, "unknown_fallback");
  });

  it("consultant fallback order — manual wins over lead owner", () => {
    const result = resolveConsultantAttribution({
      manual_consultant_fi_user_id: "manual-user",
      lead_primary_owner_user_id: "lead-owner",
      consultation_owner_fi_user_id: "consult-owner",
      consultation_staff_fi_user_id: null,
      quote_creator_fi_user_id: "quote-creator",
      case_owner_fi_user_id: "case-owner",
    });
    assert.equal(result.consultant_fi_user_id, "manual-user");
    assert.equal(result.resolution_order, "manual_override");
  });

  it("consultant fallback order — lead owner before consultation owner", () => {
    const result = resolveConsultantAttribution({
      manual_consultant_fi_user_id: null,
      lead_primary_owner_user_id: "lead-owner",
      consultation_owner_fi_user_id: "consult-owner",
      consultation_staff_fi_user_id: null,
      quote_creator_fi_user_id: "quote-creator",
      case_owner_fi_user_id: "case-owner",
    });
    assert.equal(result.consultant_fi_user_id, "lead-owner");
    assert.equal(result.resolution_order, "lead_primary_owner");
  });

  it("consultant fallback order — quote creator before case owner", () => {
    const result = resolveConsultantAttribution({
      manual_consultant_fi_user_id: null,
      lead_primary_owner_user_id: null,
      consultation_owner_fi_user_id: null,
      consultation_staff_fi_user_id: null,
      quote_creator_fi_user_id: "quote-creator",
      case_owner_fi_user_id: "case-owner",
    });
    assert.equal(result.consultant_fi_user_id, "quote-creator");
    assert.equal(result.resolution_order, "quote_creator");
  });

  it("campaign attribution from lead metadata", () => {
    const result = resolveCampaignAttribution({
      lead_metadata: {
        campaign_name: "Spring FUE",
        campaign_id: "camp-99",
        keyword: "hair transplant",
      },
      consultation_metadata: {},
      manual_campaign_name: null,
      manual_campaign_id: null,
    });
    assert.equal(result.campaign_name, "Spring FUE");
    assert.equal(result.campaign_id, "camp-99");
    assert.equal(result.keyword, "hair transplant");
    assert.equal(result.resolution_channel, "lead_metadata");
  });

  it("revenue attribution on payment received", () => {
    const amounts = calculateAttributedRevenue({ payment_amount_cents: 50_000 });
    assert.equal(amounts.attributed_revenue_cents, 50_000);
    assert.equal(amounts.attributed_collected_cents, 50_000);
    assert.equal(amounts.gross_profit_cents, null);
  });

  it("gross profit attribution after surgery snapshot", () => {
    const amounts = calculateAttributedRevenue({
      payment_amount_cents: 0,
      invoice_total_cents: 1_200_000,
      collected_cents: 1_200_000,
      gross_profit_cents: 450_000,
    });
    assert.equal(amounts.attributed_revenue_cents, 1_200_000);
    assert.equal(amounts.gross_profit_cents, 450_000);
  });

  it("manual attribution override sets confidence manual", () => {
    const event = buildRevenueAttributionEvent({
      tenant_id: TENANT_A,
      lead_id: "lead-1",
      lead_context: baseLeadContext({
        manual_override: {
          attribution_source: "referral",
          campaign_name: "Partner Q2",
          campaign_id: "p-q2",
          consultant_fi_user_id: "consultant-1",
        },
      }),
      consultant_context: {
        manual_consultant_fi_user_id: "consultant-1",
        lead_primary_owner_user_id: null,
        consultation_owner_fi_user_id: null,
        consultation_staff_fi_user_id: null,
        quote_creator_fi_user_id: null,
        case_owner_fi_user_id: null,
      },
      clinic_context: { invoice_clinic_id: null, case_clinic_id: null, lead_clinic_id: null },
      campaign_context: {
        lead_metadata: {},
        consultation_metadata: {},
        manual_campaign_name: "Partner Q2",
        manual_campaign_id: "p-q2",
      },
      amounts: calculateAttributedRevenue({ payment_amount_cents: 25_000 }),
      trigger_source: "manual_recalculation",
      idempotency_key: "manual:case-1",
    });
    assert.equal(event.attribution_source, "referral");
    assert.equal(event.attribution_confidence, "manual");
    assert.equal(event.campaign_name, "Partner Q2");
    assert.equal(event.consultant_fi_user_id, "consultant-1");
  });

  it("tenant isolation", () => {
    assert.throws(
      () =>
        assertRevenueAttributionEventsTenantScoped(TENANT_A, [
          { tenant_id: TENANT_A },
          { tenant_id: TENANT_B },
        ]),
      /tenant-scoped/
    );
  });

  it("no duplicate attribution events for same transaction idempotency key", () => {
    const key = "payment:pay-abc-123";
    const event = buildRevenueAttributionEvent({
      tenant_id: TENANT_A,
      payment_id: "pay-abc-123",
      transaction_id: "tx-1",
      lead_context: baseLeadContext({ lead_source_systems: ["meta_ads"] }),
      consultant_context: {
        manual_consultant_fi_user_id: null,
        lead_primary_owner_user_id: null,
        consultation_owner_fi_user_id: null,
        consultation_staff_fi_user_id: null,
        quote_creator_fi_user_id: null,
        case_owner_fi_user_id: null,
      },
      clinic_context: { invoice_clinic_id: null, case_clinic_id: null, lead_clinic_id: null },
      campaign_context: {
        lead_metadata: {},
        consultation_metadata: {},
        manual_campaign_name: null,
        manual_campaign_id: null,
      },
      amounts: calculateAttributedRevenue({ payment_amount_cents: 10_000 }),
      trigger_source: "payment_received",
      idempotency_key: key,
    });
    assert.equal(event.idempotency_key, key);
    assert.equal(
      calculateAttributionConfidence({
        has_manual_override: false,
        lead_resolution_channel: "lead_source_system",
        has_direct_lead_source: true,
        has_campaign: false,
        trigger_source: "payment_received",
      }),
      "direct"
    );
  });

  it("aggregate dashboard computes unknown attribution percentage", () => {
    const { metrics } = aggregateRevenueAttributionDashboard([
      {
        id: "1",
        attribution_source: "unknown",
        campaign_name: null,
        lead_id: "l1",
        consultation_id: null,
        invoice_id: "i1",
        attributed_collected_cents: 30_000,
        gross_profit_cents: 10_000,
        attribution_confidence: "inferred",
        procedure_type: null,
      },
      {
        id: "2",
        attribution_source: "google_ads",
        campaign_name: "Brand",
        lead_id: "l2",
        consultation_id: "c1",
        invoice_id: "i2",
        attributed_collected_cents: 70_000,
        gross_profit_cents: 35_000,
        attribution_confidence: "direct",
        procedure_type: "FUE",
      },
    ]);
    assert.equal(metrics.unknown_attribution_percentage, 30);
    assert.equal(metrics.revenue_by_source.find((x) => x.source === "google_ads")?.cents, 70_000);
  });
});
