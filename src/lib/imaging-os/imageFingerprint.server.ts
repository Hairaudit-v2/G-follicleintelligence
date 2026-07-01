import "server-only";

import { createHash } from "node:crypto";
import sharp from "sharp";

export type ImageFingerprint = {
  content_hash: string;
  perceptual_hash: string;
};

function averageHashFromPixels(pixels: Uint8Array, size: number): string {
  let sum = 0;
  for (let i = 0; i < pixels.length; i++) sum += pixels[i] ?? 0;
  const avg = sum / pixels.length;
  let bits = "";
  for (let i = 0; i < pixels.length; i++) {
    bits += (pixels[i] ?? 0) >= avg ? "1" : "0";
  }
  return bits.padEnd(size * size, "0");
}

/**
 * Compute SHA-256 content hash and a simple 8x8 average perceptual hash.
 */
export async function computeImageFingerprint(
  imageBuffer: Buffer | null | undefined
): Promise<ImageFingerprint | null> {
  if (!imageBuffer?.length) return null;

  try {
    const content_hash = createHash("sha256").update(imageBuffer).digest("hex");
    const { data, info } = await sharp(imageBuffer, { failOn: "none" })
      .rotate()
      .greyscale()
      .resize(8, 8, { fit: "fill" })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const perceptual_hash = averageHashFromPixels(new Uint8Array(data), info.width);
    return { content_hash, perceptual_hash };
  } catch {
    return null;
  }
}