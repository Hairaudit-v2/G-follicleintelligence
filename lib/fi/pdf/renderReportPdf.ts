/**
 * PDF renderer for FI reports. Consumes report_json only.
 * Branding (logo, colours, footer) from report.branding.
 */
import { PDFDocument, StandardFonts, rgb, RGB } from "pdf-lib";
import type { ReportJson, ReportJsonBranding } from "../reportSchema";

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 50;
const CONTENT_W = PAGE_W - MARGIN * 2;

const DEFAULT_GOLD = rgb(198 / 255, 167 / 255, 94 / 255);
const LIGHT = rgb(0.92, 0.92, 0.9);
const MUTED = rgb(0.78, 0.78, 0.82);

type PDFPage = import("pdf-lib").PDFPage;
type PDFFont = import("pdf-lib").PDFFont;

function parseHexColor(hex: string | null | undefined): RGB {
  if (!hex || typeof hex !== "string") return DEFAULT_GOLD;
  const m = hex.replace(/^#/, "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return DEFAULT_GOLD;
  return rgb(
    parseInt(m[1], 16) / 255,
    parseInt(m[2], 16) / 255,
    parseInt(m[3], 16) / 255
  );
}

type BrandingColors = {
  accent: RGB;
  background: RGB;
  brandName: string;
  footerText: string;
};

function resolveBranding(branding?: ReportJsonBranding | null): BrandingColors {
  return {
    accent: parseHexColor(branding?.primary_color ?? "#C6A75E"),
    background: parseHexColor(branding?.secondary_color ?? "#0F1B2D"),
    brandName: branding?.brand_name ?? "Follicle Intelligence™",
    footerText:
      branding?.footer_text ??
      "Confidential. For patient use only. This report does not constitute medical advice.",
  };
}

function drawPageBackground(page: PDFPage, colors: BrandingColors) {
  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_W,
    height: PAGE_H,
    color: colors.background,
  });
}

function drawHeader(
  page: PDFPage,
  helvetica: PDFFont,
  helveticaBold: PDFFont,
  pageNum: number,
  totalPages: number,
  colors: BrandingColors
) {
  page.drawText(colors.brandName, {
    x: MARGIN,
    y: PAGE_H - 28,
    size: 10,
    font: helveticaBold,
    color: colors.accent,
  });
  page.drawText(`Page ${pageNum} of ${totalPages} | v1.0`, {
    x: PAGE_W - MARGIN - 80,
    y: PAGE_H - 28,
    size: 8,
    font: helvetica,
    color: LIGHT,
  });
  page.drawLine({
    start: { x: MARGIN, y: PAGE_H - 38 },
    end: { x: PAGE_W - MARGIN, y: PAGE_H - 38 },
    thickness: 0.5,
    color: colors.accent,
  });
}

function drawFooter(
  page: PDFPage,
  helvetica: PDFFont,
  ref: string,
  colors: BrandingColors,
  partnerRefCode?: string | null
) {
  const refLine = partnerRefCode ? `Ref: ${ref} | Partner: ${partnerRefCode}` : `Ref: ${ref}`;
  page.drawText(refLine, {
    x: MARGIN,
    y: 30,
    size: 7,
    font: helvetica,
    color: MUTED,
  });
  page.drawText(colors.footerText, {
    x: MARGIN,
    y: 18,
    size: 6,
    font: helvetica,
    color: MUTED,
    maxWidth: CONTENT_W,
  });
}

function drawText(
  page: PDFPage,
  yRef: { current: number },
  text: string,
  size: number,
  font: PDFFont,
  boldFont: PDFFont,
  bold = false,
  color = LIGHT
) {
  const f = bold ? boldFont : font;
  const lineH = size * 1.3 + 2;
  page.drawText(text, {
    x: MARGIN,
    y: yRef.current,
    size,
    font: f,
    color,
    maxWidth: CONTENT_W,
  });
  yRef.current -= lineH;
}

function drawBar(
  page: PDFPage,
  y: { current: number },
  label: string,
  value: number,
  maxVal: number,
  helvetica: PDFFont,
  accentColor: RGB
) {
  const barW = 200;
  const barH = 8;
  const fillW = maxVal > 0 ? (value / maxVal) * barW : 0;

  page.drawText(label, {
    x: MARGIN,
    y: y.current,
    size: 9,
    font: helvetica,
    color: LIGHT,
    maxWidth: 180,
  });
  y.current -= 2;

  page.drawRectangle({
    x: MARGIN,
    y: y.current - barH,
    width: barW,
    height: barH,
    color: rgb(0.15, 0.2, 0.28),
  });
  page.drawRectangle({
    x: MARGIN,
    y: y.current - barH,
    width: Math.max(2, fillW),
    height: barH,
    color:
      value > 0.6
        ? rgb(0.9, 0.5, 0.25)
        : value > 0.4
          ? accentColor
          : rgb(0.35, 0.6, 0.45),
  });
  y.current -= barH + 12;
}

