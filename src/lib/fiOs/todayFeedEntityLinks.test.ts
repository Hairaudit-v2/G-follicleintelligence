import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  consultationEntityHref,
  pathologyResultEntityHref,
  paymentEntityHref,
  resolveFinancialAttentionHref,
  staffEntityHref,
  surgeryCaseEntityHref,
} from "@/src/lib/fiOs/todayFeedEntityLinks";

const BASE = "/fi-admin/11111111-1111-1111-1111-111111111111";
const PAYMENT = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const CASE = "ffffffff-ffff-ffff-ffff-ffffffffffff";
const PATIENT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const RESULT = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
const CONSULT = "11111111-2222-3333-4444-555555555555";
const STAFF = "66666666-7777-8888-9999-aaaaaaaaaaaa";

describe("todayFeedEntityLinks", () => {
  it("builds payment entity hrefs", () => {
    assert.equal(paymentEntityHref(BASE, PAYMENT, "payment_record"), `${BASE}/financial/payments/${PAYMENT}`);
    assert.equal(
      paymentEntityHref(BASE, PAYMENT, "payment_request"),
      `${BASE}/financial/payment-requests/${PAYMENT}`
    );
  });

  it("builds surgery, pathology, consultation, and staff hrefs", () => {
    assert.equal(surgeryCaseEntityHref(BASE, CASE), `${BASE}/cases/${CASE}`);
    assert.equal(
      pathologyResultEntityHref(BASE, PATIENT, RESULT),
      `${BASE}/patients/${PATIENT}/blood-results/${RESULT}`
    );
    assert.equal(consultationEntityHref(BASE, CONSULT), `${BASE}/consultations/${CONSULT}`);
    assert.equal(staffEntityHref(BASE, STAFF), `${BASE}/workforce-os/staff/${STAFF}`);
  });

  it("resolveFinancialAttentionHref prefers payment request then case", () => {
    assert.equal(
      resolveFinancialAttentionHref({
        base: BASE,
        paymentRequestId: PAYMENT,
        caseId: CASE,
        aggregateFallbackHref: `${BASE}/financial/dashboard`,
      }),
      `${BASE}/financial/payment-requests/${PAYMENT}`
    );
    assert.equal(
      resolveFinancialAttentionHref({
        base: BASE,
        caseId: CASE,
        aggregateFallbackHref: `${BASE}/financial/dashboard`,
      }),
      `${BASE}/cases/${CASE}`
    );
  });
});
