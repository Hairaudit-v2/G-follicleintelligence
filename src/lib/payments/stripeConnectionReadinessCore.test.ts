import assert from "node:assert/strict";
import test from "node:test";

import {
  detectStripeSecretKeyMode,
  evaluateStripeAccountBinding,
  evaluateStripeConnectionConfig,
  evaluateStripeWebhookMode,
} from "./stripeConnectionReadinessCore";

test("detects Stripe secret and restricted key modes", () => {
  assert.equal(detectStripeSecretKeyMode("sk_test_example"), "test");
  assert.equal(detectStripeSecretKeyMode("rk_live_example"), "live");
  assert.equal(detectStripeSecretKeyMode("pk_live_public"), null);
});

test("live configuration remains blocked until explicitly allowed", () => {
  const result = evaluateStripeConnectionConfig({
    secretKey: "sk_live_example",
    expectedAccountId: "acct_1TN2F45CMnrQiyQG",
    expectedMode: "live",
    liveModeAllowed: false,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /live mode is blocked/i);
});

test("accepts a fully bound live configuration", () => {
  const result = evaluateStripeConnectionConfig({
    secretKey: "rk_live_example",
    expectedAccountId: "acct_1TN2F45CMnrQiyQG",
    expectedMode: "live",
    liveModeAllowed: true,
  });
  assert.deepEqual(result, { ok: true, mode: "live", errors: [] });
});

test("rejects wrong account or unavailable card payments", () => {
  const errors = evaluateStripeAccountBinding(
    {
      id: "acct_wrong",
      charges_enabled: false,
      capabilities: { card_payments: "pending" },
    },
    "acct_expected"
  );
  assert.equal(errors.length, 3);
});

test("rejects test webhooks in live mode and live webhooks behind kill switch", () => {
  assert.equal(evaluateStripeWebhookMode(false, "live", true).length, 1);
  assert.equal(evaluateStripeWebhookMode(true, "live", false).length, 1);
  assert.deepEqual(evaluateStripeWebhookMode(true, "live", true), []);
});
