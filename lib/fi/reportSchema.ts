/**
 * Canonical report structure for fi_reports.report_json.
 * PDF generator consumes this only. Frontend can preview before PDF.
 * Branding from fi_tenants.config_json.
 */

export const FI_REPORT_JSON_VERSION = 1 as const;

export type ReportJsonBranding = {
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  brand_name?: string | null;
  footer_text?: string | null;
};

export type ReportJsonMetadata = {
  case_id: string;
  report_id?: string;
  model_run_id?: string;
  generated_at: string;
  /** Partner attribution: reference code only (no tenant/partner identifiers to preserve isolation). */
  partner_reference_code?: string | null;
};

export type ReportJsonScoreSection = {
  id: string;
  label: string;
  score: number;
  interpretation?: string;
};

export type ReportJsonScoreSummary = {
  overall_score: number;
  risk_tier: string;
  risk_tier_summary: string;
  sections: ReportJsonScoreSection[];
};

export type ReportJsonContentSection = {
  id: string;
  title: string;
  content: string;
  order: number;
};

export type ReportJsonChartDef = {
  id: string;
  type: "bar" | "radar" | "gauge" | "domain_scores" | "androgen_age_curve";
  title: string;
  data: Record<string, unknown>;
  options?: Record<string, unknown>;
};

export type ReportJsonBloodMarker = {
  name: string;
  value: string | number | null;
  unit?: string;
  referenceRange?: string;
  flag?: string;
};

export type ReportJsonImageFinding = {
  filename: string;
  caption: string;
  signals?: Record<string, unknown>;
};

export type ReportJsonAppendix = {
  blood_markers: ReportJsonBloodMarker[];
  image_findings: ReportJsonImageFinding[];
};

export type ReportJson = {
  version: typeof FI_REPORT_JSON_VERSION;
  metadata: ReportJsonMetadata;
  branding?: ReportJsonBranding | null;
  disclaimers: string[];
  score_summary: ReportJsonScoreSummary;
  sections: ReportJsonContentSection[];
  charts: ReportJsonChartDef[];
  appendix: ReportJsonAppendix;
};
