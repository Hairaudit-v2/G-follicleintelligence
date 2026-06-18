import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { leadTitleFromRow } from "@/src/lib/crm/crmLeadListDisplay";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { loadConsultationConversionBoardPayload } from "@/src/lib/consultations/consultationConversionBoardLoader.server";
import type { ConsultationConversionBoardColumnId } from "@/src/lib/consultations/consultationConversionBoardModel";
import { loadTenantOperationalDashboard, type ReceptionBoardCard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";
import { loadSurgeryReadinessBoardPayload } from "@/src/lib/surgery/surgeryReadinessBoardLoader.server";
import type { SurgeryReadinessBoardCard } from "@/src/lib/surgery/surgeryReadinessBoardLoader.server";
import {
  alertSeverityForContext,
  alertSeverityRank,
  assertReceptionOsTenantRowScope,
  compareReceptionOsSeverity,
  depositIsOverdue,
  depositRecordIsOutstanding,
  depositSeverity,
  mapConversionColumnToReceptionPipeline,
  RECEPTION_OS_PIPELINE_COLUMN_IDS,
  surgeryItemNeedsRiskAlert,
  surgeryReadinessSeverity,
  type ReceptionOsAlertKind,
  type ReceptionOsPipelineColumnId,
} from "@/src/lib/receptionOs/receptionOsBoardModel";
import {
  actionAlertSchema,
  depositItemSchema,
  pipelineCardSchema,
  receptionOsBoardPayloadSchema,
  todaysPatientSchema,
  type ReceptionOsActionAlert,
  type ReceptionOsBoardPayload,
  type ReceptionOsCommunicationEvent,
  type ReceptionOsDepositItem,
  type ReceptionOsPipelineCard,
  type ReceptionOsSurgeryItem,
  type ReceptionOsTodaysPatient,
} from "@/src/lib/receptionOs/receptionOsBoardPayloadSchema";
import { resolveReceptionOsViewerContext } from "@/src/lib/receptionOs/receptionOsAccess.server";
import { resolvePaymentLinksForPaymentRecords } from "@/src/lib/receptionOs/receptionPaymentLink.server";
import {
  createReceptionOsIntelligenceContext,
  deriveReceptionOsIntelligenceHints,
} from "@/src/lib/receptionOs/receptionOsIntelligenceBridge";
import {
  emptyConsultationConversionBoardPayload,
  emptySurgeryReadinessBoardPayload,
  normalizeLoaderErrorMessage,
} from "@/src/lib/receptionOs/receptionOsLoaderResilience";
import type { PaymentRecordRow, PaymentStatus } from "@/src/lib/payments/paymentRecordModel";
import { displayFromPersonMetadata } from "@/src/lib/patients/patientLabels";

export type {
  ReceptionOsActionAlert,
  ReceptionOsBoardPayload,
  ReceptionOsCommunicationEvent,
  ReceptionOsDepositItem,
  ReceptionOsPipelineCard,
  ReceptionOsSurgeryItem,
  ReceptionOsTodaysPatient,
} from "@/src/lib/receptionOs/receptionOsBoardPayloadSchema";

const COMMUNICATION_LIMIT = 40;
const DEPOSIT_LIMIT = 50;
const NEW_LEAD_LIMIT = 40;

async function loadBoardSectionSafe<T>(scope: string, loader: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await loader();
  } catch (error) {
    console.error(`[loadReceptionOsBoardPayload:${scope}]`, normalizeLoaderErrorMessage(error));
    return fallback;
  }
}

const communicationEventSchema = receptionOsBoardPayloadSchema.shape.communicationTimeline.element;
const surgeryItemSchema = receptionOsBoardPayloadSchema.shape.upcomingSurgeries.element;

