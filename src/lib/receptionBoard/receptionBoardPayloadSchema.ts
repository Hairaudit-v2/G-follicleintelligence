/**
 * Client-safe Reception Board Command Center payload schema.
 */
import { z } from "zod";

import {
  RECEPTION_BOARD_OPERATIONAL_STATUSES,
  RECEPTION_BOARD_QUEUE_COLUMN_IDS,
} from "./receptionBoardTypes";
import type { ReceptionBoardCommandCenterPayload } from "./receptionBoardTypes";

const operationalDaySchema = z.object({
  calendarTimezone: z.string(),
  todayYmd: z.string(),
  localStartIso: z.string(),
  localEndIso: z.string(),
});

const hrefsSchema = z.object({
  patient: z.string().nullable(),
  case: z.string().nullable(),
  lead: z.string().nullable(),
  appointment: z.string(),
  calendar: z.string(),
});

const appointmentSchema = z.object({
  id: z.string().uuid(),
  patientName: z.string(),
  appointmentTime: z.string(),
  appointmentType: z.string(),
  clinician: z.string(),
  status: z.enum(RECEPTION_BOARD_OPERATIONAL_STATUSES),
  statusLabel: z.string(),
  durationMinutes: z.number().nullable(),
  room: z.string().nullable(),
  paymentStatus: z.enum(["paid", "due", "overdue", "not_required", "unknown"]),
  paymentStatusLabel: z.string(),
  confirmationStatus: z.enum(["confirmed", "unconfirmed", "cancelled"]),
  journeyState: z.string().nullable(),
  journeyStateLabel: z.string().nullable(),
  sortKey: z.string(),
  hrefs: hrefsSchema,
});

const queueItemSchema = z.object({
  bookingId: z.string().uuid(),
  patientName: z.string(),
  appointmentTime: z.string(),
  appointmentType: z.string(),
  columnId: z.enum(RECEPTION_BOARD_QUEUE_COLUMN_IDS),
  operationalStatus: z.enum(RECEPTION_BOARD_OPERATIONAL_STATUSES),
  clinician: z.string(),
  room: z.string().nullable(),
  nextFlowAction: z
    .enum([
      "mark_arrived",
      "start_consultation",
      "start_treatment",
      "complete",
      "mark_no_show",
      "cancel",
    ])
    .nullable(),
  hrefs: hrefsSchema,
});

const alertSchema = z.object({
  id: z.string(),
  kind: z.string(),
  title: z.string(),
  detail: z.string(),
  severity: z.enum(["info", "warning", "critical", "blocked"]),
  href: z.string().nullable(),
  priorityScore: z.number(),
});

const quickActionSchema = z.object({
  id: z.string(),
  label: z.string(),
  href: z.string(),
  description: z.string(),
});

const tomorrowSurgerySchema = z.object({
  bookingId: z.string().uuid(),
  patientLabel: z.string(),
  procedureType: z.string(),
  surgeon: z.string().nullable(),
  assignedStaff: z.string().nullable(),
  room: z.string().nullable(),
  surgeryDate: z.string(),
  surgeryTime: z.string(),
  readinessPercent: z.number(),
  readinessTone: z.enum(["green", "yellow", "red"]),
  depositPaid: z.boolean(),
  consentSigned: z.boolean(),
  photosCompleted: z.boolean(),
  preOpChecklistComplete: z.boolean(),
  medicalClearance: z.boolean(),
  missingItems: z.array(z.string()),
  hrefs: z.object({
    case: z.string().nullable(),
    patient: z.string().nullable(),
    calendar: z.string(),
  }),
});

const intelligenceSchema = z.object({
  todayConsultations: z.number(),
  todaySurgeries: z.number(),
  revenueBookedToday: z.number(),
  outstandingPayments: z.number(),
  conversionRateToday: z.number().nullable(),
  doctorUtilizationPercent: z.number().nullable(),
  staffUtilizationPercent: z.number().nullable(),
  averageConsultationCloseRate: z.number().nullable(),
  upcomingFollowUps: z.number(),
  unreadPatientTasks: z.number(),
});

const liveEventSchema = z.object({
  id: z.string(),
  kind: z.string(),
  title: z.string(),
  detail: z.string().nullable(),
  occurredAt: z.string(),
  href: z.string().nullable(),
});

const receptionCardSchema = z.object({
  id: z.string().uuid(),
  startAt: z.string(),
  endAt: z.string(),
  title: z.string().nullable(),
  bookingType: z.string(),
  bookingStatus: z.string(),
  timezone: z.string().nullable(),
  leadId: z.string().uuid().nullable(),
  patientId: z.string().uuid().nullable(),
  displayName: z.string(),
  statusLabel: z.string(),
  typeLabel: z.string(),
  providerLabel: z.string(),
  clinicLabel: z.string().nullable(),
  roomLabel: z.string().nullable(),
  receptionColumn: z.enum([
    "expected",
    "arrived",
    "in_consultation",
    "in_treatment",
    "complete",
    "no_show",
    "cancelled",
  ]),
  metadata: z.record(z.string(), z.unknown()),
});

const queueRecordSchema = z.record(z.enum(RECEPTION_BOARD_QUEUE_COLUMN_IDS), z.array(queueItemSchema));

export const receptionBoardCommandCenterPayloadSchema = z.object({
  tenantId: z.string().uuid(),
  tenantName: z.string(),
  loadedAt: z.string(),
  operationalDay: operationalDaySchema,
  appointments: z.array(appointmentSchema),
  queue: queueRecordSchema,
  actionAlerts: z.array(alertSchema),
  quickActions: z.array(quickActionSchema),
  tomorrowSurgeries: z.array(tomorrowSurgerySchema),
  intelligence: intelligenceSchema,
  liveEvents: z.array(liveEventSchema),
  receptionCards: z.array(receptionCardSchema),
  loadTier: z.enum(["shell", "full"]).optional(),
});

export function parseReceptionBoardCommandCenterPayload(
  raw: unknown
): ReceptionBoardCommandCenterPayload {
  return receptionBoardCommandCenterPayloadSchema.parse(
    raw
  ) as unknown as ReceptionBoardCommandCenterPayload;
}

export function serializeReceptionBoardCommandCenterPayload(
  payload: ReceptionBoardCommandCenterPayload
): ReceptionBoardCommandCenterPayload {
  const { _surgerySource: _, ...rest } = payload;
  return parseReceptionBoardCommandCenterPayload(rest);
}