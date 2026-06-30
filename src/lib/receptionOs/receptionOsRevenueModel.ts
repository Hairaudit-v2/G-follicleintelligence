/**
 * ReceptionOS Phase 3 — revenue probability, follow-up SLA, and conversion intelligence.
 * Pure model derived from board payload + optional conversion-board enrichment.
 */

import {
  compareReceptionOsSeverity,
  type ReceptionOsPipelineColumnId,
  type ReceptionOsSeverity,
  type ReceptionOsViewerRole,
} from "@/src/lib/receptionOs/receptionOsBoardModel";
import type {
  ReceptionOsBoardPayload,
  ReceptionOsCommunicationEvent,
  ReceptionOsDepositItem,
  ReceptionOsPipelineCard,
  ReceptionOsSurgeryItem,
} from "@/src/lib/receptionOs/receptionOsBoardModel.types";

export const RECEPTION_OS_CONVERSION_ENRICHMENT_COLUMN_IDS = [
  "consultation_booked",
  "consultation_completed",
  "quote_drafted",
  "quote_sent",
  "quote_accepted",
  "surgery_booked",
  "lost",
] as const;

export type ReceptionOsConversionEnrichmentColumnId =
  (typeof RECEPTION_OS_CONVERSION_ENRICHMENT_COLUMN_IDS)[number];

/** Optional conversion-board enrichment — mapped in command centre loader (keeps this module client-safe). */
export type ReceptionOsConversionEnrichmentCard = {
  id: string;
  primaryColumn: ReceptionOsConversionEnrichmentColumnId;
  patientOrLeadLabel: string;
  consultationDateYmd: string | null;
  daysSinceConsultation: number | null;
  graftOrTreatmentLine: string | null;
  leadStageLabel: string | null;
  caseId: string | null;
  caseLabel: string | null;
  depositBoardLine: string;
  hrefs: {
    consultation: string | null;
    lead: string | null;
    patient: string | null;
    case: string | null;
  };
};

export const RECEPTION_OS_REVENUE_RISK_ALERT_KINDS = [
  "high_value_quote_no_followup",
  "deposit_overdue",
  "surgery_booking_at_risk",
  "patient_gone_cold",
  "missing_finance_payment_link",
  "consultation_no_quote",
  "quote_followup_sla_breach",
] as const;

export type ReceptionOsRevenueRiskAlertKind =
  (typeof RECEPTION_OS_REVENUE_RISK_ALERT_KINDS)[number];

export const RECEPTION_OS_REVENUE_CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;
export type ReceptionOsRevenueConfidenceLevel =
  (typeof RECEPTION_OS_REVENUE_CONFIDENCE_LEVELS)[number];

export const RECEPTION_OS_PHASE3_WIDGET_KEYS = [
  "revenue_intelligence",
  "conversion_scoreboard",
] as const;
export type ReceptionOsPhase3WidgetKey = (typeof RECEPTION_OS_PHASE3_WIDGET_KEYS)[number];

export type ReceptionOsRevenueIntelligenceAccess = "full" | "summary" | "none";

export type ReceptionOsRevenueSubjectSignals = {
  subjectId: string;
  label: string;
  pipelineColumn: ReceptionOsPipelineColumnId | null;
  consultationCompleted: boolean;
  quoteSent: boolean;
  depositRequested: boolean;
  depositOverdue: boolean;
  upcomingSurgeryDate: string | null;
  surgeryPaymentComplete: boolean;
  communicationCount: number;
  daysSinceLastCommunication: number | null;
  leadStatus: string | null;
  caseStatus: string | null;
  estimatedQuoteValue: number;
  currency: string;
  daysSinceConsultation: number | null;
  hasPaymentLink: boolean;
  hrefs: {
    patient: string | null;
    case: string | null;
    lead: string | null;
    consultation: string | null;
  };
};

export type ReceptionOsRevenueScore = {
  subjectId: string;
  label: string;
  probabilityPercent: number;
  confidenceLevel: ReceptionOsRevenueConfidenceLevel;
  weightedRevenue: number;
  currency: string;
  riskFlags: string[];
  recommendedNextAction: string;
  hrefs: ReceptionOsRevenueSubjectSignals["hrefs"];
};