function formatLocalTime(iso: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

function mapCommunicationKind(type: string): ReceptionOsCommunicationEvent["kind"] {
  const t = type.trim().toLowerCase();
  if (t === "sms" || t === "whatsapp") return "sms";
  if (t === "email") return "email";
  if (t === "phone" || t === "video_call") return "call";
  return "other";
}

function mapReceptionCardToPatient(
  card: ReceptionBoardCard,
  base: string,
  tz: string,
  caseId: string | null,
): ReceptionOsTodaysPatient {
  return todaysPatientSchema.parse({
    id: card.id,
    patientName: card.displayName,
    appointmentType: card.typeLabel,
    appointmentTime: formatLocalTime(card.startAt, tz),
    status: card.bookingStatus,
    statusLabel: card.statusLabel,
    clinician: card.providerLabel,
    hrefs: {
      patient: card.patientId ? `${base}/patients/${card.patientId}` : null,
      case: caseId ? `${base}/cases/${caseId}` : null,
      lead: card.leadId ? `${base}/crm/leads/${card.leadId}` : null,
      appointment: `${base}/appointments?bookingId=${card.id}`,
    },
  });
}

async function loadBookingCaseIds(tenantId: string, bookingIds: string[]): Promise<Map<string, string>> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const out = new Map<string, string>();
  if (!bookingIds.length) return out;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_bookings")
    .select("id, tenant_id, case_id")
    .eq("tenant_id", tid)
    .in("id", bookingIds);
  if (error) throw new Error(error.message);

  for (const raw of data ?? []) {
    const r = raw as { id: string; tenant_id: string; case_id: string | null };
    assertReceptionOsTenantRowScope(tid, String(r.tenant_id), "fi_bookings");
    const caseId = r.case_id?.trim();
    if (caseId) out.set(String(r.id), caseId);
  }
  return out;
}

function emptyPipelineColumns(): Record<ReceptionOsPipelineColumnId, ReceptionOsPipelineCard[]> {
  return {
    new_lead: [],
    consultation_booked: [],
    consultation_completed: [],
    quote_sent: [],
    deposit_pending: [],
    surgery_booked: [],
  };
}

async function loadRecentCommunications(tenantId: string, base: string): Promise<ReceptionOsCommunicationEvent[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const supabase = supabaseAdmin();

  const { data: comms, error } = await supabase
    .from("fi_crm_lead_communications")
    .select("id, lead_id, communication_type, direction, subject, preview, contact_at")
    .eq("tenant_id", tid)
    .is("archived_at", null)
    .order("contact_at", { ascending: false })
    .limit(COMMUNICATION_LIMIT);
  if (error) throw new Error(error.message);

  const leadIds = [...new Set((comms ?? []).map((c) => String((c as { lead_id: string }).lead_id)))];
  const leadLabels = new Map<string, string>();
  const leadHrefs = new Map<string, { patient: string | null; case: string | null; lead: string }>();
  if (leadIds.length) {
    const { data: leads } = await supabase
      .from("fi_crm_leads")
      .select("id, tenant_id, summary, person_id, patient_id, converted_case_id, metadata")
      .eq("tenant_id", tid)
      .in("id", leadIds);
    for (const raw of leads ?? []) {
      const r = raw as {
        id: string;
        tenant_id: string;
        summary: string | null;
        patient_id: string | null;
        converted_case_id: string | null;
      };
      assertReceptionOsTenantRowScope(tid, String(r.tenant_id), "fi_crm_leads");
      const leadId = String(r.id);
      leadLabels.set(leadId, leadTitleFromRow(r.summary, leadId));
      leadHrefs.set(leadId, {
        lead: `${base}/crm/leads/${leadId}`,
        patient: r.patient_id?.trim() ? `${base}/patients/${r.patient_id.trim()}` : null,
        case: r.converted_case_id?.trim() ? `${base}/cases/${r.converted_case_id.trim()}` : null,
      });
    }
  }

  const { data: notes } = await supabase
    .from("fi_crm_lead_notes")
    .select("id, lead_id, body_preview, created_at")
    .eq("tenant_id", tid)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(15);

  const events: ReceptionOsCommunicationEvent[] = [];

  for (const raw of comms ?? []) {
    const r = raw as {
      id: string;
      lead_id: string;
      communication_type: string;
      direction: string;
      subject: string | null;
      preview: string | null;
      contact_at: string;
    };
    events.push(
      communicationEventSchema.parse({
        id: r.id,
        kind: mapCommunicationKind(r.communication_type),
        direction: r.direction,
        subject: r.subject,
        preview: r.preview,
        patientOrLeadLabel: leadLabels.get(String(r.lead_id)) ?? "Lead",
        contactAt: r.contact_at,
        hrefs: leadHrefs.get(String(r.lead_id)) ?? {
          lead: `${base}/crm/leads/${r.lead_id}`,
          patient: null,
          case: null,
        },
      }),
    );
  }

  for (const raw of notes ?? []) {
    const r = raw as { id: string; lead_id: string; body_preview: string | null; created_at: string };
    events.push(
      communicationEventSchema.parse({
        id: `note-${r.id}`,
        kind: "consultation_note",
        direction: "internal",
        subject: "Consultation note",
        preview: r.body_preview,
        patientOrLeadLabel: leadLabels.get(String(r.lead_id)) ?? "Lead",
        contactAt: r.created_at,
        hrefs: leadHrefs.get(String(r.lead_id)) ?? {
          lead: `${base}/crm/leads/${r.lead_id}`,
          patient: null,
          case: null,
        },
      }),
    );
  }

  events.sort((a, b) => Date.parse(b.contactAt) - Date.parse(a.contactAt));
  return events.slice(0, COMMUNICATION_LIMIT);
}

