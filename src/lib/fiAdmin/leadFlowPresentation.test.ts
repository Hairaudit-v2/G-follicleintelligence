import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildBookingReadinessItems,
  buildLeadFlowAttentionPriorities,
  buildLeadFlowHealthCards,
  deriveBookingReadiness,
  hasUrgentLeadFlowAttention,
} from "@/src/lib/fiAdmin/leadFlowPresentation";
import type { LeadFlowDashboardPayload } from "@/src/lib/fiAdmin/leadFlowDashboardTypes";
import type { CrmKanbanLeadCard } from "@/src/lib/crm/types";

const basePayload: LeadFlowDashboardPayload = {
  staleLeads: [],
  tasksDue: [],
  quickStats: {
    newLeadsThisWeek: 3,
    newLeadsToday: 1,
    conversionRateLast30d: 0.2,
    conversionWonLast30d: 2,
    conversionClosedLast30d: 10,
    openConsultations: 4,
    todaysNoShows: 0,
    staffOnDutyToday: 2,
  },
  actionCentre: {
    leadsAwaitingContact: 0,
    consultationsAwaitingCompletion: 0,
    followUpsDue: 0,
    surgeryReadinessAlerts: 0,
    surgeryFinancialPaymentAttention: 0,
    financialPathwayTasksAttention: 0,
    financeApplicationsAttention: 0,
    superReleaseApplicationsAttention: 0,
    internationalTransferApplicationsAttention: 0,
    financialClearanceAttention: 0,
  },
  launchControl: {
    consultationsToday: 2,
    surgeriesThisWeek: 1,
    leadsNeedingFollowUp: 0,
    openTasks: 0,
    revenueAvailable: false,
  },
  clinicToday: { consultations: 2, prp: 0, followUps: 0, surgeries: 0 },
  crmPipelineLeadVolume: {
    activeByStageId: {},
    activeUnassignedStage: 0,
    activeOtherPipelineStage: 0,
  },
  crmPipelineStages: [],
  conversionKpis: {
    consultationsBookedNext30Days: 3,
    consultationsCompletedLast30Days: 2,
    quotesSent: 1,
    quotesAccepted: 1,
    surgeryBookedFromConsults: 0,
    conversionRateQuoteToSurgery: 0.33,
    conversionRateLabel: "Surgery booked ÷ quotes",
  },
  conversionLostCount: 1,
  enrichedLeads: [],
  recentActivity: [],
  hubspotImport: {
    latestBatch: null,
    stagingRowCount: 0,
    duplicateEmailCount: 0,
    duplicatePhoneCount: 0,
    duplicateRecordIdCount: 0,
  },
  staleLeadThresholdDays: 7,
};

function makeCard(overrides: Partial<CrmKanbanLeadCard> & { id: string; slug: string }): CrmKanbanLeadCard {
  const { id, slug, ...rest } = overrides;
  return {
    lead: {
      id,
      tenant_id: "t1",
      organisation_id: null,
      clinic_id: null,
      person_id: "p1",
      patient_id: null,
      case_id: null,
      current_stage_id: "s1",
      primary_owner_user_id: null,
      status: "open",
      priority: null,
      summary: "Hair transplant enquiry",
      metadata: {},
      converted_person_id: null,
      converted_case_id: null,
      converted_at: null,
      converted_by_user_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    stage: { id: "s1", slug, label: slug, sort_order: 0 },
    person: null,
    owner: null,
    patient: null,
    clinicalSummaryLine: null,
    norwoodScale: null,
    ludwigScale: null,
    primaryConcernLine: null,
    daysInStage: 1,
    stageEnteredAtIso: new Date().toISOString(),
    lastActivityAtIso: new Date().toISOString(),
    overdueTaskCount: 0,
    isHighValue: false,
    ...rest,
  };
}

test("buildLeadFlowHealthCards returns six clinic-facing KPIs", () => {
  const cards = buildLeadFlowHealthCards("/fi-admin/t1", basePayload);
  assert.equal(cards.length, 6);
  assert.equal(cards[0]?.id, "new_enquiries");
  assert.equal(cards[0]?.value, "1");
});

test("buildLeadFlowAttentionPriorities: calm when no signals", () => {
  const items = buildLeadFlowAttentionPriorities("/fi-admin/t1", basePayload);
  assert.equal(items.length, 0);
  assert.equal(hasUrgentLeadFlowAttention(items), false);
});

test("deriveBookingReadiness: new lead needs contact", () => {
  const card = makeCard({ id: "l1", slug: "new" });
  const r = deriveBookingReadiness(card, 7);
  assert.equal(r.label, "Needs contact");
});

test("buildBookingReadinessItems ranks ready-to-book leads first", () => {
  const payload: LeadFlowDashboardPayload = {
    ...basePayload,
    enrichedLeads: [
      makeCard({ id: "l1", slug: "new" }),
      makeCard({ id: "l2", slug: "qualified", isHighValue: true }),
    ],
  };
  const items = buildBookingReadinessItems("/fi-admin/t1", payload, 2);
  assert.equal(items[0]?.id, "l2");
  assert.equal(items[0]?.readinessLabel, "Ready to book");
});
