import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { FiosTrichoscopyStatus } from "./types";

export type TrichoscopyLinkRow = {
  id: string;
  tenant_id: string;
  fios_patient_id: string;
  fios_case_id: string | null;
  purpose: string;
  status: FiosTrichoscopyStatus;
  hli_episode_id: string | null;
  hli_patient_reference: string;
  active_evidence_pack_id: string | null;
  latest_session_id: string | null;
  latest_assessment_id: string | null;
  last_synced_at: string | null;
  requested_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function listTrichoscopyLinksForPatient(opts: {
  tenantId: string;
  patientId: string;
  supabaseClientForTests?: SupabaseClient;
}): Promise<TrichoscopyLinkRow[]> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_hli_trichoscopy_links")
    .select(
      "id, tenant_id, fios_patient_id, fios_case_id, purpose, status, hli_episode_id, hli_patient_reference, active_evidence_pack_id, latest_session_id, latest_assessment_id, last_synced_at, requested_at, created_at, updated_at"
    )
    .eq("tenant_id", opts.tenantId.trim())
    .eq("fios_patient_id", opts.patientId.trim())
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as TrichoscopyLinkRow[];
}

export async function getTrichoscopyLinkById(opts: {
  tenantId: string;
  linkId: string;
  supabaseClientForTests?: SupabaseClient;
}): Promise<TrichoscopyLinkRow | null> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_hli_trichoscopy_links")
    .select(
      "id, tenant_id, fios_patient_id, fios_case_id, purpose, status, hli_episode_id, hli_patient_reference, active_evidence_pack_id, latest_session_id, latest_assessment_id, last_synced_at, requested_at, created_at, updated_at"
    )
    .eq("tenant_id", opts.tenantId.trim())
    .eq("id", opts.linkId.trim())
    .maybeSingle();
  if (error || !data) return null;
  return data as TrichoscopyLinkRow;
}

export async function findTrichoscopyLinkByEpisode(opts: {
  tenantId: string;
  episodeId: string;
  supabaseClientForTests?: SupabaseClient;
}): Promise<TrichoscopyLinkRow | null> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_hli_trichoscopy_links")
    .select(
      "id, tenant_id, fios_patient_id, fios_case_id, purpose, status, hli_episode_id, hli_patient_reference, active_evidence_pack_id, latest_session_id, latest_assessment_id, last_synced_at, requested_at, created_at, updated_at"
    )
    .eq("tenant_id", opts.tenantId.trim())
    .eq("hli_episode_id", opts.episodeId.trim())
    .maybeSingle();
  if (error || !data) return null;
  return data as TrichoscopyLinkRow;
}

export async function listEvidencePacksForLink(opts: {
  tenantId: string;
  linkId: string;
  supabaseClientForTests?: SupabaseClient;
}): Promise<Array<Record<string, unknown>>> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_hli_trichoscopy_evidence_packs")
    .select("*")
    .eq("tenant_id", opts.tenantId.trim())
    .eq("link_id", opts.linkId.trim())
    .order("retrieved_at", { ascending: false });
  if (error || !data) return [];
  return data as Array<Record<string, unknown>>;
}

export async function listOpenTrichoscopyActions(opts: {
  tenantId: string;
  patientId: string;
  supabaseClientForTests?: SupabaseClient;
}): Promise<Array<Record<string, unknown>>> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_hli_trichoscopy_case_actions")
    .select("*")
    .eq("tenant_id", opts.tenantId.trim())
    .eq("fios_patient_id", opts.patientId.trim())
    .eq("status", "open")
    .order("opened_at", { ascending: false });
  if (error || !data) return [];
  return data as Array<Record<string, unknown>>;
}
