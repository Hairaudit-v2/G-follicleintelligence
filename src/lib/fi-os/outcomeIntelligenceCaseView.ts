import { mergeCheckpointKeys, missingOutcomeCheckpoints } from "@/src/lib/fi-os/outcomeIntelligenceSignals";

export type OutcomeMeasurementRow = {
  id: string;
  checkpoint_key: string;
  measurement_date: string | null;
  metric_values: Record<string, unknown>;
  imaging_refs: unknown[];
  audit_refs: unknown[];
  case_id: string | null;
};

export type OutcomeProtocolRow = {
  id: string;
  protocol_type: string;
  protocol_key: string;
  protocol_label: string;
  protocol_details: Record<string, unknown>;
  case_id: string | null;
  patient_id: string | null;
  started_at: string | null;
  completed_at: string | null;
};

const TWELVE_MONTH_CHECKPOINTS = new Set(["baseline", "day_1", "day_7", "month_1", "month_3", "month_6", "month_12"]);

export type CaseOutcomeIntelligenceView = {
  checkpointsCaptured: string[];
  checkpointsMissing: string[];
  twelveMonthRatio: { captured: number; total: number; ratio: number };
  imagingRefsApprox: number;
  auditRefsApprox: number;
  protocolKeys: string[];
  networkEligibleHint: "insufficient_data" | "tenant_only_stage";
};

export function buildCaseOutcomeIntelligenceView(input: {
  followUpCheckpoints: readonly string[];
  measurementRows: readonly OutcomeMeasurementRow[];
  protocolRows: readonly OutcomeProtocolRow[];
  linkedImageCount: number;
}): CaseOutcomeIntelligenceView {
  const fromMeasurements = input.measurementRows.map((r) => r.checkpoint_key);
  const checkpointsCaptured = mergeCheckpointKeys(input.followUpCheckpoints, fromMeasurements);
  const checkpointsMissing = missingOutcomeCheckpoints(checkpointsCaptured);
  const twelveMonthSet = TWELVE_MONTH_CHECKPOINTS;
  const cap12 = checkpointsCaptured.filter((c) => twelveMonthSet.has(c));
  const twelveMonthRatio = {
    captured: cap12.length,
    total: twelveMonthSet.size,
    ratio: twelveMonthSet.size === 0 ? 0 : cap12.length / twelveMonthSet.size,
  };

  let imagingRefsApprox = input.linkedImageCount;
  let auditRefsApprox = 0;
  for (const r of input.measurementRows) {
    imagingRefsApprox += Array.isArray(r.imaging_refs) ? r.imaging_refs.length : 0;
    auditRefsApprox += Array.isArray(r.audit_refs) ? r.audit_refs.length : 0;
  }

  const protocolKeys = input.protocolRows.map((p) => p.protocol_key).filter(Boolean);

  const networkEligibleHint: CaseOutcomeIntelligenceView["networkEligibleHint"] =
    input.measurementRows.length < 3 ? "insufficient_data" : "tenant_only_stage";

  return {
    checkpointsCaptured,
    checkpointsMissing,
    twelveMonthRatio,
    imagingRefsApprox,
    auditRefsApprox,
    protocolKeys,
    networkEligibleHint,
  };
}
