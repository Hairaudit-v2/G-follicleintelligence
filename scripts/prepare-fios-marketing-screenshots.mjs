/**
 * FI-WEB-REFRESH-1I-A — Faithful FI OS screenshot derivatives only.
 *
 * Allowed: rename, WebP convert, optional proportional resize, no content change.
 * Forbidden: masks, blur, text overlays, chrome redraw, metric edits, generative edit.
 *
 * Source of truth: public/os Images/*.jpeg
 * Output: public/os-images/fios-*.webp
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SOURCE_DIR = path.join(ROOT, "public", "os Images");
const OUT_DIR = path.join(ROOT, "public", "os-images");

/** WebP quality — high enough to preserve small UI text */
const WEBP_QUALITY = 92;

/**
 * Max output width. Originals are 3314px; keep at or below original (no upscale).
 * null = keep original width.
 */
const MAX_WIDTH = null;

/**
 * @type {Array<{ key: string, source: string, out: string }>}
 */
const JOBS = [
  {
    key: "today",
    source: "Screenshot_16-7-2026_20454_follicleintelligence.ai.jpeg",
    out: "fios-today-command-centre.webp",
  },
  {
    key: "calendar",
    source: "Screenshot_16-7-2026_20516_follicleintelligence.ai.jpeg",
    out: "fios-calendar-week-view.webp",
  },
  {
    key: "frontDesk",
    source: "Screenshot_16-7-2026_20555_follicleintelligence.ai.jpeg",
    out: "fios-front-desk-today.webp",
  },
  {
    key: "patients",
    source: "Screenshot_16-7-2026_20539_follicleintelligence.ai.jpeg",
    out: "fios-patient-journey-workspace.webp",
  },
  {
    key: "pipeline",
    source: "Screenshot_16-7-2026_201155_follicleintelligence.ai.jpeg",
    out: "fios-leadflow-pipeline-board.webp",
  },
  {
    key: "surgery",
    source: "Screenshot_16-7-2026_201356_follicleintelligence.ai.jpeg",
    out: "fios-surgery-workspace.webp",
  },
];

fs.mkdirSync(OUT_DIR, { recursive: true });

const results = [];

for (const job of JOBS) {
  const srcPath = path.join(SOURCE_DIR, job.source);
  if (!fs.existsSync(srcPath)) {
    throw new Error(`Missing source: ${srcPath}`);
  }

  const beforeBytes = fs.statSync(srcPath).size;
  const meta = await sharp(srcPath).metadata();
  const srcW = meta.width ?? 0;
  const srcH = meta.height ?? 0;

  let pipeline = sharp(srcPath).rotate(); // honour EXIF only; no content edit

  const targetW =
    MAX_WIDTH && srcW > MAX_WIDTH ? MAX_WIDTH : srcW;
  if (targetW < srcW) {
    pipeline = pipeline.resize({
      width: targetW,
      withoutEnlargement: true,
      fit: "inside",
    });
  }

  const outPath = path.join(OUT_DIR, job.out);
  // Overwrite any prior altered derivative
  if (fs.existsSync(outPath)) {
    fs.unlinkSync(outPath);
  }

  const info = await pipeline
    .webp({
      quality: WEBP_QUALITY,
      effort: 5,
      smartSubsample: false,
    })
    .toFile(outPath);

  const afterBytes = fs.statSync(outPath).size;
  const row = {
    key: job.key,
    source: job.source,
    out: job.out,
    sourceDims: `${srcW}x${srcH}`,
    outDims: `${info.width}x${info.height}`,
    crop: "None",
    conversion: "webp",
    quality: WEBP_QUALITY,
    contentAlterations: "None",
    beforeBytes,
    afterBytes,
    verification: "Exact faithful derivative",
  };
  results.push(row);
  console.log(
    `${job.key}: ${row.sourceDims} → ${row.outDims} | ${(beforeBytes / 1024).toFixed(1)}KB → ${(afterBytes / 1024).toFixed(1)}KB | content alterations: None`
  );
}

const manifestPath = path.join(OUT_DIR, "manifest.json");
fs.writeFileSync(
  manifestPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      task: "FI-WEB-REFRESH-1I-A",
      note: "Faithful derivatives only. No masking, blur, text replacement, or chrome redraw. Source data is FI Demonstration Clinic demonstration data.",
      webpQuality: WEBP_QUALITY,
      maxWidth: MAX_WIDTH,
      crop: "None",
      results,
    },
    null,
    2
  )
);

console.log(`Wrote ${manifestPath}`);
