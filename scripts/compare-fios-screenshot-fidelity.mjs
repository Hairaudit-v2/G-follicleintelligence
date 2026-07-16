import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(ROOT, "docs/marketing/screenshots/fi-web-refresh-1i-a");
fs.mkdirSync(outDir, { recursive: true });

const pairs = [
  ["today", "Screenshot_16-7-2026_20454_follicleintelligence.ai.jpeg", "fios-today-command-centre.webp"],
  ["calendar", "Screenshot_16-7-2026_20516_follicleintelligence.ai.jpeg", "fios-calendar-week-view.webp"],
  ["frontDesk", "Screenshot_16-7-2026_20555_follicleintelligence.ai.jpeg", "fios-front-desk-today.webp"],
  ["patients", "Screenshot_16-7-2026_20539_follicleintelligence.ai.jpeg", "fios-patient-journey-workspace.webp"],
  ["pipeline", "Screenshot_16-7-2026_201155_follicleintelligence.ai.jpeg", "fios-leadflow-pipeline-board.webp"],
  ["surgery", "Screenshot_16-7-2026_201356_follicleintelligence.ai.jpeg", "fios-surgery-workspace.webp"],
];

for (const [key, src, out] of pairs) {
  const left = await sharp(path.join(ROOT, "public/os Images", src))
    .resize({ width: 1400, withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer();
  const right = await sharp(path.join(ROOT, "public/os-images", out))
    .resize({ width: 1400, withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer();
  const L = await sharp(left).metadata();
  const R = await sharp(right).metadata();
  const gap = 16;
  const canvasW = (L.width ?? 0) + gap + (R.width ?? 0);
  const canvasH = Math.max(L.height ?? 0, R.height ?? 0) + 40;
  const labelSvg = Buffer.from(
    `<svg width="${canvasW}" height="40" xmlns="http://www.w3.org/2000/svg">` +
      `<text x="20" y="28" font-family="Segoe UI, sans-serif" font-size="18" fill="#111">ORIGINAL</text>` +
      `<text x="${(L.width ?? 0) + gap + 20}" y="28" font-family="Segoe UI, sans-serif" font-size="18" fill="#111">CORRECTED WEBP</text>` +
      `</svg>`
  );
  await sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([
      { input: labelSvg, top: 0, left: 0 },
      { input: left, top: 40, left: 0 },
      { input: right, top: 40, left: (L.width ?? 0) + gap },
    ])
    .jpeg({ quality: 88 })
    .toFile(path.join(outDir, `compare-${key}.jpg`));
  console.log("compare", key);
}

console.log("DONE", outDir);
