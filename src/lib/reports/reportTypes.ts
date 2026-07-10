/** Shared report result shapes for the Reports Library (Phase 1). */

export type ReportMetric = {
  key: string;
  label: string;
  value: string;
  hint?: string;
};

export type ReportTableColumn = {
  key: string;
  label: string;
  align?: "left" | "right";
};

export type ReportTableRow = Record<string, string | number | null>;

export type ReportResultTable = {
  columns: ReportTableColumn[];
  rows: ReportTableRow[];
};

export type ReportGenerateResult = {
  reportId: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  currency: string;
  metrics: ReportMetric[];
  table: ReportResultTable | null;
  emptyMessage?: string;
};
