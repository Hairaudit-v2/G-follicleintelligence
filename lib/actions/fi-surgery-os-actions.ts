"use server";

import { revalidatePath } from "next/cache";
import { ZodError, z } from "zod";

import {
  assertSurgeryOsMutationAllowed,
  assertSurgeryOsNoteMutationAllowed,
  assertSurgeryOsTeamStatusMutationAllowed,
} from "@/src/lib/surgeryOs/surgeryOsMutationAccess.server";
import {
  SURGERY_OS_LOGGABLE_EVENT_KINDS,
  SURGERY_OS_MAJOR_PHASES,
} from "@/src/lib/surgeryOs/surgeryOsPolicy";
import {
  SURGERY_OS_ASSIGNMENT_STATUSES,
  SURGERY_OS_NOTE_KINDS,
  SURGERY_OS_SEVERITIES,
} from "@/src/lib/surgeryOs/surgeryOsBoardModel";
import {
  addSurgeryOperationalNote,
  createSurgeryFromBooking,
  logSurgeryProcedureEvent,
  transitionSurgeryPhase,
  updateSurgeryTeamStatus,
} from "@/src/lib/surgeryOs/surgeryMutations.server";
import {
  addExtractionGraftCount,
  addImplantationGraftCount,
  confirmTrayGraftCount,
  correctGraftCount,
  enterTrayGraftCount,
  logDiscardedGrafts,
  reconcileGrafts,
} from "@/src/lib/surgeryOs/surgeryGraftMutations.server";
import { SURGERY_OS_GRAFT_TYPES } from "@/src/lib/surgeryOs/surgeryOsGraftModel";

const optionalAdminKey = z.object({ adminKey: z.string().optional() });

const createFromBookingSchema = optionalAdminKey.extend({
  booking_id: z.string().uuid(),
});

const transitionPhaseSchema = optionalAdminKey.extend({
  surgery_id: z.string().uuid(),
  to_phase: z.enum(SURGERY_OS_MAJOR_PHASES),
});

const logEventSchema = optionalAdminKey.extend({
  surgery_id: z.string().uuid(),
  event_kind: z.enum(SURGERY_OS_LOGGABLE_EVENT_KINDS),
  custom_label: z.string().max(200).optional().nullable(),
  custom_body: z.string().max(2000).optional().nullable(),
  occurred_at: z.string().optional().nullable(),
});

const addNoteSchema = optionalAdminKey.extend({
  surgery_id: z.string().uuid(),
  note_kind: z.enum(SURGERY_OS_NOTE_KINDS),
  body: z.string().min(1).max(4000),
  severity: z.enum(SURGERY_OS_SEVERITIES).optional(),
});

const teamStatusSchema = optionalAdminKey.extend({
  assignment_id: z.string().uuid(),
  status: z.enum(SURGERY_OS_ASSIGNMENT_STATUSES),
});

const graftMutationContextSchema = z.object({
  adminKey: z.string().optional(),
  device_id: z.string().min(8).max(128).optional().nullable(),
  client_submission_id: z.string().uuid().optional().nullable(),
});

const extractionCountSchema = graftMutationContextSchema.extend({
  surgery_id: z.string().uuid(),
  count: z.number().int().positive(),
  graft_type: z.enum(SURGERY_OS_GRAFT_TYPES).optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
});

const implantationCountSchema = graftMutationContextSchema.extend({
  surgery_id: z.string().uuid(),
  count: z.number().int().positive(),
  graft_type: z.enum(SURGERY_OS_GRAFT_TYPES).optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
});

const trayCountSchema = graftMutationContextSchema.extend({
  surgery_id: z.string().uuid(),
  tray_number: z.number().int().positive().optional().nullable(),
  singles: z.number().int().min(0),
  doubles: z.number().int().min(0),
  triples: z.number().int().min(0),
  multiples: z.number().int().min(0),
  damaged: z.number().int().min(0).optional(),
  total_hairs: z.number().int().min(0).optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
});

const discardedGraftsSchema = graftMutationContextSchema.extend({
  surgery_id: z.string().uuid(),
  count: z.number().int().positive(),
  note: z.string().max(2000).optional().nullable(),
});

const correctGraftSchema = graftMutationContextSchema.extend({
  surgery_id: z.string().uuid(),
  extracted: z.number().int().min(0),
  implanted: z.number().int().min(0),
  discarded: z.number().int().min(0),
  singles: z.number().int().min(0).optional(),
  doubles: z.number().int().min(0).optional(),
  triples: z.number().int().min(0).optional(),
  multiples: z.number().int().min(0).optional(),
  total_hairs: z.number().int().min(0).optional(),
  note: z.string().max(2000).optional().nullable(),
});

