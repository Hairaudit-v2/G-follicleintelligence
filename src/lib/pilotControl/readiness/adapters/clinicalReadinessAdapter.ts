/**
 * Clinical + pathology readiness signals (pure). Does not interpret clinical values.
 */

import { requirementForSignal } from "../readinessMilestones";
import type { PilotJourneyStage } from "../readinessTypes";
import { buildSignal, blockerFromSignal, warningFromSignal } from "../signalHelpers";
import type { PathologySourceBag } from "../readinessSourceBag";
import type { PilotBlocker, PilotReadinessWarning, ReadinessSignalResult } from "../readinessTypes";

export type ClinicalAdapterResult = {
  signals: ReadinessSignalResult[];
  blockers: PilotBlocker[];
  warnings: PilotReadinessWarning[];
};

export function resolveClinicalSignals(args: {
  bag: PathologySourceBag;
  stage: PilotJourneyStage;
  evaluatedAt: string;
}): ClinicalAdapterResult {
  const { bag, stage, evaluatedAt } = args;
  const signals: ReadinessSignalResult[] = [];
  const blockers: PilotBlocker[] = [];
  const warnings: PilotReadinessWarning[] = [];

  const consultRule = requirementForSignal(stage, "clinical.consultation_complete");
  if (consultRule && consultRule.requirement !== "not_applicable") {
    signals.push(
      buildSignal({
        key: "clinical.consultation_complete",
        label: "Consultation completion",
        sourceSystem: "patient_journey_control",
        requirement: consultRule.requirement,
        status: bag.consultationComplete ? "satisfied" : "pending",
        reasonCode: bag.consultationComplete ? "consultation_complete" : "consultation_pending",
        observedValueClass: bag.consultationComplete ? "present" : "pending",
        sourceTable: "fi_patient_journey_milestones",
        sourceField: "consultation_completed",
        blocking: false,
        patientSafeSummary: bag.consultationComplete
          ? "Consultation milestone completed"
          : "Consultation not yet completed",
        conditionReason: consultRule.notes,
      })
    );
  }

  const reqRule = requirementForSignal(stage, "clinical.pathology_requirement");
  if (reqRule) {
    if (bag.required === false) {
      signals.push(
        buildSignal({
          key: "clinical.pathology_requirement",
          label: "Pathology requirement",
          sourceSystem: "pathology",
          requirement: "not_applicable",
          status: "not_applicable",
          reasonCode: "pathology_not_required",
          observedValueClass: "not_applicable",
          sourceTable: "fi_pathology_requests",
          patientSafeSummary: "No pathology requirement for current pathway",
        })
      );
      // Also mark clearance N/A
      signals.push(
        buildSignal({
          key: "clinical.pathology_clearance",
          label: "Pathology clearance",
          sourceSystem: "pathology",
          requirement: "not_applicable",
          status: "not_applicable",
          reasonCode: "pathology_not_required",
          observedValueClass: "not_applicable",
          sourceTable: "fi_pathology_results",
        })
      );
    } else if (bag.required === null && reqRule.requirement === "conditional") {
      signals.push(
        buildSignal({
          key: "clinical.pathology_requirement",
          label: "Pathology requirement",
          sourceSystem: "pathology",
          requirement: "conditional",
          status: "unknown",
          reasonCode: "pathology_requirement_unknown",
          observedValueClass: "unknown",
          sourceTable: "fi_pathology_requests",
          blocking: stage === "procedure_preparation",
          patientSafeSummary: "Pathology requirement could not be resolved",
          conditionReason: "Source did not indicate whether pathology is required",
        })
      );
    } else if (bag.required === true) {
      signals.push(
        buildSignal({
          key: "clinical.pathology_requirement",
          label: "Pathology requirement",
          sourceSystem: "pathology",
          requirement: "mandatory",
          status: "satisfied",
          reasonCode: "pathology_required",
          observedValueClass: "present",
          sourceTable: "fi_pathology_requests",
          sourceRecordId: bag.requestId ?? undefined,
          patientSafeSummary: "Pathology is required for this pathway",
        })
      );

      const hasResult = bag.resultId != null;
      const hasRequest = bag.requestId != null;
      let receiptStatus: "missing" | "pending" | "satisfied" = "missing";
      if (hasResult) receiptStatus = "satisfied";
      else if (hasRequest) receiptStatus = "pending";

      const receipt = buildSignal({
        key: "clinical.pathology_receipt",
        label: "Pathology receipt",
        sourceSystem: "pathology",
        requirement: "mandatory",
        status: receiptStatus,
        reasonCode:
          receiptStatus === "satisfied"
            ? "pathology_received"
            : receiptStatus === "pending"
              ? "pathology_awaiting_result"
              : "pathology_missing",
        observedValueClass:
          receiptStatus === "satisfied" ? "present" : receiptStatus === "pending" ? "pending" : "absent",
        sourceTable: "fi_pathology_results",
        sourceRecordId: bag.resultId ?? bag.requestId ?? undefined,
        blocking: true,
        patientSafeSummary:
          receiptStatus === "satisfied"
            ? "Pathology result received"
            : "Required pathology result not yet available",
      });
      signals.push(receipt);

      if (hasResult && !bag.reviewed) {
        const review = buildSignal({
          key: "clinical.pathology_review",
          label: "Pathology clinical review",
          sourceSystem: "pathology",
          requirement: "mandatory",
          status: "review_required",
          reasonCode: "pathology_awaiting_review",
          observedValueClass: "pending",
          sourceTable: "fi_pathology_results",
          sourceRecordId: bag.resultId ?? undefined,
          sourceField: "patient_summary_approved_at",
          blocking: true,
          severity: "high",
          patientSafeSummary: "Pathology received but clinical review incomplete",
        });
        signals.push(review);
      } else if (hasResult && bag.reviewed) {
        signals.push(
          buildSignal({
            key: "clinical.pathology_review",
            label: "Pathology clinical review",
            sourceSystem: "pathology",
            requirement: "mandatory",
            status: "satisfied",
            reasonCode: "pathology_reviewed",
            observedValueClass: "approved",
            sourceTable: "fi_pathology_results",
            sourceRecordId: bag.resultId ?? undefined,
          })
        );
      }

      const cleared =
        bag.clearanceStatus === "cleared" && bag.reviewed && !bag.superseded;
      const clearance = buildSignal({
        key: "clinical.pathology_clearance",
        label: "Pathology clearance",
        sourceSystem: "pathology",
        requirement: "mandatory",
        status: bag.superseded
          ? "failed"
          : cleared
            ? "satisfied"
            : bag.clearanceStatus == null
              ? hasResult
                ? "pending"
                : "missing"
              : bag.clearanceStatus === "cleared"
                ? "pending"
                : "failed",
        reasonCode: bag.superseded
          ? "pathology_superseded"
          : cleared
            ? "pathology_cleared"
            : "pathology_not_cleared",
        observedValueClass: bag.superseded
          ? "failed"
          : cleared
            ? "approved"
            : "pending",
        sourceTable: "fi_pathology_results",
        sourceField: "clearance_status",
        sourceRecordId: bag.resultId ?? undefined,
        blocking: true,
        patientSafeSummary: bag.superseded
          ? "Superseded pathology record cannot satisfy clearance"
          : cleared
            ? "Pathology cleared"
            : "Pathology clearance not satisfied",
      });
      signals.push(clearance);
    }
  }

  const escRule = requirementForSignal(stage, "clinical.clinical_escalation");
  if (escRule && escRule.requirement !== "not_applicable") {
    const esc = buildSignal({
      key: "clinical.clinical_escalation",
      label: "Clinical escalation",
      sourceSystem: "patient_journey_control",
      requirement: "mandatory",
      status: bag.clinicalEscalationActive ? "failed" : "satisfied",
      reasonCode: bag.clinicalEscalationActive
        ? "clinical_escalation_active"
        : "no_clinical_escalation",
      observedValueClass: bag.clinicalEscalationActive ? "failed" : "present",
      sourceTable: "fi_patient_actions",
      blocking: bag.clinicalEscalationActive,
      severity: bag.clinicalEscalationActive ? "high" : undefined,
      patientSafeSummary: bag.clinicalEscalationActive
        ? "Active clinical escalation blocks readiness"
        : "No active clinical escalation",
    });
    signals.push(esc);
  }

  const approvalRule = requirementForSignal(stage, "clinical.clinical_approval");
  if (approvalRule && approvalRule.requirement === "mandatory") {
    const st = bag.clinicalApprovalState;
    const approval = buildSignal({
      key: "clinical.clinical_approval",
      label: "Required clinician sign-off",
      sourceSystem: "patient_journey_control",
      requirement: "mandatory",
      status:
        st === "approved"
          ? "satisfied"
          : st === "superseded"
            ? "failed"
            : st === "pending"
              ? "pending"
              : st === "absent"
                ? "missing"
                : "unknown",
      reasonCode:
        st === "approved"
          ? "clinical_approved"
          : st === "superseded"
            ? "clinical_approval_superseded"
            : st === "unknown"
              ? "clinical_approval_unknown"
              : "clinical_approval_pending",
      observedValueClass:
        st === "approved"
          ? "approved"
          : st === "superseded"
            ? "failed"
            : st === "unknown"
              ? "unknown"
              : "pending",
      sourceTable: "fi_patient_journey_milestones",
      sourceField: "clinical_review_completed",
      blocking: st !== "approved",
      patientSafeSummary:
        st === "approved"
          ? "Clinical approval recorded"
          : st === "unknown"
            ? "Clinical approval state unknown — fail closed"
            : st === "superseded"
              ? "Superseded clinical record does not satisfy readiness"
              : "Clinical approval not complete",
    });
    signals.push(approval);
  }

  for (const s of signals) {
    if (
      s.blocking &&
      s.requirement !== "optional" &&
      s.requirement !== "not_applicable" &&
      s.status !== "satisfied" &&
      s.status !== "not_applicable"
    ) {
      blockers.push(
        blockerFromSignal({
          signal: s,
          category: s.key.includes("pathology") ? "pathology" : "clinical_review",
          severity: s.severity === "critical" ? "critical" : s.severity === "high" ? "high" : "high",
          owner: "clinical",
          recommendedNextAction: "Resolve clinical / pathology gate before procedure readiness",
          evaluatedAt,
        })
      );
    } else if (s.status === "pending" && !s.blocking) {
      warnings.push(warningFromSignal({ signal: s, code: s.reasonCode, severity: "info" }));
    }
  }

  return { signals, blockers, warnings };
}