type AndrogenChartData = {
  ages: number[];
  unmanaged: number[];
  dhtManaged: number[];
  patientAge: number;
  patientValue: number;
  annotations: string[];
};

type AndrogenChartLabels = {
  xAxis: string;
  yAxis: string;
  unmanaged: string;
  dhtManaged: string;
  patientLabel: string;
};

type AndrogenChartOptions = {
  ageMin: number;
  ageMax: number;
};

function drawAndrogenCurveChart(
  page: PDFPage,
  yRef: { current: number },
  data: AndrogenChartData,
  labels: AndrogenChartLabels,
  options: AndrogenChartOptions,
  helvetica: PDFFont,
  helveticaBold: PDFFont,
  accentColor: RGB
) {
  const chartLeft = MARGIN;
  const chartTop = yRef.current - 20;
  const chartW = CONTENT_W;
  const chartH = 180;
  const chartBottom = chartTop - chartH;

  const x = (age: number) =>
    chartLeft + ((age - options.ageMin) / (options.ageMax - options.ageMin)) * chartW;
  const maxY = Math.max(...data.unmanaged, ...data.dhtManaged, 0.001);
  const y = (val: number) =>
    chartTop - (val / maxY) * chartH;

  // Draw axis
  page.drawLine({
    start: { x: chartLeft, y: chartBottom },
    end: { x: chartLeft, y: chartTop },
    thickness: 1,
    color: MUTED,
  });
  page.drawLine({
    start: { x: chartLeft, y: chartBottom },
    end: { x: chartLeft + chartW, y: chartBottom },
    thickness: 1,
    color: MUTED,
  });

  // X axis labels
  for (let a = 20; a <= options.ageMax; a += 10) {
    const px = x(a);
    page.drawText(String(a), {
      x: px - 6,
      y: chartBottom - 14,
      size: 8,
      font: helvetica,
      color: MUTED,
    });
  }
  page.drawText(labels.xAxis, {
    x: chartLeft + chartW / 2 - 12,
    y: chartBottom - 28,
    size: 8,
    font: helvetica,
    color: MUTED,
  });

  // Unmanaged curve (solid accent)
  for (let i = 0; i < data.ages.length - 1; i++) {
    page.drawLine({
      start: { x: x(data.ages[i]), y: y(data.unmanaged[i]) },
      end: { x: x(data.ages[i + 1]), y: y(data.unmanaged[i + 1]) },
      thickness: 2,
      color: accentColor,
    });
  }

  // DHT managed curve (dashed, dimmer)
  const goldDim = rgb(0.55, 0.44, 0.28);
  for (let i = 0; i < data.ages.length - 1; i++) {
    page.drawLine({
      start: { x: x(data.ages[i]), y: y(data.dhtManaged[i]) },
      end: { x: x(data.ages[i + 1]), y: y(data.dhtManaged[i + 1]) },
      thickness: 1.2,
      color: goldDim,
    });
  }

  // Patient marker (small square)
  const dotX = x(data.patientAge);
  const dotY = y(data.patientValue);
  const dotSize = 6;
  page.drawRectangle({
    x: dotX - dotSize / 2,
    y: dotY - dotSize / 2,
    width: dotSize,
    height: dotSize,
    color: accentColor,
  });
  page.drawText(labels.patientLabel, {
    x: dotX + 8,
    y: dotY,
    size: 7,
    font: helvetica,
    color: LIGHT,
  });

  // Legend
  page.drawText(`— ${labels.unmanaged}`, {
    x: chartLeft + chartW - 70,
    y: chartTop + 4,
    size: 8,
    font: helvetica,
    color: accentColor,
  });
  page.drawText(`— ${labels.dhtManaged}`, {
    x: chartLeft + chartW - 70,
    y: chartTop - 10,
    size: 8,
    font: helvetica,
    color: goldDim,
  });

  if (data.annotations.length > 0) {
    page.drawText(data.annotations.join(" • "), {
      x: chartLeft,
      y: chartTop + 4,
      size: 7,
      font: helvetica,
      color: rgb(1, 0.71, 0.31),
    });
  }

  yRef.current = chartBottom - 40;
}

