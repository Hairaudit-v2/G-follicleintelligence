/**
 * report_compose: generates canonical report JSON (fi_reports.report_json).
 * Uses claim-safe text blocks only. Validates before return.
 */
import type { StageContext, StageResult } from "./types";
import type { RiskScoreOutput } from "./risk_score";
import type { BloodExtractOutput } from "./blood_extract";
import type { ImageExtractOutput } from "./image_extract";
import {
  type ReportJson,
  FI_REPORT_JSON_VERSION,
  type ReportJsonMetadata,
  type ReportJsonScoreSummary,
  type ReportJsonContentSection,
  type ReportJsonChartDef,
  type ReportJsonAppendix,
  type ReportJsonBranding,
} from "../reportSchema";
import { FI_SCORECARD_SECTIONS, FI_SCORECARD_SECTION_LABELS } from "../scorecard";
import { CLAIM_SAFE_BLOCKS } from "@/src/lib/fi/copy/blocks";
import { validateReportCopySafety } from "@/src/lib/fi/copy/claimSafety";
import {
  computeAndrogenAgeModule,
  isAndrogenAgeApplicable,
  type AndrogenAgeInput,
} from "@/src/lib/fi/modules/androgenAge";
import type { TenantConfig } from "../tenantConfig";

export type ReportComposeInput = {
  intake: {
    id: string;
    full_name: string;
    email: string;
    dob: string;
    sex: string;
    country: string | null;
    primary_concern: string | null;
    selections?: Record<string, unknown>;
  };
  bloodSignals: BloodExtractOutput;
  imageSignals: ImageExtractOutput;
  scorecard: RiskScoreOutput["scorecard"];
  tenantConfig?: TenantConfig | null;
  /** Partner attribution: reference code only (no tenant/partner identifiers). */
  partnerReferenceCode?: string | null;
};

export type { ReportJson } from "../reportSchema";

