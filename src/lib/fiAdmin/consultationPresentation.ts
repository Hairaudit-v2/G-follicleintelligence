/**
 * ConsultationOS — clinic-facing presentation helpers (UI copy only; no loader changes).
 */

import type { ConsultationConversionBoardCard } from "@/src/lib/consultations/consultationConversionBoardLoader.server";
import {
  hasQuoteDraftSignals,
  normalizeQuoteStatusFromSignals,
} from "@/src/lib/consultations/consultationConversionBoardModel";
import type { ConsultationIndexRow } from "@/src/lib/consultations/consultationLoaders.server";
import {
  CONSULTATION_TYPE_DEFINITIONS,
  type ConsultationSectionId,
  type ConsultationTypeId,
} from "@/src/lib/consultations/consultationTypeConfig";
import type { ConsultationStatus } from "@/src/lib/consultations/consultationTypes";

import type { ConsultationDashboardPayload } from "./consultationDashboardTypes";

export const consultationOsLinkButtonClass =
  "inline-flex items-center justify-center rounded-lg border border-white/[0.1] bg-[#141C33]/60 px-3 py-2 text-sm font-medium text-[#E2E8F0] transition hover:border-violet-400/35 hover:text-violet-300 disabled:pointer-events-none disabled:opacity-40";

export type ConsultationHealthCard = {
  id: string;
  label: string;
  value: string;
  detail: string;
  href?: string;
};

export type ConsultationAttentionItem = {
  id: string;
  headline: string;
  detail?: string;
  href?: string;
  severity: "critical" | "warning" | "info";
  priorityScore: number;
};

export type ConsultationFlowState =
  | "scheduled"
  | "preparing"
  | "in_consultation"
  | "draft_pending"
  | "completed"
  | "follow_up_required";

export type ConsultationFlowItem = {
  id: string;
  patientOrLeadName: string;
  timeLabel: string;
  consultationType: string;
  clinicalStatus: string;
  commercialStatus: string | null;
  flowState: ConsultationFlowState;
  nextAction: string;
  consultationHref: string;
  patientHref: string | null;
  leadHref: string | null;
  primaryActionLabel: string;
  sortKey: string;
};

export type ClinicalPlanningItem = {
  id: string;
  patientOrLeadName: string;
  consultationType: string;
  planningLabel: string;
  nextAction: string;
  consultationHref: string;
  priorityScore: number;
};

export type ConversionFollowUpItem = {
  id: string;
  patientOrLeadName: string;
  followUpLabel: string;
  nextAction: string;
  consultationHref: string | null;
  leadHref: string | null;
  priorityScore: number;
};

export type ConsultationRecordSummary = {
  id: string;
  patientOrLeadName: string;
  dateLabel: string;
  statusLabel: string;
  treatmentInterest: string | null;
  assignedClinician: string | null;
  nextAction: string;
  consultationHref: string;
  updatedAt: string;
};

const MS_DAY = 86_400_000;

const TRANSPLANT_TYPE_IDS = new Set<ConsultationTypeId>([
  "scalp_hair_transplant",
  "eyebrow_transplant",
  "beard_transplant",
  "body_hair_transplant",
]);

const STATUS_LABEL: Record<ConsultationStatus, string> = {
  draft: "Draft",
  in_progress: "In progress",
  completed: "Completed",
  quoted: "Quoted",
  accepted: "Accepted",
  converted_to_case: "Converted to patient",
  archived: "Archived",
};

const FLOW_STATE_LABEL: Record<ConsultationFlowState, string> = {
  scheduled: "Scheduled",
  preparing: "Preparing",
  in_consultation: "In consultation",
  draft_pending: "Draft pending",
  completed: "Completed",
  follow_up_required: "Follow-up required",
};

function plural(count: number, singular: string, pluralForm?: string): string {
  if (count === 1) return `1 ${singular}`;
  return `${count} ${pluralForm ?? `${singular}s`}`;
}

function typeSections(typeId: ConsultationTypeId): readonly ConsultationSectionId[] {
  return CONSULTATION_TYPE_DEFINITIONS.find((d) => d.id === typeId)?.sections ?? [];
}

