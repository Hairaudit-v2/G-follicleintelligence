/**
 * Pure FinancialOS super release workflow logic (Phase 3B) — safe for unit tests without DB.
 */

export type FiSuperReleaseApplicationStatus =
  | "draft"
  | "eligibility_review"
  | "documents_pending"
  | "clinical_letter_required"
  | "ready_for_submission"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "release_pending"
  | "funds_released"
  | "cancelled";

export type FiSuperReleaseDocumentType =
  | "identity_document"
  | "medical_letter"
  | "financial_hardship_statement"
  | "super_release_form"
  | "consent_form"
  | "bank_details"
  | "custom";

export type FiSuperReleaseDocumentStatus =
  | "pending"
  | "requested"
  | "received"
  | "verified"
  | "rejected";

export type FiSuperReleaseClinicalLetterStatus =
  | "draft"
  | "review_required"
  | "approved"
  | "issued";

export const RESOLVED_SUPER_RELEASE_STATUSES: readonly FiSuperReleaseApplicationStatus[] = [
  "funds_released",
  "cancelled",
];

export const SUPER_RELEASE_ELIGIBILITY_REVIEW_LABEL = "Super Release Eligibility Review" as const;
export const SUPER_RELEASE_DOCUMENTS_PENDING_LABEL = "Super Release Documents Pending" as const;
export const CLINICAL_LETTER_REQUIRED_LABEL = "Clinical Letter Required" as const;
export const SUPER_RELEASE_APPROVAL_PENDING_LABEL = "Super Release Approval Pending" as const;
export const FUNDS_RELEASE_PENDING_LABEL = "Funds Release Pending" as const;

export type FiSuperReleaseApplicationRow = {
  id: string;
  application_status: FiSuperReleaseApplicationStatus;
  submitted_at: string | null;
  approved_at: string | null;
  funds_released_at: string | null;
  expected_release_date: string | null;
  created_at: string;
  updated_at: string;
  payment_pathway_id: string;
  booking_id?: string | null;
  provider_name?: string | null;
};

export type FiSuperReleaseDocumentRow = {
  id: string;
  document_type: FiSuperReleaseDocumentType;
  status: FiSuperReleaseDocumentStatus;
  created_at: string;
  updated_at: string;
};

