/**
 * Pure FinancialOS financing application logic (Phase 3) — safe for unit tests without DB.
 */

export type FiFinanceProviderType =
  | "medical_financing"
  | "bnpl"
  | "super_release"
  | "international_financing"
  | "custom";

export type FiFinanceApplicationStatus =
  | "draft"
  | "documents_pending"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "settlement_pending"
  | "settled"
  | "cancelled";

export type FiFinanceApplicationDocumentType =
  | "id_verification"
  | "bank_statement"
  | "medical_letter"
  | "super_release_form"
  | "income_verification"
  | "consent_form"
  | "custom";

export type FiFinanceApplicationDocumentStatus =
  | "pending"
  | "requested"
  | "received"
  | "verified"
  | "rejected";

export const RESOLVED_FINANCE_APPLICATION_STATUSES: readonly FiFinanceApplicationStatus[] = [
  "settled",
  "cancelled",
];

export const FINANCE_DOCUMENTS_PENDING_LABEL = "Finance Documents Pending" as const;
export const FINANCE_APPROVAL_PENDING_LABEL = "Finance Approval Pending" as const;
export const SETTLEMENT_PENDING_LABEL = "Settlement Pending" as const;

export type FiFinanceApplicationRow = {
  id: string;
  application_status: FiFinanceApplicationStatus;
  submitted_at: string | null;
  approved_at: string | null;
  settled_at: string | null;
  expected_settlement_date: string | null;
  created_at: string;
  updated_at: string;
  finance_provider_id: string;
  payment_pathway_id: string;
  booking_id?: string | null;
};

export type FiFinanceApplicationDocumentRow = {
  id: string;
  document_type: FiFinanceApplicationDocumentType;
  status: FiFinanceApplicationDocumentStatus;
  created_at: string;
  updated_at: string;
};