async function loadNewLeadPipelineCards(tenantId: string, base: string): Promise<ReceptionOsPipelineCard[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const supabase = supabaseAdmin();

  const { data: leads, error } = await supabase
    .from("fi_crm_leads")
    .select("id, summary, status, person_id, metadata, pipeline_stage_id")
    .eq("tenant_id", tid)
    .not("status", "in", "(archived,lost,converted)")
    .order("updated_at", { ascending: false })
    .limit(NEW_LEAD_LIMIT);
  if (error) throw new Error(error.message);

  const cards: ReceptionOsPipelineCard[] = [];
  for (const raw of leads ?? []) {
    const r = raw as { id: string; summary: string | null; status: string; metadata: unknown };
    cards.push(
      pipelineCardSchema.parse({
        id: `lead-${r.id}`,
        patientOrLeadLabel: leadTitleFromRow(r.summary, String(r.id)),
        column: "new_lead",
        detailLine: `CRM · ${r.status}`,
        hrefs: {
          lead: `${base}/crm/leads/${r.id}`,
          patient: null,
          consultation: null,
          case: null,
        },
      }),
    );
  }
  return cards;
}

function buildPipelineFromConversion(
  conversionPayload: Awaited<ReturnType<typeof loadConsultationConversionBoardPayload>>,
  newLeads: ReceptionOsPipelineCard[],
): ReceptionOsBoardPayload["consultationPipeline"] {
  const columns = emptyPipelineColumns();
  columns.new_lead = newLeads;

  const conversionToDeposit = new Map<string, boolean>();
  for (const colId of Object.keys(conversionPayload.columns) as ConsultationConversionBoardColumnId[]) {
    for (const card of conversionPayload.columns[colId]) {
      const depositNeeds = card.depositBoardLine.toLowerCase().includes("pending") || card.depositBoardLine.toLowerCase().includes("overdue");
      conversionToDeposit.set(card.id, depositNeeds);
    }
  }

  for (const colId of Object.keys(conversionPayload.columns) as ConsultationConversionBoardColumnId[]) {
    for (const card of conversionPayload.columns[colId]) {
      if (colId === "lost") continue;
      const depositNeeds = conversionToDeposit.get(card.id) ?? false;
      const pipelineCol = mapConversionColumnToReceptionPipeline({
        conversionColumn: colId,
        depositNeedsCollection: depositNeeds,
        surgeryBooked: colId === "surgery_booked",
      });
      if (pipelineCol === "new_lead") continue;
      columns[pipelineCol].push(
        pipelineCardSchema.parse({
          id: card.id,
          patientOrLeadLabel: card.patientOrLeadLabel,
          column: pipelineCol,
          detailLine: card.nextAction,
          hrefs: {
            lead: card.hrefs.lead,
            patient: card.hrefs.patient,
            consultation: card.hrefs.consultation,
            case: card.hrefs.case,
          },
        }),
      );
    }
  }

  const counts = {} as Record<ReceptionOsPipelineColumnId, number>;
  for (const id of RECEPTION_OS_PIPELINE_COLUMN_IDS) {
    counts[id] = columns[id].length;
  }

  return { columns, counts };
}

