/**
 * FI-CONTROLLED-PILOT-ACTIVATION-1B — finance integrity preflight (pure, fail-closed).
 * Stripe remains disabled; manual finance clearance follows FinancialOS state.
 */

import type { FinancialClearanceState } from "@/src/lib/financialOs/financialClearanceCore";

import {
  PILOT_ACTIVATION_VERSION,
  type GateCheck,
  type PilotFinancePreflightResult,
} from "./activationTypes";

export type FinancePreflightInput = {
  tenantId: string;
  programmeId: string;
  patientId: string;
  evaluatedAt?: string;
  quoteId: string | null;
  quotePatientId: string | null;
  quoteStatus: string | null;
  invoicePatientId: string | null;
  depositRequired: boolean;
  depositVerified: boolean;
  unallocatedPaymentPresent: boolean;
  paymentPatientIdMismatch: boolean;
  reconciliationException: boolean;
  paymentPlanActive: boolean;
  paymentPlanSatisfiesClearance: boolean;
  clearanceState: FinancialClearanceState | null;
  stripeEnabled: boolean;
  /** Branch-only Stripe capability must not affect live preflight when disabled. */
  stripeBranchOnlyCapability: boolean;
};

function check(
  status: GateCheck["status"],
  reasonCode: string,
  blocking: boolean,
  patientSafeSummary: string
): GateCheck {
  return { status, reasonCode, blocking, patientSafeSummary };
}

const CLEARANCE_PASS: ReadonlySet<string> = new Set([
  "financially_cleared",
  "paid_in_full",
  "deposit_ready",
]);

export function evaluatePilotPatientFinancePreflight(
  input: FinancePreflightInput
): PilotFinancePreflightResult {
  const evaluatedAt = input.evaluatedAt ?? new Date().toISOString();
  const criticalBlockers: string[] = [];

  const quoteOwnership =
    input.quoteId == null
      ? check("unknown", "quote_absent", true, "Accepted quote not observed — fail closed for pathway")
      : input.quotePatientId === input.patientId
        ? check("pass", "quote_ownership_ok", true, "Quote belongs to patient")
        : check("fail", "quote_wrong_patient", true, "Quote belongs to another patient");
  if (quoteOwnership.status !== "pass") criticalBlockers.push("quote_ownership");

  const invoiceOwnership =
    input.invoicePatientId == null
      ? check("not_applicable", "invoice_absent", false, "No invoice observed")
      : input.invoicePatientId === input.patientId
        ? check("pass", "invoice_ownership_ok", true, "Invoice belongs to patient")
        : check("fail", "invoice_wrong_patient", true, "Invoice belongs to another patient");
  if (invoiceOwnership.status === "fail") criticalBlockers.push("invoice_ownership");

  const depositRequirement =
    !input.depositRequired || input.depositVerified
      ? check("pass", "deposit_requirement_ok", true, "Deposit requirement satisfied or not required")
      : check("fail", "deposit_unmet", true, "Required deposit not verified");
  if (depositRequirement.status === "fail") criticalBlockers.push("deposit_requirement");

  const paymentAllocation = input.unallocatedPaymentPresent
    ? check(
        "fail",
        "unallocated_payment",
        true,
        "Unallocated payment must not be treated as clearance"
      )
    : check("pass", "allocation_ok", true, "No unallocated payment treated as clearance");
  if (paymentAllocation.status === "fail") criticalBlockers.push("payment_allocation");

  const crossPatientPayment = input.paymentPatientIdMismatch
    ? check("fail", "payment_wrong_patient", true, "Payment linked to another patient — critical")
    : check("pass", "payment_patient_ok", true, "Payments belong to patient");
  if (crossPatientPayment.status === "fail") criticalBlockers.push("cross_patient_payment");

  const reconciliation = input.reconciliationException
    ? check("fail", "reconciliation_exception", true, "Unresolved reconciliation exception")
    : check("pass", "reconciliation_ok", true, "No unresolved reconciliation exception");
  if (reconciliation.status === "fail") criticalBlockers.push("reconciliation");

  const paymentPlan =
    !input.paymentPlanActive || input.paymentPlanSatisfiesClearance
      ? check("pass", "payment_plan_ok", true, "Payment plan current or not applicable")
      : check("fail", "payment_plan_unsatisfactory", true, "Payment plan does not satisfy clearance");
  if (paymentPlan.status === "fail") criticalBlockers.push("payment_plan");

  // Stripe disabled does not fail manual finance. Stripe enabled is a critical stop for 1B.
  const stripeDisabled = input.stripeEnabled
    ? check("fail", "stripe_must_remain_disabled", true, "Stripe must remain disabled for controlled pilot")
    : check("pass", "stripe_disabled", true, "Stripe remains disabled; manual finance applies");
  if (stripeDisabled.status === "fail") criticalBlockers.push("stripe_enabled");
  // Branch-only capability must not affect live preflight when Stripe is disabled.
  void input.stripeBranchOnlyCapability;

  const clearanceOk =
    input.clearanceState != null && CLEARANCE_PASS.has(input.clearanceState);
  const financialClearance = clearanceOk
    ? check("pass", "clearance_ok", true, "Financial clearance follows FinancialOS state")
    : input.clearanceState == null
      ? check("unknown", "clearance_unknown", true, "Financial clearance unknown — fail closed")
      : check("fail", "clearance_not_achieved", true, "Financial clearance not achieved");
  if (financialClearance.status !== "pass") criticalBlockers.push("financial_clearance");

  const eligible = criticalBlockers.length === 0;

  return {
    eligible,
    checks: {
      quoteOwnership,
      invoiceOwnership,
      depositRequirement,
      paymentAllocation,
      paymentPlan,
      unallocatedPayment: paymentAllocation,
      crossPatientPayment,
      reconciliation,
      stripeDisabled,
      financialClearance,
    },
    criticalBlockers: [...new Set(criticalBlockers)],
    evaluatedAt,
    version: PILOT_ACTIVATION_VERSION,
  };
}
