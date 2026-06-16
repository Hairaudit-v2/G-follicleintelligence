import assert from "node:assert/strict";
import test from "node:test";

import { readCrmQuoteIdFromObjectMetadata } from "@/src/lib/revenueOs/paymentsInboxQuoteMetadata";

const qid = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

test("readCrmQuoteIdFromObjectMetadata parses invoice metadata for inbox tracing", () => {
  assert.equal(readCrmQuoteIdFromObjectMetadata({ crm_quote_id: qid }), qid);
  assert.equal(readCrmQuoteIdFromObjectMetadata({ crm_quote_id: `  ${qid}  ` }), qid);
  assert.equal(readCrmQuoteIdFromObjectMetadata({ crm_quote_id: "not-a-uuid" }), null);
  assert.equal(readCrmQuoteIdFromObjectMetadata({}), null);
});

test("payment inbox trace: invoice metadata quote + anchors can be read together", () => {
  const invoice = {
    metadata: { crm_quote_id: qid, source: "consultation_quote" },
    case_id: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
    patient_id: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33",
  };
  const quote = readCrmQuoteIdFromObjectMetadata(invoice.metadata as Record<string, unknown>);
  assert.equal(quote, qid);
  assert.ok(invoice.case_id);
  assert.ok(invoice.patient_id);
});