async function loadOutstandingDeposits(tenantId: string, todayYmd: string, base: string): Promise<ReceptionOsDepositItem[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("fi_payment_records")
    .select("*")
    .eq("tenant_id", tid)
    .in("status", ["pending", "partially_paid", "overdue"])
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(DEPOSIT_LIMIT);
  if (error) {
    if (error.message.includes("does not exist")) return [];
    console.error("[loadOutstandingDeposits]", error.message);
    return [];
  }

  const rows = (data ?? []).map((r) => r as Record<string, unknown>);
  const outstanding = rows.filter((raw) => {
    const row: Pick<PaymentRecordRow, "status" | "due_date" | "amount_expected" | "amount_paid"> = {
      status: String(raw.status) as PaymentStatus,
      due_date: raw.due_date != null ? String(raw.due_date).slice(0, 10) : null,
      amount_expected: Number(raw.amount_expected ?? 0),
      amount_paid: Number(raw.amount_paid ?? 0),
    };
    return depositRecordIsOutstanding(row, todayYmd);
  });

  const patientIds = [...new Set(outstanding.map((r) => (r.patient_id != null ? String(r.patient_id) : null)).filter(Boolean))] as string[];
  const leadIds = [...new Set(outstanding.map((r) => (r.lead_id != null ? String(r.lead_id) : null)).filter(Boolean))] as string[];

  const patientLabels = new Map<string, string>();
  if (patientIds.length) {
    const { data: patients } = await supabase.from("fi_patients").select("id, person_id").eq("tenant_id", tid).in("id", patientIds);
    const personIds = (patients ?? []).map((p) => String((p as { person_id: string }).person_id));
    const { data: persons } = personIds.length
      ? await supabase.from("fi_persons").select("id, metadata").eq("tenant_id", tid).in("id", personIds)
      : { data: [] };
    const personLabel = new Map<string, string>();
    for (const raw of persons ?? []) {
      const r = raw as { id: string; metadata: unknown };
      const m = r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata) ? (r.metadata as Record<string, unknown>) : {};
      personLabel.set(String(r.id), displayFromPersonMetadata(m).name);
    }
    for (const raw of patients ?? []) {
      const r = raw as { id: string; person_id: string };
      patientLabels.set(String(r.id), personLabel.get(String(r.person_id)) ?? "Patient");
    }
  }

  const leadLabels = new Map<string, string>();
  if (leadIds.length) {
    const { data: leads } = await supabase.from("fi_crm_leads").select("id, summary, metadata").eq("tenant_id", tid).in("id", leadIds);
    for (const raw of leads ?? []) {
      const r = raw as { id: string; summary: string | null; metadata: unknown };
      leadLabels.set(String(r.id), leadTitleFromRow(r.summary, String(r.id)));
    }
  }

  const items: ReceptionOsDepositItem[] = [];
  const paymentLinks = await resolvePaymentLinksForPaymentRecords(
    tid,
    outstanding.map((raw) => String((raw as { id: string }).id)),
  );

  for (const raw of outstanding) {
    const row = raw as PaymentRecordRow & Record<string, unknown>;
    assertReceptionOsTenantRowScope(tid, String(row.tenant_id ?? tid), "fi_payment_records");
    const pid = row.patient_id?.trim() || null;
    const lid = row.lead_id?.trim() || null;
    const label = (pid && patientLabels.get(pid)) || (lid && leadLabels.get(lid)) || "Unknown";
    const overdue = depositIsOverdue(row, todayYmd);
    const severity = depositSeverity({ isOverdue: overdue, dueDate: row.due_date?.trim() || null, todayYmd });
    const caseId = row.case_id?.trim() || null;
    items.push(
      depositItemSchema.parse({
        id: String(row.id),
        patientLabel: label,
        context: String(row.payment_context),
        amountExpected: Number(row.amount_expected ?? 0),
        amountPaid: Number(row.amount_paid ?? 0),
        currency: String(row.currency ?? "AUD"),
        dueDate: row.due_date?.trim() || null,
        isOverdue: overdue,
        statusLabel: overdue ? "Overdue" : severity === "warning" ? "Due soon" : "Pending",
        severity,
        paymentLink: paymentLinks.get(String(row.id)) ?? null,
        hrefs: {
          patient: pid ? `${base}/patients/${pid}` : null,
          case: caseId ? `${base}/cases/${caseId}` : null,
          lead: lid ? `${base}/crm/leads/${lid}` : null,
        },
      }),
    );
  }
  return items;
}

