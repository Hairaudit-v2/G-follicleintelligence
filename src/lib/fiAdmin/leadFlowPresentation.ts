/**
 * LeadFlow — clinic-facing presentation helpers (UI copy only; no loader changes).
 */

import type { ConsultationConversionKpis } from "@/src/lib/consultations/consultationConversionBoardModel";
import { leadTitleFromRow, personMetadataDisplayLabel } from "@/src/lib/crm/crmLeadListDisplay";
import type { CrmKanbanLeadCard } from "@/src/lib/crm/types";
import type {
  LeadFlowActivityRow,
  LeadFlowDashboardPayload,
  LeadFlowHubspotDiagnostics,
} from "@/src/lib/fiAdmin/leadFlowDashboardLoader.server";
import type { TaskDueItem } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

export const leadFlowLinkButtonClass =
  "inline-flex items-center justify-center rounded-lg border border-white/[0.1] bg-[#141C33]/60 px-3 py-2 text-sm font-medium text-[#E2E8F0] transition hover:border-[#22C1FF]/35 hover:text-[#22C1FF] disabled:pointer-events-none disabled:opacity-40";

export type LeadFlowHealthCard = {
  id: string;
  label: string;
  value: string;
  detail: string;
  href?: string;
};

export type LeadFlowAttentionItem = {
  id: string;
  headline: string;
  detail?: string;
  href?: string;
  severity: "critical" | "warning" | "info";
  priorityScore: number;
};

export type BookingReadinessLabel =
  | "Ready to book"
  | "Needs contact"
  | "Awaiting decision"
  | "Pricing sent"
  | "Going cold";

export type LeadFlowBookingReadinessItem = {
  id: string;
  leadName: string;
  sourceLabel: string | null;
  treatmentInterest: string | null;
  readinessLabel: BookingReadinessLabel;
  nextAction: string;
  leadHref: string;
  bookHref: string;
  followUpHref: string;
  priorityScore: number;
};

export type LeadFlowAtRiskItem = {
  id: string;
  leadName: string;
  message: string;
  leadHref: string;
  priorityScore: number;
};

export type LeadFlowConversionMetric = {
  id: string;
  label: string;
  value: string;
  detail: string;
};

export type LeadFlowRecentActivityItem = {
  id: string;
  label: string;
  detail: string;
  occurredAt: string;
  leadHref: string | null;
};

const MS_DAY = 86_400_000;

function plural(count: number, singular: string, pluralForm?: string): string {
  if (count === 1) return `1 ${singular}`;
  return `${count} ${pluralForm ?? `${singular}s`}`;
}

function leadDisplayName(card: CrmKanbanLeadCard): string {
  const person = personMetadataDisplayLabel(card.person?.metadata ?? null);
  const summary = leadTitleFromRow(card.lead.summary, card.lead.id);
  if (person !== "—" && !summary.startsWith("Lead ")) return `${summary} · ${person}`;
  if (person !== "—") return person;
  return summary;
}

function readSourceLabel(card: CrmKanbanLeadCard): string | null {
  const meta = card.lead.metadata;
  if (!meta || typeof meta !== "object") return null;
  const src = meta.source ?? meta.lead_source ?? meta.enquiry_source;
  if (typeof src === "string" && src.trim()) return src.trim();
  return null;
}

function readTreatmentInterest(card: CrmKanbanLeadCard): string | null {
  if (card.primaryConcernLine?.trim()) return card.primaryConcernLine.trim();
  if (card.clinicalSummaryLine?.trim()) return card.clinicalSummaryLine.trim();
  return null;
}

function daysSinceIso(iso: string | null | undefined, nowMs = Date.now()): number | null {
  if (!iso?.trim()) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.floor((nowMs - t) / MS_DAY);
}

function isTaskDueToday(task: TaskDueItem, localStartIso: string, localEndIso: string): boolean {
  if (!task.dueAt) return true;
  const t = Date.parse(task.dueAt);
  const start = Date.parse(localStartIso);
  const end = Date.parse(localEndIso);
  if (![t, start, end].every(Number.isFinite)) return false;
  return t >= start && t < end;
}

function stageSlug(card: CrmKanbanLeadCard): string {
  return card.stage?.slug?.trim().toLowerCase() ?? "";
}

