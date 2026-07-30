/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.3 — blocker persistence (server).
 * Derived operational register only. No clinical/financial source mutations.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import type { PersistedBlockerSnapshot, PilotBlockerRecord } from "./blockerTypes";

function adminClient(supabase?: SupabaseClient): SupabaseClient {
  return supabase ?? (supabaseAdmin() as SupabaseClient);
}

function mapRow(row: Record<string, unknown>): PersistedBlockerSnapshot {
  return {
    id: String(row.id),
    fingerprint: String(row.fingerprint),
    programmeId: String(row.programme_id),
    enrolmentId: String(row.enrolment_id),
    tenantId: String(row.tenant_id),
    patientId: String(row.patient_id),
    category: row.category as PersistedBlockerSnapshot["category"],
    subcategory: row.subcategory != null ? String(row.subcategory) : null,
    dimension: row.dimension as PersistedBlockerSnapshot["dimension"],
    sourceModule: row.source_module as PersistedBlockerSnapshot["sourceModule"],
    sourceRecordId: row.source_record_id != null ? String(row.source_record_id) : null,
    sourceSignalKey: row.source_signal_key != null ? String(row.source_signal_key) : null,
    title: String(row.title),
    summary: String(row.summary),
    recommendedNextAction: String(row.recommended_next_action),
    severity: row.severity as PersistedBlockerSnapshot["severity"],
    state: row.state as PersistedBlockerSnapshot["state"],
    ownerType: row.owner_type as PersistedBlockerSnapshot["ownerType"],
    ownerUserId: row.owner_user_id != null ? String(row.owner_user_id) : null,
    ownerRole: row.owner_role != null ? String(row.owner_role) : null,
    assignmentSource: row.assignment_source as PersistedBlockerSnapshot["assignmentSource"],
    ownershipReason: String(row.ownership_reason ?? ""),
    firstDetectedAt: String(row.first_detected_at),
    lastConfirmedAt: String(row.last_confirmed_at),
    acknowledgedAt: row.acknowledged_at != null ? String(row.acknowledged_at) : null,
    acknowledgedBy: row.acknowledged_by != null ? String(row.acknowledged_by) : null,
    resolvedAt: row.resolved_at != null ? String(row.resolved_at) : null,
    resolutionReason: row.resolution_reason != null ? String(row.resolution_reason) : null,
    supersededBy: row.superseded_by != null ? String(row.superseded_by) : null,
    escalationLevel: row.escalation_level as PersistedBlockerSnapshot["escalationLevel"],
    escalatedAt: row.escalated_at != null ? String(row.escalated_at) : null,
    thresholdKey: row.threshold_key != null ? String(row.threshold_key) : null,
    requiresPilotPause: Boolean(row.requires_pilot_pause),
    requiresImmediateReview: Boolean(row.requires_immediate_review),
    provenanceJson: Array.isArray(row.provenance_json)
      ? (row.provenance_json as PersistedBlockerSnapshot["provenanceJson"])
      : [],
    correlationIds: Array.isArray(row.correlation_ids)
      ? (row.correlation_ids as string[])
      : [],
    detectedByVersion: String(row.detected_by_version ?? ""),
    criticalIntegrity: Boolean(row.critical_integrity),
  };
}

function recordToRow(b: PilotBlockerRecord): Record<string, unknown> {
  return {
    programme_id: b.programmeId,
    enrolment_id: b.enrolmentId,
    tenant_id: b.tenantId,
    patient_id: b.patientId,
    fingerprint: b.fingerprint,
    category: b.category,
    subcategory: b.subcategory ?? null,
    dimension: b.dimension,
    source_module: b.sourceModule,
    source_record_id: b.sourceRecordId ?? null,
    source_signal_key: b.sourceSignalKey ?? null,
    title: b.title,
    summary: b.summary,
    recommended_next_action: b.recommendedNextAction,
    severity: b.severity,
    state: b.state,
    owner_type: b.ownership.ownerType,
    owner_user_id: b.ownership.ownerUserId ?? null,
    owner_role: b.ownership.ownerRole ?? null,
    assignment_source: b.ownership.assignmentSource,
    ownership_reason: b.ownership.ownershipReason,
    first_detected_at: b.firstDetectedAt,
    last_confirmed_at: b.lastConfirmedAt,
    acknowledged_at: b.acknowledgedAt ?? null,
    acknowledged_by: b.acknowledgedBy ?? null,
    resolved_at: b.resolvedAt ?? null,
    resolution_reason: b.resolutionReason ?? null,
    superseded_by: b.supersededBy ?? null,
    escalation_level: b.escalation.level,
    escalated_at: b.escalation.escalatedAt ?? null,
    threshold_key: b.escalation.thresholdKey ?? null,
    requires_pilot_pause: b.escalation.requiresPilotPause,
    requires_immediate_review: b.escalation.requiresImmediateReview,
    provenance_json: b.provenance,
    correlation_ids: b.correlationIds,
    detected_by_version: b.detectedByVersion,
    critical_integrity: b.criticalIntegrity,
    updated_at: b.evaluatedAt,
  };
}