function sectionObject(
  structured: Record<string, unknown>,
  key: string
): Record<string, unknown> | null {
  const raw = structured[key];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function sectionHasContent(section: Record<string, unknown> | null): boolean {
  if (!section) return false;
  return Object.values(section).some((v) => {
    if (v == null) return false;
    if (typeof v === "string") return v.trim().length > 0;
    if (typeof v === "number") return Number.isFinite(v);
    if (typeof v === "boolean") return v;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "object") return Object.keys(v as object).length > 0;
    return false;
  });
}

function isActiveConsultation(row: ConsultationIndexRow): boolean {
  return row.status !== "archived";
}

function isTodayOrUpcoming(
  ymd: string | null | undefined,
  todayYmd: string,
  horizonDays = 7
): boolean {
  const d = ymd?.trim();
  if (!d) return false;
  const end = addCalendarDays(todayYmd, horizonDays);
  return d >= todayYmd && d <= end;
}

function addCalendarDays(ymd: string, days: number): string {
  const base = Date.parse(`${ymd}T12:00:00.000Z`);
  if (!Number.isFinite(base)) return ymd;
  return new Date(base + days * MS_DAY).toISOString().slice(0, 10);
}

function daysSinceYmd(ymd: string | null | undefined, todayYmd: string): number | null {
  const d = ymd?.trim();
  if (!d) return null;
  const a = Date.parse(`${d}T12:00:00.000Z`);
  const b = Date.parse(`${todayYmd}T12:00:00.000Z`);
  if (![a, b].every(Number.isFinite)) return null;
  return Math.floor((b - a) / MS_DAY);
}

function readQuoteStatus(
  row: ConsultationIndexRow
): ReturnType<typeof normalizeQuoteStatusFromSignals> {
  const raw = typeof row.quote_data?.quote_status === "string" ? row.quote_data.quote_status : null;
  return normalizeQuoteStatusFromSignals({ consultationStatus: row.status, quoteStatusRaw: raw });
}

function readTreatmentInterest(row: ConsultationIndexRow): string | null {
  const graft = row.quote_data?.graft_estimate;
  const session = row.quote_data?.session_size;
  if (typeof graft === "string" && graft.trim()) return `Grafts: ${graft.trim()}`;
  if (typeof graft === "number" && Number.isFinite(graft)) return `Grafts: ${graft}`;
  if (typeof session === "string" && session.trim()) return session.trim();
  const rec = sectionObject(row.structured_data, "recommendations");
  if (rec) {
    const line =
      (typeof rec.primary_recommendation === "string" && rec.primary_recommendation.trim()) ||
      (typeof rec.summary === "string" && rec.summary.trim()) ||
      null;
    if (line) return line;
  }
  return row.consultation_type_label;
}

function nextActionForStatus(row: ConsultationIndexRow): string {
  if (row.status === "draft") return "Continue the consultation draft and capture assessment.";
  if (row.status === "in_progress")
    return "Complete clinical assessment and treatment recommendation.";
  if (row.status === "completed") return "Draft and send the treatment quote.";
  if (row.status === "quoted") return "Follow up on the quote and capture patient decision.";
  if (row.status === "accepted") return "Move toward surgery planning and case creation.";
  if (row.status === "converted_to_case") return "Open the surgery pathway in Surgery.";
  return "Review consultation status and plan next step.";
}

export function deriveConsultationFlowState(
  row: ConsultationIndexRow,
  todayYmd: string
): ConsultationFlowState | null {
  const date = row.consultation_date?.trim();
  const isToday = date === todayYmd;
  const st = row.status;

  if (st === "quoted" || st === "accepted") {
    if (isToday || daysSinceYmd(date, todayYmd) === 0) return "follow_up_required";
    return null;
  }

  if (!isToday) return null;

  if (st === "in_progress") return "in_consultation";
  if (st === "completed" || st === "converted_to_case") return "completed";
  if (st === "draft") {
    const hasProgress =
      sectionHasContent(sectionObject(row.structured_data, "assessment")) ||
      sectionHasContent(sectionObject(row.structured_data, "donor")) ||
      Boolean(row.live_notes?.trim()) ||
      Boolean(row.recommendation_notes?.trim());
    return hasProgress ? "preparing" : "scheduled";
  }

  return "draft_pending";
}

export function consultationFlowStateLabel(state: ConsultationFlowState): string {
  return FLOW_STATE_LABEL[state];
}

export function consultationStatusLabel(status: ConsultationStatus): string {
  return STATUS_LABEL[status];
}

