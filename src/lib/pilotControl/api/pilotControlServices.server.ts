/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.4 — route service assemblers (server).
 * Consume readiness/blocker/health engines — do not recalculate domain logic.
 */
import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { computeActivationRate, countEnrolmentsByStatus } from "../pilotEnrolmentCore";
import {
  loadPilotEnrolmentForPatient,
  loadPilotEnrolmentsForTenant,
  loadPilotProgrammeByIdOrKey,
  loadPilotProgrammesForTenant,
} from "../pilotCohortQuery.server";
import { evaluatePilotPatientReadiness } from "../readiness/evaluatePilotPatientReadiness.server";
import { evaluatePilotPatientBlockers } from "../blockers/evaluatePilotPatientBlockers.server";
import { buildPilotBlockerHealthInput } from "../blockers/blockerHealthInput";
import type { OverallReadinessState, PilotEnrolmentStatus } from "../pilotControlContracts";
import { PilotControlApiError } from "./pilotControlApiErrors";
import {
  buildEvaluationMetadata,
  buildResponseMeta,
  wrapPilotControlPaginatedResponse,
  wrapPilotControlResponse,
} from "./pilotControlEnvelope";
import {
  buildPagination,
  compareBlockersBySeverityThenAge,
  parseAllowlistedSort,
  parseBoundedDateRange,
  parsePagination,
  parseSearch,
  parseSortDirection,
  PILOT_BLOCKER_SORTS,
  PILOT_PATIENT_REGISTER_SORTS,
} from "./pilotControlPagination";
import {
  canExportPilotControl,
  canSeePilotPauseRecommendation,
  roleHasApiPermission,
} from "./pilotControlPermissions";
import {
  serializeActivityItem,
  serializeBlockerListItem,
  serializePatientDetail,
  serializeProgrammeSummary,
  sortAndSerializeBlockers,
} from "./pilotControlSerializers";
import {
  assemblePilotControlHealth,
  mapHealthVerdictForPauseVisibility,
} from "./assemblePilotHealth";
import {
  loadActiveProgrammeBlockers,
  queryPilotBlockersForProgramme,
} from "./queryPilotBlockers.server";
import {
  queryPilotControlActivity,
  recordPilotControlAuditEvent,
} from "./pilotControlActivity.server";
import { checkPilotControlExportRateLimit } from "./pilotControlRateLimit";
import {
  clampExportRows,
  parseExportFormat,
  parseExportType,
  rowsToCsv,
  safeExportFilename,
} from "./pilotControlExportSafety";
import type {
  PilotControlRequestContext,
  PilotPatientRegisterRow,
} from "./pilotControlApiTypes";
import { withPilotControlEvaluationGuard } from "./resolvePilotControlRequestContext.server";

