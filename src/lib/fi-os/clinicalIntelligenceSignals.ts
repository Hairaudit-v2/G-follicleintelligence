import type { CaseReadinessReport } from "@/src/lib/cases/caseReadinessTypes";
import type {
  FiClinicalIntelligenceSignalKey,
  FiClinicalIntelligenceSeverityThresholds,
} from "@/src/config/fiClinicalIntelligenceSignals";
import { getFiClinicalIntelligenceSignalDefinition } from "@/src/config/fiClinicalIntelligenceSignals";
import type { PatientTwinV1 } from "@/src/lib/patientTwin/patientTwinTypes";

export type ClinicalSignalSeverity = "info" | "attention" | "critical";

export type NormalizedClinicalSignal = {
  signalKey: FiClinicalIntelligenceSignalKey;
  severity: ClinicalSignalSeverity;
  title: string;
  detail?: string;
  sourceTable?: string;
  sourceId?: string;
  patientId?: string | null;
  caseId?: string | null;
  count?: number;
};

export type PatientClinicalIntelligenceView = {
  signals: NormalizedClinicalSignal[];
  recommendedNextStep: string | null;
};

function defTitle(key: FiClinicalIntelligenceSignalKey): string {
  return getFiClinicalIntelligenceSignalDefinition(key)?.label ?? key;
}

/**
 * Maps a non-negative integer count to severity using registry thresholds, with safe defaults.
 */
export function clinicalSeverityFromCount(
  count: number,
  thresholds: FiClinicalIntelligenceSeverityThresholds | null | undefined
): ClinicalSignalSeverity {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const t = thresholds ?? { attentionAt: 1, criticalAt: 10 };
  if (n <= 0) return "info";
  if (n >= t.criticalAt) return "critical";
  if (n >= t.attentionAt) return "attention";
  return "info";
}

export function clinicalSeverityMax(
  a: ClinicalSignalSeverity,
  b: ClinicalSignalSeverity
): ClinicalSignalSeverity {
  const rank = { info: 0, attention: 1, critical: 2 };
  return rank[a] >= rank[b] ? a : b;
}

/** Safe display line — does not assert clinical facts beyond the provided label. */
export function formatClinicalSignalDisplayLine(input: {
  label: string;
  count?: number;
  suffix?: string;
}): string {
  const suffix = input.suffix?.trim();
  if (typeof input.count === "number" && input.count > 0) {
    const c = `${input.count} open`;
    return suffix ? `${input.label}: ${c} · ${suffix}` : `${input.label}: ${c}`;
  }
  return suffix ? `${input.label} · ${suffix}` : input.label;
}

export function normalizeTenantCountSignal(params: {
  key: FiClinicalIntelligenceSignalKey;
  count: number;
  suffix?: string;
}): NormalizedClinicalSignal | null {
  const def = getFiClinicalIntelligenceSignalDefinition(params.key);
  if (!def) return null;
  const severity = clinicalSeverityFromCount(params.count, def.severityThresholds);
  if (severity === "info" && params.count <= 0) return null;
  return {
    signalKey: params.key,
    severity,
    title: formatClinicalSignalDisplayLine({
      label: def.label,
      count: params.count,
      suffix: params.suffix,
    }),
    count: params.count,
  };
}

