import "server-only";

import { publishAnalyticsEvent } from "@/src/lib/analytics-os/analyticsEventCore";
import type { AcademyAnalyticsEventType } from "@/src/lib/analytics-os/analyticsEventTypes";

import type { FiStaffCompetencyProjectionRow } from "./academyCompetencyTypes";
import type { FiStaffProcedurePrivilegeRow } from "./procedurePrivilegeTypes";

export async function publishAcademyEvent(input: {
  eventType: AcademyAnalyticsEventType;
  tenantId: string;
  staffId: string;
  entityId?: string | null;
  eventMetadata?: Record<string, unknown>;
  occurredAt?: string;
}): Promise<void> {
  try {
    await publishAnalyticsEvent({
      tenantId: input.tenantId,
      moduleName: "academy_os",
      eventType: input.eventType,
      entityId: input.staffId,
      entityType: "staff",
      eventMetadata: {
        ...(input.eventMetadata ?? {}),
        ...(input.entityId ? { competency_projection_id: input.entityId } : {}),
      },
      occurredAt: input.occurredAt,
    });
  } catch {
    // Non-blocking — analytics must not fail competency ingest.
  }
}

function eventTypeForProjection(row: FiStaffCompetencyProjectionRow): AcademyAnalyticsEventType | null {
  switch (row.competencyStatus) {
    case "active":
      return row.certificationLevel ? "certification_verified" : "competency_verified";
    case "expired":
      return "competency_expired";
    case "restricted":
    case "suspended":
      return "competency_restricted";
    case "expiring":
      return row.certificationLevel ? "certification_verified" : "competency_verified";
    default:
      return null;
  }
}

/** Publishes non-blocking AnalyticsOS events for processed competency projections. */
export async function publishAcademyCompetencyAnalytics(input: {
  tenantId: string;
  staffId: string;
  projections: FiStaffCompetencyProjectionRow[];
  exportEventId: string;
}): Promise<void> {
  const occurredAt = new Date().toISOString();

  for (const projection of input.projections) {
    const eventType = eventTypeForProjection(projection);
    if (!eventType) continue;

    await publishAcademyEvent({
      eventType,
      tenantId: input.tenantId,
      staffId: input.staffId,
      entityId: projection.id,
      occurredAt,
      eventMetadata: {
        export_event_id: input.exportEventId,
        competency_key: projection.competencyKey,
        competency_status: projection.competencyStatus,
        readiness_band: projection.readinessBand,
        certification_level: projection.certificationLevel,
      },
    });
  }
}

export async function publishAcademyProcedurePrivilegeEvent(input: {
  eventType: Extract<
    AcademyAnalyticsEventType,
    | "procedure_privilege_granted"
    | "procedure_privilege_suspended"
    | "procedure_privilege_revoked"
    | "procedure_privilege_expired"
    | "privilege_requirement_missing"
  >;
  tenantId: string;
  staffId: string;
  privilege: FiStaffProcedurePrivilegeRow | null;
  reason?: string | null;
  eventMetadata?: Record<string, unknown>;
  occurredAt?: string;
}): Promise<void> {
  try {
    await publishAnalyticsEvent({
      tenantId: input.tenantId,
      moduleName: "academy_os",
      eventType: input.eventType,
      entityId: input.staffId,
      entityType: "staff",
      eventMetadata: {
        ...(input.eventMetadata ?? {}),
        ...(input.privilege
          ? {
              procedure_privilege_id: input.privilege.id,
              procedure_key: input.privilege.procedureKey,
              privilege_level: input.privilege.privilegeLevel,
              privilege_status: input.privilege.privilegeStatus,
              clinic_id: input.privilege.clinicId,
              source_projection_id: input.privilege.sourceProjectionId,
            }
          : {}),
        ...(input.reason ? { reason: input.reason } : {}),
      },
      occurredAt: input.occurredAt,
    });
  } catch {
    // Non-blocking — analytics must not fail privilege operations.
  }
}
