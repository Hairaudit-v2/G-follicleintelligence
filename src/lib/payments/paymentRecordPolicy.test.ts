import assert from "node:assert/strict";
import test from "node:test";

import { isPaymentMutationRole } from "@/src/lib/payments/paymentRecordModel";

test("payment mutation roles: crm_operator cannot mutate payments", () => {
  assert.equal(isPaymentMutationRole("crm_operator"), false);
});

test("payment mutation roles: manager and finance can mutate", () => {
  assert.equal(isPaymentMutationRole("manager"), true);
  assert.equal(isPaymentMutationRole("finance"), true);
});

test("payment mutation roles: reception cannot mutate", () => {
  assert.equal(isPaymentMutationRole("reception"), false);
});
