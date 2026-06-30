import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { crmUnexpectedErrorPublicMessage } from "./crmUnexpectedErrorMessage";

describe("crmUnexpectedErrorPublicMessage", () => {
  it("hides internal details in production", () => {
    const msg = crmUnexpectedErrorPublicMessage(
      new Error("relation fi_patients does not exist"),
      "production"
    );
    assert.equal(msg, "An unexpected error occurred.");
  });

  it("returns the error message in non-production", () => {
    const msg = crmUnexpectedErrorPublicMessage(
      new Error("relation fi_patients does not exist"),
      "development"
    );
    assert.equal(msg, "relation fi_patients does not exist");
  });
});