/**
 * Financial readiness — observes FinancialOS manual Money + clearance (pure).
 * Stripe is never required. Does not recalculate ledger independently.
 */

import { requirementForSignal } from "../readinessMilestones";
import type { PilotJourneyStage } from "../readinessTypes";
import { buildSignal, blockerFromSignal, warningFromSignal } from "../signalHelpers";
import type { FinancialSourceBag } from "../readinessSourceBag";
import type { PilotBlocker, PilotReadinessWarning, ReadinessSignalResult } from "../readinessTypes";

export type FinancialAdapterResult = {
  signals: ReadinessSignalResult[];
  blockers: PilotBlocker[];
  warnings: PilotReadinessWarning[];
};

export function resolveFinancialSignals(args: {
  bag: FinancialSourceBag;
  enrolmentPatientId: string;
  stage: PilotJourneyStage;
  evaluatedAt: string;
}): FinancialAdapterResult {
  const { bag, enrolmentPatientId, stage, evaluatedAt } = args;
  const signals: ReadinessSignalResult[] = [];
  const blockers: PilotBlocker[] = [];
  const warnings: PilotReadinessWarning[] = [];

  const stripe = buildSignal({
    key: "financial.stripe_not_required",
    label: "Stripe not required for Money readiness",
    sourceSystem: "financial_os",
    requirement: "optional",
    status: "satisfied",
    reasonCode: bag.stripeBranchOnlyCapability
      ? "stripe_branch_only_ignored"
      : bag.stripeEnabled
        ? "stripe_present_but_not_required"
        : "stripe_disabled_ok",
    observedValueClass: "not_applicable",
    sourceTable: "fi_financial_clearance_snapshots",
    blocking: false,
    patientSafeSummary: "Manual Money readiness does not require Stripe",
  });
  signals.push(stripe);

  if (bag.stripeBranchOnlyCapability) {
    warnings.push(
      warningFromSignal({
        signal: stripe,
        code: "stripe_branch_only_not_production",
        severity: "info",
      })
    );
  }

  const quoteRule = requirementForSignal(stage, "financial.accepted_quote");
  if (quoteRule && quoteRule.requirement !== "not_applicable") {
    const accepted = bag.quoteStatus === "accepted";
    const wrongPatient =
      bag.quotePatientId != null && bag.quotePatientId !== enrolmentPatientId;
    const quote = buildSignal({
      key: "financial.accepted_quote",
      label: "Accepted quote",
      sourceSystem: "crm_quotes",
      requirement: quoteRule.requirement === "mandatory" ? "mandatory" : quoteRule.requirement,
      status: wrongPatient
        ? "failed"
        : accepted
          ? "satisfied"
          : bag.quoteId == null
            ? "missing"
            : "pending",
      reasonCode: wrongPatient
        ? "quote_wrong_patient"
        : accepted
          ? "quote_accepted"
          : bag.quoteId == null
            ? "quote_missing"
            : "quote_not_accepted",
      observedValueClass: wrongPatient
        ? "failed"
        : accepted
          ? "approved"
          : bag.quoteId == null
            ? "absent"
            : "pending",
      sourceTable: "fi_crm_quotes",
      sourceRecordId: bag.quoteId ?? undefined,
      sourceField: "status",
      blocking: quoteRule.requirement === "mandatory" || wrongPatient,
      severity: wrongPatient ? "critical" : undefined,
      patientSafeSummary: wrongPatient
        ? "Quote belongs to another patient"
        : accepted
          ? "Quote accepted"
          : "Required accepted quote not present",
    });
    signals.push(quote);
  }

  const wrongPay = buildSignal({
    key: "financial.wrong_patient_payment",
    label: "Payment patient integrity",
    sourceSystem: "financial_os",
    requirement: "mandatory",
    status: bag.paymentPatientIdMismatch ? "failed" : "satisfied",
    reasonCode: bag.paymentPatientIdMismatch
      ? "payment_wrong_patient"
      : "payment_patient_ok",
    observedValueClass: bag.paymentPatientIdMismatch ? "failed" : "present",
    sourceTable: "fi_financial_clearance_snapshots",
    blocking: bag.paymentPatientIdMismatch,
    severity: bag.paymentPatientIdMismatch ? "critical" : undefined,
    patientSafeSummary: bag.paymentPatientIdMismatch
      ? "Payment allocated to another patient — critical"
      : "No wrong-patient payment detected",
  });
  signals.push(wrongPay);

  const unalloc = buildSignal({
    key: "financial.unallocated_payment",
    label: "Unallocated payment gate",
    sourceSystem: "financial_os",
    requirement: stage === "procedure_preparation" ? "mandatory" : "conditional",
    status: bag.unallocatedPaymentPresent ? "failed" : "satisfied",
    reasonCode: bag.unallocatedPaymentPresent
      ? "unallocated_payment_present"
      : "no_unallocated_payment",
    observedValueClass: bag.unallocatedPaymentPresent ? "failed" : "present",
    blocking: bag.unallocatedPaymentPresent && stage === "procedure_preparation",
    severity: bag.unallocatedPaymentPresent ? "high" : undefined,
    patientSafeSummary: bag.unallocatedPaymentPresent
      ? "Unallocated payment must not clear financial readiness"
      : "No blocking unallocated payment",
  });
  signals.push(unalloc);

  const depositRule = requirementForSignal(stage, "financial.deposit_verified");
  if (depositRule && depositRule.requirement !== "not_applicable") {
    const needDeposit = bag.depositRequired;
    const deposit = buildSignal({
      key: "financial.deposit_verified",
      label: "Deposit verified (manual Money)",
      sourceSystem: "financial_os",
      requirement: needDeposit ? "mandatory" : "not_applicable",
      status: !needDeposit
        ? "not_applicable"
        : bag.depositVerified
          ? "satisfied"
          : "pending",
      reasonCode: !needDeposit
        ? "deposit_not_required"
        : bag.depositVerified
          ? "deposit_verified_manual"
          : "deposit_pending",
      observedValueClass: !needDeposit
        ? "not_applicable"
        : bag.depositVerified
          ? "approved"
          : "pending",
      sourceTable: "fi_financial_clearance_snapshots",
      sourceRecordId: bag.clearanceSourceRecordId ?? undefined,
      blocking: needDeposit && !bag.depositVerified,
      patientSafeSummary: !needDeposit
        ? "Deposit not required at this stage"
        : bag.depositVerified
          ? "Manual deposit verified"
          : "Required deposit not verified",
    });
    signals.push(deposit);
  }

  const planRule = requirementForSignal(stage, "financial.payment_plan");
  if (planRule && bag.paymentPlanActive) {
    const plan = buildSignal({
      key: "financial.payment_plan",
      label: "Payment plan status",
      sourceSystem: "financial_os",
      requirement: "conditional",
      status: bag.paymentPlanSatisfiesClearance ? "satisfied" : "pending",
      reasonCode: bag.paymentPlanSatisfiesClearance
        ? "payment_plan_satisfies"
        : "payment_plan_insufficient",
      observedValueClass: bag.paymentPlanSatisfiesClearance ? "approved" : "pending",
      conditionReason: "Active payment plan evaluated under canonical finance rules",
      blocking: false,
      patientSafeSummary: bag.paymentPlanSatisfiesClearance
        ? "Payment plan satisfies clearance rules"
        : "Payment plan active but does not yet satisfy clearance",
    });
    signals.push(plan);
  }

  const recon = buildSignal({
    key: "financial.reconciliation_exception",
    label: "Reconciliation exception",
    sourceSystem: "financial_os",
    requirement: stage === "procedure_preparation" ? "mandatory" : "optional",
    status: bag.reconciliationException ? "failed" : "satisfied",
    reasonCode: bag.reconciliationException
      ? "reconciliation_exception"
      : "no_reconciliation_exception",
    observedValueClass: bag.reconciliationException ? "failed" : "present",
    blocking: bag.reconciliationException && stage === "procedure_preparation",
    severity: bag.reconciliationException ? "high" : undefined,
    patientSafeSummary: bag.reconciliationException
      ? "Reconciliation exception requires finance attention"
      : "No reconciliation exception",
  });
  signals.push(recon);

  const clearanceRule = requirementForSignal(stage, "financial.clearance");
  if (clearanceRule && clearanceRule.requirement !== "not_applicable") {
    const cs = bag.clearanceState;
    let status: "satisfied" | "pending" | "failed" | "unknown" | "missing" = "missing";
    let reason = "clearance_missing";
    let observed: "approved" | "pending" | "failed" | "unknown" | "absent" = "absent";
    if (cs == null) {
      status = "unknown";
      reason = "clearance_unavailable";
      observed = "unknown";
    } else if (cs === "financially_cleared" || cs === "paid_in_full" || cs === "deposit_ready") {
      if (bag.unallocatedPaymentPresent || bag.paymentPatientIdMismatch) {
        status = "failed";
        reason = "clearance_invalidated";
        observed = "failed";
      } else {
        status = "satisfied";
        reason = `clearance_${cs}`;
        observed = "approved";
      }
    } else if (cs === "attention_required") {
      status = "failed";
      reason = "clearance_attention_required";
      observed = "failed";
    } else if (cs === "unavailable") {
      status = "unknown";
      reason = "clearance_source_unavailable";
      observed = "unknown";
    } else {
      status = "pending";
      reason = `clearance_${cs}`;
      observed = "pending";
    }

    signals.push(
      buildSignal({
        key: "financial.clearance",
        label: "Financial clearance",
        sourceSystem: "financial_os",
        requirement: "mandatory",
        status,
        reasonCode: reason,
        observedValueClass: observed,
        sourceTable: "fi_financial_clearance_snapshots",
        sourceRecordId: bag.clearanceSourceRecordId ?? undefined,
        sourceField: "clearance_state",
        blocking: status !== "satisfied",
        patientSafeSummary:
          status === "satisfied"
            ? "Canonical financial clearance satisfied"
            : "Financial clearance not satisfied",
      })
    );
  }

  if (bag.dualPaymentSourceUnresolved) {
    warnings.push({
      code: "dual_payment_source_unresolved",
      severity: "attention",
      patientSafeSummary: "Dual payment sources unresolved",
      sourceSystem: "financial_os",
      signalKey: "financial.clearance",
    });
  }

  for (const s of signals) {
    if (
      s.requirement === "optional" ||
      s.requirement === "not_applicable" ||
      s.status === "satisfied" ||
      s.status === "not_applicable"
    ) {
      continue;
    }
    if (!s.blocking && s.status !== "failed" && s.status !== "unknown") continue;
    const critical = s.severity === "critical";
    blockers.push(
      blockerFromSignal({
        signal: s,
        category: s.key.includes("reconciliation") ? "payment_reconciliation" : "financial",
        severity: critical ? "critical" : "high",
        owner: "finance",
        recommendedNextAction: critical
          ? "Investigate wrong-patient payment immediately"
          : "Resolve financial gate using FinancialOS Money workflows",
        criticalIntegrity: critical,
        evaluatedAt,
      })
    );
  }

  return { signals, blockers, warnings };
}