const reconcileGraftsSchema = graftMutationContextSchema.extend({
  surgery_id: z.string().uuid(),
  note: z.string().max(2000).optional().nullable(),
});

const confirmTrayCountSchema = graftMutationContextSchema.extend({
  surgery_id: z.string().uuid(),
  tray_event_id: z.string().uuid(),
  approved: z.boolean(),
  note: z.string().max(2000).optional().nullable(),
});

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function graftMutationOptions(parsed: {
  adminKey?: string;
  device_id?: string | null;
  client_submission_id?: string | null;
}) {
  return {
    deviceId: parsed.device_id,
    clientSubmissionId: parsed.client_submission_id,
    allowAdminOverride: Boolean(parsed.adminKey?.trim()),
  };
}

function revalidateSurgeryOsPaths(tenantId: string) {
  const base = `/fi-admin/${tenantId.trim()}/surgery-os`;
  revalidatePath(base);
  revalidatePath(`${base}/graft-counting`);
}


export async function createSurgeryFromBookingAction(
  tenantId: string,
  input: z.infer<typeof createFromBookingSchema>,
) {
  try {
    const parsed = createFromBookingSchema.parse(input);
    const { actorFiUserId } = await assertSurgeryOsMutationAllowed(tenantId, "create_from_booking", parsed.adminKey);
    const data = await createSurgeryFromBooking({
      tenantId,
      bookingId: parsed.booking_id,
      actorFiUserId,
    });
    revalidateSurgeryOsPaths(tenantId);
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, error: errMsg(e) };
  }
}

export async function transitionSurgeryPhaseAction(
  tenantId: string,
  input: z.infer<typeof transitionPhaseSchema>,
) {
  try {
    const parsed = transitionPhaseSchema.parse(input);
    const { actorFiUserId } = await assertSurgeryOsMutationAllowed(tenantId, "transition_phase", parsed.adminKey);
    const data = await transitionSurgeryPhase({
      tenantId,
      surgeryId: parsed.surgery_id,
      toPhase: parsed.to_phase,
      actorFiUserId,
    });
    revalidateSurgeryOsPaths(tenantId);
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, error: errMsg(e) };
  }
}

export async function logSurgeryEventAction(tenantId: string, input: z.infer<typeof logEventSchema>) {
  try {
    const parsed = logEventSchema.parse(input);
    const { actorFiUserId } = await assertSurgeryOsMutationAllowed(tenantId, "log_event", parsed.adminKey);
    const data = await logSurgeryProcedureEvent({
      tenantId,
      surgeryId: parsed.surgery_id,
      eventKind: parsed.event_kind,
      actorFiUserId,
      customLabel: parsed.custom_label,
      customBody: parsed.custom_body,
      occurredAt: parsed.occurred_at,
    });
    revalidateSurgeryOsPaths(tenantId);
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, error: errMsg(e) };
  }
}

export async function addSurgeryNoteAction(tenantId: string, input: z.infer<typeof addNoteSchema>) {
  try {
    const parsed = addNoteSchema.parse(input);
    const { actorFiUserId } = await assertSurgeryOsNoteMutationAllowed(tenantId, parsed.note_kind, parsed.adminKey);
    const data = await addSurgeryOperationalNote({
      tenantId,
      surgeryId: parsed.surgery_id,
      noteKind: parsed.note_kind,
      body: parsed.body,
      severity: parsed.severity,
      actorFiUserId,
    });
    revalidateSurgeryOsPaths(tenantId);
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, error: errMsg(e) };
  }
}

export async function updateSurgeryTeamStatusAction(
  tenantId: string,
  input: z.infer<typeof teamStatusSchema> & { assignment_fi_user_id: string },
) {
  try {
    const parsed = teamStatusSchema.parse(input);
    const { actorFiUserId } = await assertSurgeryOsTeamStatusMutationAllowed(
      tenantId,
      input.assignment_fi_user_id,
      parsed.adminKey,
    );
    const data = await updateSurgeryTeamStatus({
      tenantId,
      assignmentId: parsed.assignment_id,
      status: parsed.status,
      actorFiUserId,
    });
    revalidateSurgeryOsPaths(tenantId);
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, error: errMsg(e) };
  }
}

export async function addExtractionGraftCountAction(
  tenantId: string,
  input: z.infer<typeof extractionCountSchema>,
) {
  try {
    const parsed = extractionCountSchema.parse(input);
    const { actorFiUserId } = await assertSurgeryOsMutationAllowed(tenantId, "add_extraction_count", parsed.adminKey);
    const data = await addExtractionGraftCount({
      tenantId,
      surgeryId: parsed.surgery_id,
      count: parsed.count,
      graftType: parsed.graft_type,
      note: parsed.note,
      actorFiUserId,
      ...graftMutationOptions(parsed),
    });
    revalidateSurgeryOsPaths(tenantId);
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, error: errMsg(e) };
  }
}