export function deriveBookingReadiness(card: CrmKanbanLeadCard, staleThresholdDays: number): {
  label: BookingReadinessLabel;
  nextAction: string;
  priorityScore: number;
} {
  const slug = stageSlug(card);
  const daysIdle = daysSinceIso(card.lastActivityAtIso) ?? card.daysInStage ?? 0;
  const daysInStage = card.daysInStage ?? 0;

  if (daysIdle >= staleThresholdDays || daysInStage >= staleThresholdDays) {
    return {
      label: "Going cold",
      nextAction: "Send a warm follow-up while interest may still be recoverable.",
      priorityScore: 70 + Math.min(20, daysIdle),
    };
  }

  if (slug === "new" || slug === "contacted") {
    return {
      label: "Needs contact",
      nextAction: "Make first contact or confirm the enquiry details.",
      priorityScore: 85 - Math.min(30, daysInStage),
    };
  }

  if (slug === "quote_sent" || slug === "treatment_planning") {
    return {
      label: "Pricing sent",
      nextAction: "Check in on the quote and answer outstanding questions.",
      priorityScore: 78,
    };
  }

  if (slug === "qualified" || slug === "consult_scheduled") {
    return {
      label: "Ready to book",
      nextAction: slug === "consult_scheduled" ? "Confirm consultation attendance and prep." : "Book the consultation while momentum is high.",
      priorityScore: 92 - Math.min(15, daysInStage),
    };
  }

  if (slug === "consult_completed" || slug === "deposit_or_booked") {
    return {
      label: "Awaiting decision",
      nextAction: "Move toward quote acceptance or procedure booking.",
      priorityScore: 75,
    };
  }

  return {
    label: "Awaiting decision",
    nextAction: "Review the lead and plan the next follow-up step.",
    priorityScore: 60,
  };
}

function countFollowUpsDueToday(tasksDue: TaskDueItem[]): number {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
  return tasksDue.filter((t) => isTaskDueToday(t, start, end)).length;
}

function countReadyToBook(leads: CrmKanbanLeadCard[], staleThresholdDays: number): number {
  return leads.filter((c) => deriveBookingReadiness(c, staleThresholdDays).label === "Ready to book").length;
}

function countHighValue(leads: CrmKanbanLeadCard[]): number {
  return leads.filter((c) => c.isHighValue).length;
}

export function buildLeadFlowHealthCards(
  base: string,
  payload: LeadFlowDashboardPayload
): LeadFlowHealthCard[] {
  const {
    quickStats,
    tasksDue,
    enrichedLeads,
    clinicToday,
    staleLeads,
    staleLeadThresholdDays,
    launchControl,
  } = payload;

  const followUpsToday = countFollowUpsDueToday(tasksDue);
  const readyToBook = countReadyToBook(enrichedLeads, staleLeadThresholdDays);
  const highValue = countHighValue(enrichedLeads);
  const atRisk = staleLeads.length + enrichedLeads.filter((c) => deriveBookingReadiness(c, staleLeadThresholdDays).label === "Going cold").length;

  return [
    {
      id: "new_enquiries",
      label: "New enquiries",
      value: String(quickStats.newLeadsToday),
      detail:
        quickStats.newLeadsToday > 0
          ? `${plural(quickStats.newLeadsThisWeek, "new enquiry", "new enquiries")} this week`
          : "No new enquiries captured today",
      href: `${base}/crm?view=list&sort=created_at_desc`,
    },
    {
      id: "follow_ups_today",
      label: "Follow-ups due today",
      value: String(followUpsToday),
      detail: followUpsToday > 0 ? "CRM tasks due for attention today" : "No follow-up tasks due today",
      href: `${base}/crm?view=list`,
    },
    {
      id: "ready_to_book",
      label: "Ready to book",
      value: String(readyToBook),
      detail: readyToBook > 0 ? "Qualified leads close to consultation booking" : "No leads flagged as ready to book",
      href: `${base}/crm?view=board`,
    },
    {
      id: "consultations_scheduled",
      label: "Consultations scheduled",
      value: String(clinicToday.consultations || launchControl.consultationsToday),
      detail: "Consultation appointments on today's clinic calendar",
      href: `${base}/calendar`,
    },
    {
      id: "high_value",
      label: "High-value opportunities",
      value: String(highValue),
      detail: highValue > 0 ? "Priority enquiries needing attentive follow-up" : "No high-priority leads in the active queue",
      href: `${base}/crm?view=list&priority=high`,
    },
    {
      id: "at_risk",
      label: "At-risk leads",
      value: String(atRisk),
      detail: atRisk > 0 ? "Leads going quiet or overdue for follow-up" : "No leads currently flagged as at-risk",
      href: `${base}/crm?view=list`,
    },
  ];
}