export function buildConsultationHealthCards(
  base: string,
  payload: ConsultationDashboardPayload
): ConsultationHealthCard[] {
  const { consultations, conversion, todayYmd } = payload;
  const active = consultations.filter(isActiveConsultation);
  const columnCounts = Object.fromEntries(
    (Object.keys(conversion.columns) as (keyof typeof conversion.columns)[]).map((k) => [
      k,
      conversion.columns[k].length,
    ])
  ) as Record<keyof typeof conversion.columns, number>;

  const consultationsToday = active.filter((r) => r.consultation_date?.trim() === todayYmd).length;
  const needingPreparation = active.filter(
    (r) =>
      (r.status === "draft" || r.status === "in_progress") &&
      isTodayOrUpcoming(r.consultation_date, todayYmd, 3)
  ).length;
  const draftCount = active.filter((r) => r.status === "draft").length;
  const treatmentPlansPending = active.filter(
    (r) =>
      r.status === "in_progress" ||
      (r.status === "completed" &&
        readQuoteStatus(r) === "neutral" &&
        !hasQuoteDraftSignals(r.quote_data))
  ).length;
  const quotesFollowUpsDue =
    columnCounts.quote_sent +
    columnCounts.quote_drafted +
    active.filter((r) => r.status === "quoted").length;
  const readyForSurgery =
    columnCounts.quote_accepted +
    active.filter((r) => r.status === "accepted" && !r.case_id?.trim()).length;

  return [
    {
      id: "today",
      label: "Consultations today",
      value: String(consultationsToday),
      detail:
        consultationsToday > 0
          ? "Patients scheduled for clinical assessment today"
          : "No consultations scheduled for today",
      href: `${base}/calendar`,
    },
    {
      id: "preparation",
      label: "Consultations needing preparation",
      value: String(needingPreparation),
      detail:
        needingPreparation > 0
          ? "Upcoming consultations that need assessment prep before arrival"
          : "No consultations flagged for preparation",
      href: `${base}/consultations?view=list&status=draft`,
    },
    {
      id: "drafts",
      label: "Draft consultations",
      value: String(draftCount),
      detail:
        draftCount > 0 ? "Consultation drafts awaiting completion" : "No open consultation drafts",
      href: `${base}/consultations?view=list&status=draft`,
    },
    {
      id: "treatment_pending",
      label: "Treatment plans pending",
      value: String(treatmentPlansPending),
      detail:
        treatmentPlansPending > 0
          ? "Assessments in progress or awaiting treatment recommendation"
          : "No treatment plans awaiting completion",
      href: `${base}/consultations?view=list&status=in_progress`,
    },
    {
      id: "quotes_due",
      label: "Quotes / follow-ups due",
      value: String(quotesFollowUpsDue),
      detail:
        quotesFollowUpsDue > 0
          ? "Quotes to send or patient follow-ups awaiting response"
          : "No outstanding quote follow-ups",
      href: `${base}/consultation-conversion`,
    },
    {
      id: "surgery_ready",
      label: "Ready for surgery pathway",
      value: String(readyForSurgery),
      detail:
        readyForSurgery > 0
          ? "Accepted quotes ready to move into surgery planning"
          : "No consultations ready for surgery pathway",
      href: `${base}/consultation-conversion`,
    },
  ];
}

type AttentionCandidate = {
  id: string;
  count: number;
  priorityScore: number;
  severity: ConsultationAttentionItem["severity"];
  headline: (n: number) => string;
  detail?: string;
  href?: string;
};

