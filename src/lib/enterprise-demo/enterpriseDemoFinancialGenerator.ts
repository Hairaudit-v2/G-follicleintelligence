import {
  ENTERPRISE_DEMO_FINANCIAL_RISK_KEY_METADATA,
  ENTERPRISE_DEMO_INVOICE_KEY_METADATA,
  ENTERPRISE_DEMO_PAYMENT_KEY_METADATA,
} from "./enterpriseDemoConstants";
import {
  buildEnterpriseDemoPatientConsultationSpecs,
  type EnterpriseDemoPatientConsultationSpec,
} from "./enterpriseDemoPatientsGenerator";
import {
  buildEnterpriseDemoSurgerySpecs,
  type EnterpriseDemoSurgerySpec,
} from "./enterpriseDemoSurgeriesGenerator";
import type { FiGatewayPaymentStatus, FiInvoiceKind, FiInvoiceStatus, FiPaymentRequestStatus } from "@/src/lib/revenueOs/revenueInvoiceModel";

export const ENTERPRISE_DEMO_CONSULTATION_QUOTE_INVOICES = 240;
export const ENTERPRISE_DEMO_SURGERY_FINANCIAL_BUNDLES = 96;

export const ENTERPRISE_DEMO_DEMO_PAYMENT_PROVIDER = "demo";

export type EnterpriseDemoClinicFinancialProfile =
  | "clean_reconciliation"
  | "graft_invoice_variance"
  | "overdue_collection_gaps"
  | "refund_adjustment_heavy"
  | "quote_expiry_leakage"
  | "standard";

export const ENTERPRISE_DEMO_CLINIC_FINANCIAL_PROFILES: Record<
  string,
  EnterpriseDemoClinicFinancialProfile
> = {
  "sydney-hair-institute": "clean_reconciliation",
  "dubai-hair-institute": "graft_invoice_variance",
  "bangkok-restoration-centre": "overdue_collection_gaps",
  "london-central-institute": "refund_adjustment_heavy",
  "athens-medical-institute": "quote_expiry_leakage",
};

export type EnterpriseDemoFinancialLifecycle =
  | "deposit"
  | "balance"
  | "paid"
  | "overdue"
  | "partial"
  | "refunded"
  | "written_off"
  | "quote_expired"
  | "quote_open";

export type EnterpriseDemoPaymentReconciliationStatus =
  | "reconciled"
  | "pending_reconciliation"
  | "mismatch_flagged"
  | "overdue_follow_up_missing";

export type EnterpriseDemoInvoiceSpec = {
  demoInvoiceKey: string;
  demoPatientKey: string;
  demoConsultationKey: string;
  demoCaseKey: string | null;
  demoBookingKey: string | null;
  demoSurgeryKey: string | null;
  clinicSlug: string;
  invoiceKind: FiInvoiceKind;
  status: FiInvoiceStatus;
  amountCents: number;
  taxCents: number;
  totalCents: number;
  amountPaidCents: number;
  currency: string;
  dueDate: string | null;
  issuedAt: string | null;
  title: string;
  lineDescription: string;
  demoFinancialLifecycle: EnterpriseDemoFinancialLifecycle;
  synthetic: true;
};

export type EnterpriseDemoPaymentRequestSpec = {
  demoPaymentRequestKey: string;
  demoInvoiceKey: string;
  clinicSlug: string;
  status: FiPaymentRequestStatus;
  amountCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  sentAt: string | null;
  expiresAt: string | null;
  synthetic: true;
};

export type EnterpriseDemoPaymentSpec = {
  demoPaymentKey: string;
  demoInvoiceKey: string;
  demoPaymentRequestKey: string | null;
  clinicSlug: string;
  status: FiGatewayPaymentStatus;
  amountCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  recordedAt: string;
  synthetic: true;
};

export type EnterpriseDemoFranchiseRiskSpec = {
  demoFinancialRiskKey: string;
  demoCaseKey: string;
  demoSurgeryKey: string;
  demoPatientKey: string;
  clinicSlug: string;
  revenueVarianceFlag: boolean;
  inventoryToGraftVarianceFlag: boolean;
  paymentReconciliationStatus: EnterpriseDemoPaymentReconciliationStatus;
  franchiseRiskScore: number;
  riskReasonCodes: string[];
  synthetic: true;
};

export type EnterpriseDemoConsultationFinancialBundle = {
  consultation: EnterpriseDemoPatientConsultationSpec;
  quoteInvoice: EnterpriseDemoInvoiceSpec;
  paymentRequest: EnterpriseDemoPaymentRequestSpec | null;
  payment: EnterpriseDemoPaymentSpec | null;
};