export function buildLeadFlowAttentionPriorities(
  base: string,
  payload: LeadFlowDashboardPayload,
  maxItems = 5
): LeadFlowAttentionItem[] {
  const items: LeadFlowAttentionItem[] = [];
  const { tasksDue, enrichedLeads, staleLeads, actionCentre, conversionKpis, hubspotImport, staleLeadThresholdDays } =
    payload;

  const followUpsToday = countFollowUpsDueToday(tasksDue);
  if (followUpsToday > 0) {
    items.push({
      id: "follow_ups_today",
      headline: `${plural(followUpsToday, "lead needs", "leads need")} follow-up today`,
      detail: "Open tasks are due — respond while the enquiry is still warm.",
      href: `${base}/crm?view=list`,
      severity: "warning",
      priorityScore: 90,
    });
  }

  const highValueUnbooked = enrichedLeads.filter(
    (c) => c.isHighValue && !["consult_scheduled", "consult_completed", "deposit_or_booked", "in_treatment", "won_closed"].includes(stageSlug(c))
  ).length;
  if (highValueUnbooked > 0) {
    items.push({
      id: "high_value_unbooked",
      headline: `${plural(highValueUnbooked, "high-value lead has", "high-value leads have")} no booked consultation`,
      detail: "Prioritise booking or a senior callback before interest cools.",
      href: `${base}/crm?view=list&priority=high`,
      severity: "critical",
      priorityScore: 88,
    });
  }

  const quietAfterPricing = enrichedLeads.filter((c) => {
    const slug = stageSlug(c);
    if (slug !== "quote_sent" && slug !== "treatment_planning") return false;
    const idle = daysSinceIso(c.lastActivityAtIso) ?? 0;
    return idle >= 3;
  }).length;
  if (quietAfterPricing > 0) {
    items.push({
      id: "quiet_after_pricing",
      headline: `${plural(quietAfterPricing, "lead has", "leads have")} gone quiet after pricing`,
      detail: "A timely quote follow-up can recover stalled conversions.",
      href: `${base}/consultation-conversion`,
      severity: "warning",
      priorityScore: 82,
    });
  }

  if (conversionKpis.quotesSent > conversionKpis.quotesAccepted) {
    const needingQuoteFollowUp = Math.max(0, conversionKpis.quotesSent - conversionKpis.quotesAccepted);
    if (needingQuoteFollowUp > 0) {
      items.push({
        id: "quote_follow_up",
        headline: `${plural(needingQuoteFollowUp, "consultation needs", "consultations need")} quote follow-up`,
        detail: "Quotes are out — confirm decision timing and next steps.",
        href: `${base}/consultation-conversion`,
        severity: "warning",
        priorityScore: 80,
      });
    }
  }

  if (actionCentre.leadsAwaitingContact > 0) {
    items.push({
      id: "awaiting_contact",
      headline: `${plural(actionCentre.leadsAwaitingContact, "enquiry still needs", "enquiries still need")} first contact`,
      detail: "New leads without outreach lose conversion quickly.",
      href: `${base}/crm?view=list&sort=created_at_desc`,
      severity: "critical",
      priorityScore: 86,
    });
  }

  if (staleLeads.length > 0) {
    items.push({
      id: "stale_leads",
      headline: `${plural(staleLeads.length, "lead needs", "leads need")} follow-up after ${staleLeadThresholdDays}+ days`,
      detail: "Long idle periods in the same stage often precede lost opportunities.",
      href: `${base}/crm?view=list`,
      severity: "warning",
      priorityScore: 76,
    });
  }

  const dupTotal =
    hubspotImport.duplicateEmailCount +
    hubspotImport.duplicatePhoneCount +
    hubspotImport.duplicateRecordIdCount;
  if (dupTotal > 0 && hubspotImport.latestBatch && !hubspotImport.latestBatch.imported_at) {
    items.push({
      id: "import_duplicates",
      headline: `${plural(dupTotal, "imported lead may be", "imported leads may be")} duplicated`,
      detail: "Review the latest HubSpot import before committing new contacts.",
      href: `${base}/settings/imports/hubspot`,
      severity: "info",
      priorityScore: 55,
    });
  }

  return items.sort((a, b) => b.priorityScore - a.priorityScore).slice(0, maxItems);
}