/**
 * Renders a PDF from canonical report_json. No other inputs.
 */
export async function renderReportPdf(report: ReportJson): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages: PDFPage[] = [];
  const ref = report.metadata.case_id;
  const partnerRefCode = report.metadata.partner_reference_code ?? null;
  const colors = resolveBranding(report.branding);

  const addPage = () => {
    const p = doc.addPage([PAGE_W, PAGE_H]);
    drawPageBackground(p, colors);
    pages.push(p);
    return p;
  };

  let pageNum = 0;
  const androgenChart = report.charts.find((c) => c.type === "androgen_age_curve");
  const hasAndrogen = !!androgenChart;
  const contentSectionsCount = report.sections.filter((s) => s.id !== "androgen_age").length;
  const sectionPages = Math.ceil(contentSectionsCount / 4) || 0;
  const totalPages =
    2 + (hasAndrogen ? 1 : 0) + sectionPages + 2; // cover, disclaimers+scores, [androgen], [sections], blood, images

  // Page 1: Cover + metadata
  let page = addPage();
  pageNum++;
  drawHeader(page, helvetica, helveticaBold, pageNum, totalPages, colors);
  const yRef = { current: PAGE_H - 55 };
  const draw = (
    p: PDFPage,
    text: string,
    size: number,
    bold = false,
    color = LIGHT
  ) => {
    drawText(p, yRef, text, size, helvetica, helveticaBold, bold, color);
  };

  if (report.branding?.logo_url) {
    try {
      const logoRes = await fetch(report.branding.logo_url);
      const logoBuf = await logoRes.arrayBuffer();
      const isPng =
        logoRes.headers.get("content-type")?.includes("png") ||
        report.branding.logo_url.toLowerCase().endsWith(".png");
      const isJpeg =
        /jpe?g|jfif/i.test(logoRes.headers.get("content-type") ?? "") ||
        /\.jpe?g$/i.test(report.branding.logo_url);
      if (logoBuf.byteLength > 0) {
        if (isPng) {
          const img = await doc.embedPng(new Uint8Array(logoBuf));
          const logoW = 120;
          const logoH = (img.height / img.width) * logoW;
          page.drawImage(img, {
            x: MARGIN,
            y: yRef.current - logoH,
            width: logoW,
            height: logoH,
          });
          yRef.current -= logoH + 16;
        } else if (isJpeg) {
          const img = await doc.embedJpg(new Uint8Array(logoBuf));
          const logoW = 120;
          const logoH = (img.height / img.width) * logoW;
          page.drawImage(img, {
            x: MARGIN,
            y: yRef.current - logoH,
            width: logoW,
            height: logoH,
          });
          yRef.current -= logoH + 16;
        }
      }
    } catch {
      // Ignore logo fetch/embed errors
    }
  }

  page.drawText(colors.brandName, {
    x: MARGIN,
    y: yRef.current,
    size: 24,
    font: helveticaBold,
    color: colors.accent,
  });
  yRef.current -= 28;
  page.drawText("Diagnostic Report", {
    x: MARGIN,
    y: yRef.current,
    size: 16,
    font: helveticaBold,
    color: LIGHT,
  });
  yRef.current -= 36;

  draw(page, "Report details", 12, true);
  draw(page, `Case: ${report.metadata.case_id}`, 10);
  draw(page, `Generated: ${report.metadata.generated_at.slice(0, 10)}`, 10);
  draw(page, `Version: ${report.version}`, 10);
  yRef.current -= 16;

  draw(page, "Risk summary", 12, true);
  draw(
    page,
    `Overall: ${(report.score_summary.overall_score * 10).toFixed(1)}/10 | Tier: ${report.score_summary.risk_tier}`,
    10
  );
  draw(page, report.score_summary.risk_tier_summary, 9);
  yRef.current -= 8;

  drawFooter(page, helvetica, ref, colors, partnerRefCode);

  // Page 2: Disclaimers + Score summary + domain bars (from charts)
  page = addPage();
  pageNum++;
  drawHeader(page, helvetica, helveticaBold, pageNum, totalPages, colors);
  yRef.current = PAGE_H - 55;

  draw(page, "Disclaimers", 14, true, colors.accent);
  yRef.current -= 8;
  for (const d of report.disclaimers) {
    draw(page, `• ${d}`, 9);
  }
  yRef.current -= 16;

  draw(page, "Domain scores", 14, true, colors.accent);
  draw(
    page,
    `Overall: ${(report.score_summary.overall_score * 10).toFixed(1)}/10`,
    10
  );
  yRef.current -= 12;

  const domainChart = report.charts.find((c) => c.type === "domain_scores");
  const maxScore = (domainChart?.data?.maxScore as number) ?? 1;
  for (const s of report.score_summary.sections) {
    drawBar(page, yRef, `${s.label}: ${(s.score * 10).toFixed(1)}`, s.score, maxScore, helvetica, colors.accent);
  }

  drawFooter(page, helvetica, ref, colors, partnerRefCode);

  // Androgen-age chart page (men 15–70 only)
  if (hasAndrogen && androgenChart) {
    const data = androgenChart.data as AndrogenChartData & {
      labels?: AndrogenChartLabels;
      options?: AndrogenChartOptions;
    };
    const labels = (data.labels ?? {}) as AndrogenChartLabels;
    const options = (data.options ?? { ageMin: 15, ageMax: 70 }) as AndrogenChartOptions;

    page = addPage();
    pageNum++;
    drawHeader(page, helvetica, helveticaBold, pageNum, totalPages, colors);
    yRef.current = PAGE_H - 55;

    draw(page, androgenChart.title, 14, true, colors.accent);
    yRef.current -= 16;

    drawAndrogenCurveChart(
      page,
      yRef,
      {
        ages: data.ages ?? [],
        unmanaged: data.unmanaged ?? [],
        dhtManaged: data.dhtManaged ?? [],
        patientAge: data.patientAge ?? 0,
        patientValue: data.patientValue ?? 0,
        annotations: data.annotations ?? [],
      },
      labels,
      options,
      helvetica,
      helveticaBold,
      colors.accent
    );

    const androgenSection = report.sections.find((s) => s.id === "androgen_age");
    if (androgenSection?.content) {
      for (const line of androgenSection.content.split("\n")) {
        draw(page, line.trim(), 8);
      }
    }

    drawFooter(page, helvetica, ref, colors, partnerRefCode);
  }

  // Page 3+: Sections (narrative) — exclude androgen_age, it has its own page
  const contentSections = report.sections.filter((s) => s.id !== "androgen_age");
  const sectionsPerPage = 4;
  for (let i = 0; i < contentSections.length; i += sectionsPerPage) {
    page = addPage();
    pageNum++;
    drawHeader(page, helvetica, helveticaBold, pageNum, totalPages, colors);
    yRef.current = PAGE_H - 55;

    draw(page, "Findings", 14, true, colors.accent);
    yRef.current -= 12;

    const chunk = contentSections.slice(i, i + sectionsPerPage);
    for (const s of chunk) {
      draw(page, s.title, 11, true);
      draw(page, s.content, 9);
      yRef.current -= 8;
    }

    drawFooter(page, helvetica, ref, colors, partnerRefCode);
  }

  // Appendix: Blood markers
  page = addPage();
  pageNum++;
  drawHeader(page, helvetica, helveticaBold, pageNum, totalPages, colors);
  yRef.current = PAGE_H - 55;

  draw(page, "Appendix: Blood markers", 14, true, colors.accent);
  yRef.current -= 8;

  if (report.appendix.blood_markers.length > 0) {
    for (const m of report.appendix.blood_markers.slice(0, 25)) {
      const val = m.value != null ? String(m.value) : "—";
      const unit = m.unit ? ` ${m.unit}` : "";
      const flag = m.flag ? ` [${m.flag}]` : "";
      const refStr = m.referenceRange ? ` (ref: ${m.referenceRange})` : "";
      draw(page, `${m.name}: ${val}${unit}${flag}${refStr}`, 9);
    }
    if (report.appendix.blood_markers.length > 25) {
      draw(
        page,
        `… and ${report.appendix.blood_markers.length - 25} more markers`,
        8
      );
    }
  } else {
    draw(page, "No blood markers in this report.", 9);
  }

  drawFooter(page, helvetica, ref, colors, partnerRefCode);

  // Appendix: Image findings
  page = addPage();
  pageNum++;
  drawHeader(page, helvetica, helveticaBold, pageNum, totalPages, colors);
  yRef.current = PAGE_H - 55;

  draw(page, "Appendix: Image findings", 14, true, colors.accent);
  yRef.current -= 12;

  if (report.appendix.image_findings.length > 0) {
    for (const f of report.appendix.image_findings) {
      draw(page, `${f.filename}:`, 9, true);
      draw(page, f.caption, 8);
      yRef.current -= 6;
    }
  } else {
    draw(page, "No image analysis in this report.", 9);
  }

  drawFooter(page, helvetica, ref, colors, partnerRefCode);

  return doc.save();
}