export type ReceptionOsRevenueRiskAlert = {
  id: string;
  kind: ReceptionOsRevenueRiskAlertKind;
  title: string;
  detail: string;
  severity: ReceptionOsSeverity;
  estimatedRevenueAtRisk: number | null;
  currency: string;
  href: string | null;
  hrefs: ReceptionOsRevenueSubjectSignals["hrefs"];
  recommendedAction: string;
};

export type ReceptionOsRevenueSummary = {
  totalWeightedRevenue: number;
  totalAtRiskRevenue: number;
  currency: string;
  scoredSubjectCount: number;
  averageProbabilityPercent: number;
  topOpportunities: ReceptionOsRevenueScore[];
};

export type ReceptionOsConversionScoreboard = {
  consultsCompletedToday: number;
  quotesSentToday: number;
  depositsCollectedToday: number;
  surgeryBookingsCreatedToday: number;
  projectedWeightedRevenue: number;
  atRiskRevenue: number;
  currency: string;
};

export type ReceptionOsRevenueIntelligencePayload = {
  revenueSummary: ReceptionOsRevenueSummary;
  conversionScoreboard: ReceptionOsConversionScoreboard;
  revenueRiskAlerts: ReceptionOsRevenueRiskAlert[];
};

export type ReceptionOsRevenueBuildInput = {
  board: ReceptionOsBoardPayload;
  conversionColumns?: Partial<
    Record<ReceptionOsConversionEnrichmentColumnId, readonly ReceptionOsConversionEnrichmentCard[]>
  >;
  depositsCollectedToday?: number;
  surgeryBookingsCreatedToday?: number;
  highValueQuoteThreshold?: number;
};

const DEFAULT_CURRENCY = "AUD";
const HIGH_VALUE_QUOTE_THRESHOLD = 10_000;
const FOLLOW_UP_SLA_HOURS = 48;
const LEAD_INACTIVE_DAYS = 7;
const STAGE_BASE_PROBABILITY: Record<ReceptionOsPipelineColumnId, number> = {
  new_lead: 8,
  consultation_booked: 18,
  consultation_completed: 38,
  quote_sent: 58,
  deposit_pending: 78,
  surgery_booked: 92,
};

const STAGE_DEFAULT_QUOTE_VALUE: Record<ReceptionOsPipelineColumnId, number> = {
  new_lead: 4_000,
  consultation_booked: 6_000,
  consultation_completed: 9_000,
  quote_sent: 12_000,
  deposit_pending: 14_000,
  surgery_booked: 16_000,
};

