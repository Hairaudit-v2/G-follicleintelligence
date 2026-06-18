/**
 * GET/POST /api/tenants/[tenantId]/surgery-os
 * SurgeryOS command centre payload (GET) and live capture mutations (POST).
 */
import { z } from "zod";

import { assertCrmTenantReadAllowed } from "@/src/lib/crm/crmGate";
import { crmJsonOk, crmJsonError, extractAdminKeyFromRequest, mapCrmRouteError } from "@/src/lib/crm/crmHttp";
import { resolveSurgeryOsViewerContext } from "@/src/lib/surgeryOs/surgeryOsAccess.server";
import { loadSurgeryOsCommandCentrePayload } from "@/src/lib/surgeryOs/surgeryOsCommandCentreLoader.server";
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

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    if (!tenantId?.trim()) return crmJsonError(400, "Missing tenantId.");

    const adminKey = extractAdminKeyFromRequest(req);
    await assertCrmTenantReadAllowed({ tenantId, adminKey, request: req });

    const viewer = await resolveSurgeryOsViewerContext(tenantId.trim());
    if (!viewer.canAccessSurgeryOs) {
      return crmJsonError(403, "SurgeryOS access requires an active staff or CRM shell role for this tenant.");
    }

    const data = await loadSurgeryOsCommandCentrePayload(tenantId.trim(), new Date());
    return crmJsonOk({ data });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create_from_booking"),
    booking_id: z.string().uuid(),
  }),
  z.object({
    action: z.literal("transition_phase"),
    surgery_id: z.string().uuid(),
    to_phase: z.enum(SURGERY_OS_MAJOR_PHASES),
  }),
  z.object({
    action: z.literal("log_event"),
    surgery_id: z.string().uuid(),
    event_kind: z.enum(SURGERY_OS_LOGGABLE_EVENT_KINDS),
    custom_label: z.string().max(200).optional().nullable(),
    custom_body: z.string().max(2000).optional().nullable(),
    occurred_at: z.string().optional().nullable(),
  }),
  z.object({
    action: z.literal("add_note"),
    surgery_id: z.string().uuid(),
    note_kind: z.enum(SURGERY_OS_NOTE_KINDS),
    body: z.string().min(1).max(4000),
    severity: z.enum(SURGERY_OS_SEVERITIES).optional(),
  }),
  z.object({
    action: z.literal("update_team_status"),
    assignment_id: z.string().uuid(),
    assignment_fi_user_id: z.string().uuid(),
    status: z.enum(SURGERY_OS_ASSIGNMENT_STATUSES),
  }),
  z.object({
    action: z.literal("add_extraction_count"),
    surgery_id: z.string().uuid(),
    count: z.number().int().positive(),
    graft_type: z.enum(SURGERY_OS_GRAFT_TYPES).optional().nullable(),
    note: z.string().max(2000).optional().nullable(),
  }),
  z.object({
    action: z.literal("add_implantation_count"),
    surgery_id: z.string().uuid(),
    count: z.number().int().positive(),
    graft_type: z.enum(SURGERY_OS_GRAFT_TYPES).optional().nullable(),
    note: z.string().max(2000).optional().nullable(),
  }),
  z.object({
    action: z.literal("enter_tray_count"),
    surgery_id: z.string().uuid(),
    tray_number: z.number().int().positive().optional().nullable(),
    singles: z.number().int().min(0),
    doubles: z.number().int().min(0),
    triples: z.number().int().min(0),
    multiples: z.number().int().min(0),
    damaged: z.number().int().min(0).optional(),
    total_hairs: z.number().int().min(0).optional().nullable(),
    note: z.string().max(2000).optional().nullable(),
  }),
  z.object({
    action: z.literal("log_discarded_grafts"),
    surgery_id: z.string().uuid(),
    count: z.number().int().positive(),
    note: z.string().max(2000).optional().nullable(),
  }),
  z.object({
    action: z.literal("correct_graft_count"),
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
  }),
  z.object({
    action: z.literal("reconcile_grafts"),
    surgery_id: z.string().uuid(),
    note: z.string().max(2000).optional().nullable(),
  }),
  z.object({
    action: z.literal("confirm_tray_count"),
    surgery_id: z.string().uuid(),
    tray_event_id: z.string().uuid(),
    approved: z.boolean(),
    note: z.string().max(2000).optional().nullable(),
  }),
]);

