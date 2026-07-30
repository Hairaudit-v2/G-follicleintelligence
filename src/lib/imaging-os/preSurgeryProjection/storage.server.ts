/**
 * FI-IMAGINGOS-PRE-SURGERY-PROJECTION-1A — Private output storage + validation.
 */

import "server-only";

import { createHash } from "node:crypto";
import sharp from "sharp";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveProjectionGatewayConfig } from "./config.server";
import { ProjectionGatewayError } from "./errors";
import { logProjectionEvent } from "./observability";

export const ALLOWED_PROJECTION_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const MAX_PROJECTION_OUTPUT_BYTES = 15 * 1024 * 1024;
export const MIN_PROJECTION_DIMENSION = 64;
export const MAX_PROJECTION_DIMENSION = 8192;
export const DEFAULT_SIGNED_URL_TTL_SEC = 120;

export type ValidatedProjectionOutput = {
  bytes: Buffer;
  mimeType: string;
  width: number;
  height: number;
  checksum: string;
};

export async function validateProjectionOutputBytes(input: {
  bytes: Buffer;
  mimeType: string;
  jobId: string;
  caseId: string;
}): Promise<ValidatedProjectionOutput> {
  if (!ALLOWED_PROJECTION_MIME_TYPES.has(input.mimeType)) {
    logProjectionEvent({
      event: "output_validation_failed",
      jobId: input.jobId,
      externalCaseId: input.caseId,
      reason: "mime_type",
    });
    throw new ProjectionGatewayError(
      "output_validation_failed",
      "Projection output MIME type is not allowed",
      422
    );
  }
  if (input.bytes.byteLength <= 0 || input.bytes.byteLength > MAX_PROJECTION_OUTPUT_BYTES) {
    logProjectionEvent({
      event: "output_validation_failed",
      jobId: input.jobId,
      externalCaseId: input.caseId,
      reason: "file_size",
    });
    throw new ProjectionGatewayError(
      "output_validation_failed",
      "Projection output file size is outside allowed limits",
      422
    );
  }

  // Block obvious executable / HTML payloads disguised as images.
  const head = input.bytes.subarray(0, Math.min(64, input.bytes.byteLength)).toString("utf8");
  if (/<!DOCTYPE\s+html/i.test(head) || /<script/i.test(head) || head.startsWith("MZ")) {
    logProjectionEvent({
      event: "output_validation_failed",
      jobId: input.jobId,
      externalCaseId: input.caseId,
      reason: "executable_content",
    });
    throw new ProjectionGatewayError(
      "output_validation_failed",
      "Projection output failed safety content checks",
      422
    );
  }

  let meta: sharp.Metadata;
  try {
    meta = await sharp(input.bytes, { failOn: "error" }).metadata();
  } catch {
    logProjectionEvent({
      event: "output_validation_failed",
      jobId: input.jobId,
      externalCaseId: input.caseId,
      reason: "decode_failed",
    });
    throw new ProjectionGatewayError(
      "output_validation_failed",
      "Projection output could not be decoded as an image",
      422
    );
  }

  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (
    width < MIN_PROJECTION_DIMENSION ||
    height < MIN_PROJECTION_DIMENSION ||
    width > MAX_PROJECTION_DIMENSION ||
    height > MAX_PROJECTION_DIMENSION
  ) {
    logProjectionEvent({
      event: "output_validation_failed",
      jobId: input.jobId,
      externalCaseId: input.caseId,
      reason: "dimensions",
    });
    throw new ProjectionGatewayError(
      "output_validation_failed",
      "Projection output dimensions are outside allowed limits",
      422
    );
  }

  const checksum = createHash("sha256").update(input.bytes).digest("hex");
  return {
    bytes: input.bytes,
    mimeType: input.mimeType,
    width,
    height,
    checksum,
  };
}

export function buildProjectionStoragePath(args: {
  tenantId: string;
  caseId: string;
  jobId: string;
  ext: string;
}): string {
  // Opaque private path — tenant-prefixed for isolation; never public.
  return `pre_surgery_projections/${args.tenantId}/${args.caseId}/${args.jobId}/output.${args.ext}`;
}

export function extensionForMime(mimeType: string): string {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

export type StoredProjectionOutput = {
  outputStorageRef: string;
  outputChecksum: string;
  bucket: string;
  path: string;
};

export interface ProjectionStorage {
  store(input: {
    tenantId: string;
    caseId: string;
    jobId: string;
    validated: ValidatedProjectionOutput;
  }): Promise<StoredProjectionOutput>;
  createSignedUrl?(ref: string, ttlSec?: number): Promise<string>;
}

export function createMemoryProjectionStorage(): ProjectionStorage & {
  objects: Map<string, Buffer>;
} {
  const objects = new Map<string, Buffer>();
  return {
    objects,
    async store(input) {
      const ext = extensionForMime(input.validated.mimeType);
      const path = buildProjectionStoragePath({
        tenantId: input.tenantId,
        caseId: input.caseId,
        jobId: input.jobId,
        ext,
      });
      objects.set(path, input.validated.bytes);
      const ref = `memory://${path}`;
      logProjectionEvent({
        event: "output_stored",
        jobId: input.jobId,
        externalCaseId: input.caseId,
        tenantId: input.tenantId,
      });
      return {
        outputStorageRef: ref,
        outputChecksum: input.validated.checksum,
        bucket: "memory",
        path,
      };
    },
  };
}

export function createSupabaseProjectionStorage(
  bucket = resolveProjectionGatewayConfig().storageBucket
): ProjectionStorage {
  return {
    async store(input) {
      const db = supabaseAdmin();
      const ext = extensionForMime(input.validated.mimeType);
      const path = buildProjectionStoragePath({
        tenantId: input.tenantId,
        caseId: input.caseId,
        jobId: input.jobId,
        ext,
      });
      const { error } = await db.storage.from(bucket).upload(path, input.validated.bytes, {
        contentType: input.validated.mimeType,
        upsert: false,
      });
      if (error) throw error;
      const ref = `${bucket}:${path}`;
      logProjectionEvent({
        event: "output_stored",
        jobId: input.jobId,
        externalCaseId: input.caseId,
        tenantId: input.tenantId,
      });
      return {
        outputStorageRef: ref,
        outputChecksum: input.validated.checksum,
        bucket,
        path,
      };
    },
    async createSignedUrl(ref: string, ttlSec = DEFAULT_SIGNED_URL_TTL_SEC) {
      const db = supabaseAdmin();
      const [bucketName, ...rest] = ref.split(":");
      const path = rest.join(":");
      if (!bucketName || !path) {
        throw new ProjectionGatewayError("validation_failed", "Invalid storage ref", 400);
      }
      const { data, error } = await db.storage
        .from(bucketName)
        .createSignedUrl(path, Math.min(ttlSec, DEFAULT_SIGNED_URL_TTL_SEC));
      if (error || !data?.signedUrl) throw error ?? new Error("signed_url_failed");
      return data.signedUrl;
    },
  };
}

export function assertCrossCaseStorageAccess(args: {
  refCaseId: string;
  requestedCaseId: string;
}): void {
  if (args.refCaseId !== args.requestedCaseId) {
    throw new ProjectionGatewayError(
      "cross_case_denied",
      "Cross-case projection storage access denied",
      403
    );
  }
}
