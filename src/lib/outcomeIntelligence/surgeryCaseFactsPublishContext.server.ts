import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { loadGraftTrayLinksForSurgeries } from "@/src/lib/imaging-os/imagingGraftTrayBridge.server";
import { loadGraftTrayIntelligenceContextForImages } from "@/src/lib/imaging-os/graftTrayCountProvider.server";
import {
  buildSurgeryOsGraftTrayCaseIntelligence,
  buildSurgeryOsGraftTrayIntelligenceSummary,
} from "@/src/lib/surgeryOs/surgeryOsGraftTrayAiCore";
import {
  computeConfirmedTrayTotals,
  countTrayReviewBuckets,
  deriveTrayReviewStatuses,
  resolveGraftCountSessionLock,
  SURGERY_OS_GRAFT_RECONCILIATION_STATUS_LABELS,
  SURGERY_OS_GRAFT_SESSION_PHASE_LABELS,
  type SurgeryOsGraftReconciliationStatus,
  type SurgeryOsGraftSessionPhase,
} from "@/src/lib/surgeryOs/surgeryOsGraftModel";
import {
  graftSessionToTotals,
  loadGraftCountEventsForSurgeries,
  loadGraftSessionsForSurgeries,
} from "@/src/lib/surgeryOs/surgeryGraftMutations.server";
import { buildSurgeryOsCaseIntelligenceFacts } from "@/src/lib/surgeryOs/surgeryOsCaseFactsCore";
import { isMissingDatabaseRelationError } from "@/src/lib/surgeryOs/surgeryOsLoaderResilience";
import type { SurgeryCaseIntelligenceFacts } from "./surgeryCaseFactsCore";
import type { SurgeryOsGraftSummary } from "@/src/lib/surgeryOs/surgeryOsBoardModel.types";

type SurgeryPublishRow = {
  id: string;
  tenant_id: string;
  patient_id: string | null;
  case_id: string | null;
  booking_id: string | null;
  clinic_id: string | null;
  surgeon_fi_user_id: string | null;
  status: string;
  live_status: string;
  procedure_phase: string;
  target_grafts: number | null;
  scheduled_date: string;
  scheduled_start_at: string | null;
  actual_start_at: string | null;
};