export type EnterpriseDemoSurgeryFinancialBundle = {
  surgery: EnterpriseDemoSurgerySpec;
  depositInvoice: EnterpriseDemoInvoiceSpec;
  balanceInvoice: EnterpriseDemoInvoiceSpec;
  adjustmentInvoice: EnterpriseDemoInvoiceSpec | null;
  depositPaymentRequest: EnterpriseDemoPaymentRequestSpec | null;
  balancePaymentRequest: EnterpriseDemoPaymentRequestSpec | null;
  depositPayment: EnterpriseDemoPaymentSpec | null;
  balancePayment: EnterpriseDemoPaymentSpec | null;
  refundPayment: EnterpriseDemoPaymentSpec | null;
  franchiseRisk: EnterpriseDemoFranchiseRiskSpec;
  bookingFinancialOsStatus: "tentative" | "deposit_pending" | "confirmed" | "paid_in_full" | null;
};

export type EnterpriseDemoFinancialBundleSpec = {
  consultationBundles: EnterpriseDemoConsultationFinancialBundle[];
  surgeryBundles: EnterpriseDemoSurgeryFinancialBundle[];
};

const CLINIC_CURRENCY: Record<string, string> = {
  "sydney-hair-institute": "AUD",
  "dubai-hair-institute": "AED",
  "bangkok-restoration-centre": "THB",
  "london-central-institute": "GBP",
  "athens-medical-institute": "EUR",
  "los-angeles-hair-institute": "USD",
  "mumbai-hair-sciences": "INR",
  "sao-paulo-hair-institute": "BRL",
};

function stableHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function clinicFinancialProfile(clinicSlug: string): EnterpriseDemoClinicFinancialProfile {
  return ENTERPRISE_DEMO_CLINIC_FINANCIAL_PROFILES[clinicSlug] ?? "standard";
}

function currencyForClinic(clinicSlug: string): string {
  return CLINIC_CURRENCY[clinicSlug] ?? "AUD";
}

function dollarsToCents(amount: number | null | undefined): number {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * 100);
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function ymdDaysAgo(days: number): string {
  return isoDaysAgo(days).slice(0, 10);
}