function ageFromDob(dob: string): number {
  if (!dob) return 0;
  const d = new Date(dob);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

function freeTPctFromMarkers(
  markers: Array<{ name: string; value: string | number | null }>
): number | null {
  const names = [
    "free testosterone %",
    "free testosterone percent",
    "free t %",
    "ft %",
    "free testosterone",
  ];
  for (const m of markers) {
    const n = (m.name || "").toLowerCase();
    if (names.some((x) => n.includes(x))) {
      const v = m.value;
      if (typeof v === "number") return v;
      if (typeof v === "string") {
        const parsed = parseFloat(v.replace(/[^\d.-]/g, ""));
        if (!Number.isNaN(parsed)) return parsed;
      }
    }
  }
  return null;
}

function buildAndrogenAgeInput(input: ReportComposeInput): AndrogenAgeInput | null {
  const dob = input.intake.dob ?? "";
  const sex = input.intake.sex ?? "";
  const selections = input.intake.selections ?? {};
  const trt = selections.trt === true || selections.trt === "true" || selections.trt === "yes";
  const dhtManagement =
    selections.dht_management === true ||
    selections.dht_management === "true" ||
    selections.dht_management === "yes";

  const androgenInput: AndrogenAgeInput = {
    patientAge: ageFromDob(dob),
    sex,
    trt,
    dhtManagement,
    freeTPct: freeTPctFromMarkers(input.bloodSignals.markers),
  };

  return isAndrogenAgeApplicable(androgenInput) ? androgenInput : null;
}

export function runReportCompose(
  ctx: StageContext,
  input: ReportComposeInput
): StageResult<ReportJson> {
  const riskTier = input.scorecard.risk_tier as "low" | "medium" | "high";
  const riskTierSummary =
    CLAIM_SAFE_BLOCKS.risk_tier[riskTier] ?? CLAIM_SAFE_BLOCKS.risk_tier.medium;

  const metadata: ReportJsonMetadata = {
    case_id: ctx.caseId,
    model_run_id: ctx.modelRunId,
    generated_at: new Date().toISOString(),
    partner_reference_code: input.partnerReferenceCode ?? null,
  };

  const scoreSummary: ReportJsonScoreSummary = {
    overall_score: input.scorecard.overall_score,
    risk_tier: input.scorecard.risk_tier,
    risk_tier_summary: riskTierSummary,
    sections: FI_SCORECARD_SECTIONS.map((id) => ({
      id,
      label: FI_SCORECARD_SECTION_LABELS[id],
      score: input.scorecard.sections[id]?.score ?? 0,
      interpretation:
        input.scorecard.sections[id]?.interpretation ??
        CLAIM_SAFE_BLOCKS.section_interpretation(
          FI_SCORECARD_SECTION_LABELS[id],
          input.scorecard.sections[id]?.score ?? 0
        ),
    })),
  };

  const sections: ReportJsonContentSection[] = FI_SCORECARD_SECTIONS.map(
    (id, idx) => ({
      id,
      title: FI_SCORECARD_SECTION_LABELS[id],
      content:
        input.scorecard.sections[id]?.interpretation ??
        CLAIM_SAFE_BLOCKS.section_interpretation(
          FI_SCORECARD_SECTION_LABELS[id],
          input.scorecard.sections[id]?.score ?? 0
        ),
      order: idx,
    })
  );

  const charts: ReportJsonChartDef[] = [
    {
      id: "domain_scores",
      type: "domain_scores",
      title: "Domain scores",
      data: {
        maxScore: 1,
        sections: scoreSummary.sections.map((s) => ({
          id: s.id,
          label: s.label,
          score: s.score,
        })),
      },
    },
  ];

  const tenantConfig = input.tenantConfig ?? null;
  const enableAndrogenChart =
    (tenantConfig?.feature_flags?.enable_androgen_age_chart ?? true) !== false;

  const androgenInput = buildAndrogenAgeInput(input);
  if (androgenInput && enableAndrogenChart) {
    const { narrative, chartDefinition } = computeAndrogenAgeModule(androgenInput);
    sections.push({
      id: "androgen_age",
      title: chartDefinition.title,
      content: narrative.bullets.map((b) => `• ${b}`).join("\n"),
      order: sections.length,
    });
    charts.push({
      id: chartDefinition.id,
      type: "androgen_age_curve",
      title: chartDefinition.title,
      data: {
        ...chartDefinition.data,
        labels: chartDefinition.labels,
        options: chartDefinition.options,
      },
    });
  }

  const appendix: ReportJsonAppendix = {
    blood_markers: input.bloodSignals.markers.map((m) => ({
      name: m.name,
      value: m.value,
      unit: m.unit,
      referenceRange: m.referenceRange,
      flag: m.flag,
    })),
    image_findings: input.imageSignals.map((s) => ({
      filename: s.filename,
      caption: CLAIM_SAFE_BLOCKS.general_caveat,
      signals: s.signals,
    })),
  };

  const branding: ReportJsonBranding = {
    logo_url: tenantConfig?.branding?.logo_url ?? null,
    primary_color: tenantConfig?.branding?.primary_color ?? "#C6A75E",
    secondary_color: tenantConfig?.branding?.secondary_color ?? "#0F1B2D",
    brand_name: tenantConfig?.branding?.brand_name ?? "Follicle Intelligence™",
    footer_text:
      tenantConfig?.branding?.footer_text ??
      "Confidential. For patient use only. This report does not constitute medical advice.",
  };

  const reportJson: ReportJson = {
    version: FI_REPORT_JSON_VERSION,
    metadata,
    branding,
    disclaimers: [
      CLAIM_SAFE_BLOCKS.disclaimer,
      CLAIM_SAFE_BLOCKS.general_caveat,
    ],
    score_summary: scoreSummary,
    sections,
    charts,
    appendix,
  };

  const safety = validateReportCopySafety(reportJson);
  if (!safety.ok) {
    return {
      ok: false,
      error: `Claim-safety violation: ${safety.violations.map((v) => v.match).join(", ")}`,
    };
  }

  return { ok: true, data: reportJson };
}
