/**
 * Post-generation identity / containment + seam analysis.
 * Extracted from HairAudit outcomeValidation; extended for 1C seam checks.
 * Flags only — never auto-approves clinical suitability.
 */

import { createHash } from "node:crypto";
import sharp from "sharp";
import type { SharedTechnicalValidationResults } from "@follicle/projection-core/client";

export type OutcomeValidationMeasurement = {
  sourceChecksum: string;
  outputChecksum: string;
  maskChecksum: string;
  widthMatch: boolean;
  heightMatch: boolean;
  mimeOk: boolean;
  byteSize: number;
  outOfMaskMeanDelta: number;
  outOfMaskMaxDelta: number;
  outOfMaskChangedFraction: number;
  faceBandMeanDelta: number;
  backgroundBandMeanDelta: number;
  sourceWidth: number;
  sourceHeight: number;
  outputWidth: number;
  outputHeight: number;
  seamBoundaryMeanDelta: number;
  haloScore: number;
  exposureJumpScore: number;
  seamFlags: string[];
};

export type OutcomeValidationResult =
  | {
      ok: true;
      measurements: OutcomeValidationMeasurement;
      route: "clinician_review" | "technical_review_required";
      technicalValidation: SharedTechnicalValidationResults;
    }
  | {
      ok: false;
      code: "identity_or_containment_failed" | "asset_invalid" | "seam_detected";
      message: string;
      route: "technically_rejected" | "technical_review_required";
      measurements: OutcomeValidationMeasurement | null;
      technicalValidation: SharedTechnicalValidationResults;
    };

const FACE_Y_START = 0.28;
const FACE_Y_END = 0.72;
const FACE_X_START = 0.22;
const FACE_X_END = 0.78;
const BG_EDGE = 0.08;

function meanAbsDiff(
  a: Buffer,
  b: Buffer,
  maskAlpha: Buffer | null,
  w: number,
  h: number,
  opts: {
    outOfMaskOnly?: boolean;
    boundaryRingOnly?: boolean;
    region?: { x0: number; y0: number; x1: number; y1: number };
  }
): { mean: number; max: number; changedFraction: number; samples: number } {
  let sum = 0;
  let max = 0;
  let samples = 0;
  let changed = 0;
  const threshold = 18;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (opts.region) {
        const nx = x / w;
        const ny = y / h;
        if (
          nx < opts.region.x0 ||
          nx > opts.region.x1 ||
          ny < opts.region.y0 ||
          ny > opts.region.y1
        ) {
          continue;
        }
      }
      const i = (y * w + x) * 3;
      const aIdx = y * w + x;
      if (opts.outOfMaskOnly && maskAlpha) {
        if ((maskAlpha[aIdx] ?? 255) < 128) continue;
      }
      if (opts.boundaryRingOnly && maskAlpha) {
        const a0 = maskAlpha[aIdx] ?? 255;
        // Soft transition band near edit boundary.
        if (a0 < 40 || a0 > 220) continue;
      }
      const dr = Math.abs((a[i] ?? 0) - (b[i] ?? 0));
      const dg = Math.abs((a[i + 1] ?? 0) - (b[i + 1] ?? 0));
      const db = Math.abs((a[i + 2] ?? 0) - (b[i + 2] ?? 0));
      const d = (dr + dg + db) / 3;
      sum += d;
      if (d > max) max = d;
      if (d > threshold) changed += 1;
      samples += 1;
    }
  }
  return {
    mean: samples ? sum / samples : 0,
    max,
    changedFraction: samples ? changed / samples : 0,
    samples,
  };
}

/** Detect horizontal seam-like rows (rejected HA fixture pattern). */
function detectHorizontalSeamScore(rgb: Buffer, w: number, h: number): number {
  let worst = 0;
  const yStart = Math.floor(h * 0.05);
  const yEnd = Math.floor(h * 0.45);
  for (let y = yStart; y < yEnd; y++) {
    let rowDiff = 0;
    let samples = 0;
    for (let x = Math.floor(w * 0.2); x < Math.floor(w * 0.8); x++) {
      const i = (y * w + x) * 3;
      const iAbove = ((y - 1) * w + x) * 3;
      const d =
        (Math.abs((rgb[i] ?? 0) - (rgb[iAbove] ?? 0)) +
          Math.abs((rgb[i + 1] ?? 0) - (rgb[iAbove + 1] ?? 0)) +
          Math.abs((rgb[i + 2] ?? 0) - (rgb[iAbove + 2] ?? 0))) /
        3;
      rowDiff += d;
      samples += 1;
    }
    const mean = samples ? rowDiff / samples : 0;
    if (mean > worst) worst = mean;
  }
  return worst;
}