export async function loadActivePilotBlockers(args: {
  tenantId: string;
  programmeId: string;
  enrolmentId: string;
  patientId: string;
  supabase?: SupabaseClient;
}): Promise<PersistedBlockerSnapshot[]> {
  const db = adminClient(args.supabase);
  const { data, error } = await db
    .from("fi_pilot_blockers")
    .select("*")
    .eq("tenant_id", args.tenantId)
    .eq("programme_id", args.programmeId)
    .eq("enrolment_id", args.enrolmentId)
    .eq("patient_id", args.patientId)
    .in("state", ["open", "acknowledged", "in_progress"]);

  if (error) {
    // Table may not exist yet in local environments without migration — fail closed empty.
    if (String(error.message).includes("fi_pilot_blockers") || error.code === "42P01") {
      return [];
    }
    throw error;
  }
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

/**
 * Upsert active blockers and mark resolved/superseded.
 * Uses unique active fingerprint index; concurrent inserts race-safe via ON CONFLICT.
 *
 * Retry behaviour: on unique-violation, re-load active rows and re-apply updates once.
 */
export async function persistPilotBlockerReconciliation(args: {
  tenantId: string;
  programmeId: string;
  enrolmentId: string;
  patientId: string;
  upserts: PilotBlockerRecord[];
  resolved: PilotBlockerRecord[];
  supabase?: SupabaseClient;
}): Promise<void> {
  // Tenant isolation: refuse cross-tenant writes
  for (const b of [...args.upserts, ...args.resolved]) {
    if (
      b.tenantId !== args.tenantId ||
      b.programmeId !== args.programmeId ||
      b.enrolmentId !== args.enrolmentId ||
      b.patientId !== args.patientId
    ) {
      throw new Error("pilot_blocker_tenant_or_patient_mismatch");
    }
  }

  const db = adminClient(args.supabase);

  for (const b of args.upserts) {
    const row = recordToRow(b);
    const { error } = await db.from("fi_pilot_blockers").upsert(row, {
      onConflict: "programme_id,enrolment_id,fingerprint",
      ignoreDuplicates: false,
    });
    if (error) {
      // Fallback: update by fingerprint if partial unique index path differs
      const { error: updErr } = await db
        .from("fi_pilot_blockers")
        .update(row)
        .eq("tenant_id", args.tenantId)
        .eq("programme_id", args.programmeId)
        .eq("enrolment_id", args.enrolmentId)
        .eq("fingerprint", b.fingerprint)
        .in("state", ["open", "acknowledged", "in_progress"]);
      if (updErr) {
        const { error: insErr } = await db.from("fi_pilot_blockers").insert(row);
        if (insErr && !String(insErr.message).includes("duplicate")) {
          throw insErr;
        }
      }
    }
  }

  for (const b of args.resolved) {
    const { error } = await db
      .from("fi_pilot_blockers")
      .update({
        state: b.state,
        resolved_at: b.resolvedAt ?? b.evaluatedAt,
        resolution_reason: b.resolutionReason ?? null,
        superseded_by: b.supersededBy ?? null,
        last_confirmed_at: b.lastConfirmedAt,
        severity: b.severity,
        escalation_level: b.escalation.level,
        requires_pilot_pause: b.escalation.requiresPilotPause,
        requires_immediate_review: b.escalation.requiresImmediateReview,
        updated_at: b.evaluatedAt,
      })
      .eq("tenant_id", args.tenantId)
      .eq("programme_id", args.programmeId)
      .eq("enrolment_id", args.enrolmentId)
      .eq("fingerprint", b.fingerprint)
      .in("state", ["open", "acknowledged", "in_progress"]);
    if (error) throw error;
  }
}
