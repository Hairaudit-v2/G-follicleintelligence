import "server-only";

import sharp from "sharp";
import type { ImagingQualityServerHeuristic } from "./imageQualityCore";

export type ImageSharpnessHeuristicResult = ImagingQualityServerHeuristic & {
  mean_luminance: number | null;
};

const BLUR_STDEV_CLEAR = 28;
const BLUR_STDEV_POSSIBLE = 18;
const EXPOSURE_UNDER = 55;
const EXPOSURE_OVER = 205;

function blurStatusFromStdev(stdev: number): ImageSharpnessHeuristicResult["blur_status"] {
  if (stdev >= BLUR_STDEV_CLEAR) return "clear";
  if (stdev >= BLUR_STDEV_POSSIBLE) return "possible_blur";
  return "blurred";
}

function exposureStatusFromMean(mean: number): ImageSharpnessHeuristicResult["exposure_status"] {
  if (mean < EXPOSURE_UNDER) return "underexposed";
  if (mean > EXPOSURE_OVER) return "overexposed";
  return "normal";
}

function sharpnessScoreFromStdev(stdev: number): number {
  return Math.max(0, Math.min(100, Math.round((stdev / 40) * 100)));
}

/**
 * Lightweight sharpness / exposure heuristic using sharp grayscale statistics.
 * Fails safely to unknown statuses when analysis is unavailable.
 */
export async function evaluateImageSharpnessHeuristic(
  imageBuffer: Buffer | null | undefined
): Promise<ImageSharpnessHeuristicResult> {
  if (!imageBuffer?.length) {
    return {
      sharpness_score: null,
      blur_status: "unknown",
      exposure_status: "unknown",
      mean_luminance: null,
    };
  }

  try {
    const pipeline = sharp(imageBuffer, { failOn: "none" }).rotate().greyscale().resize(640, 640, {
      fit: "inside",
      withoutEnlargement: true,
    });
    const stats = await pipeline.stats();
    const channel = stats.channels[0];
    if (!channel) {
      return {
        sharpness_score: null,
        blur_status: "unknown",
        exposure_status: "unknown",
        mean_luminance: null,
      };
    }

    const stdev = channel.stdev ?? 0;
    const mean = channel.mean ?? 0;
    return {
      sharpness_score: sharpnessScoreFromStdev(stdev),
      blur_status: blurStatusFromStdev(stdev),
      exposure_status: exposureStatusFromMean(mean),
      mean_luminance: mean,
    };
  } catch {
    return {
      sharpness_score: null,
      blur_status: "unknown",
      exposure_status: "unknown",
      mean_luminance: null,
    };
  }
}