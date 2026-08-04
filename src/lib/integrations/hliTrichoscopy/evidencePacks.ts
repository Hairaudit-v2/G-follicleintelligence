import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { recordTrichoscopyUsage } from "@/src/lib/platform/entitlements/trichoscopyEntitlementLifecycle.server";
import { hliTrichoscopyFetchJson } from "./client";
import { loadHliTrichoscopyConfig } from "./config";
import { HliTrichoscopyEvidenceIntegrityError } from "./errors";
import { emitTrichoscopyTelemetry } from "./telemetry";
import type { ImportedEvidencePackState } from "./types";

export type ImportEvidencePackInput = {
  tenantId: string;
  linkId: string;
  evidencePackId: string;
  /** When entitlement is inactive, still import for clinical consistency. */
  allowWithoutEntitlement?: boolean;
  supabaseClientForTests?: SupabaseClient;
  env?: NodeJS.ProcessEnv;
};

/**
 * Retrieve a confirmed evidence pack from HLI and persist as an immutable local version.
 * Never overwrites an existing pack version in place.
 */
export async function importConfirmedEvidencePack(
  input: ImportEvidencePackInput
): Promise<{ ok: true; packId: string; localState: ImportedEvidencePackState } | { ok: false; message: string }> {
  const tenantId = input.tenantId.trim();
  const supabase = input.supabaseClientForTests ?? supabaseAdmin();
  const config = loadHliTrichoscopyConfig(input.env);

  let packPayload: Record<string, unknown>;
  if (config.useStub) {
    packPayload = {
      hliEvidencePackId: input.evidencePackId,
      packType: "hli-trichoscopy-consultation-v1",
      packVersion: "1",
      confirmationState: "confirmed",
      findingsSummary: { stub: true },
      metricsSummary: {},
      safetyAssertions: {
        assertsDiagnosis: false,
        assertsTreatmentCausation: false,
        approvesSurgery: false,
        independentlyCalculatesGraftEstimate: false,
        assignsSurgicalFault: false,
      },
      sitesAssessed: [],
      sitesMissing: [],
      limitations: [],
      escalations: [],
      sourceChecksum: `stub-${input.evidencePackId}`,
    };
  } else {
    const http = await hliTrichoscopyFetchJson({
      path: `/v1/trichoscopy/evidence-packs/${encodeURIComponent(input.evidencePackId)}`,
      method: "GET",
      tenantId,
      config,
    });
    if (!http.ok || !http.body || typeof http.body !== "object") {
      return { ok: false, message: `Failed to retrieve evidence pack (${http.status})` };
    }
    packPayload = http.body as Record<string, unknown>;
  }

  const packType = String(packPayload.packType ?? packPayload.pack_type ?? "hli-trichoscopy-consultation-v1");
  const packVersion = String(packPayload.packVersion ?? packPayload.pack_version ?? "1");
  const checksum = packPayload.sourceChecksum
    ? String(packPayload.sourceChecksum)
    : packPayload.source_checksum
      ? String(packPayload.source_checksum)
      : null;

  const { data: existingSame } = await supabase
    .from("fi_hli_trichoscopy_evidence_packs")
    .select("id, source_checksum, local_state")
    .eq("tenant_id", tenantId)
    .eq("hli_evidence_pack_id", input.evidencePackId)
    .eq("pack_version", packVersion)
    .maybeSingle();

  if (existingSame) {
    const existingChecksum = (existingSame as { source_checksum?: string | null }).source_checksum;
    if (checksum && existingChecksum && checksum !== existingChecksum) {
      throw new HliTrichoscopyEvidenceIntegrityError("Evidence pack checksum mismatch on re-import.");
    }
    return {
      ok: true,
      packId: String((existingSame as { id: string }).id),
      localState: ((existingSame as { local_state?: ImportedEvidencePackState }).local_state ??
        "active") as ImportedEvidencePackState,
    };
  }

  // Supersede prior active packs for this link (do not overwrite)
  const { data: priorActive } = await supabase
    .from("fi_hli_trichoscopy_evidence_packs")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("link_id", input.linkId)
    .eq("local_state", "active");

  const { data: inserted, error } = await supabase
    .from("fi_hli_trichoscopy_evidence_packs")
    .insert({
      tenant_id: tenantId,
      link_id: input.linkId,
      hli_evidence_pack_id: input.evidencePackId,
      pack_type: packType,
      pack_version: packVersion,
      hli_episode_id: packPayload.episodeId ? String(packPayload.episodeId) : null,
      hli_assessment_id: packPayload.assessmentId ? String(packPayload.assessmentId) : null,
      confirmation_state: String(packPayload.confirmationState ?? "confirmed"),
      reviewer_reference: packPayload.reviewerReference
        ? String(packPayload.reviewerReference)
        : null,
      confirmed_at: packPayload.confirmedAt ? String(packPayload.confirmedAt) : new Date().toISOString(),
      sites_assessed: Array.isArray(packPayload.sitesAssessed) ? packPayload.sitesAssessed : [],
      sites_missing: Array.isArray(packPayload.sitesMissing) ? packPayload.sitesMissing : [],
      findings_summary: (packPayload.findingsSummary as object) ?? {},
      metrics_summary: (packPayload.metricsSummary as object) ?? {},
      confidence: typeof packPayload.confidence === "number" ? packPayload.confidence : null,
      limitations: Array.isArray(packPayload.limitations) ? packPayload.limitations : [],
      escalations: Array.isArray(packPayload.escalations) ? packPayload.escalations : [],
      patient_publication_state: packPayload.patientPublicationState
        ? String(packPayload.patientPublicationState)
        : null,
      safety_assertions: (packPayload.safetyAssertions as object) ?? {},
      source_checksum: checksum,
      local_state: "active",
      pack_payload: packPayload,
    })
    .select("id")
    .single();

  if (error || !inserted) return { ok: false, message: error?.message ?? "insert failed" };
  const packId = String((inserted as { id: string }).id);

  if (priorActive?.length) {
    for (const row of priorActive as Array<{ id: string }>) {
      await supabase
        .from("fi_hli_trichoscopy_evidence_packs")
        .update({ local_state: "superseded", superseded_by_id: packId })
        .eq("id", row.id)
        .eq("tenant_id", tenantId);
    }
  }

  await supabase
    .from("fi_hli_trichoscopy_links")
    .update({ active_evidence_pack_id: packId, last_synced_at: new Date().toISOString() })
    .eq("id", input.linkId)
    .eq("tenant_id", tenantId);

  // FI-TRICHOSCOPY-1B: sync normalised findings into any linked consultation that is not finalised.
  const { data: consultLinks } = await supabase
    .from("fi_hli_trichoscopy_consultation_links")
    .select("id, consultation_id, consultation_finalised_at")
    .eq("tenant_id", tenantId)
    .eq("link_id", input.linkId)
    .is("consultation_finalised_at", null);

  if (consultLinks?.length) {
    const { syncConsultationFindingsFromPack } = await import("./consultation/service.server");
    for (const cl of consultLinks as Array<{ consultation_id: string }>) {
      await syncConsultationFindingsFromPack({
        tenantId,
        consultationId: String(cl.consultation_id),
        linkId: input.linkId,
        evidencePackId: packId,
        packVersion,
        hliAssessmentId: packPayload.assessmentId
          ? String(packPayload.assessmentId)
          : packPayload.hli_assessment_id
            ? String(packPayload.hli_assessment_id)
            : null,
        packPayload,
        supabaseClientForTests: input.supabaseClientForTests,
      }).catch(() => undefined);
    }
  }

  await recordTrichoscopyUsage({
    tenantId,
    capability: "trichoscopy.confirmed_evidence",
    usageType: "trichoscopy_confirmed_evidence_imported",
    sourceReference: input.evidencePackId,
    idempotencyKey: `usage:pack:${tenantId}:${input.evidencePackId}:${packVersion}`,
    supabaseClientForTests: input.supabaseClientForTests,
  });

  emitTrichoscopyTelemetry("evidence_pack_imported", {
    tenant_id: tenantId,
    pack_id: packId,
    evidence_pack_id: input.evidencePackId,
  });

  return { ok: true, packId, localState: "active" };
}