function emptyTech(partial?: Partial<SharedTechnicalValidationResults>): SharedTechnicalValidationResults {
  return {
    mimeOk: false,
    dimensionsOk: false,
    byteSizeOk: false,
    storageObjectExists: false,
    checksumOk: false,
    sourceOutcomeAligned: null,
    faceBandMeanDelta: null,
    outOfMaskMeanDelta: null,
    outOfMaskMaxDelta: null,
    outOfMaskChangedFraction: null,
    backgroundBandMeanDelta: null,
    overallPass: false,
    ...partial,
  };
}

export async function validateProjectedOutcomeAsset(input: {
  sourceBytes: Buffer;
  outputBytes: Buffer;
  maskPng: Buffer;
  maskChecksum: string;
  expectedMime?: string;
  storageObjectExists?: boolean;
}): Promise<OutcomeValidationResult> {
  const sourceChecksum = createHash("sha256").update(input.sourceBytes).digest("hex");
  const outputChecksum = createHash("sha256").update(input.outputBytes).digest("hex");

  let sourceMeta: sharp.Metadata;
  let outputMeta: sharp.Metadata;
  try {
    sourceMeta = await sharp(input.sourceBytes).metadata();
    outputMeta = await sharp(input.outputBytes).metadata();
  } catch {
    return {
      ok: false,
      code: "asset_invalid",
      message: "Could not decode source or output image for validation",
      route: "technically_rejected",
      measurements: null,
      technicalValidation: emptyTech(),
    };
  }

  const sw = sourceMeta.width ?? 0;
  const sh = sourceMeta.height ?? 0;
  const ow = outputMeta.width ?? 0;
  const oh = outputMeta.height ?? 0;
  if (!sw || !sh || !ow || !oh) {
    return {
      ok: false,
      code: "asset_invalid",
      message: "Missing image dimensions",
      route: "technically_rejected",
      measurements: null,
      technicalValidation: emptyTech({ dimensionsOk: false }),
    };
  }

  const targetW = sw;
  const targetH = sh;
  const sourceRgb = await sharp(input.sourceBytes)
    .rotate()
    .resize(targetW, targetH, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer();
  const outputRgb = await sharp(input.outputBytes)
    .rotate()
    .resize(targetW, targetH, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer();
  const maskRaw = await sharp(input.maskPng)
    .ensureAlpha()
    .resize(targetW, targetH, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const maskAlpha = Buffer.alloc(targetW * targetH);
  for (let i = 0; i < targetW * targetH; i++) {
    maskAlpha[i] = maskRaw.data[i * 4 + 3] ?? 255;
  }

  const outOfMask = meanAbsDiff(sourceRgb, outputRgb, maskAlpha, targetW, targetH, {
    outOfMaskOnly: true,
  });
  const faceBand = meanAbsDiff(sourceRgb, outputRgb, maskAlpha, targetW, targetH, {
    outOfMaskOnly: true,
    region: { x0: FACE_X_START, y0: FACE_Y_START, x1: FACE_X_END, y1: FACE_Y_END },
  });
  const backgroundBand = meanAbsDiff(sourceRgb, outputRgb, null, targetW, targetH, {
    region: { x0: 0, y0: 0, x1: BG_EDGE, y1: 1 },
  });
  const boundary = meanAbsDiff(sourceRgb, outputRgb, maskAlpha, targetW, targetH, {
    boundaryRingOnly: true,
  });
  const horizontalSeam = detectHorizontalSeamScore(outputRgb, targetW, targetH);
  const exposureJump = boundary.max;
  const haloScore = boundary.changedFraction;

  const mimeOk =
    (outputMeta.format === "jpeg" ||
      outputMeta.format === "png" ||
      outputMeta.format === "webp") &&
    (!input.expectedMime ||
      input.expectedMime.includes(outputMeta.format) ||
      (input.expectedMime.includes("jpeg") && outputMeta.format === "jpeg"));

  const seamFlags: string[] = [];
  if (horizontalSeam > 28) seamFlags.push("visible_horizontal_seam");
  if (boundary.mean > 24) seamFlags.push("abrupt_colour_or_exposure_at_boundary");
  if (haloScore > 0.35) seamFlags.push("haloing");
  if (exposureJump > 110) seamFlags.push("extreme_exposure_jump");

  const measurements: OutcomeValidationMeasurement = {
    sourceChecksum,
    outputChecksum,
    maskChecksum: input.maskChecksum,
    widthMatch: ow === sw,
    heightMatch: oh === sh,
    mimeOk,
    byteSize: input.outputBytes.byteLength,
    outOfMaskMeanDelta: outOfMask.mean,
    outOfMaskMaxDelta: outOfMask.max,
    outOfMaskChangedFraction: outOfMask.changedFraction,
    faceBandMeanDelta: faceBand.mean,
    backgroundBandMeanDelta: backgroundBand.mean,
    sourceWidth: sw,
    sourceHeight: sh,
    outputWidth: ow,
    outputHeight: oh,
    seamBoundaryMeanDelta: boundary.mean,
    haloScore,
    exposureJumpScore: exposureJump,
    seamFlags,
  };

  const technicalValidation: SharedTechnicalValidationResults = {
    mimeOk,
    dimensionsOk: Boolean(ow && oh),
    byteSizeOk: input.outputBytes.byteLength >= 8_000,
    storageObjectExists: input.storageObjectExists ?? false,
    checksumOk: Boolean(outputChecksum),
    sourceOutcomeAligned: ow === sw && oh === sh ? true : null,
    faceBandMeanDelta: faceBand.mean,
    outOfMaskMeanDelta: outOfMask.mean,
    outOfMaskMaxDelta: outOfMask.max,
    outOfMaskChangedFraction: outOfMask.changedFraction,
    backgroundBandMeanDelta: backgroundBand.mean,
    overallPass: false,
  };

  if (!mimeOk || input.outputBytes.byteLength < 8_000) {
    return {
      ok: false,
      code: "asset_invalid",
      message: "Output asset failed MIME/size validation",
      route: "technically_rejected",
      measurements,
      technicalValidation,
    };
  }

  const identityFail =
    faceBand.mean > 12 ||
    outOfMask.mean > 18 ||
    outOfMask.max > 90 ||
    outOfMask.changedFraction > 0.08 ||
    backgroundBand.mean > 22;

  if (identityFail) {
    return {
      ok: false,
      code: "identity_or_containment_failed",
      message:
        "Projected outcome failed out-of-mask / identity preservation checks. Asset held for technical rejection — not approved.",
      route: "technically_rejected",
      measurements,
      technicalValidation,
    };
  }

  if (seamFlags.length > 0) {
    technicalValidation.overallPass = false;
    return {
      ok: false,
      code: "seam_detected",
      message: `Seam/boundary analysis flagged: ${seamFlags.join(", ")}. Requires technical review — not clinically approved.`,
      route: "technical_review_required",
      measurements,
      technicalValidation,
    };
  }

  technicalValidation.overallPass = true;
  return {
    ok: true,
    measurements,
    route: "clinician_review",
    technicalValidation,
  };
}

/** Pure seam flag helper for unit tests / regression fixtures. */
export function evaluateSeamFlags(input: {
  horizontalSeamScore: number;
  boundaryMean: number;
  haloScore: number;
  exposureJump: number;
}): string[] {
  const flags: string[] = [];
  if (input.horizontalSeamScore > 28) flags.push("visible_horizontal_seam");
  if (input.boundaryMean > 24) flags.push("abrupt_colour_or_exposure_at_boundary");
  if (input.haloScore > 0.35) flags.push("haloing");
  if (input.exposureJump > 110) flags.push("extreme_exposure_jump");
  return flags;
}