function clampProbability(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function primaryHref(hrefs: ReceptionOsRevenueSubjectSignals["hrefs"]): string | null {
  return hrefs.patient ?? hrefs.case ?? hrefs.lead ?? hrefs.consultation ?? null;
}

function leadIdFromHref(href: string | null | undefined): string | null {
  if (!href) return null;
  const m = href.match(/\/crm\/leads\/([^/?#]+)/);
  return m?.[1] ?? null;
}

function buildCommunicationIndex(
  events: readonly ReceptionOsCommunicationEvent[],
  todayYmd: string
): Map<string, { count: number; daysSinceLast: number | null }> {
  const byLead = new Map<string, { count: number; latestContactAt: string | null }>();
  for (const event of events) {
    const leadId = leadIdFromHref(event.hrefs.lead);
    if (!leadId) continue;
    const prev = byLead.get(leadId) ?? { count: 0, latestContactAt: null };
    prev.count += 1;
    if (!prev.latestContactAt || Date.parse(event.contactAt) > Date.parse(prev.latestContactAt)) {
      prev.latestContactAt = event.contactAt;
    }
    byLead.set(leadId, prev);
  }

  const out = new Map<string, { count: number; daysSinceLast: number | null }>();
  const todayMs = Date.parse(`${todayYmd}T12:00:00.000Z`);
  for (const [leadId, row] of byLead) {
    let daysSinceLast: number | null = null;
    if (row.latestContactAt) {
      const diff = todayMs - Date.parse(row.latestContactAt);
      daysSinceLast = Number.isFinite(diff) ? Math.max(0, Math.floor(diff / 86_400_000)) : null;
    }
    out.set(leadId, { count: row.count, daysSinceLast });
  }
  return out;
}

function findMatchingDeposit(
  deposits: readonly ReceptionOsDepositItem[],
  hrefs: ReceptionOsRevenueSubjectSignals["hrefs"]
): ReceptionOsDepositItem | null {
  for (const dep of deposits) {
    if (hrefs.lead && dep.hrefs.lead === hrefs.lead) return dep;
    if (hrefs.patient && dep.hrefs.patient === hrefs.patient) return dep;
    if (hrefs.case && dep.hrefs.case === dep.hrefs.case) return dep;
  }
  return null;
}

function findMatchingSurgery(
  surgeries: readonly ReceptionOsSurgeryItem[],
  hrefs: ReceptionOsRevenueSubjectSignals["hrefs"]
): ReceptionOsSurgeryItem | null {
  for (const surgery of surgeries) {
    if (hrefs.case && surgery.hrefs.case === hrefs.case) return surgery;
    if (hrefs.patient && surgery.hrefs.patient === hrefs.patient) return surgery;
  }
  return null;
}

function pipelineColumnFromConversion(
  col: ReceptionOsConversionEnrichmentColumnId,
  depositNeedsCollection: boolean
): ReceptionOsPipelineColumnId {
  if (col === "surgery_booked") return "surgery_booked";
  if (depositNeedsCollection) return "deposit_pending";
  if (col === "quote_sent" || col === "quote_accepted" || col === "quote_drafted")
    return "quote_sent";
  if (col === "consultation_completed") return "consultation_completed";
  if (col === "consultation_booked") return "consultation_booked";
  return "new_lead";
}

function depositNeedsCollectionFromLine(line: string): boolean {
  const lower = line.toLowerCase();
  return lower.includes("pending") || lower.includes("overdue") || lower.includes("partial");
}

function hasPaymentLinkFromDepositLine(line: string): boolean {
  const lower = line.toLowerCase();
  if (lower.includes("no manual deposit record")) return false;
  if (lower.includes("no tracking")) return false;
  return (
    lower.includes("paid") ||
    lower.includes("pending") ||
    lower.includes("partial") ||
    lower.includes("waived")
  );
}

function estimateQuoteValue(input: {
  pipelineColumn: ReceptionOsPipelineColumnId;
  deposit: ReceptionOsDepositItem | null;
  graftOrTreatmentLine: string | null;
}): number {
  if (input.deposit && input.deposit.amountExpected > 0) {
    return Math.max(input.deposit.amountExpected, STAGE_DEFAULT_QUOTE_VALUE[input.pipelineColumn]);
  }

  const graft = input.graftOrTreatmentLine ?? "";
  const moneyMatch =
    graft.match(/(?:AUD|\$)\s*([\d,]+(?:\.\d+)?)/i) ??
    graft.match(/([\d,]+(?:\.\d+)?)\s*(?:AUD|\$)/i);
  if (moneyMatch?.[1]) {
    const parsed = Number(moneyMatch[1].replace(/,/g, ""));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return STAGE_DEFAULT_QUOTE_VALUE[input.pipelineColumn];
}

function subjectFromPipelineCard(
  card: ReceptionOsPipelineCard,
  board: Pick<
    ReceptionOsBoardPayload,
    "outstandingDeposits" | "upcomingSurgeries" | "communicationTimeline" | "operationalDay"
  >,
  commIndex: Map<string, { count: number; daysSinceLast: number | null }>
): ReceptionOsRevenueSubjectSignals {
  const leadId = leadIdFromHref(card.hrefs.lead);
  const comm = leadId ? commIndex.get(leadId) : undefined;
  const deposit = findMatchingDeposit(board.outstandingDeposits, card.hrefs);
  const surgery = findMatchingSurgery(board.upcomingSurgeries, card.hrefs);
  const leadStatus =
    card.column === "new_lead" && card.detailLine?.startsWith("CRM · ")
      ? card.detailLine.replace("CRM · ", "").trim()
      : null;

  return {
    subjectId: card.id,
    label: card.patientOrLeadLabel,
    pipelineColumn: card.column,
    consultationCompleted:
      card.column === "consultation_completed" ||
      card.column === "quote_sent" ||
      card.column === "deposit_pending" ||
      card.column === "surgery_booked",
    quoteSent:
      card.column === "quote_sent" ||
      card.column === "deposit_pending" ||
      card.column === "surgery_booked",
    depositRequested: Boolean(deposit) || card.column === "deposit_pending",
    depositOverdue: Boolean(deposit?.isOverdue),
    upcomingSurgeryDate: surgery?.surgeryDate ?? null,
    surgeryPaymentComplete: surgery?.paymentComplete ?? false,
    communicationCount: comm?.count ?? 0,
    daysSinceLastCommunication: comm?.daysSinceLast ?? null,
    leadStatus,
    caseStatus: card.hrefs.case ? "linked" : null,
    estimatedQuoteValue: estimateQuoteValue({
      pipelineColumn: card.column,
      deposit,
      graftOrTreatmentLine: card.detailLine,
    }),
    currency: deposit?.currency ?? DEFAULT_CURRENCY,
    daysSinceConsultation: null,
    hasPaymentLink:
      Boolean(deposit) || card.column === "deposit_pending" || card.column === "surgery_booked",
    hrefs: {
      patient: card.hrefs.patient,
      case: card.hrefs.case,
      lead: card.hrefs.lead,
      consultation: card.hrefs.consultation,
    },
  };
}

function subjectFromConversionCard(
  card: ReceptionOsConversionEnrichmentCard,
  board: Pick<
    ReceptionOsBoardPayload,
    "outstandingDeposits" | "upcomingSurgeries" | "communicationTimeline" | "operationalDay"
  >,
  commIndex: Map<string, { count: number; daysSinceLast: number | null }>
): ReceptionOsRevenueSubjectSignals {
  const depositNeeds = depositNeedsCollectionFromLine(card.depositBoardLine);
  const pipelineColumn = pipelineColumnFromConversion(card.primaryColumn, depositNeeds);
  const leadId = leadIdFromHref(card.hrefs.lead);
  const comm = leadId ? commIndex.get(leadId) : undefined;
  const deposit = findMatchingDeposit(board.outstandingDeposits, card.hrefs);
  const surgery = findMatchingSurgery(board.upcomingSurgeries, card.hrefs);

  return {
    subjectId: card.id,
    label: card.patientOrLeadLabel,
    pipelineColumn,
    consultationCompleted:
      card.primaryColumn === "consultation_completed" ||
      card.primaryColumn === "quote_drafted" ||
      card.primaryColumn === "quote_sent" ||
      card.primaryColumn === "quote_accepted" ||
      card.primaryColumn === "surgery_booked",
    quoteSent:
      card.primaryColumn === "quote_sent" ||
      card.primaryColumn === "quote_accepted" ||
      card.primaryColumn === "surgery_booked" ||
      card.primaryColumn === "quote_drafted",
    depositRequested: depositNeeds || Boolean(deposit) || pipelineColumn === "deposit_pending",
    depositOverdue: Boolean(deposit?.isOverdue),
    upcomingSurgeryDate: surgery?.surgeryDate ?? null,
    surgeryPaymentComplete: surgery?.paymentComplete ?? false,
    communicationCount: comm?.count ?? 0,
    daysSinceLastCommunication: comm?.daysSinceLast ?? null,
    leadStatus: card.leadStageLabel,
    caseStatus: card.caseId ? (card.caseLabel ?? "linked") : null,
    estimatedQuoteValue: estimateQuoteValue({
      pipelineColumn,
      deposit,
      graftOrTreatmentLine: card.graftOrTreatmentLine,
    }),
    currency: deposit?.currency ?? DEFAULT_CURRENCY,
    daysSinceConsultation: card.daysSinceConsultation,
    hasPaymentLink: hasPaymentLinkFromDepositLine(card.depositBoardLine),
    hrefs: {
      patient: card.hrefs.patient,
      case: card.hrefs.case,
      lead: card.hrefs.lead,
      consultation: card.hrefs.consultation,
    },
  };
}

export function buildReceptionOsRevenueSubjects(
  input: ReceptionOsRevenueBuildInput
): ReceptionOsRevenueSubjectSignals[] {
  const commIndex = buildCommunicationIndex(
    input.board.communicationTimeline,
    input.board.operationalDay.todayYmd
  );
  const byId = new Map<string, ReceptionOsRevenueSubjectSignals>();

  if (input.conversionColumns) {
    for (const colId of RECEPTION_OS_CONVERSION_ENRICHMENT_COLUMN_IDS) {
      if (colId === "lost") continue;
      for (const card of input.conversionColumns[colId] ?? []) {
        byId.set(card.id, subjectFromConversionCard(card, input.board, commIndex));
      }
    }
  }

  for (const colId of Object.keys(
    input.board.consultationPipeline.columns
  ) as ReceptionOsPipelineColumnId[]) {
    for (const card of input.board.consultationPipeline.columns[colId]) {
      if (!byId.has(card.id)) {
        byId.set(card.id, subjectFromPipelineCard(card, input.board, commIndex));
      }
    }
  }

  return [...byId.values()];
}

export function scoreReceptionOsRevenueSubject(
  subject: ReceptionOsRevenueSubjectSignals
): ReceptionOsRevenueScore {
  const column = subject.pipelineColumn ?? "new_lead";
  let probability = STAGE_BASE_PROBABILITY[column];
  const riskFlags: string[] = [];
  let signalCount = 1;

  if (subject.consultationCompleted) signalCount += 1;
  if (subject.quoteSent) signalCount += 1;
  if (subject.depositRequested) signalCount += 1;
  if (subject.upcomingSurgeryDate) signalCount += 1;
  if (subject.communicationCount > 0) signalCount += 1;
  if (subject.leadStatus) signalCount += 1;
  if (subject.caseStatus) signalCount += 1;

  if (subject.depositOverdue) {
    probability -= 22;
    riskFlags.push("deposit_overdue");
  }

  if (subject.depositRequested && !subject.depositOverdue) {
    probability += 8;
  }

  if (subject.upcomingSurgeryDate && !subject.surgeryPaymentComplete) {
    probability -= 12;
    riskFlags.push("surgery_without_deposit");
  }

  if (subject.upcomingSurgeryDate && subject.surgeryPaymentComplete) {
    probability += 6;
  }

  if (
    subject.daysSinceLastCommunication != null &&
    subject.daysSinceLastCommunication >= LEAD_INACTIVE_DAYS
  ) {
    probability -= 18;
    riskFlags.push("lead_inactive");
  } else if (
    subject.daysSinceLastCommunication != null &&
    subject.daysSinceLastCommunication <= 2
  ) {
    probability += 6;
  }

  const lostLead = subject.leadStatus?.trim().toLowerCase() === "lost";
  if (lostLead) {
    probability -= 35;
    riskFlags.push("lead_lost");
  }

  if (subject.caseStatus) {
    probability += 5;
  }

  if (subject.consultationCompleted && !subject.quoteSent) {
    riskFlags.push("no_quote_after_consult");
    probability -= 5;
  }

  if (
    subject.quoteSent &&
    subject.daysSinceLastCommunication != null &&
    subject.daysSinceLastCommunication * 24 >= FOLLOW_UP_SLA_HOURS
  ) {
    riskFlags.push("quote_followup_gap");
    probability -= 8;
  }

  if (!subject.hasPaymentLink && subject.depositRequested) {
    riskFlags.push("missing_payment_link");
    probability -= 6;
  }

  probability = clampProbability(probability);

  const confidenceLevel: ReceptionOsRevenueConfidenceLevel =
    signalCount >= 6 ? "high" : signalCount >= 4 ? "medium" : "low";

  const weightedRevenue = Math.round((subject.estimatedQuoteValue * probability) / 100);

  const recommendedNextAction = recommendNextAction(subject, riskFlags);

  return {
    subjectId: subject.subjectId,
    label: subject.label,
    probabilityPercent: probability,
    confidenceLevel,
    weightedRevenue,
    currency: subject.currency,
    riskFlags,
    recommendedNextAction,
    hrefs: subject.hrefs,
  };
}

function recommendNextAction(
  subject: ReceptionOsRevenueSubjectSignals,
  riskFlags: string[]
): string {
  if (riskFlags.includes("deposit_overdue"))
    return "Chase overdue deposit and confirm payment pathway.";
  if (riskFlags.includes("surgery_without_deposit"))
    return "Secure surgery deposit before the held date slips.";
  if (riskFlags.includes("no_quote_after_consult"))
    return "Send quote and schedule follow-up within 48 hours.";
  if (riskFlags.includes("quote_followup_gap"))
    return "Follow up on sent quote — no contact in 48+ hours.";
  if (riskFlags.includes("missing_payment_link"))
    return "Send finance/payment link for requested deposit.";
  if (riskFlags.includes("lead_inactive")) return "Re-engage lead — no communication in 7+ days.";
  if (subject.pipelineColumn === "quote_sent")
    return "Confirm quote acceptance and move to deposit.";
  if (subject.pipelineColumn === "consultation_completed") return "Draft and send treatment quote.";
  if (subject.pipelineColumn === "deposit_pending")
    return "Confirm deposit receipt and book surgery.";
  return "Maintain cadence and advance to next conversion step.";
}

export function detectReceptionOsFollowUpSlaBreaches(
  subjects: readonly ReceptionOsRevenueSubjectSignals[]
): ReceptionOsRevenueRiskAlert[] {
  const alerts: ReceptionOsRevenueRiskAlert[] = [];

  for (const subject of subjects) {
    const href = primaryHref(subject.hrefs);
    const base = {
      currency: subject.currency,
      href,
      hrefs: subject.hrefs,
      estimatedRevenueAtRisk: subject.estimatedQuoteValue,
    };

    if (subject.consultationCompleted && !subject.quoteSent) {
      alerts.push({
        id: `sla-no-quote-${subject.subjectId}`,
        kind: "consultation_no_quote",
        title: "Consultation completed — no quote sent",
        detail: `${subject.label} · consultation done, quote not sent`,
        severity: (subject.daysSinceConsultation ?? 0) >= 3 ? "critical" : "warning",
        recommendedAction: "Send treatment quote and log follow-up.",
        ...base,
      });
    }

    if (
      subject.quoteSent &&
      subject.daysSinceLastCommunication != null &&
      subject.daysSinceLastCommunication * 24 >= FOLLOW_UP_SLA_HOURS
    ) {
      alerts.push({
        id: `sla-quote-followup-${subject.subjectId}`,
        kind: "quote_followup_sla_breach",
        title: "Quote sent — follow-up overdue",
        detail: `${subject.label} · no follow-up for ${subject.daysSinceLastCommunication} day(s)`,
        severity: subject.daysSinceLastCommunication >= 4 ? "critical" : "warning",
        recommendedAction: "Call or message patient about the sent quote.",
        ...base,
      });
    }

    if (subject.depositRequested && subject.depositOverdue) {
      alerts.push({
        id: `sla-deposit-overdue-${subject.subjectId}`,
        kind: "deposit_overdue",
        title: "Deposit overdue",
        detail: `${subject.label} · deposit past due date`,
        severity: "critical",
        recommendedAction: "Collect deposit or reschedule commitment.",
        ...base,
      });
    }

    if (subject.upcomingSurgeryDate && !subject.surgeryPaymentComplete) {
      alerts.push({
        id: `sla-surgery-deposit-${subject.subjectId}`,
        kind: "surgery_booking_at_risk",
        title: "Surgery date held without deposit",
        detail: `${subject.label} · surgery ${subject.upcomingSurgeryDate} · deposit incomplete`,
        severity: "critical",
        recommendedAction: "Confirm deposit and readiness before surgery date.",
        ...base,
      });
    }

    if (
      subject.daysSinceLastCommunication != null &&
      subject.daysSinceLastCommunication >= LEAD_INACTIVE_DAYS &&
      subject.pipelineColumn !== "surgery_booked"
    ) {
      alerts.push({
        id: `sla-lead-cold-${subject.subjectId}`,
        kind: "patient_gone_cold",
        title: "Patient gone cold",
        detail: `${subject.label} · inactive ${subject.daysSinceLastCommunication} days`,
        severity: subject.daysSinceLastCommunication >= 14 ? "critical" : "warning",
        recommendedAction: "Re-engage with personalised follow-up.",
        ...base,
      });
    }
  }

  return alerts;
}

export function buildReceptionOsLostRevenueAlerts(input: {
  subjects: readonly ReceptionOsRevenueSubjectSignals[];
  scores: readonly ReceptionOsRevenueScore[];
  highValueQuoteThreshold?: number;
}): ReceptionOsRevenueRiskAlert[] {
  const threshold = input.highValueQuoteThreshold ?? HIGH_VALUE_QUOTE_THRESHOLD;
  const slaAlerts = detectReceptionOsFollowUpSlaBreaches(input.subjects);
  const alerts: ReceptionOsRevenueRiskAlert[] = [...slaAlerts];
  const seen = new Set(alerts.map((a) => a.id));

  for (const score of input.scores) {
    const subject = input.subjects.find((s) => s.subjectId === score.subjectId);
    if (!subject) continue;

    if (
      subject.quoteSent &&
      subject.estimatedQuoteValue >= threshold &&
      score.riskFlags.includes("quote_followup_gap") &&
      !seen.has(`lost-high-value-${subject.subjectId}`)
    ) {
      alerts.push({
        id: `lost-high-value-${subject.subjectId}`,
        kind: "high_value_quote_no_followup",
        title: "High-value quote without follow-up",
        detail: `${subject.label} · ${subject.currency} ${subject.estimatedQuoteValue.toLocaleString()} quote · no recent follow-up`,
        severity: "critical",
        estimatedRevenueAtRisk: subject.estimatedQuoteValue,
        currency: subject.currency,
        href: primaryHref(subject.hrefs),
        hrefs: subject.hrefs,
        recommendedAction: "Priority consultant follow-up on high-value quote.",
      });
      seen.add(`lost-high-value-${subject.subjectId}`);
    }

    if (
      score.riskFlags.includes("missing_payment_link") &&
      !seen.has(`lost-payment-link-${subject.subjectId}`)
    ) {
      alerts.push({
        id: `lost-payment-link-${subject.subjectId}`,
        kind: "missing_finance_payment_link",
        title: "Missing finance / payment link",
        detail: `${subject.label} · deposit requested without payment link`,
        severity: "warning",
        estimatedRevenueAtRisk: subject.estimatedQuoteValue,
        currency: subject.currency,
        href: primaryHref(subject.hrefs),
        hrefs: subject.hrefs,
        recommendedAction: "Send secure payment link via finance pathway.",
      });
      seen.add(`lost-payment-link-${subject.subjectId}`);
    }
  }

  alerts.sort((a, b) => compareReceptionOsSeverity(a.severity, b.severity));
  return alerts.slice(0, 40);
}

export function buildReceptionOsConversionScoreboard(input: {
  board: Pick<ReceptionOsBoardPayload, "operationalDay" | "consultationPipeline">;
  conversionColumns?: Partial<
    Record<ReceptionOsConversionEnrichmentColumnId, readonly ReceptionOsConversionEnrichmentCard[]>
  >;
  scores: readonly ReceptionOsRevenueScore[];
  revenueRiskAlerts: readonly ReceptionOsRevenueRiskAlert[];
  depositsCollectedToday?: number;
  surgeryBookingsCreatedToday?: number;
}): ReceptionOsConversionScoreboard {
  const todayYmd = input.board.operationalDay.todayYmd;
  let consultsCompletedToday = 0;
  let quotesSentToday = 0;

  if (input.conversionColumns) {
    for (const card of input.conversionColumns.consultation_completed ?? []) {
      if (card.consultationDateYmd === todayYmd) consultsCompletedToday += 1;
    }
    for (const col of ["quote_sent", "quote_accepted"] as const) {
      for (const card of input.conversionColumns[col] ?? []) {
        if (card.consultationDateYmd === todayYmd || card.daysSinceConsultation === 0)
          quotesSentToday += 1;
      }
    }
  } else {
    consultsCompletedToday = input.board.consultationPipeline.counts.consultation_completed;
    quotesSentToday = input.board.consultationPipeline.counts.quote_sent;
  }

  const projectedWeightedRevenue = input.scores.reduce((sum, s) => sum + s.weightedRevenue, 0);
  const atRiskRevenue = input.revenueRiskAlerts.reduce(
    (sum, a) => sum + (a.estimatedRevenueAtRisk ?? 0),
    0
  );

  return {
    consultsCompletedToday,
    quotesSentToday,
    depositsCollectedToday: input.depositsCollectedToday ?? 0,
    surgeryBookingsCreatedToday: input.surgeryBookingsCreatedToday ?? 0,
    projectedWeightedRevenue,
    atRiskRevenue,
    currency: input.scores[0]?.currency ?? DEFAULT_CURRENCY,
  };
}

export function buildReceptionOsRevenueSummary(input: {
  scores: readonly ReceptionOsRevenueScore[];
  subjects: readonly ReceptionOsRevenueSubjectSignals[];
}): ReceptionOsRevenueSummary {
  const { scores, subjects } = input;
  const currency = scores[0]?.currency ?? DEFAULT_CURRENCY;
  const totalWeightedRevenue = scores.reduce((sum, s) => sum + s.weightedRevenue, 0);
  const atRiskSubjectIds = new Set(
    scores.filter((s) => s.riskFlags.length > 0).map((s) => s.subjectId)
  );
  const totalAtRiskRevenue = subjects
    .filter((s) => atRiskSubjectIds.has(s.subjectId))
    .reduce((sum, s) => sum + s.estimatedQuoteValue, 0);
  const averageProbabilityPercent =
    scores.length > 0
      ? Math.round(scores.reduce((sum, s) => sum + s.probabilityPercent, 0) / scores.length)
      : 0;

  const topOpportunities = scores
    .slice()
    .sort(
      (a, b) => b.weightedRevenue - a.weightedRevenue || b.probabilityPercent - a.probabilityPercent
    )
    .slice(0, 8);

  return {
    totalWeightedRevenue,
    totalAtRiskRevenue,
    currency,
    scoredSubjectCount: scores.length,
    averageProbabilityPercent,
    topOpportunities,
  };
}

export function buildReceptionOsRevenueIntelligence(
  input: ReceptionOsRevenueBuildInput
): ReceptionOsRevenueIntelligencePayload {
  const subjects = buildReceptionOsRevenueSubjects(input);
  const scores = subjects.map(scoreReceptionOsRevenueSubject);
  const revenueRiskAlerts = buildReceptionOsLostRevenueAlerts({
    subjects,
    scores,
    highValueQuoteThreshold: input.highValueQuoteThreshold,
  });
  const conversionScoreboard = buildReceptionOsConversionScoreboard({
    board: input.board,
    conversionColumns: input.conversionColumns,
    scores,
    revenueRiskAlerts,
    depositsCollectedToday: input.depositsCollectedToday,
    surgeryBookingsCreatedToday: input.surgeryBookingsCreatedToday,
  });
  const revenueSummary = buildReceptionOsRevenueSummary({ scores, subjects });

  return { revenueSummary, conversionScoreboard, revenueRiskAlerts };
}

export function revenueIntelligenceAccessForRole(
  role: ReceptionOsViewerRole
): ReceptionOsRevenueIntelligenceAccess {
  if (role === "admin" || role === "clinic_manager") return "full";
  if (role === "consultant") return "summary";
  return "none";
}

export function conversionScoreboardVisibleForRole(role: ReceptionOsViewerRole): boolean {
  return revenueIntelligenceAccessForRole(role) !== "none";
}

export function phase3WidgetsForRole(
  role: ReceptionOsViewerRole
): readonly ReceptionOsPhase3WidgetKey[] {
  const access = revenueIntelligenceAccessForRole(role);
  if (access === "full") return RECEPTION_OS_PHASE3_WIDGET_KEYS;
  if (access === "summary") return ["conversion_scoreboard"];
  return [];
}
