import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildTenantStoragePathPrefix,
  isAbsoluteStoragePathReference,
  validateDualWriteStorageLocation,
} from "./dualWriteStoragePathValidation";

const TENANT = "11111111-1111-4111-8111-111111111111";

describe("dualWriteStoragePathValidation", () => {
  it("accepts tenant-prefixed paths in allowed buckets", () => {
    const path = `${buildTenantStoragePathPrefix(TENANT)}cases/case-1/front.jpg`;
    const result = validateDualWriteStorageLocation({
      tenantId: TENANT,
      storageBucket: "patient-images",
      storagePath: path,
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.storage_path, path);
  });

  it("rejects cross-tenant storage paths", () => {
    const result = validateDualWriteStorageLocation({
      tenantId: TENANT,
      storageBucket: "case-files",
      storagePath: "tenant/other-tenant/cases/1.jpg",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /tenant isolation/);
  });

  it("rejects disallowed buckets", () => {
    const result = validateDualWriteStorageLocation({
      tenantId: TENANT,
      storageBucket: "fi-intakes",
      storagePath: `${buildTenantStoragePathPrefix(TENANT)}intake.jpg`,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /not allowed/);
  });

  it("rejects URL storage paths", () => {
    assert.equal(isAbsoluteStoragePathReference("https://cdn.example.com/img.jpg"), true);
    const result = validateDualWriteStorageLocation({
      tenantId: TENANT,
      storageBucket: "patient-images",
      storagePath: "https://cdn.example.com/img.jpg",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /must not be a URL/);
  });
});