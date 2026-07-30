/**
 * FI-CONTROLLED-PILOT-ACTIVATION-1B — pathway event hooks (server).
 * Resolves pilot programme/enrolment for a patient and emits best-effort.
 * No-ops when the patient is not enrolled (current planned programme has zero enrolments).
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  loadPilotEnrolmentForPatient,
  loadPilotProgrammeForTenant,
} from "../pilotCohortQuery.server";
import {
  emitPilotPathwayEventBestEffort,
  type EmitPilotPathwayEventResult,
} from "./emitDomainEvent.server";
import type {
  PilotControlDomainEventActorType,
  PilotControlEvidenceClass,
} from "./domainEvents";

export async function emitPathwayEventForPatientBestEffort(args: {
  tenantId: string;
  patientId: string;
  eventType: string;
  idempotencyKey: string;
  sourceModule: string;
  sourceRecordId?: string;
  actorType?: PilotControlDomainEventActorType;
  actorId?: string;
  actorRole?: string;
  correlationId?: string;
  evidenceClass?: PilotControlEvidenceClass;
  payload?: Record<string, unknown>;
  humanInviteGateComplete?: boolean;
  automaticPolling?: boolean;
  supabase?: SupabaseClient;
}): Promise<EmitPilotPathwayEventResult> {
  try {
    const programme = await loadPilotProgrammeForTenant(
      { tenantId: args.tenantId },
      { supabase: args.supabase }
    );
    if (!programme) {
      return { emitted: false, reason: "no_programme" };
    }

    const enrolmentResult = await loadPilotEnrolmentForPatient(
      {
        tenantId: args.tenantId,
        programmeId: programme.id,
        patientId: args.patientId,
      },
      { supabase: args.supabase }
    ).catch(() => null);

    const enrolment =
      enrolmentResult && enrolmentResult.ok ? enrolmentResult.enrolment : null;

    // Emit for enrolled patients; also allow synthetic/staff_test without enrolment
    // when evidenceClass is non-live (service-level proof).
    const evidenceClass = args.evidenceClass ?? "live_patient";
    if (!enrolment && evidenceClass === "live_patient") {
      return { emitted: false, reason: "patient_not_enrolled" };
    }

    return emitPilotPathwayEventBestEffort({
      eventType: args.eventType,
      tenantId: args.tenantId,
      programmeId: programme.id,
      enrolmentId: enrolment?.id,
      patientId: args.patientId,
      actorType: args.actorType ?? "system",
      actorId: args.actorId,
      actorRole: args.actorRole,
      sourceModule: args.sourceModule,
      sourceRecordId: args.sourceRecordId,
      idempotencyKey: args.idempotencyKey,
      evidenceClass,
      correlationId: args.correlationId,
      humanInviteGateComplete: args.humanInviteGateComplete,
      automaticPolling: args.automaticPolling,
      payload: args.payload,
      supabase: args.supabase,
    });
  } catch (err) {
    console.error(
      "pathway_event_hook_failed",
      err instanceof Error ? err.message.slice(0, 200) : "unknown"
    );
    return { emitted: false, reason: "hook_failed", writeFailed: true };
  }
}
