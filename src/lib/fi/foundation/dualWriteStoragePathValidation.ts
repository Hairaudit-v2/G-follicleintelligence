/**
 * Dual-write ingest storage validation (pure — unit tested).
 */

export const DUAL_WRITE_ALLOWED_STORAGE_BUCKETS = new Set(["patient-images", "case-files"]);

export type DualWriteStorageValidationResult =
  | { ok: true; storage_bucket: string; storage_path: string }
  | { ok: false; error: string };

export function buildTenantStoragePathPrefix(tenantId: string): string {
  return `tenant/${tenantId.trim()}/`;
}

export function isAbsoluteStoragePathReference(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (/^https?:\/\//i.test(v)) return true;
  if (v.startsWith("//")) return true;
  return false;
}

export function validateDualWriteStorageLocation(input: {
  tenantId: string;
  storageBucket: string;
  storagePath: string;
}): DualWriteStorageValidationResult {
  const tid = input.tenantId.trim();
  const bucket = input.storageBucket.trim();
  const path = input.storagePath.trim();

  if (!tid) return { ok: false, error: "tenantId is required for dual-write storage validation." };
  if (!bucket) return { ok: false, error: "storage_bucket is required." };
  if (!path) return { ok: false, error: "storage_path is required." };
  if (isAbsoluteStoragePathReference(path)) {
    return { ok: false, error: "storage_path must not be a URL; use a bucket object key." };
  }
  if (!DUAL_WRITE_ALLOWED_STORAGE_BUCKETS.has(bucket)) {
    return { ok: false, error: `storage_bucket "${bucket}" is not allowed for dual-write ingest.` };
  }

  const prefix = buildTenantStoragePathPrefix(tid);
  const normalizedPath = path.replace(/\\/g, "/");
  if (!normalizedPath.startsWith(prefix)) {
    return {
      ok: false,
      error: `storage_path must start with "${prefix}" for tenant isolation.`,
    };
  }

  return { ok: true, storage_bucket: bucket, storage_path: normalizedPath };
}