export type FiSuperReleaseClinicalLetterRow = {
  id: string;
  letter_status: FiSuperReleaseClinicalLetterStatus;
  issued_at: string | null;
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

export function isResolvedSuperReleaseStatus(status: FiSuperReleaseApplicationStatus): boolean {
  return RESOLVED_SUPER_RELEASE_STATUSES.includes(status);
}

export function isUnresolvedSuperReleaseApplication(
  application: FiSuperReleaseApplicationRow | null | undefined
): boolean {
  if (!application) return false;
  return !isResolvedSuperReleaseStatus(application.application_status);
}

export type BuildSuperReleaseAttentionInput = {
  todayYmd: string;
  application: FiSuperReleaseApplicationRow | null;
  surgeryDateYmd?: string | null;
};

function statusAnchorIso(application: FiSuperReleaseApplicationRow): string {
  const status = application.application_status;
  if (status === "submitted" || status === "under_review") {
    return application.submitted_at || application.updated_at || application.created_at;
  }
  if (status === "approved" || status === "release_pending") {
    return (
      application.approved_at ||
      application.submitted_at ||
      application.updated_at ||
      application.created_at
    );
  }
  return application.updated_at || application.created_at;
}

export function computeDaysInStatus(
  application: FiSuperReleaseApplicationRow,
  todayYmd: string
): number {
  return daysSinceIso(statusAnchorIso(application), todayYmd);
}

/**
 * Ops centre escalation (SLA breached):
 * - eligibility_review > 3 days
 * - documents_pending > 5 days
 * - clinical_letter_required > 3 days
 * - submitted > 7 days
 * - under_review > 10 days
 * - expected_release_date missed
 * - rejected application
 * - release_pending + surgery within 14 days
 */
export function requiresEscalatedSuperReleaseAttention(
  input: BuildSuperReleaseAttentionInput
): boolean {
  const { todayYmd, application, surgeryDateYmd = null } = input;
  if (!application || isResolvedSuperReleaseStatus(application.application_status)) return false;

  const status = application.application_status;
  const surgery = ymd(surgeryDateYmd);
  const expectedRelease = ymd(application.expected_release_date);
  const daysInStatus = computeDaysInStatus(application, todayYmd);

  if (status === "rejected") return true;

  if (status === "eligibility_review" && daysInStatus > 3) return true;
  if (status === "documents_pending" && daysInStatus > 5) return true;
  if (status === "clinical_letter_required" && daysInStatus > 3) return true;
  if (status === "submitted" && daysInStatus > 7) return true;
  if (status === "under_review" && daysInStatus > 10) return true;

  if (expectedRelease && expectedRelease < todayYmd && status !== "funds_released") return true;

  if (status === "release_pending" && surgery) {
    const daysToSurgery = daysBetween(todayYmd, surgery);
    return daysToSurgery >= 0 && daysToSurgery <= 14;
  }

  return false;
}

export function buildSuperReleaseAttentionLabels(input: BuildSuperReleaseAttentionInput): string[] {
  const { todayYmd, application, surgeryDateYmd = null } = input;
  if (!application || isResolvedSuperReleaseStatus(application.application_status)) return [];

  const labels: string[] = [];
  const status = application.application_status;
  const surgery = ymd(surgeryDateYmd);
  const expectedRelease = ymd(application.expected_release_date);

  if (status === "eligibility_review") labels.push(SUPER_RELEASE_ELIGIBILITY_REVIEW_LABEL);
  if (status === "documents_pending") labels.push(SUPER_RELEASE_DOCUMENTS_PENDING_LABEL);
  if (status === "clinical_letter_required") labels.push(CLINICAL_LETTER_REQUIRED_LABEL);

  if (
    status === "submitted" ||
    status === "under_review" ||
    status === "rejected" ||
    status === "approved" ||
    status === "ready_for_submission"
  ) {
    if (!["approved", "release_pending", "funds_released"].includes(status)) {
      labels.push(SUPER_RELEASE_APPROVAL_PENDING_LABEL);
    }
  }

  if (status === "release_pending") labels.push(FUNDS_RELEASE_PENDING_LABEL);

  if (expectedRelease && expectedRelease < todayYmd && status !== "funds_released") {
    if (!labels.includes(FUNDS_RELEASE_PENDING_LABEL)) labels.push(FUNDS_RELEASE_PENDING_LABEL);
  }

  if (status === "release_pending" && surgery) {
    const daysToSurgery = daysBetween(todayYmd, surgery);
    if (
      daysToSurgery >= 0 &&
      daysToSurgery <= 14 &&
      !labels.includes(FUNDS_RELEASE_PENDING_LABEL)
    ) {
      labels.push(FUNDS_RELEASE_PENDING_LABEL);
    }
  }

  return Array.from(new Set(labels));
}

export type SuperReleaseAttentionSummary = {
  super_release_attention_required: boolean;
  super_release_summary_label: string | null;
  super_release_attention_labels: string[];
  days_in_status: number;
  sla_breach: boolean;
};

function summaryLabelForStatus(status: FiSuperReleaseApplicationStatus): string {
  switch (status) {
    case "eligibility_review":
      return SUPER_RELEASE_ELIGIBILITY_REVIEW_LABEL;
    case "documents_pending":
      return SUPER_RELEASE_DOCUMENTS_PENDING_LABEL;
    case "clinical_letter_required":
      return CLINICAL_LETTER_REQUIRED_LABEL;
    case "release_pending":
      return FUNDS_RELEASE_PENDING_LABEL;
    case "submitted":
    case "under_review":
    case "ready_for_submission":
    case "approved":
    case "rejected":
      return SUPER_RELEASE_APPROVAL_PENDING_LABEL;
    case "draft":
      return "Super release draft";
    default:
      return "Super release in progress";
  }
}

/**
 * Surgery pipeline: any unresolved super release application blocks financial clearance.
 */
export function buildSuperReleaseAttentionSummary(
  input: BuildSuperReleaseAttentionInput
): SuperReleaseAttentionSummary {
  const { application } = input;
  if (!application || isResolvedSuperReleaseStatus(application.application_status)) {
    return {
      super_release_attention_required: false,
      super_release_summary_label: null,
      super_release_attention_labels: [],
      days_in_status: 0,
      sla_breach: false,
    };
  }

  const days_in_status = computeDaysInStatus(application, input.todayYmd);
  const labels = buildSuperReleaseAttentionLabels(input);
  const sla_breach = requiresEscalatedSuperReleaseAttention(input);

  return {
    super_release_attention_required: true,
    super_release_summary_label: labels[0] ?? summaryLabelForStatus(application.application_status),
    super_release_attention_labels: labels,
    days_in_status,
    sla_breach,
  };
}

export function resolveSuperReleaseAttention(input: BuildSuperReleaseAttentionInput): boolean {
  return requiresEscalatedSuperReleaseAttention(input);
}

export type SuperReleaseAnalyticsRow = FiSuperReleaseApplicationRow & {
  clinical_letters?: FiSuperReleaseClinicalLetterRow[];
};

export type SuperReleaseAnalytics = {
  approvalRate: number | null;
  rejectionRate: number | null;
  averageReleaseDays: number | null;
  averageApprovalDays: number | null;
  averageClinicalLetterTurnaroundDays: number | null;
  totalApplications: number;
  submittedCount: number;
  approvedCount: number;
  rejectedCount: number;
  fundsReleasedCount: number;
};

export type SuperReleaseDashboardCounts = {
  openCount: number;
  clinicalLettersPendingCount: number;
  awaitingDocumentsCount: number;
  submittedCount: number;
  fundsReleasePendingCount: number;
  attentionCount: number;
  averageApprovalDays: number | null;
};

function averageDaysBetween(startIso: string | null, endIso: string | null): number | null {
  const start = ymd(startIso);
  const end = ymd(endIso);
  if (!start || !end) return null;
  const d = daysBetween(start, end);
  return d >= 0 ? d : null;
}

export function aggregateSuperReleaseAnalytics(
  applications: SuperReleaseAnalyticsRow[],
  clinicalLetters: FiSuperReleaseClinicalLetterRow[] = []
): SuperReleaseAnalytics {
  const submitted = applications.filter((r) =>
    [
      "submitted",
      "under_review",
      "approved",
      "rejected",
      "release_pending",
      "funds_released",
    ].includes(r.application_status)
  );
  const approved = applications.filter((r) =>
    ["approved", "release_pending", "funds_released"].includes(r.application_status)
  );
  const rejected = applications.filter((r) => r.application_status === "rejected");
  const fundsReleased = applications.filter((r) => r.application_status === "funds_released");

  const approvalDays: number[] = [];
  const releaseDays: number[] = [];
  for (const r of applications) {
    const ad = averageDaysBetween(r.submitted_at, r.approved_at);
    if (ad != null) approvalDays.push(ad);
    const rd = averageDaysBetween(r.approved_at ?? r.submitted_at, r.funds_released_at);
    if (rd != null) releaseDays.push(rd);
  }

  const letterTurnaround: number[] = [];
  for (const letter of clinicalLetters) {
    if (letter.letter_status === "issued" && letter.issued_at) {
      const td = averageDaysBetween(letter.created_at, letter.issued_at);
      if (td != null) letterTurnaround.push(td);
    }
  }

  const decided = approved.length + rejected.length;

  return {
    totalApplications: applications.length,
    submittedCount: submitted.length,
    approvedCount: approved.length,
    rejectedCount: rejected.length,
    fundsReleasedCount: fundsReleased.length,
    approvalRate: decided > 0 ? approved.length / decided : null,
    rejectionRate: decided > 0 ? rejected.length / decided : null,
    averageApprovalDays:
      approvalDays.length > 0
        ? Math.round(approvalDays.reduce((a, b) => a + b, 0) / approvalDays.length)
        : null,
    averageReleaseDays:
      releaseDays.length > 0
        ? Math.round(releaseDays.reduce((a, b) => a + b, 0) / releaseDays.length)
        : null,
    averageClinicalLetterTurnaroundDays:
      letterTurnaround.length > 0
        ? Math.round(letterTurnaround.reduce((a, b) => a + b, 0) / letterTurnaround.length)
        : null,
  };
}

export function aggregateSuperReleaseDashboardCounts(
  applications: SuperReleaseAnalyticsRow[],
  todayYmd: string,
  clinicalLetters: FiSuperReleaseClinicalLetterRow[] = [],
  surgeryDatesByBookingId: Map<string, string> = new Map()
): SuperReleaseDashboardCounts {
  let openCount = 0;
  let clinicalLettersPendingCount = 0;
  let awaitingDocumentsCount = 0;
  let submittedCount = 0;
  let fundsReleasePendingCount = 0;
  let attentionCount = 0;
  const approvalDays: number[] = [];

  for (const app of applications) {
    if (!isResolvedSuperReleaseStatus(app.application_status)) openCount += 1;
    if (app.application_status === "clinical_letter_required") clinicalLettersPendingCount += 1;
    if (app.application_status === "documents_pending") awaitingDocumentsCount += 1;
    if (
      [
        "submitted",
        "under_review",
        "approved",
        "rejected",
        "release_pending",
        "funds_released",
      ].includes(app.application_status)
    ) {
      submittedCount += 1;
    }
    if (app.application_status === "release_pending") fundsReleasePendingCount += 1;

    const surgeryYmd = app.booking_id
      ? (surgeryDatesByBookingId.get(app.booking_id) ?? null)
      : null;
    if (
      resolveSuperReleaseAttention({
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

  const pendingLetters = clinicalLetters.filter((l) =>
    ["draft", "review_required"].includes(l.letter_status)
  );
  clinicalLettersPendingCount = Math.max(clinicalLettersPendingCount, pendingLetters.length);

  return {
    openCount,
    clinicalLettersPendingCount,
    awaitingDocumentsCount,
    submittedCount,
    fundsReleasePendingCount,
    attentionCount,
    averageApprovalDays:
      approvalDays.length > 0
        ? Math.round(approvalDays.reduce((a, b) => a + b, 0) / approvalDays.length)
        : null,
  };
}

export function hasPendingSuperReleaseDocuments(documents: FiSuperReleaseDocumentRow[]): boolean {
  return documents.some((d) => ["pending", "requested"].includes(d.status));
}
