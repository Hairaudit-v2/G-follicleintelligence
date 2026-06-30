import { z } from "zod";

import {
  PLAN_STATUSES,
  THERAPY_EVENT_TYPES,
  type PlanStatus,
  type TherapyEventType,
} from "./medicationOsTypes";

const planStatusTuple = PLAN_STATUSES as unknown as [PlanStatus, ...PlanStatus[]];
const therapyEventTypeTuple = THERAPY_EVENT_TYPES as unknown as [
  TherapyEventType,
  ...TherapyEventType[],
];

const uuid = z.string().uuid();

/** Query / action inputs for future MedicationOS writes; safe to use from route handlers. */
export const medicationOsTenantIdSchema = z.object({
  tenantId: z.string().min(1),
});

export const medicationOsPatientScopeSchema = z.object({
  tenantId: z.string().min(1),
  patientId: uuid,
});

export const medicationOsCaseScopeSchema = z.object({
  tenantId: z.string().min(1),
  caseId: uuid,
});

export const loadTherapyPlansOptionsSchema = z
  .object({
    limit: z.number().int().min(1).max(200).optional(),
    statusIn: z.array(z.enum(planStatusTuple)).optional(),
    includeItems: z.boolean().optional(),
  })
  .strict();

export const loadTherapyEventsOptionsSchema = z
  .object({
    limit: z.number().int().min(1).max(500).optional(),
    eventTypeIn: z.array(z.enum(therapyEventTypeTuple)).optional(),
  })
  .strict();

export type LoadTherapyPlansOptionsInput = z.infer<typeof loadTherapyPlansOptionsSchema>;
export type LoadTherapyEventsOptionsInput = z.infer<typeof loadTherapyEventsOptionsSchema>;
