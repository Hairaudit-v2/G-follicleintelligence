import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { PatientVisualSummaryReport } from "./patientVisualSummaryReportTypes";
import { formatZoneDisplayValue } from "./patientVisualSummaryReportCore";

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;
const LINE_H = 14;

function wrapToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const t = text.replace(/\r\n/g, "\n").trim();
  if (!t) return [];
  const lines: string[] = [];
  for (const para of t.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) cur = next;
      else {
        if (cur) lines.push(cur);
        cur = font.widthOfTextAtSize(w, size) <= maxWidth ? w : w.slice(0, 40);
      }
    }
    if (cur) lines.push(cur);
  }
  return lines;
}

function drawLines(
  page: PDFPage,
  yRef: { y: number },
  lines: string[],
  size: number,
  font: PDFFont,
  color = rgb(0.1, 0.1, 0.12)
) {
  for (const line of lines) {
    if (yRef.y < MARGIN + 40) break;
    page.drawText(line, { x: MARGIN, y: yRef.y, size, font, color });
    yRef.y -= LINE_H;
  }
}

function ensureSpace(pdf: PDFDocument, y: { y: number }, pageRef: { page: PDFPage }): void {
  if (y.y < MARGIN + 60) {
    pageRef.page = pdf.addPage([PAGE_W, PAGE_H]);
    y.y = PAGE_H - MARGIN;
  }
}

function sectionTitle(
  pdf: PDFDocument,
  pageRef: { page: PDFPage },
  y: { y: number },
  bold: PDFFont,
  title: string
) {
  ensureSpace(pdf, y, pageRef);
  y.y -= 8;
  pageRef.page.drawText(title, {
    x: MARGIN,
    y: y.y,
    size: 12,
    font: bold,
    color: rgb(0.05, 0.05, 0.08),
  });
  y.y -= LINE_H + 4;
}

export async function renderPatientVisualSummaryPdfBytes(
  report: PatientVisualSummaryReport
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const pageRef = { page };
  const y = { y: PAGE_H - MARGIN };

  page.drawText(report.header.reportTypeLabel, {
    x: MARGIN,
    y: y.y,
    size: 16,
    font: bold,
    color: rgb(0.05, 0.05, 0.08),
  });
  y.y -= 22;

  const headerRows = [
    `Patient: ${report.header.patientDisplay}`,
    report.header.clinicName ? `Clinic: ${report.header.clinicName}` : null,
    report.header.procedureOrAuditDate
      ? `Date: ${report.header.procedureOrAuditDate.slice(0, 10)}`
      : null,
    `Generated: ${report.header.generatedAt.slice(0, 10)}`,
    `Status: ${report.approval.status}`,
  ].filter(Boolean) as string[];

  drawLines(page, y, headerRows, 10, regular);
  y.y -= 4;
  drawLines(
    page,
    y,
    wrapToWidth(report.header.disclaimer, regular, 9, CONTENT_W),
    9,
    regular,
    rgb(0.4, 0.4, 0.45)
  );
  y.y -= 8;

  sectionTitle(pdf, pageRef, y, bold, "Post-op photos");
  for (const photo of report.photoPanel) {
    ensureSpace(pdf, y, pageRef);
    drawLines(
      pageRef.page,
      y,
      [
        `${photo.label}: ${photo.image_id ? "Received" : photo.status_message}`,
        photo.photo_date ? `  Date: ${photo.photo_date.slice(0, 10)}` : null,
      ].filter(Boolean) as string[],
      10,
      regular
    );
  }

  sectionTitle(pdf, pageRef, y, bold, "Graft distribution");
  for (const zone of report.graftDistributionZones) {
    ensureSpace(pdf, y, pageRef);
    drawLines(pageRef.page, y, [zone.label], 10, bold);
    drawLines(pageRef.page, y, [
      `  Grafts: ${formatZoneDisplayValue(zone.graftCount)}`,
      zone.densityRange ? `  Density: ${zone.densityRange}` : null,
    ].filter(Boolean) as string[], 9, regular);
  }

  if (report.hairlinePrinciples.length > 0) {
    sectionTitle(pdf, pageRef, y, bold, "Hairline / design principles");
    drawLines(pageRef.page, y, report.hairlinePrinciples.map((p) => `• ${p}`), 10, regular);
  }

  sectionTitle(pdf, pageRef, y, bold, "Graft type summary");
  const g = report.graftTypeSummary;
  drawLines(pageRef.page, y, [
    `Singles: ${g.singles}`,
    `Doubles: ${g.doubles}`,
    `Triples: ${g.triples}`,
    `4+ hair grafts: ${g.fourPlusHair}`,
    `5-hair grafts: ${g.fiveHair}`,
  ], 10, regular);

  if (report.densityZones.length > 0) {
    sectionTitle(pdf, pageRef, y, bold, "Density gradient");
    for (const dz of report.densityZones) {
      const line = dz.graftsPerCm2 != null
        ? `${dz.label}: ${dz.qualitativeLabel} (${dz.graftsPerCm2} grafts/cm²)`
        : `${dz.label}: ${dz.qualitativeLabel}`;
      drawLines(pageRef.page, y, [line], 10, regular);
    }
  }

  sectionTitle(pdf, pageRef, y, bold, "Expected healing / growth timeline");
  for (const m of report.healingTimeline) {
    drawLines(pageRef.page, y, [`${m.month} month: ${m.label}`], 10, regular);
  }
  drawLines(pageRef.page, y, [report.timelineVariationNote], 9, regular, rgb(0.35, 0.35, 0.4));

  sectionTitle(pdf, pageRef, y, bold, "What we will monitor");
  drawLines(pageRef.page, y, report.monitoringItems.map((m) => `• ${m}`), 10, regular);

  if (report.auditSummary) {
    sectionTitle(pdf, pageRef, y, bold, "Audit summary");
    const a = report.auditSummary;
    drawLines(pageRef.page, y, [
      `Views received: ${a.uploadedViews.length > 0 ? a.uploadedViews.join(", ") : "Not recorded"}`,
      `Image quality: ${a.imageQualityStatus}`,
      `Clinical review: ${a.clinicalReviewStatus}`,
      a.missingOrRetakeViews.length > 0
        ? `Retake requested: ${a.missingOrRetakeViews.join(", ")}`
        : null,
      `Longitudinal comparison: ${a.longitudinalComparisonAvailable ? "Available" : "Not available"}`,
      a.patientSafeSummary,
    ].filter(Boolean) as string[], 10, regular);
  }

  return pdf.save();
}