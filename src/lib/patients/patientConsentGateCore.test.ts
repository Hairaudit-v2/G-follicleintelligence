import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { photographyConsentGateSatisfied } from "./patientConsentGateCore";

describe("photographyConsentGateSatisfied", () => {
  it("allows capture when photo_clinical instance is signed", () => {
    assert.equal(
      photographyConsentGateSatisfied({
        photoClinicalSigned: true,
        vaultConsentDocumentPresent: false,
      }),
      true
    );
  });

  it("falls back to vault document when framework unsigned", () => {
    assert.equal(
      photographyConsentGateSatisfied({
        photoClinicalSigned: false,
        vaultConsentDocumentPresent: true,
      }),
      true
    );
  });

  it("blocks when neither framework nor vault satisfied", () => {
    assert.equal(
      photographyConsentGateSatisfied({
        photoClinicalSigned: false,
        vaultConsentDocumentPresent: false,
      }),
      false
    );
  });
});