function ymd(s: string | null | undefined): string | null {
  const t = s?.trim();
  if (!t) return null;
  return t.length >= 10 ? t.slice(0, 10) : t;
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const a = Date.parse(`${fromYmd}T00:00:00Z`);
  const b = Date.parse(`${toYmd}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

function daysSinceIso(iso: string, todayYmd: string): number {
  const d = ymd(iso);
  if (!d) return 0;
  return daysBetween(d, todayYmd);
}

export function isResolvedFinanceApplicationStatus(status: FiFinanceApplicationStatus): boolean {
  return RESOLVED_FINANCE_APPLICATION_STATUSES.includes(status);
}

export function isUnresolvedFinanceApplication(
  application: FiFinanceApplicationRow | null | undefined
): boolean {
  if (!application) return false;
  return !isResolvedFinanceApplicationStatus(application.application_status);
}

export type FinanceApplicationAttentionSummary = {
  finance_attention_required: boolean;
  finance_attention_reason: string | null;
  finance_attention_labels: string[];
};

export type BuildFinanceApplicationAttentionInput = {
  todayYmd: string;
  application: FiFinanceApplicationRow | null;
  surgeryDateYmd?: string | null;
};

/**
 * Attention rules for ops centre escalation (SLA breached):
 * - documents_pending > 3 days
 * - submitted > 5 days
 * - under_review > 7 days
 * - expected settlement missed
 * - rejected application
 * - settlement_pending and surgery within 14 days
 */
export function requiresEscalatedFinanceApplicationAttention(
  input: BuildFinanceApplicationAttentionInput
): boolean {
  const { todayYmd, application, surgeryDateYmd = null } = input;
  if (!application || isResolvedFinanceApplicationStatus(application.application_status))
    return false;

  const status = application.application_status;
  const surgery = ymd(surgeryDateYmd);
  const expectedSettlement = ymd(application.expected_settlement_date);

  if (status === "rejected") return true;

  if (status === "documents_pending") {
    return daysSinceIso(application.updated_at || application.created_at, todayYmd) > 3;
  }

  if (status === "submitted") {
    const anchor = application.submitted_at || application.updated_at || application.created_at;
    return daysSinceIso(anchor, todayYmd) > 5;
  }

  if (status === "under_review") {
    const anchor = application.submitted_at || application.updated_at || application.created_at;
    return daysSinceIso(anchor, todayYmd) > 7;
  }

  if (expectedSettlement && expectedSettlement < todayYmd && status !== "settled") return true;

  if (status === "settlement_pending" && surgery) {
    const daysToSurgery = daysBetween(todayYmd, surgery);
    return daysToSurgery >= 0 && daysToSurgery <= 14;
  }

  return false;
}

export function buildFinanceApplicationAttentionLabels(
  input: BuildFinanceApplicationAttentionInput
): string[] {
  const { todayYmd, application, surgeryDateYmd = null } = input;
  if (!application || isResolvedFinanceApplicationStatus(application.application_status)) return [];

  const labels: string[] = [];
  const status = application.application_status;
  const surgery = ymd(surgeryDateYmd);
  const expectedSettlement = ymd(application.expected_settlement_date);

  if (status === "documents_pending") {
    labels.push(FINANCE_DOCUMENTS_PENDING_LABEL);
  }

  if (
    status === "submitted" ||
    status === "under_review" ||
    status === "rejected" ||
    status === "approved"
  ) {
    if (status !== "approved") labels.push(FINANCE_APPROVAL_PENDING_LABEL);
  }

  if (status === "settlement_pending") {
    labels.push(SETTLEMENT_PENDING_LABEL);
  }

  if (expectedSettlement && expectedSettlement < todayYmd && status !== "settled") {
    if (!labels.includes(SETTLEMENT_PENDING_LABEL)) labels.push(SETTLEMENT_PENDING_LABEL);
  }

  if (status === "settlement_pending" && surgery) {
    const daysToSurgery = daysBetween(todayYmd, surgery);
    if (daysToSurgery >= 0 && daysToSurgery <= 14 && !labels.includes(SETTLEMENT_PENDING_LABEL)) {
      labels.push(SETTLEMENT_PENDING_LABEL);
    }
  }

  return Array.from(new Set(labels));
}

/**
 * Surgery pipeline: any unresolved finance application blocks financial clearance.
 * Labels reflect current workflow stage.
 */
export function buildFinanceApplicationAttentionSummary(
  input: BuildFinanceApplicationAttentionInput
): FinanceApplicationAttentionSummary {
  const { application } = input;
  if (!application || isResolvedFinanceApplicationStatus(application.application_status)) {
    return {
      finance_attention_required: false,
      finance_attention_reason: null,
      finance_attention_labels: [],
    };
  }

  const labels = buildFinanceApplicationAttentionLabels(input);
  return {
    finance_attention_required: true,
    finance_attention_reason: labels.length
      ? labels.join("; ")
      : "Financing application in progress",
    finance_attention_labels: labels,
  };
}

export function resolveFinanceApplicationAttention(
  input: BuildFinanceApplicationAttentionInput
): boolean {
  return requiresEscalatedFinanceApplicationAttention(input);
}

export type FinanceApplicationAnalyticsRow = FiFinanceApplicationRow & {
  provider_name?: string;
};

export type FinanceProviderAnalytics = {
  providerId: string;
  providerName: string;
  totalApplications: number;
  submittedCount: number;
  approvedCount: number;
  rejectedCount: number;
  settledCount: number;
  approvalRate: number | null;
  rejectionRate: number | null;
  averageApprovalDays: number | null;
  averageSettlementDays: number | null;
};

export type FinanceApplicationsDashboardCounts = {
  submittedCount: number;
  approvedCount: number;
  pendingDocsCount: number;
  settlementPendingCount: number;
  attentionCount: number;
  averageApprovalDays: number | null;
  providerConversionRates: Array<{
    providerId: string;
    providerName: string;
    conversionRate: number | null;
  }>;
  mostUsedProvider: { providerId: string; providerName: string; count: number } | null;
};

function averageDaysBetween(startIso: string | null, endIso: string | null): number | null {
  const start = ymd(startIso);
  const end = ymd(endIso);
  if (!start || !end) return null;
  const d = daysBetween(start, end);
  return d >= 0 ? d : null;
}

export function aggregateFinanceProviderAnalytics(
  applications: FinanceApplicationAnalyticsRow[],
  providerNames: Map<string, string>
): FinanceProviderAnalytics[] {
  const byProvider = new Map<string, FinanceApplicationAnalyticsRow[]>();
  for (const app of applications) {
    const pid = app.finance_provider_id;
    byProvider.set(pid, [...(byProvider.get(pid) ?? []), app]);
  }

  const out: FinanceProviderAnalytics[] = [];
  for (const [providerId, rows] of byProvider) {
    const submitted = rows.filter((r) =>
      [
        "submitted",
        "under_review",
        "approved",
        "rejected",
        "settlement_pending",
        "settled",
      ].includes(r.application_status)
    );
    const approved = rows.filter((r) =>
      ["approved", "settlement_pending", "settled"].includes(r.application_status)
    );
    const rejected = rows.filter((r) => r.application_status === "rejected");
    const settled = rows.filter((r) => r.application_status === "settled");

    const approvalDays: number[] = [];
    const settlementDays: number[] = [];
    for (const r of rows) {
      const ad = averageDaysBetween(r.submitted_at, r.approved_at);
      if (ad != null) approvalDays.push(ad);
      const sd = averageDaysBetween(r.approved_at ?? r.submitted_at, r.settled_at);
      if (sd != null) settlementDays.push(sd);
    }

    const decided = approved.length + rejected.length;
    out.push({
      providerId,
      providerName: providerNames.get(providerId) ?? providerId,
      totalApplications: rows.length,
      submittedCount: submitted.length,
      approvedCount: approved.length,
      rejectedCount: rejected.length,
      settledCount: settled.length,
      approvalRate: decided > 0 ? approved.length / decided : null,
      rejectionRate: decided > 0 ? rejected.length / decided : null,
      averageApprovalDays:
        approvalDays.length > 0
          ? Math.round(approvalDays.reduce((a, b) => a + b, 0) / approvalDays.length)
          : null,
      averageSettlementDays:
        settlementDays.length > 0
          ? Math.round(settlementDays.reduce((a, b) => a + b, 0) / settlementDays.length)
          : null,
    });
  }

  return out.sort((a, b) => b.totalApplications - a.totalApplications);
}

export function aggregateFinanceApplicationsDashboardCounts(
  applications: FinanceApplicationAnalyticsRow[],
  todayYmd: string,
  providerNames: Map<string, string>,
  surgeryDatesByBookingId: Map<string, string> = new Map()
): FinanceApplicationsDashboardCounts {
  let submittedCount = 0;
  let approvedCount = 0;
  let pendingDocsCount = 0;
  let settlementPendingCount = 0;
  let attentionCount = 0;
  const approvalDays: number[] = [];

  for (const app of applications) {
    if (
      [
        "submitted",
        "under_review",
        "approved",
        "rejected",
        "settlement_pending",
        "settled",
      ].includes(app.application_status)
    ) {
      submittedCount += 1;
    }
    if (["approved", "settlement_pending", "settled"].includes(app.application_status)) {
      approvedCount += 1;
    }
    if (app.application_status === "documents_pending") pendingDocsCount += 1;
    if (app.application_status === "settlement_pending") settlementPendingCount += 1;

    const surgeryYmd = app.booking_id
      ? (surgeryDatesByBookingId.get(app.booking_id) ?? null)
      : null;
    if (
      resolveFinanceApplicationAttention({
        todayYmd,
        application: app,
        surgeryDateYmd: surgeryYmd,
      })
    ) {
      attentionCount += 1;
    }

    const ad = averageDaysBetween(app.submitted_at, app.approved_at);
    if (ad != null) approvalDays.push(ad);
  }

  const providerAnalytics = aggregateFinanceProviderAnalytics(applications, providerNames);
  const providerConversionRates = providerAnalytics.map((p) => ({
    providerId: p.providerId,
    providerName: p.providerName,
    conversionRate: p.approvalRate,
  }));

  const mostUsed = providerAnalytics.length
    ? providerAnalytics.reduce((best, cur) =>
        cur.totalApplications > best.totalApplications ? cur : best
      )
    : null;

  return {
    submittedCount,
    approvedCount,
    pendingDocsCount,
    settlementPendingCount,
    attentionCount,
    averageApprovalDays:
      approvalDays.length > 0
        ? Math.round(approvalDays.reduce((a, b) => a + b, 0) / approvalDays.length)
        : null,
    providerConversionRates,
    mostUsedProvider: mostUsed
      ? {
          providerId: mostUsed.providerId,
          providerName: mostUsed.providerName,
          count: mostUsed.totalApplications,
        }
      : null,
  };
}

export function hasPendingFinanceDocuments(documents: FiFinanceApplicationDocumentRow[]): boolean {
  return documents.some((d) => ["pending", "requested"].includes(d.status));
}