export function buildConsultationAttentionPriorities(
  base: string,
  payload: ConsultationDashboardPayload,
  maxItems = 5
): ConsultationAttentionItem[] {
  const { consultations, conversion, todayYmd } = payload;
  const active = consultations.filter(isActiveConsultation);
  const columnCounts = Object.fromEntries(
    (Object.keys(conversion.columns) as (keyof typeof conversion.columns)[]).map((k) => [
      k,
      conversion.columns[k].length,
    ])
  ) as Record<keyof typeof conversion.columns, number>;

  const needingPreparation = active.filter(
    (r) => r.status === "draft" && r.consultation_date?.trim() === todayYmd
  ).length;
  const draftIncomplete = active.filter((r) => r.status === "draft").length;
  const inProgress = active.filter((r) => r.status === "in_progress").length;
  const quotesDue = columnCounts.quote_sent + active.filter((r) => r.status === "quoted").length;
  const surgeryReady = columnCounts.quote_accepted;
  const completedNoQuote = active.filter(
    (r) =>
      r.status === "completed" &&
      readQuoteStatus(r) === "neutral" &&
      !hasQuoteDraftSignals(r.quote_data)
  ).length;

  const candidates: AttentionCandidate[] = [
    {
      id: "preparation_today",
      count: needingPreparation,
      priorityScore: 96,
      severity: "critical",
      headline: (n) =>
        plural(n, "consultation", "consultations") + " need preparation before the patient arrives",
      detail: "Open the consultation workspace and complete pre-visit assessment.",
      href: `${base}/consultations?view=list&status=draft`,
    },
    {
      id: "drafts",
      count: draftIncomplete,
      priorityScore: 88,
      severity: "warning",
      headline: (n) => plural(n, "draft consultation", "draft consultations") + " need completion",
      detail: "Continue capturing assessment and treatment recommendation.",
      href: `${base}/consultations?view=list&status=draft`,
    },
    {
      id: "in_progress",
      count: inProgress,
      priorityScore: 84,
      severity: "warning",
      headline: (n) =>
        plural(n, "consultation", "consultations") + " are in progress and need completion",
      detail: "Finish clinical assessment and mark the consultation complete.",
      href: `${base}/consultations?view=list&status=in_progress`,
    },
    {
      id: "completed_no_quote",
      count: completedNoQuote,
      priorityScore: 82,
      severity: "warning",
      headline: (n) =>
        plural(n, "completed consultation", "completed consultations") + " need a treatment quote",
      detail: "Draft pricing and send the quote to the patient.",
      href: `${base}/consultation-conversion`,
    },
    {
      id: "quote_followup",
      count: quotesDue,
      priorityScore: 80,
      severity: "info",
      headline: (n) => plural(n, "patient", "patients") + " need quote follow-up",
      detail: "Check in on sent quotes and capture acceptance.",
      href: `${base}/consultation-conversion`,
    },
    {
      id: "surgery_convert",
      count: surgeryReady,
      priorityScore: 76,
      severity: "info",
      headline: (n) =>
        plural(n, "consultation", "consultations") + " are ready to convert to surgery planning",
      detail: "Create or link the case and schedule the procedure.",
      href: `${base}/consultation-conversion`,
    },
  ];

  return candidates
    .filter((c) => c.count > 0)
    .sort((a, b) => b.priorityScore - a.priorityScore || b.count - a.count)
    .slice(0, maxItems)
    .map((c) => ({
      id: c.id,
      headline: c.headline(c.count),
      detail: c.detail,
      href: c.href,
      severity: c.severity,
      priorityScore: c.priorityScore,
    }));
}

export function hasUrgentConsultationAttention(items: ConsultationAttentionItem[]): boolean {
  return items.some((i) => i.severity === "critical" || i.severity === "warning");
}

export function consultationAttentionSeverityClass(
  severity: ConsultationAttentionItem["severity"]
): string {
  if (severity === "critical") return "border-rose-500/25 bg-rose-500/[0.06]";
  if (severity === "warning") return "border-amber-500/20 bg-amber-500/[0.04]";
  return "border-white/[0.08] bg-[#0c1220]/60";
}

function flowPrimaryActionLabel(state: ConsultationFlowState): string {
  switch (state) {
    case "scheduled":
      return "Start consultation";
    case "preparing":
      return "Continue preparation";
    case "in_consultation":
      return "Open consultation";
    case "draft_pending":
      return "Continue draft";
    case "completed":
      return "Open consultation";
    case "follow_up_required":
      return "Create quote / follow-up";
    default:
      return "Open consultation";
  }
}

function commercialStatusForRow(row: ConsultationIndexRow): string | null {
  const q = readQuoteStatus(row);
  if (q === "accepted") return "Quote accepted";
  if (q === "sent" || row.status === "quoted") return "Quote sent";
  if (q === "draft" || hasQuoteDraftSignals(row.quote_data)) return "Quote in draft";
  if (row.status === "completed") return "Awaiting quote";
  if (row.lead_id) return "Lead linked";
  return null;
}

