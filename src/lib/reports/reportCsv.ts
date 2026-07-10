import type { ReportGenerateResult } from "@/src/lib/reports/reportTypes";

export function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Generic CSV for a ReportGenerateResult (metrics + optional table). */
export function reportResultToCsv(result: ReportGenerateResult): string {
  const lines: string[] = [];
  lines.push(`Report,${csvEscape(result.title)}`);
  lines.push(`Period,${result.periodStart},${result.periodEnd}`);
  lines.push(`Generated,${result.generatedAt}`);
  lines.push(`Currency,${result.currency}`);
  lines.push("");
  for (const m of result.metrics) {
    lines.push(`${csvEscape(m.label)},${csvEscape(m.value)}`);
  }
  lines.push("");
  if (result.table && result.table.rows.length > 0) {
    lines.push(result.table.columns.map((c) => csvEscape(c.label)).join(","));
    for (const row of result.table.rows) {
      lines.push(
        result.table.columns
          .map((c) => csvEscape(row[c.key] == null ? "" : String(row[c.key])))
          .join(",")
      );
    }
  } else {
    lines.push("No detail rows");
  }
  return lines.join("\n");
}

export function reportCsvFilename(reportId: string, periodStart: string, periodEnd: string): string {
  const safe = reportId.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
  return `${safe}_${periodStart}_${periodEnd}.csv`;
}
