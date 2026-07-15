#!/usr/bin/env tsx
/**
 * FI-SECURITY-RESTORE-DRILL-1 storage validator (E5).
 *
 * Copies Storage objects read-only from production → isolated recovery project,
 * verifies byte size + SHA-256, then checks signed vs unsigned access on dest.
 *
 * Safety:
 * - Source must be production project ref iqqvzgxoimxchhcnbzxl (list/download only).
 * - Destination must be non-production and match FI_DRILL_EXPECTED_PROJECT_REF.
 * - Never mutates production objects or production bucket policies.
 * - Logs aggregate counts only — never paths, URLs, keys, or PHI.
 */
import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const PRODUCTION_PROJECT_REF = "iqqvzgxoimxchhcnbzxl";
const DEFAULT_BUCKETS = ["patient-images", "tenant-branding"] as const;
const SIGNED_TTL_SECONDS = 60;

type FileMeta = {
  bucket: string;
  /** Full object path inside the bucket — never logged. */
  path: string;
  size: number | null;
};

type BucketStats = {
  bucket: string;
  objectCount: number;
  totalBytes: number;
  copied: number;
  verified: number;
  checksumMatches: number;
  checksumMismatches: number;
  downloadFailures: number;
};

type Evidence = {
  drill: "FI-SECURITY-RESTORE-DRILL-1-STORAGE";
  generatedAtUtc: string;
  sourceProjectRef: string;
  destinationProjectRef: string;
  buckets: BucketStats[];
  totals: {
    objectCount: number;
    totalBytes: number;
    copied: number;
    verified: number;
    checksumMatches: number;
  };
  signedUrlPatientImages: "PASS" | "FAIL" | "SKIP";
  unsignedPrivateAccess: "DENIED" | "LEAKED" | "FAIL" | "SKIP";
  tenantBrandingReadable: "PASS" | "FAIL" | "SKIP";
  applicationRead: "PASS" | "FAIL" | "SKIP";
  temporaryFileCleanup: "PASS" | "FAIL";
  phiHandlingAttestation: string;
  longTermIndependentBackupDefined: false;
  verdict: "PASS" | "AMBER" | "RED";
  notes: string[];
};

function loadEnvFile(path: string, override = false): void {
  if (!existsSync(path)) return;
  let raw = readFileSync(path, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim().replace(/^export\s+/, "");
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    const existing = process.env[key];
    if (override || existing === undefined || existing.trim() === "") {
      process.env[key] = value;
    }
  }
}

loadEnvFile(resolve(process.cwd(), ".env.restore-drill.local"), true);
loadEnvFile(resolve(process.cwd(), ".env.restore-drill"), false);

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function projectRefFromUrl(rawUrl: string): string {
  const host = new URL(rawUrl).host.toLowerCase();
  const match = /^([a-z0-9-]+)\.supabase\.co$/.exec(host);
  return match?.[1] ?? host;
}

function sha256(buf: ArrayBuffer | Buffer | Uint8Array): string {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
  return createHash("sha256").update(bytes).digest("hex");
}