export function buildTodayConsultationFlowItems(
  base: string,
  payload: ConsultationDashboardPayload,
  maxItems = 8
): ConsultationFlowItem[] {
  const { consultations, todayYmd } = payload;
  const items: ConsultationFlowItem[] = [];

  for (const row of consultations) {
    if (!isActiveConsultation(row)) continue;
    const flowState = deriveConsultationFlowState(row, todayYmd);
    if (!flowState) continue;

    const patientHref = row.patient_id?.trim() ? `${base}/patients/${row.patient_id.trim()}` : null;
    const leadHref = row.lead_id?.trim() ? `${base}/crm/leads/${row.lead_id.trim()}` : null;

    items.push({
      id: row.id,
      patientOrLeadName: row.link_headline,
      timeLabel:
        row.consultation_date?.trim() === todayYmd
          ? "Today"
          : formatConsultationDate(row.consultation_date),
      consultationType: row.consultation_type_label,
      clinicalStatus: consultationStatusLabel(row.status),
      commercialStatus: commercialStatusForRow(row),
      flowState,
      nextAction: nextActionForStatus(row),
      consultationHref: `${base}/consultations/${row.id}`,
      patientHref,
      leadHref,
      primaryActionLabel: flowPrimaryActionLabel(flowState),
      sortKey: `${row.consultation_date ?? "9999"}-${row.updated_at}`,
    });
  }

  const stateOrder: Record<ConsultationFlowState, number> = {
    in_consultation: 0,
    preparing: 1,
    scheduled: 2,
    draft_pending: 3,
    follow_up_required: 4,
    completed: 5,
  };

  return items
    .sort(
      (a, b) =>
        stateOrder[a.flowState] - stateOrder[b.flowState] || a.sortKey.localeCompare(b.sortKey)
    )
    .slice(0, maxItems);
}

function deriveClinicalPlanningLabel(
  row: ConsultationIndexRow
): { label: string; action: string; score: number } | null {
  if (!isActiveConsultation(row)) return null;
  if (row.status === "quoted" || row.status === "accepted" || row.status === "converted_to_case")
    return null;

  const structured = row.structured_data ?? {};
  const sections = typeSections(row.consultation_type);
  const typeId = row.consultation_type;

  if (
    sections.includes("assessment") &&
    !sectionHasContent(sectionObject(structured, "assessment"))
  ) {
    return {
      label: "Hair loss classification incomplete",
      action: "Complete visual assessment and pattern classification.",
      score: 90,
    };
  }

  if (sections.includes("donor") && !sectionHasContent(sectionObject(structured, "donor"))) {
    return {
      label: "Donor assessment needed",
      action: "Capture donor density and harvest suitability.",
      score: 86,
    };
  }

  if (sections.includes("medical") && !sectionHasContent(sectionObject(structured, "medical"))) {
    return {
      label: "Pathology / medication review needed",
      action: "Review medical history and scalp health context.",
      score: 84,
    };
  }

  if (
    sections.includes("recommendations") &&
    !sectionHasContent(sectionObject(structured, "recommendations"))
  ) {
    return {
      label: "Treatment recommendation pending",
      action: "Document the recommended treatment plan.",
      score: 82,
    };
  }

  if (
    TRANSPLANT_TYPE_IDS.has(typeId) &&
    (row.status === "completed" || row.status === "in_progress") &&
    !row.case_id?.trim() &&
    readQuoteStatus(row) !== "accepted"
  ) {
    return {
      label: "Surgery candidacy decision pending",
      action: "Confirm procedure suitability and quote readiness.",
      score: 78,
    };
  }

  return null;
}

export function buildClinicalPlanningQueueItems(
  base: string,
  payload: ConsultationDashboardPayload,
  maxItems = 5
): ClinicalPlanningItem[] {
  const items: ClinicalPlanningItem[] = [];

  for (const row of payload.consultations) {
    const planning = deriveClinicalPlanningLabel(row);
    if (!planning) continue;
    items.push({
      id: row.id,
      patientOrLeadName: row.link_headline,
      consultationType: row.consultation_type_label,
      planningLabel: planning.label,
      nextAction: planning.action,
      consultationHref: `${base}/consultations/${row.id}`,
      priorityScore: planning.score,
    });
  }

  return items.sort((a, b) => b.priorityScore - a.priorityScore).slice(0, maxItems);
}