export function derivePatientTwinIntegritySignals(twin: PatientTwinV1): NormalizedClinicalSignal[] {
  const out: NormalizedClinicalSignal[] = [];
  const def = getFiClinicalIntelligenceSignalDefinition("patient_twin_integrity_attention");
  const warnN = twin.warnings?.length ?? 0;
  const missingN = twin.completeness?.missing?.length ?? 0;
  const score = twin.completeness?.score ?? 100;
  const n = warnN + missingN;
  if (n > 0 || score < 65) {
    const severity = clinicalSeverityFromCount(
      n || (score < 40 ? 3 : 1),
      def?.severityThresholds ?? null
    );
    out.push({
      signalKey: "patient_twin_integrity_attention",
      severity: clinicalSeverityMax(severity, score < 40 ? "attention" : "info"),
      title: formatClinicalSignalDisplayLine({
        label: defTitle("patient_twin_integrity_attention"),
        count: n,
        suffix: score < 85 ? `completeness ${score}/100` : undefined,
      }),
      patientId: twin.patient_id,
      sourceTable: "patient_twin_projection",
    });
  }

  const draftPath = twin.pathology.results.filter(
    (r) =>
      String(r.status ?? "")
        .trim()
        .toLowerCase() === "draft"
  );
  if (draftPath.length) {
    const pd = getFiClinicalIntelligenceSignalDefinition("pathology_review_pending");
    out.push({
      signalKey: "pathology_review_pending",
      severity: clinicalSeverityFromCount(draftPath.length, pd?.severityThresholds ?? null),
      title: formatClinicalSignalDisplayLine({
        label: defTitle("pathology_review_pending"),
        count: draftPath.length,
      }),
      patientId: twin.patient_id,
      sourceTable: "fi_pathology_results",
      sourceId: draftPath[0]?.id,
    });
  }

  if (twin.imaging.active_image_total <= 0 && twin.cases.length > 0) {
    const id = getFiClinicalIntelligenceSignalDefinition("imaging_baseline_missing");
    out.push({
      signalKey: "imaging_baseline_missing",
      severity: clinicalSeverityFromCount(1, id?.severityThresholds ?? null),
      title: formatClinicalSignalDisplayLine({
        label: defTitle("imaging_baseline_missing"),
        suffix: "no linked imaging rows",
      }),
      patientId: twin.patient_id,
      sourceTable: "fi_patient_images",
    });
  }

  return out;
}

export function deriveCaseClinicalSignals(input: {
  caseId: string;
  patientFoundationId: string | null;
  readiness: CaseReadinessReport;
}): NormalizedClinicalSignal[] {
  const out: NormalizedClinicalSignal[] = [];
  const r = input.readiness;
  const pid = input.patientFoundationId;

  if (r.overallPercent < 100) {
    const severity =
      r.overallPercent < 45 ? "critical" : r.overallPercent < 75 ? "attention" : "info";
    out.push({
      signalKey: "surgery_readiness_attention",
      severity,
      title: formatClinicalSignalDisplayLine({
        label: defTitle("surgery_readiness_attention"),
        suffix: `${r.overallPercent}% checklist`,
      }),
      caseId: input.caseId,
      patientId: pid,
      sourceTable: "fi_cases",
      sourceId: input.caseId,
    });
  }

  const proc = r.sections.find((s) => s.key === "procedure_day");
  if (proc && proc.health !== "complete" && proc.health !== "not_started") {
    out.push({
      signalKey: "procedure_day_incomplete",
      severity: proc.health === "needs_attention" ? "attention" : "info",
      title: formatClinicalSignalDisplayLine({
        label: defTitle("procedure_day_incomplete"),
        suffix: proc.summary,
      }),
      caseId: input.caseId,
      patientId: pid,
    });
  }

  const post = r.sections.find((s) => s.key === "post_op");
  if (post && post.health !== "complete") {
    out.push({
      signalKey: "post_op_pending",
      severity: post.health === "needs_attention" ? "attention" : "info",
      title: formatClinicalSignalDisplayLine({
        label: defTitle("post_op_pending"),
        suffix: post.summary,
      }),
      caseId: input.caseId,
      patientId: pid,
    });
  }

  const fu = r.sections.find((s) => s.key === "follow_ups");
  if (fu && fu.health !== "complete") {
    out.push({
      signalKey: "follow_up_overdue",
      severity: fu.health === "needs_attention" ? "attention" : "info",
      title: formatClinicalSignalDisplayLine({
        label: defTitle("follow_up_overdue"),
        suffix: fu.summary,
      }),
      caseId: input.caseId,
      patientId: pid,
    });
  }

  const img = r.sections.find((s) => s.key === "images");
  if (img && img.health !== "complete" && img.health !== "not_started") {
    out.push({
      signalKey: "imaging_baseline_missing",
      severity: "attention",
      title: formatClinicalSignalDisplayLine({
        label: defTitle("imaging_baseline_missing"),
        suffix: img.summary,
      }),
      caseId: input.caseId,
      patientId: pid,
    });
  }

  return out;
}