function ymdDaysAhead(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isoDaysAhead(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

function consultationQuoteInvoiceKey(consultationKey: string): string {
  return `${consultationKey}-quote-invoice`;
}

function surgeryDepositInvoiceKey(surgeryKey: string): string {
  return `${surgeryKey}-deposit-invoice`;
}

function surgeryBalanceInvoiceKey(surgeryKey: string): string {
  return `${surgeryKey}-balance-invoice`;
}

function surgeryAdjustmentInvoiceKey(surgeryKey: string): string {
  return `${surgeryKey}-adjustment-invoice`;
}

function paymentRequestKey(invoiceKey: string): string {
  return `${invoiceKey}-payment-request`;
}

function paymentKey(invoiceKey: string, suffix: string): string {
  return `${invoiceKey}-payment-${suffix}`;
}

function financialRiskKey(surgeryKey: string): string {
  return `${surgeryKey}-financial-risk`;
}

function resolveConsultationQuoteLifecycle(
  spec: EnterpriseDemoPatientConsultationSpec,
  profile: EnterpriseDemoClinicFinancialProfile
): {
  status: FiInvoiceStatus;
  lifecycle: EnterpriseDemoFinancialLifecycle;
  amountPaidCents: number;
  totalCents: number;
  dueDate: string | null;
  paymentRequestStatus: FiPaymentRequestStatus | null;
  paymentStatus: FiGatewayPaymentStatus | null;
} {
  const totalCents = dollarsToCents(spec.quotedValue);
  const hash = stableHash(spec.demoConsultationKey);

  if (totalCents <= 0) {
    return {
      status: "draft",
      lifecycle: "quote_open",
      amountPaidCents: 0,
      totalCents: 0,
      dueDate: null,
      paymentRequestStatus: null,
      paymentStatus: null,
    };
  }

  if (profile === "quote_expiry_leakage") {
    if (spec.consultationStatus === "quoted" && hash % 3 !== 0) {
      return {
        status: "issued",
        lifecycle: "quote_expired",
        amountPaidCents: 0,
        totalCents,
        dueDate: ymdDaysAgo(21 + (hash % 14)),
        paymentRequestStatus: "expired",
        paymentStatus: null,
      };
    }
    if (spec.conversionOutcome === "quoted_declined" || spec.conversionOutcome === "lost_to_competitor") {
      return {
        status: "cancelled",
        lifecycle: "quote_expired",
        amountPaidCents: 0,
        totalCents,
        dueDate: ymdDaysAgo(30),
        paymentRequestStatus: "cancelled",
        paymentStatus: null,
      };
    }
  }

  if (spec.consultationStatus === "converted_to_case" || spec.conversionOutcome === "converted_to_case") {
    return {
      status: "paid",
      lifecycle: "paid",
      amountPaidCents: totalCents,
      totalCents,
      dueDate: ymdDaysAgo(14),
      paymentRequestStatus: "paid",
      paymentStatus: "manually_recorded",
    };
  }

  if (spec.consultationStatus === "accepted") {
    return {
      status: hash % 4 === 0 ? "partially_paid" : "issued",
      lifecycle: hash % 4 === 0 ? "partial" : "quote_open",
      amountPaidCents: hash % 4 === 0 ? Math.floor(totalCents * 0.2) : 0,
      totalCents,
      dueDate: ymdDaysAhead(7 + (hash % 10)),
      paymentRequestStatus: hash % 4 === 0 ? "viewed" : "sent",
      paymentStatus: hash % 4 === 0 ? "manually_recorded" : null,
    };
  }

  if (spec.consultationStatus === "quoted") {
    const overdue = hash % 5 === 0 && profile !== "clean_reconciliation";
    return {
      status: overdue ? "overdue" : "issued",
      lifecycle: overdue ? "overdue" : "quote_open",
      amountPaidCents: 0,
      totalCents,
      dueDate: overdue ? ymdDaysAgo(5 + (hash % 10)) : ymdDaysAhead(14),
      paymentRequestStatus: overdue ? "sent" : "sent",
      paymentStatus: null,
    };
  }

  return {
    status: "draft",
    lifecycle: "quote_open",
    amountPaidCents: 0,
    totalCents,
    dueDate: null,
    paymentRequestStatus: null,
    paymentStatus: null,
  };
}

function buildConsultationQuoteInvoice(
  spec: EnterpriseDemoPatientConsultationSpec,
  lifecycle: ReturnType<typeof resolveConsultationQuoteLifecycle>
): EnterpriseDemoInvoiceSpec {
  const demoInvoiceKey = consultationQuoteInvoiceKey(spec.demoConsultationKey);
  const currency = currencyForClinic(spec.clinicSlug);
  const title =
    spec.quotedTreatment != null
      ? `Consultation quote · ${spec.quotedTreatment}`
      : `Consultation quote · ${spec.consultationType}`;

  return {
    demoInvoiceKey,
    demoPatientKey: spec.demoPatientKey,
    demoConsultationKey: spec.demoConsultationKey,
    demoCaseKey: null,
    demoBookingKey: null,
    demoSurgeryKey: null,
    clinicSlug: spec.clinicSlug,
    invoiceKind: "consultation_quote",
    status: lifecycle.status,
    amountCents: lifecycle.totalCents,
    taxCents: 0,
    totalCents: lifecycle.totalCents,
    amountPaidCents: lifecycle.amountPaidCents,
    currency,
    dueDate: lifecycle.dueDate,
    issuedAt: lifecycle.status !== "draft" ? isoDaysAgo(10 + (stableHash(demoInvoiceKey) % 20)) : null,
    title,
    lineDescription: spec.quotedTreatment ?? spec.consultationType,
    demoFinancialLifecycle: lifecycle.lifecycle,
    synthetic: true,
  };
}

function buildPaymentRequestForInvoice(
  invoice: EnterpriseDemoInvoiceSpec,
  status: FiPaymentRequestStatus,
  sentAt: string | null,
  expiresAt: string | null
): EnterpriseDemoPaymentRequestSpec {
  const outstanding = Math.max(0, invoice.totalCents - invoice.amountPaidCents);
  const amount = outstanding > 0 ? outstanding : invoice.totalCents;
  return {
    demoPaymentRequestKey: paymentRequestKey(invoice.demoInvoiceKey),
    demoInvoiceKey: invoice.demoInvoiceKey,
    clinicSlug: invoice.clinicSlug,
    status,
    amountCents: amount,
    taxCents: 0,
    totalCents: amount,
    currency: invoice.currency,
    sentAt,
    expiresAt,
    synthetic: true,
  };
}

function buildPaymentForInvoice(
  invoice: EnterpriseDemoInvoiceSpec,
  demoPaymentKey: string,
  amountCents: number,
  status: FiGatewayPaymentStatus,
  paymentRequestKeyValue: string | null
): EnterpriseDemoPaymentSpec {
  return {
    demoPaymentKey,
    demoInvoiceKey: invoice.demoInvoiceKey,
    demoPaymentRequestKey: paymentRequestKeyValue,
    clinicSlug: invoice.clinicSlug,
    status,
    amountCents,
    taxCents: 0,
    totalCents: amountCents,
    currency: invoice.currency,
    recordedAt: isoDaysAgo(3 + (stableHash(demoPaymentKey) % 12)),
    synthetic: true,
  };
}

function resolveSurgeryFinancials(
  surgery: EnterpriseDemoSurgerySpec,
  profile: EnterpriseDemoClinicFinancialProfile,
  surgeryIndex: number
): {
  depositStatus: FiInvoiceStatus;
  balanceStatus: FiInvoiceStatus;
  depositPaidCents: number;
  balancePaidCents: number;
  depositLifecycle: EnterpriseDemoFinancialLifecycle;
  balanceLifecycle: EnterpriseDemoFinancialLifecycle;
  adjustment: { amountCents: number; status: FiInvoiceStatus } | null;
  refundPayment: boolean;
  writtenOff: boolean;
  bookingFinancialOsStatus: EnterpriseDemoSurgeryFinancialBundle["bookingFinancialOsStatus"];
} {
  const procedureCents = dollarsToCents(surgery.quotedValue ?? surgery.graftTarget * 8);
  const depositCents = Math.floor(procedureCents * 0.25);
  const balanceCents = Math.max(0, procedureCents - depositCents);
  const hash = stableHash(surgery.demoSurgeryKey);

  if (profile === "clean_reconciliation") {
    const fullyPaid = surgery.surgeryStatus === "completed" || hash % 5 !== 0;
    return {
      depositStatus: "paid",
      balanceStatus: fullyPaid ? "paid" : "partially_paid",
      depositPaidCents: depositCents,
      balancePaidCents: fullyPaid ? balanceCents : Math.floor(balanceCents * 0.6),
      depositLifecycle: "paid",
      balanceLifecycle: fullyPaid ? "paid" : "partial",
      adjustment: null,
      refundPayment: false,
      writtenOff: false,
      bookingFinancialOsStatus: fullyPaid ? "paid_in_full" : "confirmed",
    };
  }

  if (profile === "overdue_collection_gaps") {
    const overdue = surgeryIndex < 4 || (surgery.surgeryStatus === "completed" && hash % 3 === 0);
    return {
      depositStatus: overdue && hash % 2 === 0 ? "partially_paid" : "paid",
      balanceStatus: overdue ? "overdue" : hash % 3 === 0 ? "partially_paid" : "paid",
      depositPaidCents:
        overdue && hash % 2 === 0 ? Math.floor(depositCents * 0.5) : depositCents,
      balancePaidCents: overdue ? Math.floor(depositCents * 0.5) : balanceCents,
      depositLifecycle: overdue && hash % 2 === 0 ? "partial" : "paid",
      balanceLifecycle: overdue ? "overdue" : hash % 3 === 0 ? "partial" : "paid",
      adjustment: null,
      refundPayment: false,
      writtenOff: false,
      bookingFinancialOsStatus: overdue ? "deposit_pending" : "confirmed",
    };
  }

  if (profile === "refund_adjustment_heavy") {
    const refunded = surgeryIndex < 3 && surgery.surgeryStatus === "completed";
    const writtenOff = surgeryIndex === 3;
    return {
      depositStatus: refunded ? "refunded" : "paid",
      balanceStatus: refunded ? "refunded" : writtenOff ? "cancelled" : hash % 4 === 0 ? "partially_paid" : "paid",
      depositPaidCents: depositCents,
      balancePaidCents: refunded ? balanceCents : writtenOff ? 0 : hash % 4 === 0 ? Math.floor(balanceCents * 0.7) : balanceCents,
      depositLifecycle: refunded ? "refunded" : "paid",
      balanceLifecycle: refunded ? "refunded" : writtenOff ? "written_off" : hash % 4 === 0 ? "partial" : "paid",
      adjustment: refunded
        ? { amountCents: Math.floor(procedureCents * 0.08), status: "issued" as FiInvoiceStatus }
        : null,
      refundPayment: refunded,
      writtenOff,
      bookingFinancialOsStatus: refunded ? "confirmed" : writtenOff ? "deposit_pending" : "paid_in_full",
    };
  }

  if (profile === "graft_invoice_variance") {
    return {
      depositStatus: "paid",
      balanceStatus: surgery.surgeryStatus === "completed" && hash % 2 === 0 ? "partially_paid" : "paid",
      depositPaidCents: depositCents,
      balancePaidCents:
        surgery.surgeryStatus === "completed" && hash % 2 === 0
          ? Math.floor(balanceCents * 0.85)
          : balanceCents,
      depositLifecycle: "paid",
      balanceLifecycle:
        surgery.surgeryStatus === "completed" && hash % 2 === 0 ? "partial" : "paid",
      adjustment: null,
      refundPayment: false,
      writtenOff: false,
      bookingFinancialOsStatus: "confirmed",
    };
  }

  const partial = hash % 6 === 0;
  return {
    depositStatus: partial ? "partially_paid" : "paid",
    balanceStatus: surgery.surgeryStatus === "scheduled" ? "issued" : partial ? "partially_paid" : "paid",
    depositPaidCents: partial ? Math.floor(depositCents * 0.6) : depositCents,
    balancePaidCents: partial ? Math.floor(balanceCents * 0.4) : balanceCents,
    depositLifecycle: partial ? "partial" : "paid",
    balanceLifecycle: surgery.surgeryStatus === "scheduled" ? "balance" : partial ? "partial" : "paid",
    adjustment: null,
    refundPayment: false,
    writtenOff: false,
    bookingFinancialOsStatus: surgery.surgeryStatus === "scheduled" ? "tentative" : "confirmed",
  };
}

function buildSurgeryInvoice(
  surgery: EnterpriseDemoSurgerySpec,
  kind: "surgery_deposit" | "surgery_balance" | "adjustment",
  demoInvoiceKey: string,
  totalCents: number,
  amountPaidCents: number,
  status: FiInvoiceStatus,
  lifecycle: EnterpriseDemoFinancialLifecycle,
  title: string
): EnterpriseDemoInvoiceSpec {
  return {
    demoInvoiceKey,
    demoPatientKey: surgery.demoPatientKey,
    demoConsultationKey: surgery.demoConsultationKey,
    demoCaseKey: surgery.demoCaseKey,
    demoBookingKey: surgery.demoBookingKey,
    demoSurgeryKey: surgery.demoSurgeryKey,
    clinicSlug: surgery.clinicSlug,
    invoiceKind: kind,
    status,
    amountCents: totalCents,
    taxCents: 0,
    totalCents,
    amountPaidCents,
    currency: currencyForClinic(surgery.clinicSlug),
    dueDate:
      lifecycle === "overdue"
        ? ymdDaysAgo(12 + (stableHash(demoInvoiceKey) % 20))
        : ymdDaysAhead(14 + (stableHash(demoInvoiceKey) % 10)),
    issuedAt: isoDaysAgo(20 + (stableHash(demoInvoiceKey) % 30)),
    title,
    lineDescription: surgery.procedureType,
    demoFinancialLifecycle: lifecycle,
    synthetic: true,
  };
}

function buildFranchiseRisk(
  surgery: EnterpriseDemoSurgerySpec,
  profile: EnterpriseDemoClinicFinancialProfile,
  financials: ReturnType<typeof resolveSurgeryFinancials>
): EnterpriseDemoFranchiseRiskSpec {
  const hash = stableHash(surgery.demoSurgeryKey);
  const revenueVariance =
    profile === "graft_invoice_variance" ||
    (surgery.invoiceGraftPlaceholder != null && surgery.graftTarget !== surgery.invoiceGraftPlaceholder);
  const inventoryVariance =
    profile === "graft_invoice_variance" ||
    surgery.performanceProfile === "graft_count_vs_quote";
  const reconciliationStatus: EnterpriseDemoPaymentReconciliationStatus =
    profile === "clean_reconciliation"
      ? "reconciled"
      : profile === "overdue_collection_gaps"
        ? financials.balanceLifecycle === "overdue"
          ? "overdue_follow_up_missing"
          : "pending_reconciliation"
        : profile === "graft_invoice_variance"
          ? "mismatch_flagged"
          : profile === "refund_adjustment_heavy"
            ? financials.refundPayment
              ? "mismatch_flagged"
              : "reconciled"
            : "pending_reconciliation";

  const reasonCodes: string[] = [];
  if (revenueVariance) reasonCodes.push("revenue_vs_quote_variance");
  if (inventoryVariance) reasonCodes.push("inventory_to_graft_variance");
  if (reconciliationStatus === "overdue_follow_up_missing") {
    reasonCodes.push("overdue_balance_no_follow_up");
  }
  if (financials.refundPayment) reasonCodes.push("quality_linked_refund");
  if (financials.writtenOff) reasonCodes.push("balance_written_off");
  if (reasonCodes.length === 0) reasonCodes.push("within_tolerance");

  let score = 18 + (hash % 25);
  if (revenueVariance) score += 22;
  if (inventoryVariance) score += 18;
  if (reconciliationStatus === "overdue_follow_up_missing") score += 28;
  if (financials.refundPayment) score += 15;
  if (financials.writtenOff) score += 20;
  if (profile === "clean_reconciliation") score = Math.min(score, 24);

  return {
    demoFinancialRiskKey: financialRiskKey(surgery.demoSurgeryKey),
    demoCaseKey: surgery.demoCaseKey,
    demoSurgeryKey: surgery.demoSurgeryKey,
    demoPatientKey: surgery.demoPatientKey,
    clinicSlug: surgery.clinicSlug,
    revenueVarianceFlag: revenueVariance,
    inventoryToGraftVarianceFlag: inventoryVariance,
    paymentReconciliationStatus: reconciliationStatus,
    franchiseRiskScore: Math.min(100, score),
    riskReasonCodes: reasonCodes,
    synthetic: true,
  };
}

function buildConsultationBundle(
  spec: EnterpriseDemoPatientConsultationSpec
): EnterpriseDemoConsultationFinancialBundle {
  const profile = clinicFinancialProfile(spec.clinicSlug);
  const lifecycle = resolveConsultationQuoteLifecycle(spec, profile);
  const quoteInvoice = buildConsultationQuoteInvoice(spec, lifecycle);

  let paymentRequest: EnterpriseDemoPaymentRequestSpec | null = null;
  let payment: EnterpriseDemoPaymentSpec | null = null;

  if (lifecycle.paymentRequestStatus) {
    paymentRequest = buildPaymentRequestForInvoice(
      quoteInvoice,
      lifecycle.paymentRequestStatus,
      lifecycle.status !== "draft" ? isoDaysAgo(8) : null,
      lifecycle.lifecycle === "quote_expired" ? isoDaysAgo(7) : isoDaysAhead(14)
    );
  }

  if (lifecycle.paymentStatus && lifecycle.amountPaidCents > 0) {
    payment = buildPaymentForInvoice(
      quoteInvoice,
      paymentKey(quoteInvoice.demoInvoiceKey, "primary"),
      lifecycle.amountPaidCents,
      lifecycle.paymentStatus,
      paymentRequest?.demoPaymentRequestKey ?? null
    );
  }

  return { consultation: spec, quoteInvoice, paymentRequest, payment };
}

function buildSurgeryBundle(
  surgery: EnterpriseDemoSurgerySpec,
  surgeryIndex: number
): EnterpriseDemoSurgeryFinancialBundle {
  const profile = clinicFinancialProfile(surgery.clinicSlug);
  const financials = resolveSurgeryFinancials(surgery, profile, surgeryIndex);
  const procedureCents = dollarsToCents(surgery.quotedValue ?? surgery.graftTarget * 8);
  const depositCents = Math.floor(procedureCents * 0.25);
  const balanceCents = Math.max(0, procedureCents - depositCents);

  const depositInvoice = buildSurgeryInvoice(
    surgery,
    "surgery_deposit",
    surgeryDepositInvoiceKey(surgery.demoSurgeryKey),
    depositCents,
    financials.depositPaidCents,
    financials.depositStatus,
    financials.depositLifecycle,
    `Surgery deposit · ${surgery.displayName}`
  );

  const balanceInvoice = buildSurgeryInvoice(
    surgery,
    "surgery_balance",
    surgeryBalanceInvoiceKey(surgery.demoSurgeryKey),
    balanceCents,
    financials.balancePaidCents,
    financials.balanceStatus,
    financials.balanceLifecycle,
    `Surgery balance · ${surgery.displayName}`
  );

  const adjustmentInvoice =
    financials.adjustment != null
      ? buildSurgeryInvoice(
          surgery,
          "adjustment",
          surgeryAdjustmentInvoiceKey(surgery.demoSurgeryKey),
          financials.adjustment.amountCents,
          0,
          financials.adjustment.status,
          "refunded",
          `Quality adjustment · ${surgery.displayName}`
        )
      : null;

  const depositPaymentRequest =
    depositInvoice.amountPaidCents < depositInvoice.totalCents
      ? buildPaymentRequestForInvoice(
          depositInvoice,
          "sent",
          isoDaysAgo(6),
          ymdDaysAhead(10)
        )
      : depositInvoice.amountPaidCents > 0
        ? buildPaymentRequestForInvoice(depositInvoice, "paid", isoDaysAgo(18), isoDaysAgo(2))
        : null;

  const balancePaymentRequest =
    balanceInvoice.amountPaidCents < balanceInvoice.totalCents
      ? buildPaymentRequestForInvoice(
          balanceInvoice,
          financials.balanceLifecycle === "overdue" ? "sent" : "viewed",
          isoDaysAgo(4),
          financials.balanceLifecycle === "overdue" ? isoDaysAgo(3) : isoDaysAhead(7)
        )
      : balanceInvoice.amountPaidCents > 0
        ? buildPaymentRequestForInvoice(balanceInvoice, "paid", isoDaysAgo(10), isoDaysAgo(1))
        : null;

  const depositPayment =
    depositInvoice.amountPaidCents > 0
      ? buildPaymentForInvoice(
          depositInvoice,
          paymentKey(depositInvoice.demoInvoiceKey, "deposit"),
          depositInvoice.amountPaidCents,
          financials.depositStatus === "refunded" ? "refunded" : "manually_recorded",
          depositPaymentRequest?.demoPaymentRequestKey ?? null
        )
      : null;

  const balancePayment =
    balanceInvoice.amountPaidCents > 0
      ? buildPaymentForInvoice(
          balanceInvoice,
          paymentKey(balanceInvoice.demoInvoiceKey, "balance"),
          balanceInvoice.amountPaidCents,
          financials.refundPayment ? "refunded" : "manually_recorded",
          balancePaymentRequest?.demoPaymentRequestKey ?? null
        )
      : null;

  const refundPayment =
    financials.refundPayment && balancePayment
      ? buildPaymentForInvoice(
          balanceInvoice,
          paymentKey(balanceInvoice.demoInvoiceKey, "refund"),
          Math.floor(balanceInvoice.totalCents * 0.12),
          "refunded",
          balancePaymentRequest?.demoPaymentRequestKey ?? null
        )
      : null;

  return {
    surgery,
    depositInvoice,
    balanceInvoice,
    adjustmentInvoice,
    depositPaymentRequest,
    balancePaymentRequest,
    depositPayment,
    balancePayment,
    refundPayment,
    franchiseRisk: buildFranchiseRisk(surgery, profile, financials),
    bookingFinancialOsStatus: financials.bookingFinancialOsStatus,
  };
}

export function buildEnterpriseDemoFinancialBundles(
  patientSpecs?: EnterpriseDemoPatientConsultationSpec[],
  surgerySpecs?: EnterpriseDemoSurgerySpec[]
): EnterpriseDemoFinancialBundleSpec {
  const consultations = patientSpecs ?? buildEnterpriseDemoPatientConsultationSpecs();
  const surgeries = surgerySpecs ?? buildEnterpriseDemoSurgerySpecs(consultations);

  const consultationBundles = consultations.map(buildConsultationBundle);

  const surgeryBundles = surgeries.map((surgery, index) => {
    const clinicSurgeries = surgeries.filter((s) => s.clinicSlug === surgery.clinicSlug);
    const surgeryIndex = clinicSurgeries.indexOf(surgery);
    return buildSurgeryBundle(surgery, surgeryIndex >= 0 ? surgeryIndex : index % 12);
  });

  return { consultationBundles, surgeryBundles };
}

export function validateEnterpriseDemoFinancialBundles(
  bundles: EnterpriseDemoFinancialBundleSpec
): { ok: true } | { ok: false; reason: string } {
  if (bundles.consultationBundles.length !== ENTERPRISE_DEMO_CONSULTATION_QUOTE_INVOICES) {
    return {
      ok: false,
      reason: `Expected ${ENTERPRISE_DEMO_CONSULTATION_QUOTE_INVOICES} consultation financial bundles, got ${bundles.consultationBundles.length}.`,
    };
  }

  if (bundles.surgeryBundles.length !== ENTERPRISE_DEMO_SURGERY_FINANCIAL_BUNDLES) {
    return {
      ok: false,
      reason: `Expected ${ENTERPRISE_DEMO_SURGERY_FINANCIAL_BUNDLES} surgery financial bundles, got ${bundles.surgeryBundles.length}.`,
    };
  }

  const invoiceKeys = new Set<string>();
  const paymentKeys = new Set<string>();
  const riskKeys = new Set<string>();

  for (const bundle of bundles.consultationBundles) {
    const key = bundle.quoteInvoice.demoInvoiceKey;
    if (invoiceKeys.has(key)) {
      return { ok: false, reason: `Duplicate ${ENTERPRISE_DEMO_INVOICE_KEY_METADATA}: ${key}` };
    }
    invoiceKeys.add(key);
    if (bundle.payment) {
      if (paymentKeys.has(bundle.payment.demoPaymentKey)) {
        return { ok: false, reason: `Duplicate ${ENTERPRISE_DEMO_PAYMENT_KEY_METADATA}: ${bundle.payment.demoPaymentKey}` };
      }
      paymentKeys.add(bundle.payment.demoPaymentKey);
    }
  }

  for (const bundle of bundles.surgeryBundles) {
    for (const invoice of [
      bundle.depositInvoice,
      bundle.balanceInvoice,
      bundle.adjustmentInvoice,
    ].filter((row): row is EnterpriseDemoInvoiceSpec => row != null)) {
      if (invoiceKeys.has(invoice.demoInvoiceKey)) {
        return { ok: false, reason: `Duplicate ${ENTERPRISE_DEMO_INVOICE_KEY_METADATA}: ${invoice.demoInvoiceKey}` };
      }
      invoiceKeys.add(invoice.demoInvoiceKey);
    }

    for (const payment of [
      bundle.depositPayment,
      bundle.balancePayment,
      bundle.refundPayment,
    ].filter((row): row is EnterpriseDemoPaymentSpec => row != null)) {
      if (paymentKeys.has(payment.demoPaymentKey)) {
        return { ok: false, reason: `Duplicate ${ENTERPRISE_DEMO_PAYMENT_KEY_METADATA}: ${payment.demoPaymentKey}` };
      }
      paymentKeys.add(payment.demoPaymentKey);
    }

    const riskKey = bundle.franchiseRisk.demoFinancialRiskKey;
    if (riskKeys.has(riskKey)) {
      return { ok: false, reason: `Duplicate ${ENTERPRISE_DEMO_FINANCIAL_RISK_KEY_METADATA}: ${riskKey}` };
    }
    riskKeys.add(riskKey);
  }

  const sydney = bundles.surgeryBundles.filter((b) => b.surgery.clinicSlug === "sydney-hair-institute");
  if (!sydney.every((b) => b.franchiseRisk.paymentReconciliationStatus === "reconciled")) {
    return { ok: false, reason: "Sydney surgeries should have reconciled payment status." };
  }

  const dubai = bundles.surgeryBundles.filter((b) => b.surgery.clinicSlug === "dubai-hair-institute");
  if (!dubai.some((b) => b.franchiseRisk.inventoryToGraftVarianceFlag)) {
    return { ok: false, reason: "Dubai surgeries should include graft variance flags." };
  }

  const bangkok = bundles.surgeryBundles.filter((b) => b.surgery.clinicSlug === "bangkok-restoration-centre");
  if (!bangkok.some((b) => b.balanceInvoice.status === "overdue")) {
    return { ok: false, reason: "Bangkok surgeries should include overdue balance invoices." };
  }

  const london = bundles.surgeryBundles.filter((b) => b.surgery.clinicSlug === "london-central-institute");
  if (!london.some((b) => b.refundPayment != null || b.adjustmentInvoice != null)) {
    return { ok: false, reason: "London surgeries should include refunds or adjustments." };
  }

  const athensQuotes = bundles.consultationBundles.filter(
    (b) => b.consultation.clinicSlug === "athens-medical-institute"
  );
  if (
    !athensQuotes.some(
      (b) =>
        b.quoteInvoice.demoFinancialLifecycle === "quote_expired" ||
        b.paymentRequest?.status === "expired"
    )
  ) {
    return { ok: false, reason: "Athens consultations should include quote expiry leakage." };
  }

  return { ok: true };
}

export function countEnterpriseDemoFinancialRecords(bundles: EnterpriseDemoFinancialBundleSpec): {
  consultationQuoteInvoices: number;
  surgeryFinancialBundles: number;
  totalInvoices: number;
  totalPayments: number;
  totalPaymentRequests: number;
  franchiseRiskRecords: number;
} {
  let totalInvoices = 0;
  let totalPayments = 0;
  let totalPaymentRequests = 0;

  for (const bundle of bundles.consultationBundles) {
    totalInvoices += 1;
    if (bundle.paymentRequest) totalPaymentRequests += 1;
    if (bundle.payment) totalPayments += 1;
  }

  for (const bundle of bundles.surgeryBundles) {
    totalInvoices += bundle.adjustmentInvoice ? 3 : 2;
    if (bundle.depositPaymentRequest) totalPaymentRequests += 1;
    if (bundle.balancePaymentRequest) totalPaymentRequests += 1;
    if (bundle.depositPayment) totalPayments += 1;
    if (bundle.balancePayment) totalPayments += 1;
    if (bundle.refundPayment) totalPayments += 1;
  }

  return {
    consultationQuoteInvoices: bundles.consultationBundles.length,
    surgeryFinancialBundles: bundles.surgeryBundles.length,
    totalInvoices,
    totalPayments,
    totalPaymentRequests,
    franchiseRiskRecords: bundles.surgeryBundles.length,
  };
}