function conversionCardToFollowUp(
  base: string,
  card: ConsultationConversionBoardCard
): ConversionFollowUpItem | null {
  const col = card.primaryColumn;
  if (col === "lost" || col === "surgery_booked" || col === "consultation_booked") return null;

  let label = "Follow-up required";
  if (col === "quote_sent") label = "Quote sent, awaiting response";
  else if (col === "quote_drafted") label = "Quote draft needs sending";
  else if (col === "quote_accepted") label = "Procedure interest confirmed — book surgery";
  else if (col === "consultation_completed") label = "Procedure interest identified";

  const financeHint = card.graftOrTreatmentLine?.toLowerCase().includes("finance");
  if (financeHint) label = "Patient needs finance / payment discussion";

  const days = card.daysSinceConsultation;
  if (col === "quote_sent" && days != null && days >= 5) {
    label = "Follow-up call due";
  }

  if (col === "quote_accepted" && !card.caseId) {
    label = "Surgery date not booked";
  }

  return {
    id: card.id,
    patientOrLeadName: card.patientOrLeadLabel,
    followUpLabel: label,
    nextAction: card.nextAction,
    consultationHref: card.hrefs.consultation,
    leadHref: card.hrefs.lead,
    priorityScore:
      col === "quote_sent"
        ? 88 + Math.min(10, card.daysSinceConsultation ?? 0)
        : col === "quote_accepted"
          ? 85
          : 75,
  };
}

export function buildConversionFollowUpQueueItems(
  base: string,
  payload: ConsultationDashboardPayload,
  maxItems = 5
): ConversionFollowUpItem[] {
  const cols = payload.conversion.columns;
  const cards = [
    ...cols.quote_sent,
    ...cols.quote_drafted,
    ...cols.consultation_completed,
    ...cols.quote_accepted,
  ];

  const items = cards
    .map((c) => conversionCardToFollowUp(base, c))
    .filter((x): x is ConversionFollowUpItem => x != null);

  return items.sort((a, b) => b.priorityScore - a.priorityScore).slice(0, maxItems);
}

export function buildConsultationRecordSummaries(
  base: string,
  payload: ConsultationDashboardPayload,
  maxItems = 8
): ConsultationRecordSummary[] {
  return payload.consultations
    .filter(isActiveConsultation)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, maxItems)
    .map((row) => ({
      id: row.id,
      patientOrLeadName: row.link_headline,
      dateLabel: formatConsultationDate(row.consultation_date),
      statusLabel: consultationStatusLabel(row.status),
      treatmentInterest: readTreatmentInterest(row),
      assignedClinician: row.consultant_display_name?.trim() || null,
      nextAction: nextActionForStatus(row),
      consultationHref: `${base}/consultations/${row.id}`,
      updatedAt: row.updated_at,
    }));
}

export function formatConsultationDate(iso: string | null | undefined): string {
  if (!iso?.trim()) return "—";
  const d = Date.parse(iso.length === 10 ? `${iso}T12:00:00.000Z` : iso);
  if (!Number.isFinite(d)) return iso;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(d));
}

export function formatConsultationDateTime(iso: string): string {
  const d = Date.parse(iso);
  if (!Number.isFinite(d)) return iso;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(d)
  );
}

export function consultationDiagnosticCounts(payload: ConsultationDashboardPayload): {
  totalLoaded: number;
  byStatus: Record<string, number>;
  withPatientLink: number;
  withLeadLink: number;
  withBookingLink: number;
  withCaseLink: number;
} {
  const byStatus: Record<string, number> = {};
  let withPatientLink = 0;
  let withLeadLink = 0;
  let withBookingLink = 0;
  let withCaseLink = 0;

  for (const row of payload.consultations) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
    if (row.patient_id?.trim()) withPatientLink += 1;
    if (row.lead_id?.trim()) withLeadLink += 1;
    if (row.booking_id?.trim()) withBookingLink += 1;
    if (row.case_id?.trim()) withCaseLink += 1;
  }

  return {
    totalLoaded: payload.consultations.length,
    byStatus,
    withPatientLink,
    withLeadLink,
    withBookingLink,
    withCaseLink,
  };
}

export function flowStateBadgeClass(state: ConsultationFlowState): string {
  switch (state) {
    case "in_consultation":
      return "bg-sky-500/15 text-sky-200 ring-1 ring-sky-500/30";
    case "preparing":
      return "bg-violet-500/15 text-violet-200 ring-1 ring-violet-500/30";
    case "scheduled":
      return "bg-indigo-500/15 text-indigo-200 ring-1 ring-indigo-500/30";
    case "follow_up_required":
      return "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30";
    case "completed":
      return "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30";
    default:
      return "bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/30";
  }
}
