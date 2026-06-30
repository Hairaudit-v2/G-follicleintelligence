import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEnterpriseDemoFinancialBundles,
  countEnterpriseDemoFinancialRecords,
  ENTERPRISE_DEMO_CONSULTATION_QUOTE_INVOICES,
  ENTERPRISE_DEMO_SURGERY_FINANCIAL_BUNDLES,
  validateEnterpriseDemoFinancialBundles,
} from "./enterpriseDemoFinancialGenerator";

test("buildEnterpriseDemoFinancialBundles produces 240 consultation and 96 surgery bundles", () => {
  const bundles = buildEnterpriseDemoFinancialBundles();
  assert.equal(bundles.consultationBundles.length, ENTERPRISE_DEMO_CONSULTATION_QUOTE_INVOICES);
  assert.equal(bundles.surgeryBundles.length, ENTERPRISE_DEMO_SURGERY_FINANCIAL_BUNDLES);
});

test("validateEnterpriseDemoFinancialBundles accepts generated bundles", () => {
  const bundles = buildEnterpriseDemoFinancialBundles();
  const result = validateEnterpriseDemoFinancialBundles(bundles);
  assert.equal(result.ok, true);
});

test("demo invoice and payment keys are unique", () => {
  const bundles = buildEnterpriseDemoFinancialBundles();
  const invoiceKeys = new Set<string>();
  const paymentKeys = new Set<string>();

  for (const bundle of bundles.consultationBundles) {
    assert.ok(!invoiceKeys.has(bundle.quoteInvoice.demoInvoiceKey));
    invoiceKeys.add(bundle.quoteInvoice.demoInvoiceKey);
    if (bundle.payment) {
      assert.ok(!paymentKeys.has(bundle.payment.demoPaymentKey));
      paymentKeys.add(bundle.payment.demoPaymentKey);
      assert.equal(bundle.payment.synthetic, true);
    }
  }

  for (const bundle of bundles.surgeryBundles) {
    for (const invoice of [
      bundle.depositInvoice,
      bundle.balanceInvoice,
      bundle.adjustmentInvoice,
    ].filter(Boolean)) {
      assert.ok(!invoiceKeys.has(invoice!.demoInvoiceKey));
      invoiceKeys.add(invoice!.demoInvoiceKey);
    }
    for (const payment of [
      bundle.depositPayment,
      bundle.balancePayment,
      bundle.refundPayment,
    ].filter(Boolean)) {
      assert.ok(!paymentKeys.has(payment!.demoPaymentKey));
      paymentKeys.add(payment!.demoPaymentKey);
    }
  }
});

test("Sydney surgeries reconcile cleanly with low franchise risk", () => {
  const bundles = buildEnterpriseDemoFinancialBundles();
  const sydney = bundles.surgeryBundles.filter(
    (b) => b.surgery.clinicSlug === "sydney-hair-institute"
  );

  assert.ok(sydney.length > 0);
  for (const bundle of sydney) {
    assert.equal(bundle.franchiseRisk.paymentReconciliationStatus, "reconciled");
    assert.ok(bundle.franchiseRisk.franchiseRiskScore <= 30);
  }
});

test("Dubai surgeries flag graft and revenue variance", () => {
  const bundles = buildEnterpriseDemoFinancialBundles();
  const dubai = bundles.surgeryBundles.filter(
    (b) => b.surgery.clinicSlug === "dubai-hair-institute"
  );

  assert.ok(dubai.every((b) => b.franchiseRisk.inventoryToGraftVarianceFlag));
  assert.ok(dubai.some((b) => b.franchiseRisk.revenueVarianceFlag));
});

test("Bangkok surgeries include overdue balances", () => {
  const bundles = buildEnterpriseDemoFinancialBundles();
  const bangkok = bundles.surgeryBundles.filter(
    (b) => b.surgery.clinicSlug === "bangkok-restoration-centre"
  );

  assert.ok(bangkok.some((b) => b.balanceInvoice.status === "overdue"));
  assert.ok(
    bangkok.some((b) => b.franchiseRisk.paymentReconciliationStatus === "overdue_follow_up_missing")
  );
});

test("London surgeries include refunds or adjustments", () => {
  const bundles = buildEnterpriseDemoFinancialBundles();
  const london = bundles.surgeryBundles.filter(
    (b) => b.surgery.clinicSlug === "london-central-institute"
  );

  assert.ok(london.some((b) => b.refundPayment != null || b.adjustmentInvoice != null));
  assert.ok(london.some((b) => b.franchiseRisk.riskReasonCodes.includes("quality_linked_refund")));
});

test("Athens consultations include quote expiry leakage", () => {
  const bundles = buildEnterpriseDemoFinancialBundles();
  const athens = bundles.consultationBundles.filter(
    (b) => b.consultation.clinicSlug === "athens-medical-institute"
  );

  assert.ok(
    athens.some(
      (b) =>
        b.quoteInvoice.demoFinancialLifecycle === "quote_expired" ||
        b.paymentRequest?.status === "expired"
    )
  );
});

test("countEnterpriseDemoFinancialRecords tallies invoices and payments", () => {
  const bundles = buildEnterpriseDemoFinancialBundles();
  const counts = countEnterpriseDemoFinancialRecords(bundles);

  assert.equal(counts.consultationQuoteInvoices, 240);
  assert.equal(counts.surgeryFinancialBundles, 96);
  assert.equal(counts.franchiseRiskRecords, 96);
  assert.ok(counts.totalInvoices >= 240 + 96 * 2);
  assert.ok(counts.totalPaymentRequests > 0);
});

test("surgery invoices link to demo surgery and case keys", () => {
  const bundles = buildEnterpriseDemoFinancialBundles();

  for (const bundle of bundles.surgeryBundles) {
    assert.equal(bundle.depositInvoice.demoSurgeryKey, bundle.surgery.demoSurgeryKey);
    assert.equal(bundle.balanceInvoice.demoCaseKey, bundle.surgery.demoCaseKey);
    assert.equal(
      bundle.franchiseRisk.demoFinancialRiskKey,
      `${bundle.surgery.demoSurgeryKey}-financial-risk`
    );
  }
});
