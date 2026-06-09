import assert from "node:assert/strict";
import test from "node:test";

import { consultationTypeForBookingType } from "@/src/lib/consultations/consultationBookingLink";

test("consultationTypeForBookingType maps operational booking types", () => {
  assert.equal(consultationTypeForBookingType("prp"), "prp_prf");
  assert.equal(consultationTypeForBookingType("exosomes"), "exosomes");
  assert.equal(consultationTypeForBookingType("consultation"), "scalp_hair_transplant");
});
