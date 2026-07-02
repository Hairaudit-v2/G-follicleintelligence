import { z } from "zod";

import type { ProcedureDayBoardPayload } from "@/src/lib/surgery/procedureDayBoardLoader.server";
import { PROCEDURE_DAY_WORKFLOW_STAGES } from "./procedureDayWorkflowCore";

export type ProcedureDayWorkflowStage = (typeof PROCEDURE_DAY_WORKFLOW_STAGES)[number];

export type ProcedureDaySurgicalMetrics = {
  graftsExtracted?: number | null;
  graftsImplanted?: number | null;
  hairsCounted?: number | null;
  transectionRate?: number | null;
  punchSize?: string | null;
  extractionMethod?: string | null;
  implantationMethod?: string | null;
  medicationsGiven?: string[] | null;
  adverseEvents?: string[] | null;
  notes?: string | null;
};

export type ProcedureDaySessionRow = {
  id: string;
  tenantId: string;
  bookingId: string;
  patientId: string;
  caseId: string | null;
  currentStage: ProcedureDayWorkflowStage;
  startedAt: string | null;
  completedAt: string | null;
  metadata: ProcedureDaySurgicalMetrics & Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ProcedureDayEventRow = {
  id: string;
  tenantId: string;
  sessionId: string;
  bookingId: string;
  patientId: string;
  eventType: string;
  fromStage: ProcedureDayWorkflowStage | null;
  toStage: ProcedureDayWorkflowStage | null;
  payload: Record<string, unknown>;
  actorUserId: string | null;
  createdAt: string;
};

export type ProcedureDayLiveBoardPayload = ProcedureDayBoardPayload & {
  liveWorkflowEnabled: boolean;
  liveByBooking: Record<string, ProcedureDayLiveCardState>;
  liveSummary: {
    activeSessions: number;
    completedToday: number;
    dischargedToday: number;
  };
};

export type ProcedureDayLiveCardState = {
  bookingId: string;
  sessionId: string | null;
  currentStage: ProcedureDayWorkflowStage;
  stageLabel: string;
  startedAt: string | null;
  completedAt: string | null;
  metrics: ProcedureDaySurgicalMetrics;
  isLive: boolean;
  canStart: boolean;
  nextStage: ProcedureDayWorkflowStage | null;
  safetyWarnings: string[];
  checklist: ProcedureDayChecklistItem[];
  postOpSummary: string | null;
};

export type ProcedureDayChecklistItem = {
  id: string;
  label: string;
  complete: boolean;
  required: boolean;
};

const optionalAdminKey = z.object({ adminKey: z.string().optional() });

export const procedureDayBookingIdSchema = optionalAdminKey.extend({
  booking_id: z.string().uuid(),
});

export const procedureDayAdvanceStageSchema = optionalAdminKey.extend({
  booking_id: z.string().uuid(),
  to_stage: z.enum(PROCEDURE_DAY_WORKFLOW_STAGES).optional(),
});

export const procedureDayMetricSchema = optionalAdminKey.extend({
  booking_id: z.string().uuid(),
  metric: z.enum([
    "grafts_extracted",
    "grafts_implanted",
    "hairs_counted",
    "transection_rate",
    "punch_size",
    "extraction_method",
    "implantation_method",
    "medications_given",
    "adverse_events",
    "notes",
  ]),
  value: z.union([
    z.number(),
    z.string(),
    z.array(z.string()),
    z.null(),
  ]),
  increment: z.number().int().optional(),
});

export const procedureDayGraftIncrementSchema = optionalAdminKey.extend({
  booking_id: z.string().uuid(),
  field: z.enum(["grafts_extracted", "grafts_implanted", "hairs_counted"]),
  delta: z.number().int().positive().max(5000),
});

export const procedureDayCompleteSchema = optionalAdminKey.extend({
  booking_id: z.string().uuid(),
  post_op_summary: z.string().max(4000).optional().nullable(),
  create_follow_up_task: z.boolean().optional(),
});

export const procedureDayDischargeSchema = optionalAdminKey.extend({
  booking_id: z.string().uuid(),
  discharge_notes: z.string().max(2000).optional().nullable(),
});