function mapSurgeryCard(card: SurgeryReadinessBoardCard): ReceptionOsSurgeryItem {
  const paymentComplete =
    !card.surgeryDepositLabel.toLowerCase().includes("pending") &&
    !card.surgeryDepositLabel.toLowerCase().includes("overdue") &&
    !card.surgeryDepositLabel.toLowerCase().includes("no manual");
  const consentComplete = !card.issues.some((i) => i.kind === "missing_consent_proxy");
  const readinessStatus =
    card.primaryColumn === "ready"
      ? "Ready"
      : card.primaryColumn === "high_risk"
        ? "High risk"
        : card.primaryColumn === "needs_attention"
          ? "Needs attention"
          : "In progress";

  const severity = surgeryReadinessSeverity({
    readinessStatus,
    paymentComplete,
    consentComplete,
    daysUntil: card.daysUntil,
  });

  return surgeryItemSchema.parse({
    bookingId: card.bookingId,
    patientLabel: card.patientLabel,
    surgeryDate: card.surgeryLocalYmd,
    surgeryTime: card.bookingTimeLabel,
    daysUntil: card.daysUntil,
    staffAssigned: card.assigneeLabel,
    paymentComplete,
    consentComplete,
    readinessStatus,
    readinessPercent: card.readinessPercent,
    severity,
    hrefs: card.hrefs,
  });
}

async function loadMissingFormsAlerts(tenantId: string, base: string): Promise<ReceptionOsActionAlert[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("fi_consultation_form_instances")
    .select("id, consultation_id, status, template_slug")
    .eq("tenant_id", tid)
    .eq("status", "draft")
    .order("updated_at", { ascending: false })
    .limit(20);
  if (error) return [];

  const consultIds = [...new Set((data ?? []).map((d) => String((d as { consultation_id: string }).consultation_id)))];
  if (!consultIds.length) return [];

  const { data: consults } = await supabase
    .from("fi_consultations")
    .select("id, patient_id, lead_id")
    .eq("tenant_id", tid)
    .in("id", consultIds);

  const alerts: ReceptionOsActionAlert[] = [];
  for (const raw of data ?? []) {
    const r = raw as { id: string; consultation_id: string; template_slug: string | null };
    const consult = (consults ?? []).find((c) => String((c as { id: string }).id) === String(r.consultation_id)) as
      | { id: string; patient_id: string | null; lead_id: string | null }
      | undefined;
    const patientId = consult?.patient_id?.trim() || null;
    const severity = alertSeverityForContext({ kind: "missing_forms" });
    alerts.push(
      actionAlertSchema.parse({
        id: `form-${r.id}`,
        kind: "missing_forms",
        title: "Missing or draft form",
        detail: r.template_slug ? `Form "${r.template_slug}" not submitted` : "Consultation form draft incomplete",
        severity,
        href: consult ? `${base}/consultations/${consult.id}` : null,
        hrefs: {
          patient: patientId ? `${base}/patients/${patientId}` : null,
          case: null,
          lead: consult?.lead_id?.trim() ? `${base}/crm/leads/${consult.lead_id.trim()}` : null,
          consultation: consult ? `${base}/consultations/${consult.id}` : null,
        },
      }),
    );
  }
  return alerts;
}

