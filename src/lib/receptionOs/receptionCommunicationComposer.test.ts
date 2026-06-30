import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildReceptionCommunicationVariables,
  extractLeadIdFromHref,
  patientFirstNameFromLabel,
  suggestReceptionCommunicationTemplateKey,
  suggestTemplateFromActionAlert,
  suggestTemplateFromRevenueAlertKind,
} from "@/src/lib/receptionOs/receptionCommunicationComposer";

describe("receptionCommunicationComposer", () => {
  it("extracts lead id from CRM href", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    assert.equal(extractLeadIdFromHref(`/fi-admin/t/crm/leads/${id}`), id);
    assert.equal(extractLeadIdFromHref(null), null);
  });

  it("derives patient first name from label", () => {
    assert.equal(patientFirstNameFromLabel("Jane Doe"), "Jane");
    assert.equal(patientFirstNameFromLabel(""), "there");
  });

  it("selects templates from alert and revenue kinds", () => {
    assert.equal(
      suggestReceptionCommunicationTemplateKey({ sourceKind: "deposit", alertKind: null }),
      "deposit_reminder"
    );
    assert.equal(
      suggestTemplateFromActionAlert({
        id: "deposit-x",
        kind: "missing_deposit",
        title: "Deposit",
        detail: "Due",
        severity: "critical",
        href: null,
      }),
      "deposit_reminder"
    );
    assert.equal(
      suggestTemplateFromRevenueAlertKind("patient_gone_cold"),
      "cold_lead_reactivation"
    );
    assert.equal(
      suggestTemplateFromRevenueAlertKind("missing_finance_payment_link"),
      "payment_link_follow_up"
    );
    assert.equal(
      suggestTemplateFromRevenueAlertKind("quote_followup_sla_breach"),
      "quote_follow_up"
    );
  });

  it("builds variable map for rendering", () => {
    const vars = buildReceptionCommunicationVariables({
      sourceKind: "deposit",
      sourceId: "22222222-2222-4222-8222-222222222222",
      label: "Chris Taylor",
      depositAmount: 1200,
      currency: "AUD",
      clinicName: "Evolved",
      paymentLink: "https://example.com/pay/token",
    });
    assert.equal(vars.patient_first_name, "Chris");
    assert.equal(vars.clinic_name, "Evolved");
    assert.equal(vars.payment_link, "https://example.com/pay/token");
    assert.match(String(vars.deposit_amount), /AUD/);
  });
});
