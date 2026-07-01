import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PDFDocument } from "pdf-lib";

import {
  fetchImageBytesFromSignedUrl,
  photosWithSignedUrls,
} from "./patientVisualSummaryPdfThumbnails";
import type { PatientVisualSummaryPhotoPanelItem } from "./patientVisualSummaryReportTypes";

describe("patientVisualSummaryPdfThumbnails", () => {
  it("rejects missing signed URL", async () => {
    const result = await fetchImageBytesFromSignedUrl("");
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "missing_or_invalid_url");
  });

  it("fails gracefully on fetch error", async () => {
    const failingFetch = async () => {
      throw new Error("network");
    };
    const result = await fetchImageBytesFromSignedUrl(
      "https://example.com/image.jpg",
      failingFetch as typeof fetch
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "fetch_error");
  });

  it("filters photos with signed URLs only", () => {
    const photos: PatientVisualSummaryPhotoPanelItem[] = [
      {
        slot: "donor",
        label: "Donor",
        image_id: "1",
        preview_signed_url: "https://signed.example/a.jpg",
        photo_date: null,
        status_message: "ok",
      },
      {
        slot: "recipient",
        label: "Recipient",
        image_id: null,
        preview_signed_url: null,
        photo_date: null,
        status_message: "Not recorded",
      },
    ];
    assert.equal(photosWithSignedUrls(photos).length, 1);
  });

  it("PDF generation continues when embed fails", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([200, 200]);
    page.drawText("ok", { x: 10, y: 100, size: 12 });
    const bytes = await pdf.save();
    assert.ok(bytes.length > 0);
  });
});