async function loadSurgeryRowForPublish(
  client: SupabaseClient,
  tenantId: string,
  surgeryId: string
): Promise<SurgeryPublishRow | null> {
  const { data, error } = await client
    .from("fi_surgeries")
    .select(
      "id, tenant_id, patient_id, case_id, booking_id, clinic_id, surgeon_fi_user_id, status, live_status, procedure_phase, target_grafts, scheduled_date, scheduled_start_at, actual_start_at"
    )
    .eq("tenant_id", tenantId)
    .eq("id", surgeryId)
    .maybeSingle();
  if (error) {
    if (isMissingDatabaseRelationError(error)) return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  return data as SurgeryPublishRow;
}

async function loadTeamFiUserIds(
  client: SupabaseClient,
  tenantId: string,
  surgeryId: string
): Promise<string[]> {
  const { data, error } = await client
    .from("fi_surgery_team_assignments")
    .select("fi_user_id")
    .eq("tenant_id", tenantId)
    .eq("surgery_id", surgeryId);
  if (error) {
    if (isMissingDatabaseRelationError(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? [])
    .map((row) => (row as { fi_user_id?: string | null }).fi_user_id)
    .filter((id): id is string => typeof id === "string" && id.trim().length > 0);
}

async function loadReviewerLabels(
  client: SupabaseClient,
  tenantId: string,
  reviewerIds: string[]
): Promise<Map<string, string>> {
  const ids = [...new Set(reviewerIds.filter(Boolean))];
  const out = new Map<string, string>();
  if (!ids.length) return out;

  const { data, error } = await client
    .from("fi_users")
    .select("id, display_name, email")
    .eq("tenant_id", tenantId)
    .in("id", ids);
  if (error) {
    if (isMissingDatabaseRelationError(error)) return out;
    throw new Error(error.message);
  }

  for (const raw of data ?? []) {
    const row = raw as { id: string; display_name?: string | null; email?: string | null };
    const label = row.display_name?.trim() || row.email?.trim() || row.id;
    out.set(row.id, label);
  }
  return out;
}

function emptyGraftSessionTotals(surgery: SurgeryPublishRow) {
  return graftSessionToTotals({
    id: "",
    tenant_id: surgery.tenant_id,
    surgery_id: surgery.id,
    phase: "extraction",
    target_grafts: surgery.target_grafts,
    extracted_grafts: 0,
    implanted_grafts: 0,
    discarded_grafts: 0,
    remaining_grafts: 0,
    singles: 0,
    doubles: 0,
    triples: 0,
    multiples: 0,
    total_hairs: 0,
    average_hairs_per_graft: null,
    reconciliation_status: "pending",
    created_by_fi_user_id: null,
    extraction_lock_device_id: null,
    extraction_lock_held_at: null,
    extraction_lock_held_by_fi_user_id: null,
    implantation_lock_device_id: null,
    implantation_lock_held_at: null,
    implantation_lock_held_by_fi_user_id: null,
    reconciled_by_fi_user_id: null,
    reconciled_at: null,
  });
}

function buildPublishGraftSummary(input: {
  surgery: SurgeryPublishRow;
  graftSession: Awaited<ReturnType<typeof loadGraftSessionsForSurgeries>> extends Map<string, infer V>
    ? V | undefined
    : never;
  graftEvents: Awaited<ReturnType<typeof loadGraftCountEventsForSurgeries>> extends Map<
    string,
    infer V
  >
    ? V
    : never;
  trayImageLinks: SurgeryOsGraftSummary["trayImageLinks"];
  graftTrayIntelligence: SurgeryOsGraftSummary["graftTrayIntelligence"];
}): SurgeryOsGraftSummary {
  const { surgery, graftSession, graftEvents } = input;
  const reviewStatuses = deriveTrayReviewStatuses(
    graftEvents.map((e) => ({
      id: e.id,
      eventType: e.event_type,
      note: e.note,
      createdAt: e.created_at,
    }))
  );
  const trayBuckets = countTrayReviewBuckets(
    graftEvents.map((e) => ({
      eventType: e.event_type,
      reviewStatus:
        e.event_type === "tray_count" ? (reviewStatuses.get(e.id) ?? "pending") : null,
    }))
  );
  const confirmedTrayTotals = computeConfirmedTrayTotals(
    graftEvents.map((e) => ({
      eventType: e.event_type,
      reviewStatus:
        e.event_type === "tray_count" ? (reviewStatuses.get(e.id) ?? "pending") : null,
      singles: e.singles,
      doubles: e.doubles,
      triples: e.triples,
      multiples: e.multiples,
      totalHairs: e.total_hairs,
      deltaDiscarded: e.delta_discarded,
    }))
  );

  const graftPhase = (graftSession?.phase ?? "extraction") as SurgeryOsGraftSessionPhase;
  const reconciliationStatus = (graftSession?.reconciliation_status ??
    "pending") as SurgeryOsGraftReconciliationStatus;
  const totals = graftSession ? graftSessionToTotals(graftSession) : emptyGraftSessionTotals(surgery);
  const nowMs = Date.now();

  return {
    surgeryId: surgery.id,
    patientLabel: "",
    sessionId: graftSession?.id ?? null,
    phase: graftPhase,
    phaseLabel: SURGERY_OS_GRAFT_SESSION_PHASE_LABELS[graftPhase],
    targetGrafts: totals.targetGrafts,
    extractedGrafts: totals.extractedGrafts,
    implantedGrafts: totals.implantedGrafts,
    discardedGrafts: totals.discardedGrafts,
    remainingGrafts: totals.remainingGrafts,
    singles: totals.composition.singles,
    doubles: totals.composition.doubles,
    triples: totals.composition.triples,
    multiples: totals.composition.multiples,
    totalHairs: totals.totalHairs,
    averageHairsPerGraft: totals.averageHairsPerGraft,
    progressPercent: null,
    reconciliationStatus,
    reconciliationStatusLabel: SURGERY_OS_GRAFT_RECONCILIATION_STATUS_LABELS[reconciliationStatus],
    pendingTrayCount: trayBuckets.pending,
    confirmedTrayGrafts:
      confirmedTrayTotals.singles +
      confirmedTrayTotals.doubles +
      confirmedTrayTotals.triples +
      confirmedTrayTotals.multiples,
    trayImageCount: input.trayImageLinks.length,
    trayImageLinks: input.trayImageLinks,
    graftTrayIntelligence: input.graftTrayIntelligence,
    caseIntelligenceFacts: null,
    reconciledAt: graftSession?.reconciled_at ?? null,
    reconciledByLabel: null,
    sessionLocks: {
      extraction: resolveGraftCountSessionLock({
        kind: "extraction",
        deviceId: graftSession?.extraction_lock_device_id ?? null,
        heldAt: graftSession?.extraction_lock_held_at ?? null,
        heldByFiUserId: graftSession?.extraction_lock_held_by_fi_user_id ?? null,
        heldByLabel: null,
        requestingDeviceId: null,
        nowMs,
      }),
      implantation: resolveGraftCountSessionLock({
        kind: "implantation",
        deviceId: graftSession?.implantation_lock_device_id ?? null,
        heldAt: graftSession?.implantation_lock_held_at ?? null,
        heldByFiUserId: graftSession?.implantation_lock_held_by_fi_user_id ?? null,
        heldByLabel: null,
        requestingDeviceId: null,
        nowMs,
      }),
    },
    totals,
    hrefs: { patient: null, case: null, surgery: null },
  };
}

export async function loadAndBuildSurgeryCaseIntelligenceFactsForPublish(input: {
  tenantId: string;
  surgeryId: string;
  client?: SupabaseClient;
}): Promise<{
  facts: SurgeryCaseIntelligenceFacts | null;
  clinicId: string | null;
}> {
  const tid = assertNonEmptyUuid(input.tenantId.trim(), "tenantId");
  const sid = assertNonEmptyUuid(input.surgeryId.trim(), "surgeryId");
  const client = input.client ?? supabaseAdmin();

  const surgery = await loadSurgeryRowForPublish(client, tid, sid);
  if (!surgery) return { facts: null, clinicId: null };

  const [graftSessionsBySurgery, graftEventsBySurgery, teamFiUserIds] = await Promise.all([
    loadGraftSessionsForSurgeries(tid, [sid]),
    loadGraftCountEventsForSurgeries(tid, [sid]),
    loadTeamFiUserIds(client, tid, sid),
  ]);

  let trayLinksBySurgery: Awaited<ReturnType<typeof loadGraftTrayLinksForSurgeries>> = new Map();
  let trayIntelligenceByImage = new Map<
    string,
    Awaited<ReturnType<typeof loadGraftTrayIntelligenceContextForImages>> extends Map<string, infer V>
      ? V
      : never
  >();

  try {
    trayLinksBySurgery = await loadGraftTrayLinksForSurgeries(tid, [sid], client);
    const trayImageIds = [...(trayLinksBySurgery.get(sid) ?? [])].map((l) => l.image_id);
    if (trayImageIds.length) {
      trayIntelligenceByImage = await loadGraftTrayIntelligenceContextForImages(
        tid,
        trayImageIds,
        client
      );
    }
  } catch (e) {
    if (!isMissingDatabaseRelationError(e)) throw e;
  }

  const reviewerIds = [...trayIntelligenceByImage.values()].flatMap((ctx) => {
    const ids: (string | null)[] = [ctx.estimate.reviewed_by_fi_user_id];
    for (const entry of ctx.auditTrail) ids.push(entry.reviewed_by_fi_user_id);
    return ids.filter(Boolean) as string[];
  });
  const reviewerLabels = await loadReviewerLabels(client, tid, reviewerIds);

  const surgeryTrayLinks = trayLinksBySurgery.get(sid) ?? [];
  const trayImageLinks = surgeryTrayLinks.map((link) => {
    const ctx = trayIntelligenceByImage.get(link.image_id);
    const reviewerId = ctx?.estimate.reviewed_by_fi_user_id ?? null;
    const intelligenceSummary = ctx
      ? buildSurgeryOsGraftTrayIntelligenceSummary({
          estimate: ctx.estimate,
          auditTrail: ctx.auditTrail,
          reviewerLabel: reviewerId ? (reviewerLabels.get(reviewerId) ?? null) : null,
          sourceImageHref: null,
          estimateAnalysisJobStatus: ctx.estimateAnalysisJobStatus,
          hasNewerActiveJob: ctx.hasNewerActiveJob,
        })
      : null;
    return {
      linkId: link.id,
      imageId: link.image_id,
      capturedAt: link.captured_at,
      status: link.status,
      reviewRequired: link.review_required,
      imagingHref: null,
      aiEstimate: null,
      intelligenceSummary,
    };
  });

  const graftTrayIntelligence =
    trayImageLinks.length > 0
      ? buildSurgeryOsGraftTrayCaseIntelligence({
          linkSummaries: trayImageLinks
            .map((l) => l.intelligenceSummary)
            .filter((s): s is NonNullable<typeof s> => s != null),
        })
      : null;

  const graftSummary = buildPublishGraftSummary({
    surgery,
    graftSession: graftSessionsBySurgery.get(sid),
    graftEvents: graftEventsBySurgery.get(sid) ?? [],
    trayImageLinks,
    graftTrayIntelligence,
  });

  const facts = buildSurgeryOsCaseIntelligenceFacts({
    tenantId: tid,
    patientId: surgery.patient_id,
    caseId: surgery.case_id,
    surgeryId: surgery.id,
    bookingId: surgery.booking_id,
    procedureDate: surgery.scheduled_date ?? surgery.actual_start_at ?? surgery.scheduled_start_at,
    surgeonFiUserId: surgery.surgeon_fi_user_id,
    teamFiUserIds,
    surgeryStatus: surgery.status,
    procedurePhase: surgery.procedure_phase,
    liveStatus: surgery.live_status,
    graftSummary,
  });

  return { facts, clinicId: surgery.clinic_id ?? null };
}