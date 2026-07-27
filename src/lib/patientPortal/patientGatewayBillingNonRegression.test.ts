/**
 * FI-PATIENT-APP-1E — webapp non-regression architectural proofs.
 * Ensures the patient billing gateway remains an additive access path.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import path from "node:path";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

describe("FI-PATIENT-APP-1E webapp non-regression", () => {
  it("1–5. FinanceOS / RevenueOS staff services remain the webapp path (not redirected)", async () => {
    const loaders = await import("@/src/lib/revenueOs/revenueInvoiceLoaders.server");
    const mutations = await import("@/src/lib/revenueOs/revenueInvoiceMutations.server");
    assert.equal(typeof loaders.loadPatientInvoiceSummary, "function");
    assert.equal(typeof loaders.loadUnpaidInvoicesDashboard, "function");
    assert.equal(typeof mutations.createPaymentRequestForInvoice, "function");
    assert.equal(typeof mutations.recordGatewayPaymentSuccess, "function");

    const actions = await import("@/lib/actions/fi-revenue-invoice-actions");
    assert.ok(actions);
  });

  it("6. Stripe webhook reconciliation core remains available and idempotent helpers export", async () => {
    const core = await import("@/src/lib/payments/stripeWebhookProcessingCore");
    assert.equal(typeof core.resolveStripeCheckoutCompletedWebhookUpdate, "function");
    const idem = await import("@/src/lib/payments/stripeWebhookIdempotency");
    assert.equal(typeof idem.isStripeWebhookDuplicateInsert, "function");
    const provider = await import(
      "@/src/lib/payments/providers/stripe/stripePaymentProvider.server"
    );
    assert.equal(typeof provider.createStripePaymentProvider, "function");
  });

  it("7. /patient/* portal access module remains cookie/portal-oriented (unchanged surface)", async () => {
    const portal = await import("@/src/lib/patientPortal/patientPortalAccess.server");
    assert.ok(portal);
    const src = read("src/lib/patientPortal/patientPortalAccess.server.ts");
    assert.equal(src.includes("/api/patient/v1"), false);
    assert.equal(src.includes("requirePatientGatewayContext"), false);
  });

  it("8–9. no frontend/staff routes depend on /api/patient/v1 billing", () => {
    const patientLayout = read("app/patient/[tenantId]/layout.tsx");
    const patientIndex = read("app/patient/[tenantId]/page.tsx");
    assert.equal(patientLayout.includes("/api/patient/v1"), false);
    assert.equal(patientIndex.includes("/api/patient/v1"), false);

    // Staff revenue panel must not call patient gateway.
    const revenuePanel = read("src/components/fi-admin/revenue/PatientRevenueInvoicesPanel.tsx");
    assert.equal(revenuePanel.includes("/api/patient/v1"), false);
  });

  it("10. patient gateway billing wraps existing services and does not redefine staff mutations", () => {
    const billingServer = read("src/lib/patientPortal/patientGatewayBilling.server.ts");
    assert.ok(billingServer.includes("loadPatientInvoiceSummary"));
    assert.ok(billingServer.includes("createPaymentRequestForInvoice"));
    assert.equal(billingServer.includes("from(\"fi_invoices\").update"), false);
    assert.equal(billingServer.includes("amount_paid_cents:"), false);

    const webhook = read("app/api/fi-payments/stripe/webhook/route.ts");
    // Webhook still uses existing reconciler; audit is additive only.
    assert.ok(webhook.includes("recordGatewayPaymentSuccess"));
    assert.ok(webhook.includes("writePatientGatewayAudit"));
    assert.ok(webhook.includes("verifyWebhook"));
  });
});