async function loadPatientDisplayNames(
  tenantId: string,
  patientIds: string[]
): Promise<Map<string, { displayName: string; reference?: string }>> {
  const map = new Map<string, { displayName: string; reference?: string }>();
  const ids = [...new Set(patientIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return map;
  const supabase = supabaseAdmin();

  const { data: patients } = await supabase
    .from("fi_patients")
    .select("id, person_id, metadata")
    .eq("tenant_id", tenantId)
    .in("id", ids.slice(0, 200));

  const personIds = [
    ...new Set(
      (patients ?? [])
        .map((p) => (p as { person_id?: string | null }).person_id)
        .filter((id): id is string => Boolean(id?.trim()))
    ),
  ];

  const personNames = new Map<string, string>();
  if (personIds.length > 0) {
    const { data: people } = await supabase
      .from("fi_persons")
      .select("id, metadata")
      .in("id", personIds);
    for (const row of people ?? []) {
      const r = row as { id: string; metadata?: unknown };
      const meta =
        r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
          ? (r.metadata as Record<string, unknown>)
          : {};
      const name =
        typeof meta.display_name === "string"
          ? meta.display_name
          : typeof meta.preferred_name === "string"
            ? meta.preferred_name
            : typeof meta.full_name === "string"
              ? meta.full_name
              : "Patient";
      personNames.set(String(r.id), name);
    }
  }

  for (const row of patients ?? []) {
    const r = row as { id: string; person_id?: string | null; metadata?: unknown };
    const fromPerson = r.person_id ? personNames.get(String(r.person_id)) : undefined;
    const meta =
      r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
        ? (r.metadata as Record<string, unknown>)
        : {};
    const fromMeta =
      typeof meta.display_name === "string"
        ? meta.display_name
        : typeof meta.preferred_name === "string"
          ? meta.preferred_name
          : undefined;
    map.set(String(r.id), {
      displayName: fromPerson || fromMeta || "Patient",
    });
  }
  return map;
}

export async function assembleProgrammesResponse(ctx: PilotControlRequestContext) {
  if (!roleHasApiPermission(ctx.actorRole, "pilot_control.programmes.read")) {
    throw new PilotControlApiError(
      "PILOT_CONTROL_FORBIDDEN",
      "Not authorized to list programmes.",
      403,
      ctx.correlationId
    );
  }

  const programmes = await loadPilotProgrammesForTenant({ tenantId: ctx.tenantId });
  const data = [];
  for (const p of programmes) {
    const enrolments = await loadPilotEnrolmentsForTenant(
      { tenantId: ctx.tenantId, programmeId: p.id },
      { includeHistorical: true }
    );
    data.push(
      serializeProgrammeSummary({
        id: p.id,
        key: p.programmeKey,
        name: p.displayName,
        status: p.status,
        enrolments,
      })
    );
  }

  return wrapPilotControlResponse(
    data,
    buildResponseMeta({
      programmeId: ctx.programmeId || programmes[0]?.id || "",
      tenantId: ctx.tenantId,
      correlationId: ctx.correlationId,
      generatedAt: ctx.requestedAt,
      evaluation: buildEvaluationMetadata({
        evaluatedAt: ctx.requestedAt,
        blockerPersistenceMode: "read_only",
      }),
    })
  );
}

export async function assembleOverviewResponse(ctx: PilotControlRequestContext) {
  if (!roleHasApiPermission(ctx.actorRole, "pilot_control.overview.read")) {
    throw new PilotControlApiError(
      "PILOT_CONTROL_FORBIDDEN",
      "Not authorized to view programme overview.",
      403,
      ctx.correlationId
    );
  }

  const programme = await loadPilotProgrammeByIdOrKey({
    tenantId: ctx.tenantId,
    programmeIdOrKey: ctx.programmeId,
  });
  if (!programme) {
    throw new PilotControlApiError(
      "PILOT_CONTROL_PROGRAMME_NOT_FOUND",
      "Programme not found.",
      404,
      ctx.correlationId
    );
  }

  const enrolments = await loadPilotEnrolmentsForTenant(
    { tenantId: ctx.tenantId, programmeId: programme.id },
    { includeHistorical: true }
  );
  const counts = countEnrolmentsByStatus(enrolments);
  const blockers = await loadActiveProgrammeBlockers({
    tenantId: ctx.tenantId,
    programmeId: programme.id,
  });
  const blockerHealth = buildPilotBlockerHealthInput(blockers);
  const health = mapHealthVerdictForPauseVisibility(
    assemblePilotControlHealth({
      programmeStatus: programme.status,
      enrolments,
      blockers,
      evaluatedAt: ctx.requestedAt,
    }),
    canSeePilotPauseRecommendation(ctx.actorRole)
  );

  const programmeSummary = serializeProgrammeSummary({
    id: programme.id,
    key: programme.programmeKey,
    name: programme.displayName,
    status: programme.status,
    enrolments,
    lastEvaluatedAt: ctx.requestedAt,
  });

  const activationRate = computeActivationRate({
    invited: counts.invited,
    activated: counts.activated,
    active: counts.active,
  });

  const urgentItems = [...blockers]
    .filter((b) => b.severity === "critical" || b.severity === "high")
    .sort(compareBlockersBySeverityThenAge)
    .slice(0, 10)
    .map((b) => ({
      kind: "blocker" as const,
      severity: b.severity,
      title: b.title,
      patientId: b.patientId,
      enrolmentId: b.enrolmentId,
      recommendedNextAction: b.recommendedNextAction,
    }));

  const overview = {
    programme: programmeSummary,
    cohort: {
      totalApproved:
        counts.approved +
        counts.invited +
        counts.activated +
        counts.active +
        counts.paused +
        counts.completed,
      invited: counts.invited,
      activated: counts.activated,
      active: counts.active,
      paused: counts.paused,
      completed: counts.completed,
      withdrawn: counts.withdrawn,
    },
    readiness: {
      notStarted: 0,
      inProgress: 0,
      attentionRequired: 0,
      blocked: blockerHealth.openBySeverity.critical + blockerHealth.openBySeverity.high,
      ready: 0,
      completed: counts.completed,
    },
    blockers: blockerHealth,
    actions: {
      patientOwnedOpen: blockers.filter((b) => b.ownership.ownerType === "patient").length,
      clinicOwnedOpen: blockers.filter(
        (b) => b.ownership.ownerType !== "patient" && b.ownership.ownerType !== "unassigned"
      ).length,
      unassignedOpen: blockers.filter((b) => b.ownership.ownerType === "unassigned").length,
      overduePatient: blockerHealth.overduePatientActions,
      overdueClinic: blockerHealth.overdueClinicActions,
    },
    app: {
      invited: counts.invited,
      activated: counts.activated + counts.active,
      activationRate,
      inactivePatients: 0,
      pushAvailable: 0,
      pushUnavailable: 0,
    },
    health: {
      verdict: health.verdict,
      score: health.score ?? 0,
      reasons:
        health.expansionRecommendation === "insufficient_evidence"
          ? ["No real pilot enrolments or live patient activity"]
          : [],
      criticalFailClosed: health.verdict === "RED",
      expansionRecommendation: health.expansionRecommendation,
      ruleVersion: health.ruleVersion,
    },
    urgentItems,
    ...(canSeePilotPauseRecommendation(ctx.actorRole)
      ? {
          pauseRecommendation: {
            requiresPilotPause: blockerHealth.blockersRequiringPilotPause > 0,
            blockersRequiringPilotPause: blockerHealth.blockersRequiringPilotPause,
          },
        }
      : {}),
    generatedAt: ctx.requestedAt,
  };

  if (!ctx.isAutomaticRefresh) {
    await recordPilotControlAuditEvent({
      tenantId: ctx.tenantId,
      programmeId: programme.id,
      eventKind: "pilot_control_overview_viewed",
      actorType: "staff",
      actorId: ctx.fiUserId,
      correlationId: ctx.correlationId,
      payload: { route: "overview" },
    });
  }

  return wrapPilotControlResponse(
    overview,
    buildResponseMeta({
      programmeId: programme.id,
      tenantId: ctx.tenantId,
      correlationId: ctx.correlationId,
      generatedAt: ctx.requestedAt,
      evaluation: buildEvaluationMetadata({
        evaluatedAt: ctx.requestedAt,
        blockerPersistenceMode: "read_only",
      }),
    })
  );
}

export async function assemblePatientRegisterResponse(
  ctx: PilotControlRequestContext,
  searchParams: URLSearchParams
) {
  if (!roleHasApiPermission(ctx.actorRole, "pilot_control.patient_register.read")) {
    throw new PilotControlApiError(
      "PILOT_CONTROL_FORBIDDEN",
      "Not authorized to view the patient register.",
      403,
      ctx.correlationId
    );
  }

  const { page, pageSize } = parsePagination(
    {
      page: searchParams.get("page"),
      pageSize: searchParams.get("pageSize"),
    },
    ctx.correlationId,
    { required: true }
  );
  const sort = parseAllowlistedSort(
    searchParams.get("sort"),
    PILOT_PATIENT_REGISTER_SORTS,
    "updated_at",
    ctx.correlationId
  );
  const direction = parseSortDirection(searchParams.get("direction"), ctx.correlationId, "desc");
  const search = parseSearch(searchParams.get("search"), ctx.correlationId);
  const statusFilter = searchParams.get("status")?.trim() as PilotEnrolmentStatus | undefined;

  let enrolments = await loadPilotEnrolmentsForTenant(
    { tenantId: ctx.tenantId, programmeId: ctx.programmeId },
    { includeHistorical: true }
  );

  if (statusFilter) {
    enrolments = enrolments.filter((e) => e.enrolmentStatus === statusFilter);
  }

  const clinicFilter = searchParams.get("clinicId")?.trim();
  if (
    ctx.clinicId &&
    clinicFilter &&
    clinicFilter !== ctx.clinicId &&
    ctx.actorRole === "clinic_manager"
  ) {
    throw new PilotControlApiError(
      "PILOT_CONTROL_FORBIDDEN",
      "Clinic scope mismatch.",
      403,
      ctx.correlationId
    );
  }

  const names = await loadPatientDisplayNames(
    ctx.tenantId,
    enrolments.map((e) => e.patientId)
  );

  if (search) {
    const q = search.toLowerCase();
    enrolments = enrolments.filter((e) => {
      const n = names.get(e.patientId);
      return (
        n?.displayName.toLowerCase().includes(q) ||
        n?.reference?.toLowerCase().includes(q) ||
        e.patientId.toLowerCase().includes(q)
      );
    });
  }

  enrolments = [...enrolments].sort((a, b) => {
    let cmp = 0;
    if (sort === "display_name") {
      cmp = (names.get(a.patientId)?.displayName ?? "").localeCompare(
        names.get(b.patientId)?.displayName ?? ""
      );
    } else if (sort === "pilot_status") {
      cmp = a.enrolmentStatus.localeCompare(b.enrolmentStatus);
    } else {
      cmp = a.updatedAt.localeCompare(b.updatedAt);
    }
    return direction === "asc" ? cmp : -cmp;
  });

  const total = enrolments.length;
  const pageRows = enrolments.slice((page - 1) * pageSize, page * pageSize);

  const pageBlockers = await loadActiveProgrammeBlockers({
    tenantId: ctx.tenantId,
    programmeId: ctx.programmeId,
    limit: 500,
  });
  const blockersByEnrolment = new Map<string, typeof pageBlockers>();
  for (const b of pageBlockers) {
    const list = blockersByEnrolment.get(b.enrolmentId) ?? [];
    list.push(b);
    blockersByEnrolment.set(b.enrolmentId, list);
  }

  const rows: PilotPatientRegisterRow[] = pageRows.map((e) => {
    const blockers = (blockersByEnrolment.get(e.id) ?? []).sort(compareBlockersBySeverityThenAge);
    const primary = blockers[0];
    return {
      enrolmentId: e.id,
      patientId: e.patientId,
      patient: {
        displayName: names.get(e.patientId)?.displayName ?? "Patient",
        reference: names.get(e.patientId)?.reference,
      },
      clinic: { id: ctx.clinicId },
      pilotStatus: e.enrolmentStatus,
      journey: { milestone: "unknown", milestoneLabel: "Unknown" },
      readiness: {
        clinical: "unknown",
        financial: "unknown",
        patient: "unknown",
        operational: "unknown",
        technical: "unknown",
        overall: "not_started" as OverallReadinessState,
      },
      nextActions: {},
      blockerSummary: {
        totalOpen: blockers.length,
        highestSeverity: primary?.severity,
        primaryBlocker: primary
          ? {
              id: primary.fingerprint,
              category: primary.category,
              title: primary.title,
              severity: primary.severity,
              state: primary.state,
            }
          : undefined,
      },
      app: {
        invitationState: e.invitedAt ? "invited" : "not_invited",
        activationState:
          e.activatedAt || e.enrolmentStatus === "active" ? "activated" : "not_activated",
      },
      ownership: {
        operationalOwnerType: e.operationalOwnerRole ?? undefined,
      },
      activity: {},
      evaluatedAt: ctx.requestedAt,
    };
  });

  if (ctx.actorRole === "reception") {
    for (const row of rows) row.readiness.clinical = "redacted";
  }
  if (
    (ctx.actorRole === "clinical" || ctx.actorRole === "technical") &&
    !roleHasApiPermission(ctx.actorRole, "pilot_control.financial_summary.read")
  ) {
    for (const row of rows) row.readiness.financial = "redacted";
  }

  if (!ctx.isAutomaticRefresh) {
    await recordPilotControlAuditEvent({
      tenantId: ctx.tenantId,
      programmeId: ctx.programmeId,
      eventKind: "pilot_control_patient_register_viewed",
      actorType: "staff",
      actorId: ctx.fiUserId,
      correlationId: ctx.correlationId,
      payload: { page, pageSize, total },
    });
  }

  return wrapPilotControlPaginatedResponse(
    rows,
    buildPagination({ page, pageSize, total }),
    buildResponseMeta({
      programmeId: ctx.programmeId,
      tenantId: ctx.tenantId,
      correlationId: ctx.correlationId,
      generatedAt: ctx.requestedAt,
      evaluation: buildEvaluationMetadata({
        evaluatedAt: ctx.requestedAt,
        blockerPersistenceMode: "read_only",
      }),
    })
  );
}

export async function assemblePatientDetailResponse(
  ctx: PilotControlRequestContext,
  patientId: string
) {
  if (!roleHasApiPermission(ctx.actorRole, "pilot_control.patient_detail.read")) {
    throw new PilotControlApiError(
      "PILOT_CONTROL_FORBIDDEN",
      "Not authorized to view patient detail.",
      403,
      ctx.correlationId
    );
  }

  return withPilotControlEvaluationGuard(`user:${ctx.actorId}`, ctx.correlationId, async () => {
    const membership = await loadPilotEnrolmentForPatient({
      tenantId: ctx.tenantId,
      patientId,
      programmeId: ctx.programmeId,
    });

    if (!membership.ok) {
      throw new PilotControlApiError(
        membership.code === "ambiguous_enrolment"
          ? "PILOT_CONTROL_IDENTITY_AMBIGUOUS"
          : "PILOT_CONTROL_PATIENT_NOT_ENROLLED",
        membership.code === "ambiguous_enrolment"
          ? "Patient pilot membership could not be resolved safely."
          : "Patient is not enrolled in this pilot programme.",
        membership.code === "ambiguous_enrolment" ? 409 : 404,
        ctx.correlationId
      );
    }

    const enrolment = membership.enrolment;
    const [readiness, blockerEval] = await Promise.all([
      evaluatePilotPatientReadiness({
        tenantId: ctx.tenantId,
        programmeId: ctx.programmeId,
        patientId,
      }),
      evaluatePilotPatientBlockers({
        tenantId: ctx.tenantId,
        programmeId: ctx.programmeId,
        patientId,
        persistDerivedState: false,
      }),
    ]);

    if ("enrolled" in blockerEval && blockerEval.enrolled === false) {
      throw new PilotControlApiError(
        "PILOT_CONTROL_PATIENT_NOT_ENROLLED",
        "Patient is not enrolled in this pilot programme.",
        404,
        ctx.correlationId
      );
    }

    const blockers =
      "activeBlockers" in blockerEval ? blockerEval.activeBlockers : [];

    const names = await loadPatientDisplayNames(ctx.tenantId, [patientId]);
    const detail = serializePatientDetail({
      role: ctx.actorRole,
      tenantId: ctx.tenantId,
      patientId,
      displayName: names.get(patientId)?.displayName ?? "Patient",
      reference: names.get(patientId)?.reference,
      enrolment: {
        enrolmentId: enrolment.id,
        status: enrolment.enrolmentStatus,
        enrolledAt: enrolment.enrolledAt,
        invitedAt: enrolment.invitedAt,
        activatedAt: enrolment.activatedAt,
      },
      readiness,
      blockers,
      evaluatedAt: readiness.evaluatedAt,
    });

    if (!ctx.isAutomaticRefresh) {
      await recordPilotControlAuditEvent({
        tenantId: ctx.tenantId,
        programmeId: ctx.programmeId,
        patientId,
        enrolmentId: enrolment.id,
        eventKind: "pilot_control_patient_detail_viewed",
        actorType: "staff",
        actorId: ctx.fiUserId,
        correlationId: ctx.correlationId,
        payload: { route: "patient_detail" },
      });
    }

    const warnings =
      readiness.warnings?.map((w) => ({
        code: w.code,
        message: w.patientSafeSummary,
        sourceCategory: w.sourceSystem,
      })) ?? [];

    return wrapPilotControlResponse(
      detail,
      buildResponseMeta({
        programmeId: ctx.programmeId,
        tenantId: ctx.tenantId,
        correlationId: ctx.correlationId,
        generatedAt: ctx.requestedAt,
        partial: warnings.length > 0,
        warnings,
        evaluation: buildEvaluationMetadata({
          evaluatedAt: readiness.evaluatedAt,
          blockerPersistenceMode: "read_only",
        }),
      })
    );
  });
}

export async function assembleBlockersResponse(
  ctx: PilotControlRequestContext,
  searchParams: URLSearchParams
) {
  if (!roleHasApiPermission(ctx.actorRole, "pilot_control.blockers.read")) {
    throw new PilotControlApiError(
      "PILOT_CONTROL_FORBIDDEN",
      "Not authorized to view blockers.",
      403,
      ctx.correlationId
    );
  }

  const { page, pageSize } = parsePagination(
    {
      page: searchParams.get("page"),
      pageSize: searchParams.get("pageSize"),
    },
    ctx.correlationId
  );

  const stateParam = searchParams.get("state");
  const filters = {
    patientId: searchParams.get("patientId")?.trim() || undefined,
    state: stateParam?.trim() || undefined,
    category: searchParams.get("category")?.trim() || undefined,
    dimension: searchParams.get("dimension")?.trim() || undefined,
    severity: searchParams.get("severity")?.trim() || undefined,
    ownerType: searchParams.get("ownerType")?.trim() || undefined,
    ownerUserId: searchParams.get("ownerUserId")?.trim() || undefined,
    escalated:
      searchParams.get("escalated") === "true"
        ? true
        : searchParams.get("escalated") === "false"
          ? false
          : undefined,
    requiresPilotPause:
      searchParams.get("requiresPilotPause") === "true" ? true : undefined,
    ageFrom: searchParams.get("ageFrom") ? Number(searchParams.get("ageFrom")) : undefined,
    ageTo: searchParams.get("ageTo") ? Number(searchParams.get("ageTo")) : undefined,
  };

  if (filters.requiresPilotPause && !canSeePilotPauseRecommendation(ctx.actorRole)) {
    throw new PilotControlApiError(
      "PILOT_CONTROL_FORBIDDEN",
      "Not authorized to filter pilot-pause recommendations.",
      403,
      ctx.correlationId
    );
  }

  const result = await queryPilotBlockersForProgramme({
    tenantId: ctx.tenantId,
    programmeId: ctx.programmeId,
    filters,
    page: 1,
    pageSize: 500,
  });

  let items = [...result.items].sort(compareBlockersBySeverityThenAge);
  const sort = parseAllowlistedSort(
    searchParams.get("sort"),
    PILOT_BLOCKER_SORTS,
    "severity",
    ctx.correlationId
  );
  const direction = parseSortDirection(searchParams.get("direction"), ctx.correlationId, "asc");
  if (sort === "age") {
    items.sort((a, b) =>
      direction === "asc" ? a.ageSeconds - b.ageSeconds : b.ageSeconds - a.ageSeconds
    );
  } else if (sort === "last_confirmed_at") {
    items.sort((a, b) => {
      const cmp = a.lastConfirmedAt.localeCompare(b.lastConfirmedAt);
      return direction === "asc" ? cmp : -cmp;
    });
  } else if (direction === "desc") {
    items = items.reverse();
  }

  const total = items.length;
  const pageItems = items.slice((page - 1) * pageSize, page * pageSize);
  const serialized = pageItems.map((b) =>
    serializeBlockerListItem(b, ctx.actorRole, { tenantId: ctx.tenantId })
  );

  if (!ctx.isAutomaticRefresh) {
    await recordPilotControlAuditEvent({
      tenantId: ctx.tenantId,
      programmeId: ctx.programmeId,
      eventKind: "pilot_control_blockers_viewed",
      actorType: "staff",
      actorId: ctx.fiUserId,
      correlationId: ctx.correlationId,
      payload: { total, defaultActive: !stateParam },
    });
  }

  return wrapPilotControlPaginatedResponse(
    serialized,
    buildPagination({ page, pageSize, total }),
    buildResponseMeta({
      programmeId: ctx.programmeId,
      tenantId: ctx.tenantId,
      correlationId: ctx.correlationId,
      generatedAt: ctx.requestedAt,
      evaluation: buildEvaluationMetadata({
        evaluatedAt: ctx.requestedAt,
        blockerPersistenceMode: "read_only",
      }),
    })
  );
}

export async function assembleActivityResponse(
  ctx: PilotControlRequestContext,
  searchParams: URLSearchParams
) {
  if (!roleHasApiPermission(ctx.actorRole, "pilot_control.activity.read")) {
    throw new PilotControlApiError(
      "PILOT_CONTROL_FORBIDDEN",
      "Not authorized to view activity.",
      403,
      ctx.correlationId
    );
  }

  const { page, pageSize } = parsePagination(
    {
      page: searchParams.get("page"),
      pageSize: searchParams.get("pageSize"),
    },
    ctx.correlationId
  );
  const range = parseBoundedDateRange(
    { from: searchParams.get("from"), to: searchParams.get("to") },
    ctx.correlationId
  );

  const result = await queryPilotControlActivity({
    tenantId: ctx.tenantId,
    programmeId: ctx.programmeId,
    from: range.from,
    to: range.to,
    patientId: searchParams.get("patientId")?.trim() || undefined,
    eventType: searchParams.get("eventType")?.trim() || undefined,
    actorType: searchParams.get("actorType")?.trim() || undefined,
    sourceModule: searchParams.get("sourceModule")?.trim() || undefined,
    page,
    pageSize,
  });

  const items = result.items.map((e) =>
    serializeActivityItem(
      {
        id: e.id,
        eventKind: e.eventKind,
        patientId: e.patientId,
        enrolmentId: e.enrolmentId,
        actorType: e.actorType,
        actorId: e.actorId,
        sourceModule: e.sourceModule,
        createdAt: e.createdAt,
        correlationId: e.correlationId,
        payload: e.payload,
      },
      ctx.actorRole
    )
  );

  if (!ctx.isAutomaticRefresh) {
    await recordPilotControlAuditEvent({
      tenantId: ctx.tenantId,
      programmeId: ctx.programmeId,
      eventKind: "pilot_control_activity_viewed",
      actorType: "staff",
      actorId: ctx.fiUserId,
      correlationId: ctx.correlationId,
      payload: { total: result.total },
    });
  }

  return wrapPilotControlPaginatedResponse(
    items,
    buildPagination({ page, pageSize, total: result.total }),
    buildResponseMeta({
      programmeId: ctx.programmeId,
      tenantId: ctx.tenantId,
      correlationId: ctx.correlationId,
      generatedAt: ctx.requestedAt,
      evaluation: buildEvaluationMetadata({ evaluatedAt: ctx.requestedAt }),
    })
  );
}

export async function assembleHealthResponse(ctx: PilotControlRequestContext) {
  if (!roleHasApiPermission(ctx.actorRole, "pilot_control.health.read")) {
    throw new PilotControlApiError(
      "PILOT_CONTROL_FORBIDDEN",
      "Not authorized to view pilot health.",
      403,
      ctx.correlationId
    );
  }

  const programme = await loadPilotProgrammeByIdOrKey({
    tenantId: ctx.tenantId,
    programmeIdOrKey: ctx.programmeId,
  });
  if (!programme) {
    throw new PilotControlApiError(
      "PILOT_CONTROL_PROGRAMME_NOT_FOUND",
      "Programme not found.",
      404,
      ctx.correlationId
    );
  }

  const enrolments = await loadPilotEnrolmentsForTenant(
    { tenantId: ctx.tenantId, programmeId: programme.id },
    { includeHistorical: true }
  );
  const blockers = await loadActiveProgrammeBlockers({
    tenantId: ctx.tenantId,
    programmeId: programme.id,
  });

  const health = mapHealthVerdictForPauseVisibility(
    assemblePilotControlHealth({
      programmeStatus: programme.status,
      enrolments,
      blockers,
      evaluatedAt: ctx.requestedAt,
    }),
    canSeePilotPauseRecommendation(ctx.actorRole)
  );

  if (!ctx.isAutomaticRefresh) {
    await recordPilotControlAuditEvent({
      tenantId: ctx.tenantId,
      programmeId: programme.id,
      eventKind: "pilot_control_health_viewed",
      actorType: "staff",
      actorId: ctx.fiUserId,
      correlationId: ctx.correlationId,
      payload: { verdict: health.verdict },
    });
  }

  return wrapPilotControlResponse(
    health,
    buildResponseMeta({
      programmeId: programme.id,
      tenantId: ctx.tenantId,
      correlationId: ctx.correlationId,
      generatedAt: ctx.requestedAt,
      evaluation: buildEvaluationMetadata({
        evaluatedAt: ctx.requestedAt,
        blockerPersistenceMode: "read_only",
      }),
    })
  );
}

export async function assembleExportResponse(
  ctx: PilotControlRequestContext,
  searchParams: URLSearchParams
): Promise<{ body: string; contentType: string; filename: string }> {
  if (
    !canExportPilotControl(ctx.actorRole) ||
    !roleHasApiPermission(ctx.actorRole, "pilot_control.export")
  ) {
    throw new PilotControlApiError(
      "PILOT_CONTROL_EXPORT_DENIED",
      "Export requires explicit pilot_control.export permission.",
      403,
      ctx.correlationId
    );
  }

  const rate = checkPilotControlExportRateLimit(`user:${ctx.actorId}`);
  if (!rate.allowed) {
    throw new PilotControlApiError(
      "PILOT_CONTROL_RATE_LIMITED",
      "Export rate limit exceeded.",
      429,
      ctx.correlationId
    );
  }

  const exportType = parseExportType(
    searchParams.get("type") ?? searchParams.get("exportType"),
    ctx.correlationId
  );
  const format = parseExportFormat(searchParams.get("format"), ctx.correlationId);

  let rows: Array<Record<string, unknown>> = [];
  let headers: string[] = [];

  if (exportType === "programme_summary") {
    const overview = await assembleOverviewResponse(ctx);
    rows = [
      {
        programmeId: overview.data.programme.id,
        programmeKey: overview.data.programme.key,
        status: overview.data.programme.status,
        active: overview.data.cohort.active,
        verdict: overview.data.health.verdict,
        realPatientInvitesEnabled: overview.data.programme.realPatientInvitesEnabled,
      },
    ];
    headers = Object.keys(rows[0]!);
  } else if (exportType === "active_blockers") {
    const blockers = await loadActiveProgrammeBlockers({
      tenantId: ctx.tenantId,
      programmeId: ctx.programmeId,
    });
    const serialized = sortAndSerializeBlockers(blockers, ctx.actorRole, {
      tenantId: ctx.tenantId,
    });
    rows = serialized.map((b) => ({
      id: b.id,
      patientId: b.patientId,
      category: b.category,
      severity: b.severity,
      state: b.state,
      title: b.title,
      summary: b.summary,
      ageSeconds: b.ageSeconds,
    }));
    headers = [
      "id",
      "patientId",
      "category",
      "severity",
      "state",
      "title",
      "summary",
      "ageSeconds",
    ];
  } else if (exportType === "activity_summary") {
    const range = parseBoundedDateRange(
      { from: searchParams.get("from"), to: searchParams.get("to") },
      ctx.correlationId
    );
    const activity = await queryPilotControlActivity({
      tenantId: ctx.tenantId,
      programmeId: ctx.programmeId,
      from: range.from,
      to: range.to,
      page: 1,
      pageSize: 500,
    });
    rows = activity.items.map((e) => ({
      eventId: e.id,
      eventType: e.eventKind,
      occurredAt: e.createdAt,
      actorType: e.actorType,
      sourceModule: e.sourceModule,
      safeSummary: serializeActivityItem(
        {
          id: e.id,
          eventKind: e.eventKind,
          actorType: e.actorType,
          sourceModule: e.sourceModule,
          createdAt: e.createdAt,
        },
        ctx.actorRole
      ).safeSummary,
    }));
    headers = [
      "eventId",
      "eventType",
      "occurredAt",
      "actorType",
      "sourceModule",
      "safeSummary",
    ];
  } else {
    const enrolments = await loadPilotEnrolmentsForTenant(
      { tenantId: ctx.tenantId, programmeId: ctx.programmeId },
      { includeHistorical: true }
    );
    const names = await loadPatientDisplayNames(
      ctx.tenantId,
      enrolments.map((e) => e.patientId)
    );
    rows = enrolments.map((e) => ({
      enrolmentId: e.id,
      patientId: e.patientId,
      displayName: names.get(e.patientId)?.displayName ?? "Patient",
      pilotStatus: e.enrolmentStatus,
      invitedAt: e.invitedAt ?? "",
      activatedAt: e.activatedAt ?? "",
    }));
    headers = [
      "enrolmentId",
      "patientId",
      "displayName",
      "pilotStatus",
      "invitedAt",
      "activatedAt",
    ];
  }

  const limited = clampExportRows(rows, ctx.correlationId);
  const filename = safeExportFilename({
    programmeKey: ctx.programmeKey,
    exportType,
    format,
    at: ctx.requestedAt,
  });

  await recordPilotControlAuditEvent({
    tenantId: ctx.tenantId,
    programmeId: ctx.programmeId,
    eventKind: "pilot_control_export_created",
    actorType: "staff",
    actorId: ctx.fiUserId,
    correlationId: ctx.correlationId,
    payload: {
      exportType,
      format,
      rowCount: limited.length,
    },
  });

  if (format === "json") {
    return {
      body: JSON.stringify({ data: limited, meta: { exportType, rowCount: limited.length } }),
      contentType: "application/json; charset=utf-8",
      filename,
    };
  }

  return {
    body: rowsToCsv(headers, limited),
    contentType: "text/csv; charset=utf-8",
    filename,
  };
}
