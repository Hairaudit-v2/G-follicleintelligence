import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { PatientSafeImagingExportCard } from "./patientSafeImagingExportCore";

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

export async function renderPatientSafeImagingHandoutPdfBytes(input: {
  title: string;
  disclaimer: string;
  cards: PatientSafeImagingExportCard[];
  clinicName?: string | null;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  const y = { y: PAGE_H - MARGIN };

  page.drawText(input.title, { x: MARGIN, y: y.y, size: 16, font: bold, color: rgb(0.05, 0.05, 0.08) });
  y.y -= 22;
  if (input.clinicName?.trim()) {
    page.drawText(input.clinicName.trim(), {
      x: MARGIN,
      y: y.y,
      size: 10,
      font: regular,
      color: rgb(0.35, 0.35, 0.4),
    });
    y.y -= 16;
  }
  drawLines(page, y, wrapToWidth(input.disclaimer, regular, 9, CONTENT_W), 9, regular, rgb(0.4, 0.4, 0.45));
  y.y -= 8;

  for (const card of input.cards) {
    if (y.y < MARGIN + 80) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y.y = PAGE_H - MARGIN;
    }
    page.drawText("Image", { x: MARGIN, y: y.y, size: 11, font: bold });
    y.y -= LINE_H + 2;
    const rows = [
      `Photo date: ${card.photo_date ? card.photo_date.slice(0, 10) : "—"}`,
      `View: ${card.view_label ?? "—"}`,
      `Session: ${card.session_type ?? "—"}`,
      `Progress: ${card.progress_label ?? "—"}`,
      `Status: ${card.status_message}`,
    ];
    drawLines(page, y, rows, 10, regular);
    y.y -= 6;
  }

  return pdf.save();
}