export function hasUrgentLeadFlowAttention(items: LeadFlowAttentionItem[]): boolean {
  return items.some((i) => i.severity === "critical" || i.severity === "warning");
}

export function buildBookingReadinessItems(
  base: string,
  payload: LeadFlowDashboardPayload,
  maxItems = 5
): LeadFlowBookingReadinessItem[] {
  const { enrichedLeads, staleLeadThresholdDays } = payload;

  return enrichedLeads
    .map((card) => {
      const readiness = deriveBookingReadiness(card, staleLeadThresholdDays);
      const leadHref = `${base}/crm/leads/${card.lead.id}`;
      return {
        id: card.lead.id,
        leadName: leadDisplayName(card),
        sourceLabel: readSourceLabel(card),
        treatmentInterest: readTreatmentInterest(card),
        readinessLabel: readiness.label,
        nextAction: readiness.nextAction,
        leadHref,
        bookHref: `${leadHref}?tab=overview`,
        followUpHref: `${leadHref}?tab=timeline`,
        priorityScore: readiness.priorityScore + (card.isHighValue ? 8 : 0),
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, maxItems);
}

export function buildAtRiskLeadItems(base: string, payload: LeadFlowDashboardPayload, maxItems = 5): LeadFlowAtRiskItem[] {
  const { enrichedLeads, staleLeads, staleLeadThresholdDays, actionCentre } = payload;
  const items: LeadFlowAtRiskItem[] = [];

  for (const stale of staleLeads.slice(0, maxItems)) {
    items.push({
      id: `stale-${stale.leadId}`,
      leadName: stale.title,
      message: `Lead may go cold — in ${stale.stageLabel.toLowerCase()} for ${stale.daysInStage} days.`,
      leadHref: `${base}/crm/leads/${stale.leadId}`,
      priorityScore: 70 + stale.daysInStage,
    });
  }

  for (const card of enrichedLeads) {
    const slug = stageSlug(card);
    const idle = daysSinceIso(card.lastActivityAtIso) ?? 0;
    if (idle < staleLeadThresholdDays) continue;
    if (items.some((i) => i.id === card.lead.id || i.id === `stale-${card.lead.id}`)) continue;

    let message = `Lead may go cold — last activity was over ${idle} days ago.`;
    if (slug === "quote_sent") message = "Quote sent but no response — check decision timing.";
    if (slug === "new") message = "No contact after enquiry — respond while intent is highest.";

    items.push({
      id: card.lead.id,
      leadName: leadDisplayName(card),
      message,
      leadHref: `${base}/crm/leads/${card.lead.id}`,
      priorityScore: 65 + idle,
    });
  }

  if (actionCentre.leadsAwaitingContact > 0 && items.length < maxItems) {
    const unassigned = enrichedLeads.find((c) => stageSlug(c) === "new");
    if (unassigned && !items.some((i) => i.id === unassigned.lead.id)) {
      items.push({
        id: unassigned.lead.id,
        leadName: leadDisplayName(unassigned),
        message: "Imported or newly captured — not yet assigned or contacted.",
        leadHref: `${base}/crm/leads/${unassigned.lead.id}`,
        priorityScore: 72,
      });
    }
  }

  return items.sort((a, b) => b.priorityScore - a.priorityScore).slice(0, maxItems);
}

export function buildConversionSnapshotMetrics(
  kpis: ConsultationConversionKpis,
  lostCount: number
): LeadFlowConversionMetric[] {
  const enquiryToConsult =
    kpis.consultationsBookedNext30Days > 0
      ? `${kpis.consultationsBookedNext30Days} booked`
      : "—";

  const consultToInterest =
    kpis.consultationsCompletedLast30Days > 0
      ? `${Math.round((kpis.quotesSent / Math.max(kpis.consultationsCompletedLast30Days, 1)) * 100)}%`
      : "—";

  const quoteFollowUpNeeded = Math.max(0, kpis.quotesSent - kpis.quotesAccepted);

  return [
    {
      id: "enquiry_to_consult",
      label: "Enquiries to booked consults",
      value: String(kpis.consultationsBookedNext30Days),
      detail: `${enquiryToConsult} in the next 30 days`,
    },
    {
      id: "consult_to_interest",
      label: "Consults to procedure interest",
      value: String(kpis.quotesSent),
      detail: `${consultToInterest} of completed consults reached quote stage (last 30d)`,
    },
    {
      id: "quotes_sent",
      label: "Quotes sent",
      value: String(kpis.quotesSent),
      detail: kpis.quotesSent > 0 ? `${kpis.quotesAccepted} accepted` : "No quotes sent in window",
    },
    {
      id: "quote_follow_up",
      label: "Quote follow-up needed",
      value: String(quoteFollowUpNeeded),
      detail: quoteFollowUpNeeded > 0 ? "Outstanding quote decisions to chase" : "No outstanding quote follow-ups",
    },
    {
      id: "lost_stalled",
      label: "Lost / stalled leads",
      value: String(lostCount),
      detail: lostCount > 0 ? "Marked lost in the conversion board window" : "No lost leads in window",
    },
  ];
}

function activityKindLabel(kind: string, title: string | null): string {
  const k = kind.trim().toLowerCase();
  if (k === "lead.created") return "New enquiry received";
  if (k === "stage.changed" || k === "crm.stage.auto_advanced") return "Lead progressed";
  if (k === "task.completed") return "Follow-up completed";
  if (k === "task.created") return "Follow-up scheduled";
  if (k === "booking.created") return "Consultation booked";
  if (k === "booking.cancelled") return "Consultation cancelled";
  if (k === "booking.completed") return "Consultation completed";
  if (k === "lead.converted_to_person") return "Lead moved to patient interest";
  if (k === "crm.import.hubspot_stage1") return "Imported from HubSpot";
  if (k === "quote.accepted") return "Quote accepted";
  if (k === "lead_communication.created") return "Outreach logged";
  if (title?.trim()) return title.trim();
  return "Lead activity recorded";
}

export function buildRecentLeadActivity(
  base: string,
  rows: LeadFlowActivityRow[],
  maxItems = 8
): LeadFlowRecentActivityItem[] {
  return rows.slice(0, maxItems).map((row) => ({
    id: row.id,
    label: activityKindLabel(row.activityKind, row.title),
    detail: row.title?.trim() || "Activity captured in LeadFlow",
    occurredAt: row.occurredAt,
    leadHref: row.leadId ? `${base}/crm/leads/${row.leadId}` : null,
  }));
}

export function formatLeadFlowDateTime(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function readinessBadgeClass(label: BookingReadinessLabel): string {
  if (label === "Ready to book") return "bg-emerald-500/15 text-emerald-100 ring-emerald-500/30";
  if (label === "Going cold") return "bg-amber-500/15 text-amber-100 ring-amber-400/35";
  if (label === "Needs contact") return "bg-sky-500/15 text-sky-200 ring-sky-500/30";
  if (label === "Pricing sent") return "bg-violet-500/15 text-violet-100 ring-violet-500/30";
  return "bg-white/[0.06] text-[#CBD5E1] ring-white/10";
}

export function attentionSeverityClass(severity: LeadFlowAttentionItem["severity"]): string {
  if (severity === "critical") return "border-rose-500/25 bg-rose-500/[0.06]";
  if (severity === "warning") return "border-amber-500/25 bg-amber-500/[0.05]";
  return "border-white/[0.08] bg-[#0c1220]/50";
}

export function summarizeHubspotDiagnostics(diag: LeadFlowHubspotDiagnostics): string {
  if (!diag.latestBatch) return "No HubSpot import batches recorded for this clinic.";
  const b = diag.latestBatch;
  if (b.imported_at) return `Last import committed ${formatLeadFlowDateTime(b.imported_at)} (${b.imported_row_count} contacts).`;
  if (b.dry_run_at) return `Latest batch dry-run ${b.dry_run_passed ? "passed" : "needs review"} — ${diag.stagingRowCount} contacts staged.`;
  return `Latest batch uploaded — ${b.row_count} contacts awaiting validation.`;
}
