import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertAllowedTenantLogoFile,
  buildTenantLogoStoragePath,
  readTenantLogoUploadFormData,
} from "./tenantBrandingStorageCore";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

/** Mirrors the client upload handler: append File directly to FormData. */
function buildClientUploadFormData(file: File): FormData {
  const formData = new FormData();
  formData.append("tenantId", TENANT_ID);
  formData.append("adminKey", "secret-key");
  formData.append("logo", file);
  return formData;
}

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

describe("readTenantLogoUploadFormData (Server Action payload shape)", () => {
  it("reads tenantId, adminKey and File out of FormData", () => {
    const file = new File([new Uint8Array(100)], "logo.png", { type: "image/png" });
    const res = readTenantLogoUploadFormData(buildClientUploadFormData(file));
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.tenantId, TENANT_ID);
      assert.equal(res.adminKey, "secret-key");
      assert.ok(res.file instanceof File);
      assert.equal(res.contentType, "image/png");
    }
  });

  it("rejects a missing file cleanly", () => {
    const formData = new FormData();
    formData.append("tenantId", TENANT_ID);
    const res = readTenantLogoUploadFormData(formData);
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.error, "No file provided.");
  });

  it("rejects a missing tenant id cleanly", () => {
    const formData = new FormData();
    formData.append("logo", new File([new Uint8Array(10)], "logo.png", { type: "image/png" }));
    const res = readTenantLogoUploadFormData(formData);
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.error, "Invalid tenant id.");
  });

  it("rejects a non-FormData payload without throwing", () => {
    const res = readTenantLogoUploadFormData({} as unknown as FormData);
    assert.equal(res.ok, false);
  });

  it("returns a plain object result (no class instance / null prototype)", () => {
    const file = new File([new Uint8Array(100)], "logo.png", { type: "image/png" });
    const res = readTenantLogoUploadFormData(buildClientUploadFormData(file));
    const proto = Object.getPrototypeOf(res);
    assert.ok(proto === Object.prototype, "result must be a plain object");
  });

  it("only ever passes the File through FormData, never nested in a plain object", () => {
    // Regression for: "Only plain objects ... can be passed to Server Actions."
    // The client must append the File to FormData; the payload itself must be a
    // FormData instance and the logo entry must be a File.
    const file = new File([new Uint8Array(100)], "logo.png", { type: "image/png" });
    const payload = buildClientUploadFormData(file);
    assert.ok(payload instanceof FormData, "upload payload must be FormData");
    assert.ok(payload.get("logo") instanceof File, "logo entry must be a File");
  });
});
