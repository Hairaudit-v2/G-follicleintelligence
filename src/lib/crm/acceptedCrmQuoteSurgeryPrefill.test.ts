import assert from "node:assert/strict";
import test from "node:test";

import { buildSurgeryAppointmentPrefillFromAcceptedQuote } from "@/src/lib/crm/acceptedCrmQuoteSurgeryPrefill";

const quoteId = "750e8400-e29b-41d4-a716-446655440099";
const consId = "850e8400-e29b-41d4-a716-446655440088";

test("appointment prefill includes quote-derived notes, amount, grafts, inclusions, consultation id", () => {
  const { description, initialMetadata } = buildSurgeryAppointmentPrefillFromAcceptedQuote({
    id: quoteId,
    consultation_id: consId,
    subtotal_amount: 12345.67,
    total_amount: null,
    metadata: {
      estimated_grafts_min: 1800,
      estimated_grafts_max: 2200,
      recommended_treatments: ["PRP session", "Exosomes add-on"],
      quote_notes: "FUE crown focus; medical clearance obtained.",
      procedure_days: 1,
    },
    line_items_snapshot: [],
  });
  assert.ok(description.includes(quoteId));
  assert.ok(description.includes("Quoted amount:"));
  assert.ok(description.includes("Procedure day count: 1"));
  assert.ok(description.includes("1800–2200"));
  assert.ok(description.includes("PRP"));
  assert.ok(description.includes("Exosomes"));
  assert.ok(description.includes(consId));
  assert.ok(description.includes("FUE crown focus"));
  assert.equal(initialMetadata.crm_quote_id, quoteId);
  assert.equal(initialMetadata.prefill_consultation_id, consId);
  assert.equal(initialMetadata.graft_count_estimate, "1800–2200");
});