export async function POST(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    if (!tenantId?.trim()) return crmJsonError(400, "Missing tenantId.");

    const adminKey = extractAdminKeyFromRequest(req);
    await assertCrmTenantReadAllowed({ tenantId, adminKey, request: req });

    const raw = await req.json();
    const body = bodySchema.parse(raw);

    switch (body.action) {
      case "create_from_booking": {
        const { actorFiUserId } = await assertSurgeryOsMutationAllowed(tenantId.trim(), "create_from_booking", adminKey);
        const result = await createSurgeryFromBooking({
          tenantId: tenantId.trim(),
          bookingId: body.booking_id,
          actorFiUserId,
        });
        return crmJsonOk({ data: result });
      }
      case "transition_phase": {
        const { actorFiUserId } = await assertSurgeryOsMutationAllowed(tenantId.trim(), "transition_phase", adminKey);
        const result = await transitionSurgeryPhase({
          tenantId: tenantId.trim(),
          surgeryId: body.surgery_id,
          toPhase: body.to_phase,
          actorFiUserId,
        });
        return crmJsonOk({ data: result });
      }
      case "log_event": {
        const { actorFiUserId } = await assertSurgeryOsMutationAllowed(tenantId.trim(), "log_event", adminKey);
        const result = await logSurgeryProcedureEvent({
          tenantId: tenantId.trim(),
          surgeryId: body.surgery_id,
          eventKind: body.event_kind,
          actorFiUserId,
          customLabel: body.custom_label,
          customBody: body.custom_body,
          occurredAt: body.occurred_at,
        });
        return crmJsonOk({ data: result });
      }
      case "add_note": {
        const { actorFiUserId } = await assertSurgeryOsNoteMutationAllowed(
          tenantId.trim(),
          body.note_kind,
          adminKey,
        );
        const note = await addSurgeryOperationalNote({
          tenantId: tenantId.trim(),
          surgeryId: body.surgery_id,
          noteKind: body.note_kind,
          body: body.body,
          severity: body.severity,
          actorFiUserId,
        });
        return crmJsonOk({ data: { note } });
      }
      case "update_team_status": {
        const { actorFiUserId } = await assertSurgeryOsTeamStatusMutationAllowed(
          tenantId.trim(),
          body.assignment_fi_user_id,
          adminKey,
        );
        const assignment = await updateSurgeryTeamStatus({
          tenantId: tenantId.trim(),
          assignmentId: body.assignment_id,
          status: body.status,
          actorFiUserId,
        });
        return crmJsonOk({ data: { assignment } });
      }
      case "add_extraction_count": {
        const { actorFiUserId } = await assertSurgeryOsMutationAllowed(tenantId.trim(), "add_extraction_count", adminKey);
        const result = await addExtractionGraftCount({
          tenantId: tenantId.trim(),
          surgeryId: body.surgery_id,
          count: body.count,
          graftType: body.graft_type,
          note: body.note,
          actorFiUserId,
        });
        return crmJsonOk({ data: result });
      }
      case "add_implantation_count": {
        const { actorFiUserId } = await assertSurgeryOsMutationAllowed(tenantId.trim(), "add_implantation_count", adminKey);
        const result = await addImplantationGraftCount({
          tenantId: tenantId.trim(),
          surgeryId: body.surgery_id,
          count: body.count,
          graftType: body.graft_type,
          note: body.note,
          actorFiUserId,
        });
        return crmJsonOk({ data: result });
      }
      case "enter_tray_count": {
        const { actorFiUserId } = await assertSurgeryOsMutationAllowed(tenantId.trim(), "enter_tray_count", adminKey);
        const result = await enterTrayGraftCount({
          tenantId: tenantId.trim(),
          surgeryId: body.surgery_id,
          trayNumber: body.tray_number,
          singles: body.singles,
          doubles: body.doubles,
          triples: body.triples,
          multiples: body.multiples,
          damaged: body.damaged,
          totalHairs: body.total_hairs,
          note: body.note,
          actorFiUserId,
        });
        return crmJsonOk({ data: result });
      }
      case "log_discarded_grafts": {
        const { actorFiUserId } = await assertSurgeryOsMutationAllowed(tenantId.trim(), "log_discarded_grafts", adminKey);
        const result = await logDiscardedGrafts({
          tenantId: tenantId.trim(),
          surgeryId: body.surgery_id,
          count: body.count,
          note: body.note,
          actorFiUserId,
        });
        return crmJsonOk({ data: result });
      }
      case "correct_graft_count": {
        const { actorFiUserId } = await assertSurgeryOsMutationAllowed(tenantId.trim(), "correct_graft_count", adminKey);
        const result = await correctGraftCount({
          tenantId: tenantId.trim(),
          surgeryId: body.surgery_id,
          extracted: body.extracted,
          implanted: body.implanted,
          discarded: body.discarded,
          singles: body.singles,
          doubles: body.doubles,
          triples: body.triples,
          multiples: body.multiples,
          totalHairs: body.total_hairs,
          note: body.note,
          actorFiUserId,
        });
        return crmJsonOk({ data: result });
      }
      case "reconcile_grafts": {
        const { actorFiUserId } = await assertSurgeryOsMutationAllowed(tenantId.trim(), "reconcile_grafts", adminKey);
        const result = await reconcileGrafts({
          tenantId: tenantId.trim(),
          surgeryId: body.surgery_id,
          note: body.note,
          actorFiUserId,
        });
        return crmJsonOk({ data: result });
      }
      case "confirm_tray_count": {
        const { actorFiUserId } = await assertSurgeryOsMutationAllowed(tenantId.trim(), "confirm_tray_count", adminKey);
        const result = await confirmTrayGraftCount({
          tenantId: tenantId.trim(),
          surgeryId: body.surgery_id,
          trayEventId: body.tray_event_id,
          approved: body.approved,
          note: body.note,
          actorFiUserId,
        });
        return crmJsonOk({ data: result });
      }
    }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return crmJsonError(400, e.errors[0]?.message ?? "Invalid request body.");
    }
    return mapCrmRouteError(e);
  }
}
