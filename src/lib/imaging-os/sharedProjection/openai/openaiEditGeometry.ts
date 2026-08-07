/**
 * Aspect-preserving pad/unpad for gpt-image edit sizes.
 * Extracted from HairAudit openaiEditGeometry — never stretch-fill mismatched ratios.
 */

import sharp from "sharp";

export type OpenAiEditCanvasSize = "1024x1024" | "1024x1536" | "1536x1024";

export type AspectFitLayout = {
  canvasWidth: number;
  canvasHeight: number;
  contentWidth: number;
  contentHeight: number;
  offsetX: number;
  offsetY: number;
  scale: number;
  sourceWidth: number;
  sourceHeight: number;
};

export function parseOpenAiEditSize(size: OpenAiEditCanvasSize | "auto"): {
  width: number;
  height: number;
} | null {
  if (size === "auto") return null;
  const [w, h] = size.split("x").map((n) => Number(n));
  if (!w || !h) return null;
  return { width: w, height: h };
}

export function computeAspectFitLayout(input: {
  sourceWidth: number;
  sourceHeight: number;
  canvasWidth: number;
  canvasHeight: number;
}): AspectFitLayout {
  const { sourceWidth, sourceHeight, canvasWidth, canvasHeight } = input;
  const scale = Math.min(canvasWidth / sourceWidth, canvasHeight / sourceHeight);
  const contentWidth = Math.max(1, Math.round(sourceWidth * scale));
  const contentHeight = Math.max(1, Math.round(sourceHeight * scale));
  const offsetX = Math.floor((canvasWidth - contentWidth) / 2);
  const offsetY = Math.floor((canvasHeight - contentHeight) / 2);
  return {
    canvasWidth,
    canvasHeight,
    contentWidth,
    contentHeight,
    offsetX,
    offsetY,
    scale,
    sourceWidth,
    sourceHeight,
  };
}

export async function padImageToCanvas(input: {
  bytes: Buffer;
  layout: AspectFitLayout;
  background?: { r: number; g: number; b: number; alpha: number };
}): Promise<Buffer> {
  const { layout } = input;
  const bg = input.background ?? { r: 0, g: 0, b: 0, alpha: 255 };
  const resized = await sharp(input.bytes)
    .resize(layout.contentWidth, layout.contentHeight, { fit: "fill", kernel: "lanczos3" })
    .ensureAlpha()
    .toBuffer();

  return sharp({
    create: {
      width: layout.canvasWidth,
      height: layout.canvasHeight,
      channels: 4,
      background: bg,
    },
  })
    .composite([{ input: resized, left: layout.offsetX, top: layout.offsetY }])
    .png()
    .toBuffer();
}

export async function unpadCanvasToSource(input: {
  bytes: Buffer;
  layout: AspectFitLayout;
  outputFormat?: "jpeg" | "png";
}): Promise<{ bytes: Buffer; mimeType: "image/jpeg" | "image/png" }> {
  const { layout } = input;
  const cropped = await sharp(input.bytes)
    .extract({
      left: layout.offsetX,
      top: layout.offsetY,
      width: layout.contentWidth,
      height: layout.contentHeight,
    })
    .resize(layout.sourceWidth, layout.sourceHeight, {
      fit: "fill",
      kernel: "lanczos3",
    })
    .toBuffer();

  if (input.outputFormat === "png") {
    const bytes = await sharp(cropped).png().toBuffer();
    return { bytes, mimeType: "image/png" };
  }
  const bytes = await sharp(cropped).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
  return { bytes, mimeType: "image/jpeg" };
}

export function pickOpenAiEditSize(widthPx: number, heightPx: number): OpenAiEditCanvasSize {
  if (!widthPx || !heightPx) return "1024x1024";
  const ratio = widthPx / heightPx;
  if (ratio < 0.85) return "1024x1536";
  if (ratio > 1.15) return "1536x1024";
  return "1024x1024";
}
