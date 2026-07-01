import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isPatientPortalImagingEnabled } from "./patientPortalImagingEnabled";

describe("isPatientPortalImagingEnabled", () => {
  it("defaults off in production when unset", () => {
    assert.equal(
      isPatientPortalImagingEnabled({ NODE_ENV: "production", FI_PORTAL_IMAGING_ENABLED: undefined }),
      false
    );
  });

  it("enables in production when flag is affirmative", () => {
    assert.equal(
      isPatientPortalImagingEnabled({ NODE_ENV: "production", FI_PORTAL_IMAGING_ENABLED: "true" }),
      true
    );
    assert.equal(
      isPatientPortalImagingEnabled({ NODE_ENV: "production", FI_PORTAL_IMAGING_ENABLED: "1" }),
      true
    );
  });

  it("defaults on in non-production when unset", () => {
    assert.equal(
      isPatientPortalImagingEnabled({ NODE_ENV: "development", FI_PORTAL_IMAGING_ENABLED: undefined }),
      true
    );
  });

  it("respects explicit false in non-production", () => {
    assert.equal(
      isPatientPortalImagingEnabled({ NODE_ENV: "development", FI_PORTAL_IMAGING_ENABLED: "false" }),
      false
    );
  });
});