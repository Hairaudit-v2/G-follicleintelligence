/**
 * FI-IMAGINGOS-PRE-SURGERY-PROJECTION-1A — Strict runtime schema for HairAudit requests.
 */

import { z } from "zod";
import {
  HA_CANONICAL_SNAPSHOT_SCHEMA_VERSION,
  HA_PROJECTION_REQUEST_SCHEMA_VERSION,
  PROJECTION_MODES,
} from "./types";

export const MAX_PROJECTION_REQUEST_BYTES = 512_000;

const opaqueRefSchema = z
  .string()
  .min(1)
  .max(2048)
  .refine((v) => !/^(javascript|data|file|vbscript):/i.test(v.trim()), {
    message: "unsafe_url_scheme",
  })
  .refine((v) => !/^https?:\/\//i.test(v.trim()) || !/[<>"']/.test(v), {
    message: "malformed_source_ref",
  });

/** Opaque storage refs preferred; block executable schemes. Signed URLs are discouraged but http(s) allowed if no script payload. */
const sourceImageRefSchema = opaqueRefSchema.refine(
  (v) => {
    const t = v.trim().toLowerCase();
    if (t.startsWith("javascript:") || t.startsWith("data:text/html") || t.startsWith("data:application")) {
      return false;
    }
    return true;
  },
  { message: "unsafe_source_ref" }
);

const nonEmptyId = z.string().min(1).max(128);

const canonicalGeometrySchema = z
  .object({
    hairlineAnnotationIds: z.array(nonEmptyId).max(200),
    recipientZoneAnnotationIds: z.array(nonEmptyId).max(200),
    deferredZones: z.array(z.string().max(128)).max(100),
    excludedZones: z.array(z.string().max(128)).max(100),
    zoneGraftTargets: z
      .array(
        z.object({
          zone: z.string().min(1).max(128),
          grafts: z.number().int().nonnegative(),
          priority: z.string().min(1).max(64),
        })
      )
      .max(100),
  })
  .strict();

export const canonicalProjectionSnapshotSchema = z
  .object({
    schemaVersion: z.literal(HA_CANONICAL_SNAPSHOT_SCHEMA_VERSION),
    caseId: nonEmptyId,
    sourceImageIds: z.array(nonEmptyId).min(1).max(50),
    primarySourceImageId: nonEmptyId,
    imageRoles: z
      .array(
        z.object({
          imageId: nonEmptyId,
          assignedRole: z.string().min(1).max(64),
          orientationDegrees: z.number(),
          mirrored: z.boolean(),
        })
      )
      .max(50),
    approvedObservationIds: z.array(nonEmptyId).max(500),
    approvedGraftPlanId: nonEmptyId,
    approvedGraftPlanVersion: z.number().int().positive(),
    approvedGraftPlanChecksum: z.string().min(8).max(128),
    projectionMode: z.enum(PROJECTION_MODES),
    geometry: canonicalGeometrySchema,
    providerId: z.string().min(1).max(64),
    modelVersion: z.string().min(1).max(128),
    safetyLabelVersion: z.string().min(1).max(128),
    generationPolicyVersion: z.string().min(1).max(128),
    engineVersion: z.string().min(1).max(128),
    sourceImageRefs: z
      .array(
        z.object({
          imageId: nonEmptyId,
          storageRef: sourceImageRefSchema,
        })
      )
      .max(50),
    approvedAnnotationIds: z.array(nonEmptyId).max(500),
  })
  .strict();

export const hairAuditProjectionRequestSchema = z
  .object({
    schemaVersion: z.literal(HA_PROJECTION_REQUEST_SCHEMA_VERSION),
    idempotencyKey: z.string().min(1).max(128).nullable(),
    inputChecksum: z.string().min(8).max(128).nullable(),
    modelVersion: z.string().min(1).max(128),
    mode: z.enum(PROJECTION_MODES),
    caseId: nonEmptyId,
    sourceImageId: nonEmptyId,
    sourceImageRef: sourceImageRefSchema,
    approvedGraftPlanId: nonEmptyId,
    approvedGraftPlanVersion: z.number().int().positive(),
    approvedGraftPlanChecksum: z.string().min(8).max(128),
    approvedAnnotationIds: z.array(nonEmptyId).min(1).max(500),
    constraints: z.unknown(),
    deterministicSeed: z.string().max(256).nullable().optional(),
    canonical: canonicalProjectionSnapshotSchema.nullable(),
    projectionId: z.string().min(1).max(128).nullable().optional(),
    externalProjectionId: z.string().min(1).max(128).nullable().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!data.approvedGraftPlanId || !data.approvedGraftPlanChecksum) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "missing_approved_plan_provenance",
        path: ["approvedGraftPlanId"],
      });
    }
    if (data.canonical) {
      if (data.canonical.caseId !== data.caseId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "canonical_case_mismatch",
          path: ["canonical", "caseId"],
        });
      }
      if (data.canonical.approvedGraftPlanId !== data.approvedGraftPlanId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "canonical_plan_id_mismatch",
          path: ["canonical", "approvedGraftPlanId"],
        });
      }
      if (data.canonical.approvedGraftPlanChecksum !== data.approvedGraftPlanChecksum) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "canonical_plan_checksum_mismatch",
          path: ["canonical", "approvedGraftPlanChecksum"],
        });
      }
      if (data.canonical.projectionMode !== data.mode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "canonical_mode_mismatch",
          path: ["canonical", "projectionMode"],
        });
      }
    }
  });

export type ParsedHairAuditProjectionRequest = z.infer<typeof hairAuditProjectionRequestSchema>;

export function parseHairAuditProjectionRequest(
  raw: unknown
):
  | { ok: true; data: ParsedHairAuditProjectionRequest }
  | { ok: false; code: string; message: string; details?: unknown } {
  const parsed = hairAuditProjectionRequestSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const msg = first?.message ?? "validation_failed";
    let code = "validation_failed";
    if (msg.includes("Invalid literal") || first?.path?.[0] === "schemaVersion") {
      code = "unsupported_schema_version";
    } else if (msg === "unsafe_url_scheme" || msg === "unsafe_source_ref") {
      code = "unsafe_source_ref";
    } else if (msg === "malformed_source_ref") {
      code = "malformed_source_ref";
    } else if (first?.path?.[0] === "mode") {
      code = "invalid_projection_mode";
    } else if (msg.startsWith("canonical_") || msg === "missing_approved_plan_provenance") {
      code = msg;
    }
    return { ok: false, code, message: msg, details: parsed.error.flatten() };
  }
  return { ok: true, data: parsed.data };
}
