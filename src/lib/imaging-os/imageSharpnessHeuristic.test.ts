import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";

import { evaluateImageSharpnessHeuristic } from "./imageSharpnessHeuristic.server";

async function buildSolidPngBuffer(color: { r: number; g: number; b: number }): Promise<Buffer> {
  return sharp({
    create: { width: 640, height: 480, channels: 3, background: color },
  })
    .png()
    .toBuffer();
}

async function buildNoisyPngBuffer(): Promise<Buffer> {
  const pixels = Buffer.alloc(640 * 480 * 3);
  for (let i = 0; i < pixels.length; i++) pixels[i] = Math.floor(Math.random() * 255);
  return sharp(pixels, { raw: { width: 640, height: 480, channels: 3 } })
    .png()
    .toBuffer();
}

describe("evaluateImageSharpnessHeuristic", () => {
  it("returns unknown for unavailable image buffer", async () => {
    const result = await evaluateImageSharpnessHeuristic(null);
    assert.equal(result.blur_status, "unknown");
    assert.equal(result.exposure_status, "unknown");
    assert.equal(result.sharpness_score, null);
  });

  it("classifies a noisy image as clearer than a flat image", async () => {
    const clear = await evaluateImageSharpnessHeuristic(await buildNoisyPngBuffer());
    const flat = await evaluateImageSharpnessHeuristic(await buildSolidPngBuffer({ r: 120, g: 120, b: 120 }));
    assert.ok((clear.sharpness_score ?? 0) > (flat.sharpness_score ?? 0));
  });

  it("detects underexposed flat images", async () => {
    const dark = await evaluateImageSharpnessHeuristic(await buildSolidPngBuffer({ r: 10, g: 10, b: 10 }));
    assert.equal(dark.exposure_status, "underexposed");
  });

  it("fails safely for invalid buffer", async () => {
    const result = await evaluateImageSharpnessHeuristic(Buffer.from("not-an-image"));
    assert.equal(result.blur_status, "unknown");
    assert.equal(result.exposure_status, "unknown");
  });
});