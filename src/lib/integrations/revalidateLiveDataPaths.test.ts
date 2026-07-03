import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FI_REFERENCE_DATA_TAG,
  FI_TENANT_REFERENCE_TAG_PREFIX,
  revalidateLiveDataSurfacesForTenant,
} from "./revalidateLiveDataPaths.server";

describe("revalidateLiveDataSurfacesForTenant", () => {
  it("is exported for integration sync callers", () => {
    assert.equal(typeof revalidateLiveDataSurfacesForTenant, "function");
    assert.equal(FI_TENANT_REFERENCE_TAG_PREFIX, "fi-tenant-");
    assert.equal(FI_REFERENCE_DATA_TAG, "fi-reference-data");
  });
});