function buildActionAlerts(input: {
  deposits: ReceptionOsDepositItem[];
  conversionPayload: Awaited<ReturnType<typeof loadConsultationConversionBoardPayload>>;
  surgeryCards: ReceptionOsSurgeryItem[];
  missingForms: ReceptionOsActionAlert[];
  base: string;
}): ReceptionOsActionAlert[] {
  const alerts: ReceptionOsActionAlert[] = [...input.missingForms];

  for (const dep of input.deposits.filter((d) => d.isOverdue)) {
    const severity = alertSeverityForContext({ kind: "missing_deposit", isOverdueDeposit: dep.isOverdue });
    alerts.push(
      actionAlertSchema.parse({
        id: `deposit-${dep.id}`,
        kind: "missing_deposit",
        title: dep.isOverdue ? "Overdue deposit" : "Deposit pending",
        detail: `${dep.patientLabel} · ${dep.currency} ${dep.amountExpected.toFixed(0)} due`,
        severity,
        href: dep.hrefs.patient ?? dep.hrefs.case ?? dep.hrefs.lead,
        hrefs: {
          patient: dep.hrefs.patient,
          case: dep.hrefs.case,
          lead: dep.hrefs.lead,
          consultation: null,
        },
      }),
    );
  }

  for (const card of input.conversionPayload.columns.consultation_completed ?? []) {
    if (card.daysSinceConsultation != null && card.daysSinceConsultation >= 3) {
      const severity = alertSeverityForContext({
        kind: "no_follow_up_after_consultation",
        daysSinceConsultation: card.daysSinceConsultation,
      });
      alerts.push(
        actionAlertSchema.parse({
          id: `followup-${card.consultationId ?? card.id}`,
          kind: "no_follow_up_after_consultation",
          title: "No follow-up after consultation",
          detail: `${card.patientOrLeadLabel} · ${card.daysSinceConsultation} days since consult`,
          severity,
          href: card.hrefs.patient ?? card.hrefs.lead ?? card.hrefs.consultation,
          hrefs: {
            patient: card.hrefs.patient,
            case: card.hrefs.case,
            lead: card.hrefs.lead,
            consultation: card.hrefs.consultation,
          },
        }),
      );
    }
  }

  for (const surgery of input.surgeryCards) {
    if (!surgeryItemNeedsRiskAlert(surgery)) continue;
    const severity = alertSeverityForContext({
      kind: "surgery_risk",
      surgeryReadinessStatus: surgery.readinessStatus,
    });
    alerts.push(
      actionAlertSchema.parse({
        id: `surgery-${surgery.bookingId}`,
        kind: "surgery_risk",
        title: "Surgery readiness alert",
        detail: `${surgery.patientLabel} · ${surgery.surgeryDate} · ${surgery.readinessStatus}`,
        severity,
        href: surgery.hrefs.case ?? surgery.hrefs.patient ?? surgery.hrefs.calendar,
        hrefs: {
          patient: surgery.hrefs.patient,
          case: surgery.hrefs.case,
          lead: null,
          consultation: null,
        },
      }),
    );
  }

  alerts.sort((a, b) => {
    const sd = compareReceptionOsSeverity(a.severity, b.severity);
    if (sd !== 0) return sd;
    return alertSeverityRank(b.kind as ReceptionOsAlertKind) - alertSeverityRank(a.kind as ReceptionOsAlertKind);
  });

  return alerts.slice(0, 30);
}

