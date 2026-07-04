import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { IMAGING_AI_ANALYSIS_KINDS } from "./ai";
import { captureSourcesMatchForFilter, normalizeFiImageCaptureSource } from "./capture";
import { mapFiOsSourceCapture } from "@/src/lib/imaging/unifiedClassifier/unifiedImageClassifyService.server";
import { matchesImagingReviewQueueFilters, type ReviewQueueFilterRow } from "./review";

const ROOT = process.cwd();

test("UI-safe AI kind import includes graft_tray_count_estimate (7 canonical kinds)", () => {
  assert.equal(IMAGING_AI_ANALYSIS_KINDS.length, 7);
  assert.ok(IMAGING_AI_ANALYSIS_KINDS.includes("graft_tray_count_estimate"));
  assert.ok(IMAGING_AI_ANALYSIS_KINDS.includes("clinical_image_analysis"));
});

test("no divergent IMAGING_AI_ANALYSIS_KINDS array definitions remain", () => {
  const offenders: string[] = [];
  const scanDir = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".git") continue;
        scanDir(full);
        continue;
      }
      if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx")) continue;
      const text = fs.readFileSync(full, "utf8");
      if (!text.includes("IMAGING_AI_ANALYSIS_KINDS")) continue;
      if (full.replace(/\\/g, "/").endsWith("src/lib/imaging-os/imagingAiAnalysisKinds.ts")) {
        continue;
      }
      if (/export const IMAGING_AI_ANALYSIS_KINDS\s*=\s*\[/.test(text)) {
        offenders.push(path.relative(ROOT, full));
      }
    }
  };
  scanDir(path.join(ROOT, "src"));
  assert.deepEqual(offenders, []);
});

test("guided_capture normalizes to imaging_os_wizard", () => {
  assert.equal(normalizeFiImageCaptureSource("guided_capture"), "imaging_os_wizard");
});

test("vie_guided normalizes to vie_capture_wizard", () => {
  assert.equal(normalizeFiImageCaptureSource("vie_guided"), "vie_capture_wizard");
});

test("review queue filter matches capture_source aliases", () => {
  const row: ReviewQueueFilterRow = {
    imageId: "img-1",
    patientId: "patient-1",
    caseId: null,
    metadata: { capture_source: "imaging_os_wizard" },
    aiImageCategory: "donor",
    aiImageCategoryConfidence: 0.8,
    aiImageReviewStatus: "pending",
    createdAt: "2026-07-01T12:00:00.000Z",
    reviewReasons: [],
  };
  assert.equal(matchesImagingReviewQueueFilters(row, { captureSource: "guided_capture" }), true);
  assert.equal(captureSourcesMatchForFilter("guided_capture", "imaging_os_wizard"), true);
  assert.equal(captureSourcesMatchForFilter("vie_guided", "vie_capture_wizard"), true);
});

test("classifier preserves normalized capture_source from request metadata", () => {
  const mapped = mapFiOsSourceCapture({
    source_system: "fi_os",
    source_image_id: "img-1",
    signed_url: "https://example.test/a.jpg",
    capture_source: "imaging_os_wizard",
    upload_source: "fi_os",
  });
  assert.equal(mapped.capture_source, "imaging_os_wizard");

  const legacy = mapFiOsSourceCapture({
    source_system: "fi_os",
    source_image_id: "img-2",
    signed_url: "https://example.test/b.jpg",
    capture_source: "guided_capture",
    upload_source: "fi_os",
  });
  assert.equal(legacy.capture_source, "imaging_os_wizard");

  const defaulted = mapFiOsSourceCapture({
    source_system: "fi_os",
    source_image_id: "img-3",
    signed_url: "https://example.test/c.jpg",
    upload_source: "fi_os",
  });
  assert.equal(defaulted.capture_source, "imaging_os_wizard");
});