import "server-only";

import sharp from "sharp";
import type { FiImageWatermarkPosition } from "./fiImageAttributionTypes";

export type FiImageWatermarkOverlayInput = {
  imageBuffer: Buffer;
  contentType: string;
  clinicName: string;
  captureDateLabel: string;
  patientName?: string | null;
  marketingHeadline?: string | null;
  marketingSubline?: string | null;
  logoBuffer?: Buffer | null;
  opacity: number;
  position: FiImageWatermarkPosition;
  includePatientName: boolean;
  mode: "clinical_watermark" | "marketing_export";
};

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function gravityForPosition(position: FiImageWatermarkPosition): sharp.Gravity {
  if (position === "bottom_center") return "south";
  if (position === "top_right") return "northeast";
  return "southeast";
}

function buildWatermarkSvg(args: {
  width: number;
  height: number;
  lines: string[];
  opacity: number;
  position: FiImageWatermarkPosition;
}): Buffer {
  const pad = Math.max(12, Math.round(Math.min(args.width, args.height) * 0.02));
  const fontSize = Math.max(14, Math.round(Math.min(args.width, args.height) * 0.028));
  const lineHeight = Math.round(fontSize * 1.35);
  const blockHeight = args.lines.length * lineHeight + pad;
  const blockWidth = Math.min(args.width - pad * 2, Math.max(220, Math.round(args.width * 0.45)));
  const yStart = fontSize + pad;

  let x = pad;
  let anchor = "start";
  if (args.position === "bottom_center") {
    x = Math.round(args.width / 2);
    anchor = "middle";
  } else if (args.position === "top_right" || args.position === "bottom_right") {
    x = args.width - pad;
    anchor = "end";
  }

  const y =
    args.position === "top_right"
      ? yStart
      : args.height - blockHeight + fontSize;

  const textNodes = args.lines
    .map((line, i) => {
      const yy = y + i * lineHeight;
      return `<text x="${x}" y="${yy}" text-anchor="${anchor}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" fill="rgba(255,255,255,${args.opacity})" stroke="rgba(0,0,0,${Math.min(0.55, args.opacity + 0.15)})" stroke-width="1">${escapeXml(line)}</text>`;
    })
    .join("");

  const svg = `<svg width="${args.width}" height="${args.height}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${args.position === "bottom_center" ? Math.round((args.width - blockWidth) / 2) : args.position === "top_right" || args.position === "bottom_right" ? args.width - blockWidth - pad : pad}" y="${args.position === "top_right" ? pad : args.height - blockHeight}" width="${blockWidth}" height="${blockHeight}" rx="8" fill="rgba(0,0,0,${Math.min(0.35, args.opacity + 0.05)})"/>
  ${textNodes}
</svg>`;
  return Buffer.from(svg);
}

export async function applyFiImageWatermarkOverlay(input: FiImageWatermarkOverlayInput): Promise<Buffer> {
  const base = sharp(input.imageBuffer, { failOn: "none" }).rotate();
  const meta = await base.metadata();
  const width = meta.width ?? 1200;
  const height = meta.height ?? 900;

  const lines: string[] = [];
  if (input.mode === "marketing_export") {
    lines.push(input.marketingHeadline?.trim() || input.clinicName.trim() || "Clinic");
    if (input.marketingSubline?.trim()) lines.push(input.marketingSubline.trim());
    lines.push(input.captureDateLabel.trim());
  } else {
    lines.push(input.clinicName.trim() || "Clinic");
    lines.push(`Captured ${input.captureDateLabel.trim()}`);
    if (input.includePatientName && input.patientName?.trim()) {
      lines.unshift(input.patientName.trim());
    }
  }

  const composites: sharp.OverlayOptions[] = [
    {
      input: buildWatermarkSvg({
        width,
        height,
        lines,
        opacity: input.opacity,
        position: input.position,
      }),
      gravity: gravityForPosition(input.position),
    },
  ];

  if (input.logoBuffer && input.logoBuffer.length > 0) {
    const logoSize = Math.max(48, Math.round(Math.min(width, height) * 0.08));
    const logo = await sharp(input.logoBuffer).resize(logoSize, logoSize, { fit: "inside" }).png().toBuffer();
    composites.unshift({
      input: logo,
      gravity: input.position === "top_right" ? "northeast" : "southeast",
      blend: "over",
    });
  }

  const outFormat = input.contentType.includes("png") ? "png" : "jpeg";
  const pipeline = base.composite(composites);
  if (outFormat === "png") {
    return pipeline.png({ compressionLevel: 8 }).toBuffer();
  }
  return pipeline.jpeg({ quality: 92, mozjpeg: true }).toBuffer();
}

export async function fetchLogoBuffer(logoUrl: string | null | undefined): Promise<Buffer | null> {
  const url = logoUrl?.trim();
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) return null;
    await sharp(buf).metadata();
    return buf;
  } catch {
    return null;
  }
}

export async function probeImageDimensions(buffer: Buffer): Promise<{ width: number | null; height: number | null }> {
  try {
    const meta = await sharp(buffer, { failOn: "none" }).metadata();
    return {
      width: meta.width ?? null,
      height: meta.height ?? null,
    };
  } catch {
    return { width: null, height: null };
  }
}

export async function fileToBuffer(file: File): Promise<Buffer> {
  const ab = await file.arrayBuffer();
  return Buffer.from(ab);
}
