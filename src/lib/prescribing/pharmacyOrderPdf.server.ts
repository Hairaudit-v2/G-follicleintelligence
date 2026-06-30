import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import type { PharmacyOrderPdfContext } from "@/src/lib/prescribing/pharmacyOrderPayload.server";

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;
const LINE_H = 13;

function parseHex(hex: string | null | undefined) {
  if (!hex || typeof hex !== "string") return rgb(0.2, 0.45, 0.65);
  const m = hex.replace(/^#/, "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return rgb(0.2, 0.45, 0.65);
  return rgb(parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255);
}

function wrapToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const t = text.replace(/\r\n/g, "\n").trim();
  if (!t) return [];
  const lines: string[] = [];
  for (const para of t.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        cur = next;
      } else {
        if (cur) lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
  }
  return lines;
}

function drawWrapped(
  page: PDFPage,
  yRef: { y: number },
  text: string,
  size: number,
  font: PDFFont,
  color = rgb(0.1, 0.1, 0.12)
) {
  const lines = wrapToWidth(text, font, size, CONTENT_W);
  for (const ln of lines) {
    if (yRef.y < MARGIN + 60) return;
    page.drawText(ln, { x: MARGIN, y: yRef.y, size, font, color, maxWidth: CONTENT_W });
    yRef.y -= LINE_H;
  }
}

/**
 * Compound pharmacy order summary (DoctorOS 1B) — pdf-lib, no external render service.
 */
export async function renderPharmacyOrderPdfBytes(
  ctx: PharmacyOrderPdfContext
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const accent = parseHex(ctx.accentHex);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  const yRef = { y: PAGE_H - MARGIN };

  page.drawRectangle({
    x: 0,
    y: PAGE_H - 48,
    width: PAGE_W,
    height: 48,
    color: rgb(0.06, 0.1, 0.16),
  });
  page.drawText(ctx.clinicName.slice(0, 80), {
    x: MARGIN,
    y: PAGE_H - 30,
    size: 13,
    font: fontBold,
    color: accent,
  });
  yRef.y = PAGE_H - 58;

  drawWrapped(page, yRef, "COMPOUND PHARMACY ORDER", 11, fontBold, rgb(0.15, 0.2, 0.28));
  yRef.y -= 4;
  drawWrapped(page, yRef, `Prescription ID: ${ctx.prescriptionId}`, 9, font);
  if (ctx.signedAt) drawWrapped(page, yRef, `Signed: ${ctx.signedAt}`, 9, font);
  yRef.y -= 6;

  drawWrapped(page, yRef, "Patient", 10, fontBold);
  drawWrapped(page, yRef, ctx.patientName, 9, font);
  if (ctx.patientEmail) drawWrapped(page, yRef, `Email: ${ctx.patientEmail}`, 9, font);
  yRef.y -= 4;

  drawWrapped(page, yRef, "Shipping / delivery", 10, fontBold);
  drawWrapped(page, yRef, `Delivery type: ${ctx.deliveryType?.trim() || "—"}`, 9, font);
  drawWrapped(page, yRef, ctx.shippingAddress, 9, font);
  yRef.y -= 4;

  drawWrapped(page, yRef, "Pharmacy", 10, fontBold);
  drawWrapped(page, yRef, ctx.pharmacyName, 9, font);
  drawWrapped(page, yRef, `Contact: ${ctx.pharmacyEmail}`, 9, font);
  if (ctx.pharmacyPhone) drawWrapped(page, yRef, `Phone: ${ctx.pharmacyPhone}`, 9, font);
  if (ctx.pharmacyAddress) drawWrapped(page, yRef, ctx.pharmacyAddress, 9, font);
  yRef.y -= 4;

  drawWrapped(page, yRef, "Prescriber", 10, fontBold);
  drawWrapped(page, yRef, `${ctx.prescriberName} (${ctx.prescriberRole})`, 9, font);
  yRef.y -= 4;

  drawWrapped(page, yRef, "Medications", 10, fontBold);
  for (const it of ctx.items) {
    if (yRef.y < MARGIN + 120) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      yRef.y = PAGE_H - MARGIN;
    }
    drawWrapped(
      page,
      yRef,
      `• ${it.medication_name} — ${it.quantity_label} (${it.form_type})`,
      9,
      fontBold
    );
    drawWrapped(page, yRef, `  Dose: ${it.dose_instructions}`, 9, font);
    if (it.repeats_instructions)
      drawWrapped(page, yRef, `  Repeats: ${it.repeats_instructions}`, 9, font);
    if (it.reorder_rule) drawWrapped(page, yRef, `  Reorder: ${it.reorder_rule}`, 9, font);
    drawWrapped(
      page,
      yRef,
      `  Prescriber confirmed repeat rules: ${it.repeat_confirmed ? "Yes" : "No"}`,
      8,
      font,
      it.repeat_confirmed ? rgb(0.1, 0.45, 0.2) : rgb(0.6, 0.2, 0.15)
    );
    yRef.y -= 2;
  }

  if (ctx.clinicalNotes?.trim()) {
    if (yRef.y < MARGIN + 100) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      yRef.y = PAGE_H - MARGIN;
    }
    yRef.y -= 4;
    drawWrapped(page, yRef, "Clinical notes", 10, fontBold);
    drawWrapped(page, yRef, ctx.clinicalNotes, 9, font);
  }

  yRef.y -= 8;
  if (yRef.y < MARGIN + 40) {
    page = doc.addPage([PAGE_W, PAGE_H]);
    yRef.y = PAGE_H - MARGIN;
  }
  drawWrapped(
    page,
    yRef,
    "Prepared in Follicle Intelligence (DoctorOS). Verify patient identity and legal prescribing requirements before dispensing.",
    8,
    font,
    rgb(0.35, 0.35, 0.38)
  );

  return doc.save();
}