export async function loadReceptionOsBoardPayload(tenantId: string, now: Date = new Date()): Promise<ReceptionOsBoardPayload> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const viewerContext = await resolveReceptionOsViewerContext(tid);
  const base = `/fi-admin/${tid}`;

  const operational = await loadTenantOperationalDashboard(tid, { includeReceptionBoard: true });
  const todayYmd = operational.operationalDay.todayYmd;
  const tz = operational.operationalDay.calendarTimezone;

  const [conversionPayload, surgeryPayload, communications, newLeads, deposits, missingForms] = await Promise.all([
    loadBoardSectionSafe(
      "conversion",
      () => loadConsultationConversionBoardPayload(tid, now),
      emptyConsultationConversionBoardPayload(tz, todayYmd),
    ),
    loadBoardSectionSafe(
      "surgery",
      () => loadSurgeryReadinessBoardPayload(tid, now),
      emptySurgeryReadinessBoardPayload(tz, todayYmd),
    ),
    loadBoardSectionSafe("communications", () => loadRecentCommunications(tid, base), []),
    loadBoardSectionSafe("pipeline_leads", () => loadNewLeadPipelineCards(tid, base), []),
    loadBoardSectionSafe("deposits", () => loadOutstandingDeposits(tid, todayYmd, base), []),
    loadBoardSectionSafe("missing_forms", () => loadMissingFormsAlerts(tid, base), []),
  ]);

  const bookingIds = operational.receptionBoard.cards.map((c) => c.id);
  const caseByBooking = await loadBookingCaseIds(tid, bookingIds);
  const todaysPatients = operational.receptionBoard.cards
    .slice()
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .map((c) => mapReceptionCardToPatient(c, base, tz, caseByBooking.get(c.id) ?? null));

  const consultationPipeline = buildPipelineFromConversion(conversionPayload, newLeads);

  const allSurgeryCards = [
    ...surgeryPayload.columns.ready,
    ...surgeryPayload.columns.needs_attention,
    ...surgeryPayload.columns.high_risk,
    ...surgeryPayload.columns.missing_pathology,
    ...surgeryPayload.columns.missing_consent,
    ...surgeryPayload.columns.on_hold_not_linked,
  ]
    .slice()
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

  const upcomingSurgeries = allSurgeryCards.map(mapSurgeryCard);
  const actionAlerts = buildActionAlerts({
    deposits,
    conversionPayload,
    surgeryCards: upcomingSurgeries,
    missingForms,
    base,
  });

  const patientsWaitingCount = operational.receptionBoard.cards.filter(
    (c) => c.receptionColumn === "expected" || c.receptionColumn === "arrived" || c.receptionColumn === "in_consultation",
  ).length;

  const intelligenceBase = createReceptionOsIntelligenceContext();
  const hints = deriveReceptionOsIntelligenceHints({
    overdueDepositCount: deposits.filter((d) => d.isOverdue).length,
    surgeryRiskAlertCount: actionAlerts.filter((a) => a.kind === "surgery_risk").length,
    noFollowUpCount: actionAlerts.filter((a) => a.kind === "no_follow_up_after_consultation").length,
    missingFormsCount: actionAlerts.filter((a) => a.kind === "missing_forms").length,
    patientsWaitingCount,
  });

  return receptionOsBoardPayloadSchema.parse({
    tenantId: tid,
    tenantName: operational.tenantName,
    loadedAt: now.toISOString(),
    operationalDay: operational.operationalDay,
    viewer: {
      role: viewerContext.receptionOsRole,
      visibleWidgets: [...viewerContext.visibleWidgets],
    },
    todaysPatients,
    communicationTimeline: communications,
    consultationPipeline,
    outstandingDeposits: deposits,
    upcomingSurgeries,
    actionAlerts,
    intelligence: { ...intelligenceBase, hints, generatedAt: now.toISOString() },
  }) as ReceptionOsBoardPayload;
}
