/**
 * FI-TRICHOSCOPY-1B — consultation-scoped queries (server).
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { FiosTrichoscopyStatus } from "../types";
import type { TrichoscopyConsultationStatus } from "./types";

export type ConsultationTrichoscopyLinkRow = {
  id: string;
  tenant_id: string;
  consultation_id: string;
  fios_patient_id: string;
  link_id: string | null;
  request_id: string | null;
  evidence_pack_id: string | null;
  request_mode: string;
  consultation_status: TrichoscopyConsultationStatus;
  pinned_hli_assessment_id: string | null;
  pinned_evidence_pack_id: string | null;
  pinned_pack_version: string | null;
  pinned_findings_schema_version: string | null;
  pinned_at: string | null;
  pinned_by_user_id: string | null;
  consultation_finalised_at: string | null;
  defer_reason: string | null;
  not_required_reason: string | null;
  blocking_reason_codes: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export async function getConsultationTrichoscopyLink(opts: {
  tenantId: string;
  consultationId: string;
  supabaseClientForTests?: SupabaseClient;
}): Promise<ConsultationTrichoscopyLinkRow | null> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_hli_trichoscopy_consultation_links")
    .select("*")
    .eq("tenant_id", opts.tenantId.trim())
    .eq("consultation_id", opts.consultationId.trim())
    .order("created_at", { ascending: false })
    .limit(5);
  if (error || !data?.length) return null;
  const active = (data as ConsultationTrichoscopyLinkRow[]).find(
    (row) => row.consultation_status !== "withdrawn" && row.consultation_status !== "failed"
  );
  return active ?? (data[0] as ConsultationTrichoscopyLinkRow);
}

export async function listConsultationFindings(opts: {
  tenantId: string;
  consultationId: string;
  supabaseClientForTests?: SupabaseClient;
}): Promise<Array<Record<string, unknown>>> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_hli_trichoscopy_findings")
    .select("*")
    .eq("tenant_id", opts.tenantId.trim())
    .eq("consultation_id", opts.consultationId.trim())
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data as Array<Record<string, unknown>>;
}

export async function listConsultationFindingReviews(opts: {
  tenantId: string;
  consultationId: string;
  supabaseClientForTests?: SupabaseClient;
}): Promise<Array<Record<string, unknown>>> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_hli_trichoscopy_finding_reviews")
    .select("*")
    .eq("tenant_id", opts.tenantId.trim())
    .eq("consultation_id", opts.consultationId.trim());
  if (error || !data) return [];
  return data as Array<Record<string, unknown>>;
}

export async function getConsultationIndication(opts: {
  tenantId: string;
  consultationId: string;
  supabaseClientForTests?: SupabaseClient;
}): Promise<Record<string, unknown> | null> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_hli_trichoscopy_indications")
    .select("*")
    .eq("tenant_id", opts.tenantId.trim())
    .eq("consultation_id", opts.consultationId.trim())
    .maybeSingle();
  if (error || !data) return null;
  return data as Record<string, unknown>;
}

export async function getTenantConsultationRules(opts: {
  tenantId: string;
  supabaseClientForTests?: SupabaseClient;
}): Promise<Record<string, unknown> | null> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_hli_trichoscopy_consultation_rules")
    .select("*")
    .eq("tenant_id", opts.tenantId.trim())
    .maybeSingle();
  if (error || !data) return null;
  return data as Record<string, unknown>;
}

export async function findLinkableAssessmentsForPatient(opts: {
  tenantId: string;
  patientId: string;
  supabaseClientForTests?: SupabaseClient;
}): Promise<
  Array<{
    linkId: string;
    status: FiosTrichoscopyStatus;
    purpose: string;
    episodeId: string | null;
    packVersion: string | null;
    lastSyncedAt: string | null;
  }>
> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { data: links } = await supabase
    .from("fi_hli_trichoscopy_links")
    .select("id, status, purpose, hli_episode_id, active_evidence_pack_id, last_synced_at")
    .eq("tenant_id", opts.tenantId.trim())
    .eq("fios_patient_id", opts.patientId.trim())
    .is("cancelled_at", null)
    .order("created_at", { ascending: false })
    .limit(20);

  if (!links?.length) return [];

  const packIds = links
    .map((l) => (l as { active_evidence_pack_id?: string | null }).active_evidence_pack_id)
    .filter(Boolean) as string[];

  const packVersions = new Map<string, string>();
  if (packIds.length) {
    const { data: packs } = await supabase
      .from("fi_hli_trichoscopy_evidence_packs")
      .select("id, pack_version")
      .eq("tenant_id", opts.tenantId.trim())
      .in("id", packIds);
    for (const p of packs ?? []) {
      packVersions.set(String((p as { id: string }).id), String((p as { pack_version: string }).pack_version));
    }
  }

  return links.map((l) => {
    const row = l as {
      id: string;
      status: FiosTrichoscopyStatus;
      purpose: string;
      hli_episode_id: string | null;
      active_evidence_pack_id: string | null;
      last_synced_at: string | null;
    };
    return {
      linkId: row.id,
      status: row.status,
      purpose: row.purpose,
      episodeId: row.hli_episode_id,
      packVersion: row.active_evidence_pack_id
        ? packVersions.get(row.active_evidence_pack_id) ?? null
        : null,
      lastSyncedAt: row.last_synced_at,
    };
  });
}

export async function writeConsultationTrichoscopyAudit(opts: {
  tenantId: string;
  consultationId: string;
  patientId?: string | null;
  actorUserId?: string | null;
  action: string;
  source?: string;
  evidencePackId?: string | null;
  packVersion?: string | null;
  findingId?: string | null;
  payload?: Record<string, unknown>;
  supabaseClientForTests?: SupabaseClient;
}): Promise<void> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  await supabase.from("fi_hli_trichoscopy_consultation_audit").insert({
    tenant_id: opts.tenantId.trim(),
    consultation_id: opts.consultationId.trim(),
    fios_patient_id: opts.patientId ?? null,
    actor_user_id: opts.actorUserId ?? null,
    action: opts.action,
    source: opts.source ?? "fios",
    evidence_pack_id: opts.evidencePackId ?? null,
    pack_version: opts.packVersion ?? null,
    finding_id: opts.findingId ?? null,
    payload: opts.payload ?? {},
  });
}
