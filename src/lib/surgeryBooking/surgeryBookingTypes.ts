import { z } from "zod";

const UUID = z.string().uuid();
const optionalUuid = z.union([UUID, z.null()]).optional();

const zoneSchema = z
  .object({
    key: z.string().min(1).max(64),
    label: z.string().max(256).nullable().optional(),
  })
  .strict();

const resourceAssignmentSchema = z
  .object({
    resource_type: z.enum(["staff", "room"]),
    resource_id: UUID,
    role_label: z.string().max(200).nullable().optional(),
    is_primary: z.boolean().optional(),
  })
  .strict();

export const surgeryBookingConfirmBodySchema = z
  .object({
    adminKey: z.string().optional(),
    patientId: UUID,
    personId: optionalUuid,
    caseId: optionalUuid,
    leadId: optionalUuid,
    clinicId: UUID,
    consultationId: optionalUuid,
    crmQuoteId: optionalUuid,
    procedureType: z.string().min(1).max(256),
    graftEstimate: z.string().max(128).nullable().optional(),
    plannedZones: z.array(zoneSchema).max(24).optional(),
    clinicalNotes: z.string().max(8000).nullable().optional(),
    surgeonStaffId: UUID,
    startAt: z.string().min(1),
    endAt: z.string().min(1),
    timezone: z.string().max(128).nullable().optional(),
    roomId: UUID,
    roomRequired: z.boolean().optional(),
    resourceAssignments: z.array(resourceAssignmentSchema).max(32).optional(),
    bookingStatus: z.enum(["scheduled", "confirmed"]).optional(),
    createDepositRequest: z.boolean().optional(),
    entrySource: z.string().max(64).optional(),
  })
  .strict();

export type SurgeryBookingConfirmBody = z.infer<typeof surgeryBookingConfirmBodySchema>;

export type SurgeryBookingConfirmResult = {
  bookingId: string;
  caseId: string | null;
  patientId: string;
  preOpChecklist: Array<{ key: string; label: string; complete: boolean }>;
  depositInvoiceId: string | null;
  nextActions: Array<{ label: string; href: string }>;
};

export type SurgeryBookingWizardPrefill = {
  patientId?: string | null;
  personId?: string | null;
  caseId?: string | null;
  leadId?: string | null;
  clinicId?: string | null;
  consultationId?: string | null;
  crmQuoteId?: string | null;
  patientDisplayName?: string | null;
  caseLabel?: string | null;
  procedureType?: string | null;
  graftEstimate?: string | null;
  plannedZones?: Array<{ key: string; label?: string | null }>;
  clinicalNotes?: string | null;
  description?: string | null;
  initialMetadata?: Record<string, unknown>;
  surgeonStaffId?: string | null;
  entrySource?: string | null;
};