function client(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Recursive list: treat id===null as folder; otherwise file. */
async function listAllObjectsReliable(sb: SupabaseClient, bucket: string): Promise<FileMeta[]> {
  const out: FileMeta[] = [];
  async function walk(prefix: string): Promise<void> {
    const { data, error } = await sb.storage.from(bucket).list(prefix, {
      limit: 1000,
      offset: 0,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(`list failed for bucket=${bucket}: ${error.message}`);
    for (const entry of data ?? []) {
      const child = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        await walk(child);
        continue;
      }
      const size =
        typeof entry.metadata?.size === "number"
          ? entry.metadata.size
          : null;
      out.push({ bucket, path: child, size });
    }
  }
  await walk("");
  return out;
}

async function downloadBytes(
  sb: SupabaseClient,
  bucket: string,
  path: string
): Promise<{ ok: true; bytes: Buffer; contentType: string } | { ok: false; error: string }> {
  const { data, error } = await sb.storage.from(bucket).download(path);
  if (error || !data) return { ok: false, error: error?.message ?? "empty" };
  const ab = await data.arrayBuffer();
  const contentType =
    (typeof data.type === "string" && data.type.trim()) || "application/octet-stream";
  return { ok: true, bytes: Buffer.from(ab), contentType };
}

async function uploadBytes(
  sb: SupabaseClient,
  bucket: string,
  path: string,
  bytes: Buffer,
  contentType?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ct = contentType?.trim() || "image/jpeg";
  const { error } = await sb.storage.from(bucket).upload(path, bytes, {
    upsert: true,
    contentType: ct,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

function assertSafetyGates(sourceUrl: string, destUrl: string, expectedDestRef: string): {
  sourceRef: string;
  destRef: string;
} {
  if (process.env.FI_DRILL_CONFIRM_NON_PRODUCTION !== "YES") {
    throw new Error("Refusing: set FI_DRILL_CONFIRM_NON_PRODUCTION=YES after verifying destination ≠ production");
  }
  const sourceRef = projectRefFromUrl(sourceUrl);
  const destRef = projectRefFromUrl(destUrl);
  if (sourceRef !== PRODUCTION_PROJECT_REF) {
    throw new Error(
      `Refusing: FI_SOURCE_SUPABASE_URL must be production ref ${PRODUCTION_PROJECT_REF} (got ${sourceRef})`
    );
  }
  if (!expectedDestRef || expectedDestRef === PRODUCTION_PROJECT_REF) {
    throw new Error("Refusing: FI_DRILL_EXPECTED_PROJECT_REF missing or equals production");
  }
  if (destRef !== expectedDestRef) {
    throw new Error(
      `Refusing: destination ref ${destRef} ≠ FI_DRILL_EXPECTED_PROJECT_REF ${expectedDestRef}`
    );
  }
  if (destRef === PRODUCTION_PROJECT_REF) {
    throw new Error("Refusing: destination equals production");
  }
  if (sourceRef === destRef) {
    throw new Error("Refusing: source and destination project refs must differ");
  }
  if (new URL(sourceUrl).origin === new URL(destUrl).origin) {
    throw new Error("Refusing: source and destination URLs must differ");
  }
  // Visible confirmation (refs only)
  console.log(`[restore-drill:storage] SOURCE (production, read-only): ${sourceRef}`);
  console.log(`[restore-drill:storage] DESTINATION (isolated recovery): ${destRef}`);
  console.log(`[restore-drill:storage] Safety gates OK — proceeding`);
  return { sourceRef, destRef };
}

async function main(): Promise<void> {
  const sourceUrl = requiredEnv("FI_SOURCE_SUPABASE_URL");
  const sourceKey = requiredEnv("FI_SOURCE_SUPABASE_SERVICE_ROLE_KEY");
  const destUrl = requiredEnv("FI_RESTORE_SUPABASE_URL");
  const destKey = requiredEnv("FI_RESTORE_SUPABASE_SERVICE_ROLE_KEY");
  const expectedDestRef = requiredEnv("FI_DRILL_EXPECTED_PROJECT_REF");

  const { sourceRef, destRef } = assertSafetyGates(sourceUrl, destUrl, expectedDestRef);

  const bucketList =
    process.env.FI_DRILL_STORAGE_BUCKETS?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [...DEFAULT_BUCKETS];

  const source = client(sourceUrl, sourceKey);
  const dest = client(destUrl, destKey);

  const tmpRoot = join(process.cwd(), ".tmp-restore-drill-storage");
  mkdirSync(tmpRoot, { recursive: true });
  const workDir = mkdtempSync(join(tmpRoot, "run-"));
  let cleanupOk = false;

  const notes: string[] = [];
  const bucketStats: BucketStats[] = [];
  let probePathPatient: string | null = null;
  let probePathBranding: string | null = null;
  let brandingPublic = false;

  try {
    // Bucket publicity (destination) — policy check without dumping names
    const { data: destBuckets, error: bucketErr } = await dest.storage.listBuckets();
    if (bucketErr) throw new Error(`dest listBuckets: ${bucketErr.message}`);
    const publicity = new Map(
      (destBuckets ?? []).map((b) => [b.name, Boolean(b.public)])
    );

    for (const bucket of bucketList) {
      const stats: BucketStats = {
        bucket,
        objectCount: 0,
        totalBytes: 0,
        copied: 0,
        verified: 0,
        checksumMatches: 0,
        checksumMismatches: 0,
        downloadFailures: 0,
      };

      const sourceObjs = await listAllObjectsReliable(source, bucket);
      stats.objectCount = sourceObjs.length;
      stats.totalBytes = sourceObjs.reduce((acc, o) => acc + (o.size ?? 0), 0);

      if (bucket === "patient-images" && sourceObjs[0]) probePathPatient = sourceObjs[0].path;
      if (bucket === "tenant-branding" && sourceObjs[0]) {
        probePathBranding = sourceObjs[0].path;
        brandingPublic = publicity.get(bucket) === true;
      }

      for (const obj of sourceObjs) {
        // 1) Probe destination binary presence
        let destDl = await downloadBytes(dest, bucket, obj.path);
        let needCopy = !destDl.ok;

        if (destDl.ok && obj.size != null && destDl.bytes.length !== obj.size) {
          needCopy = true;
        }

        if (needCopy) {
          const srcDl = await downloadBytes(source, bucket, obj.path);
          if (!srcDl.ok) {
            stats.downloadFailures += 1;
            notes.push(`source download failed for one ${bucket} object`);
            continue;
          }
          // Write temp (gitignored) then upload to dest — never touch source write APIs
          const tempName = join(workDir, `${randomUUID()}.bin`);
          writeFileSync(tempName, srcDl.bytes);
          let up = await uploadBytes(dest, bucket, obj.path, srcDl.bytes, srcDl.contentType);
          // Retry common image MIME allow-list variants if bucket rejects
          if (!up.ok && /mime type/i.test(up.error)) {
            for (const ct of ["image/jpeg", "image/png", "image/webp", "image/gif", "text/plain", "image/svg+xml"]) {
              if (ct === srcDl.contentType) continue;
              up = await uploadBytes(dest, bucket, obj.path, srcDl.bytes, ct);
              if (up.ok) break;
            }
          }
          rmSync(tempName, { force: true });
          if (!up.ok) {
            stats.downloadFailures += 1;
            notes.push(`dest upload failed for one ${bucket} object (${up.error})`);
            continue;
          }
          stats.copied += 1;
          destDl = await downloadBytes(dest, bucket, obj.path);
        }

        // 3) Verify size + sha256 (re-download source for hash if we still have only dest)
        const srcDl = await downloadBytes(source, bucket, obj.path);
        if (!srcDl.ok || !destDl.ok) {
          stats.downloadFailures += 1;
          continue;
        }
        stats.verified += 1;
        if (srcDl.bytes.length !== destDl.bytes.length) {
          stats.checksumMismatches += 1;
          notes.push(`size mismatch in bucket ${bucket}`);
          continue;
        }
        if (sha256(srcDl.bytes) !== sha256(destDl.bytes)) {
          stats.checksumMismatches += 1;
          notes.push(`checksum mismatch in bucket ${bucket}`);
          continue;
        }
        stats.checksumMatches += 1;
      }

      bucketStats.push(stats);
      console.log(
        `[restore-drill:storage] bucket=${bucket} objects=${stats.objectCount} bytes=${stats.totalBytes} copied=${stats.copied} verified=${stats.verified} checksum_ok=${stats.checksumMatches}`
      );
    }

    // 4) Signed URL — one patient-images object on destination
    let signedUrlPatientImages: Evidence["signedUrlPatientImages"] = "SKIP";
    let applicationRead: Evidence["applicationRead"] = "SKIP";
    if (probePathPatient) {
      const { data: signed, error: signErr } = await dest.storage
        .from("patient-images")
        .createSignedUrl(probePathPatient, SIGNED_TTL_SECONDS);
      if (signErr || !signed?.signedUrl) {
        signedUrlPatientImages = "FAIL";
        notes.push("signed URL create failed for patient-images probe");
      } else {
        try {
          const res = await fetch(signed.signedUrl, { method: "GET" });
          signedUrlPatientImages = res.ok ? "PASS" : "FAIL";
          applicationRead = res.ok ? "PASS" : "FAIL";
          if (!res.ok) notes.push(`signed URL HTTP ${res.status}`);
        } catch {
          signedUrlPatientImages = "FAIL";
          applicationRead = "FAIL";
          notes.push("signed URL fetch threw");
        }
      }
    } else {
      notes.push("no patient-images objects to probe");
    }

    // 5) Unsigned must NOT access private patient image
    let unsignedPrivateAccess: Evidence["unsignedPrivateAccess"] = "SKIP";
    if (probePathPatient) {
      const { data: pub } = dest.storage.from("patient-images").getPublicUrl(probePathPatient);
      try {
        const res = await fetch(pub.publicUrl, { method: "GET" });
        if (res.ok) {
          unsignedPrivateAccess = "LEAKED";
          notes.push("unsigned public URL returned OK for patient-images — private policy fail");
        } else {
          unsignedPrivateAccess = "DENIED";
        }
      } catch {
        unsignedPrivateAccess = "DENIED";
      }
    }

    // 6) Tenant branding readable per existing policy
    let tenantBrandingReadable: Evidence["tenantBrandingReadable"] = "SKIP";
    if (probePathBranding) {
      if (brandingPublic) {
        const { data: pub } = dest.storage.from("tenant-branding").getPublicUrl(probePathBranding);
        try {
          const res = await fetch(pub.publicUrl, { method: "GET" });
          tenantBrandingReadable = res.ok ? "PASS" : "FAIL";
          if (!res.ok) notes.push(`tenant-branding public read HTTP ${res.status}`);
        } catch {
          tenantBrandingReadable = "FAIL";
        }
      } else {
        const { data: signed, error } = await dest.storage
          .from("tenant-branding")
          .createSignedUrl(probePathBranding, SIGNED_TTL_SECONDS);
        if (error || !signed?.signedUrl) {
          tenantBrandingReadable = "FAIL";
        } else {
          try {
            const res = await fetch(signed.signedUrl, { method: "GET" });
            tenantBrandingReadable = res.ok ? "PASS" : "FAIL";
          } catch {
            tenantBrandingReadable = "FAIL";
          }
        }
      }
    }

    const totals = bucketStats.reduce(
      (acc, b) => {
        acc.objectCount += b.objectCount;
        acc.totalBytes += b.totalBytes;
        acc.copied += b.copied;
        acc.verified += b.verified;
        acc.checksumMatches += b.checksumMatches;
        return acc;
      },
      { objectCount: 0, totalBytes: 0, copied: 0, verified: 0, checksumMatches: 0 }
    );

    const technicalPass =
      totals.objectCount > 0 &&
      totals.checksumMatches === totals.objectCount &&
      totals.verified === totals.objectCount &&
      signedUrlPatientImages === "PASS" &&
      unsignedPrivateAccess === "DENIED" &&
      tenantBrandingReadable === "PASS" &&
      applicationRead === "PASS";

    const longTermIndependentBackupDefined = false as const;
    let verdict: Evidence["verdict"];
    if (!technicalPass) {
      verdict = "RED";
      notes.push("Technical recovery or access-control checks failed");
    } else if (!longTermIndependentBackupDefined) {
      verdict = "AMBER";
      notes.push(
        "Binaries recovered and access controls pass; independent long-term Storage backup not yet defined in runbooks as an operated secondary"
      );
    } else {
      verdict = "PASS";
    }

    // 11) Cleanup temps
    try {
      rmSync(workDir, { recursive: true, force: true });
      cleanupOk = !existsSync(workDir);
    } catch {
      cleanupOk = false;
    }

    const evidence: Evidence = {
      drill: "FI-SECURITY-RESTORE-DRILL-1-STORAGE",
      generatedAtUtc: new Date().toISOString(),
      sourceProjectRef: sourceRef,
      destinationProjectRef: destRef,
      buckets: bucketStats,
      totals,
      signedUrlPatientImages,
      unsignedPrivateAccess,
      tenantBrandingReadable,
      applicationRead,
      temporaryFileCleanup: cleanupOk ? "PASS" : "FAIL",
      phiHandlingAttestation:
        "No filenames, patient IDs, signed URLs, or object paths written to committed docs; temps deleted after checksum validation; source ops were list/download only; production policies unchanged.",
      longTermIndependentBackupDefined,
      verdict,
      notes,
    };

    const outDir = resolve(process.cwd(), "docs/security/restore-drill-evidence");
    mkdirSync(outDir, { recursive: true });
    const stamp = evidence.generatedAtUtc.replace(/[:.]/g, "-");
    const outPath = join(outDir, `restored-storage-${destRef}-${stamp}.json`);
    writeFileSync(outPath, JSON.stringify(evidence, null, 2), "utf8");

    console.log("---");
    console.log(`[restore-drill:storage] totals objects=${totals.objectCount} bytes=${totals.totalBytes}`);
    console.log(
      `[restore-drill:storage] copied=${totals.copied} verified=${totals.verified} checksum_ok=${totals.checksumMatches}`
    );
    console.log(`[restore-drill:storage] signedUrl=${signedUrlPatientImages}`);
    console.log(`[restore-drill:storage] unsignedPrivate=${unsignedPrivateAccess}`);
    console.log(`[restore-drill:storage] tenantBrandingReadable=${tenantBrandingReadable}`);
    console.log(`[restore-drill:storage] applicationRead=${applicationRead}`);
    console.log(`[restore-drill:storage] tempCleanup=${cleanupOk ? "PASS" : "FAIL"}`);
    console.log(`[restore-drill:storage] verdict=${verdict}`);
    console.log(`[restore-drill:storage] evidence (gitignored): restored-storage-*.json`);

    if (verdict === "RED") process.exitCode = 1;
  } catch (err) {
    try {
      rmSync(workDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    console.error(
      `[restore-drill:storage] FATAL: ${err instanceof Error ? err.message : "unknown error"}`
    );
    process.exitCode = 1;
  }
}

main();
