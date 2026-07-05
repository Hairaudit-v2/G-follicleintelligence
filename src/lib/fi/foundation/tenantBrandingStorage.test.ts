import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertAllowedTenantLogoFile,
  buildTenantLogoStoragePath,
} from "./tenantBrandingStorageCore";

describe("tenantBrandingStorage", () => {
  it("builds tenant-scoped storage paths", () => {
    const path = buildTenantLogoStoragePath(
      "11111111-1111-1111-1111-111111111111",
      "My Clinic Logo.png",
      "image/png"
    );
    assert.match(path, /^tenant-branding\/11111111-1111-1111-1111-111111111111\/logo\//);
    assert.match(path, /\.png$/);
  });

  it("rejects disallowed mime types", () => {
    const file = new File([new Uint8Array([1, 2, 3])], "x.gif", { type: "image/gif" });
    const res = assertAllowedTenantLogoFile(file);
    assert.equal(res.ok, false);
  });

  it("accepts png uploads within size limit", () => {
    const file = new File([new Uint8Array(100)], "logo.png", { type: "image/png" });
    const res = assertAllowedTenantLogoFile(file);
    assert.equal(res.ok, true);
    if (res.ok) assert.equal(res.contentType, "image/png");
  });
});