export async function addImplantationGraftCountAction(
  tenantId: string,
  input: z.infer<typeof implantationCountSchema>,
) {
  try {
    const parsed = implantationCountSchema.parse(input);
    const { actorFiUserId } = await assertSurgeryOsMutationAllowed(tenantId, "add_implantation_count", parsed.adminKey);
    const data = await addImplantationGraftCount({
      tenantId,
      surgeryId: parsed.surgery_id,
      count: parsed.count,
      graftType: parsed.graft_type,
      note: parsed.note,
      actorFiUserId,
      ...graftMutationOptions(parsed),
    });
    revalidateSurgeryOsPaths(tenantId);
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, error: errMsg(e) };
  }
}

export async function enterTrayGraftCountAction(tenantId: string, input: z.infer<typeof trayCountSchema>) {
  try {
    const parsed = trayCountSchema.parse(input);
    const { actorFiUserId } = await assertSurgeryOsMutationAllowed(tenantId, "enter_tray_count", parsed.adminKey);
    const data = await enterTrayGraftCount({
      tenantId,
      surgeryId: parsed.surgery_id,
      trayNumber: parsed.tray_number,
      singles: parsed.singles,
      doubles: parsed.doubles,
      triples: parsed.triples,
      multiples: parsed.multiples,
      damaged: parsed.damaged,
      totalHairs: parsed.total_hairs,
      note: parsed.note,
      actorFiUserId,
      ...graftMutationOptions(parsed),
    });
    revalidateSurgeryOsPaths(tenantId);
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, error: errMsg(e) };
  }
}

export async function logDiscardedGraftsAction(tenantId: string, input: z.infer<typeof discardedGraftsSchema>) {
  try {
    const parsed = discardedGraftsSchema.parse(input);
    const { actorFiUserId } = await assertSurgeryOsMutationAllowed(tenantId, "log_discarded_grafts", parsed.adminKey);
    const data = await logDiscardedGrafts({
      tenantId,
      surgeryId: parsed.surgery_id,
      count: parsed.count,
      note: parsed.note,
      actorFiUserId,
    });
    revalidateSurgeryOsPaths(tenantId);
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, error: errMsg(e) };
  }
}

export async function correctGraftCountAction(tenantId: string, input: z.infer<typeof correctGraftSchema>) {
  try {
    const parsed = correctGraftSchema.parse(input);
    const { actorFiUserId } = await assertSurgeryOsMutationAllowed(tenantId, "correct_graft_count", parsed.adminKey);
    const data = await correctGraftCount({
      tenantId,
      surgeryId: parsed.surgery_id,
      extracted: parsed.extracted,
      implanted: parsed.implanted,
      discarded: parsed.discarded,
      singles: parsed.singles,
      doubles: parsed.doubles,
      triples: parsed.triples,
      multiples: parsed.multiples,
      totalHairs: parsed.total_hairs,
      note: parsed.note,
      actorFiUserId,
    });
    revalidateSurgeryOsPaths(tenantId);
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, error: errMsg(e) };
  }
}

export async function reconcileGraftsAction(tenantId: string, input: z.infer<typeof reconcileGraftsSchema>) {
  try {
    const parsed = reconcileGraftsSchema.parse(input);
    const { actorFiUserId } = await assertSurgeryOsMutationAllowed(tenantId, "reconcile_grafts", parsed.adminKey);
    const data = await reconcileGrafts({
      tenantId,
      surgeryId: parsed.surgery_id,
      note: parsed.note,
      actorFiUserId,
      allowAdminOverride: Boolean(parsed.adminKey?.trim()),
    });
    revalidateSurgeryOsPaths(tenantId);
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, error: errMsg(e) };
  }
}

export async function confirmTrayGraftCountAction(
  tenantId: string,
  input: z.infer<typeof confirmTrayCountSchema>,
) {
  try {
    const parsed = confirmTrayCountSchema.parse(input);
    const { actorFiUserId } = await assertSurgeryOsMutationAllowed(tenantId, "confirm_tray_count", parsed.adminKey);
    const data = await confirmTrayGraftCount({
      tenantId,
      surgeryId: parsed.surgery_id,
      trayEventId: parsed.tray_event_id,
      approved: parsed.approved,
      note: parsed.note,
      actorFiUserId,
      ...graftMutationOptions(parsed),
    });
    revalidateSurgeryOsPaths(tenantId);
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, error: errMsg(e) };
  }
}

export { SURGERY_OS_MAJOR_PHASES, SURGERY_OS_LOGGABLE_EVENT_KINDS };
