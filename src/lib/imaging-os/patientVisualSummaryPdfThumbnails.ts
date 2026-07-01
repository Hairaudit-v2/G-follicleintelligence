/**
 * ImagingOS Phase 7B — fetch and embed patient-safe PDF thumbnails (testable helpers).
 */

import type { PDFDocument } from "pdf-lib";
import type { PatientVisualSummaryPhotoPanelItem } from "./patientVisualSummaryReportTypes";

export type PdfThumbnailFetchResult =
  | { ok: true; bytes: Uint8Array; contentType: string }
  | { ok: false; reason: string };

export async function fetchImageBytesFromSignedUrl(
  signedUrl: string,
  fetchFn: typeof fetch = fetch
): Promise<PdfThumbnailFetchResult> {
  const url = signedUrl?.trim();
  if (!url || !url.startsWith("http")) {
    return { ok: false, reason: "missing_or_invalid_url" };
  }
  try {
    const res = await fetchFn(url, { cache: "no-store" });
    if (!res.ok) return { ok: false, reason: `http_${res.status}` };
    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length === 0) return { ok: false, reason: "empty_body" };
    return { ok: true, bytes: buf, contentType };
  } catch {
    return { ok: false, reason: "fetch_error" };
  }
}

export async function embedPatientSafeThumbnail(
  pdf: PDFDocument,
  bytes: Uint8Array,
  contentType: string
): Promise<{ ok: true; image: Awaited<ReturnType<PDFDocument["embedJpg"]>> } | { ok: false }> {
  const ct = contentType.toLowerCase();
  try {
    if (ct.includes("png")) {
      const image = await pdf.embedPng(bytes);
      return { ok: true, image };
    }
    const image = await pdf.embedJpg(bytes);
    return { ok: true, image };
  } catch {
    try {
      const image = await pdf.embedPng(bytes);
      return { ok: true, image };
    } catch {
      return { ok: false };
    }
  }
}

export function photosWithSignedUrls(
  photos: PatientVisualSummaryPhotoPanelItem[]
): PatientVisualSummaryPhotoPanelItem[] {
  return photos.filter((p) => Boolean(p.preview_signed_url?.trim()));
}