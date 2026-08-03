import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { hliTrichoscopyFetchJson } from "./client";
import { loadHliTrichoscopyConfig } from "./config";
import { importConfirmedEvidencePack } from "./evidencePacks";
import { mapHliTrichoscopyStatusToFios } from "./mappers";
import { emitTrichoscopyTelemetry } from "./telemetry";

export async function reconcileTrichoscopyLink(opts: {
  linkId: string;
  tenantId: string;
  triggeredByUserId?: string | null;
  supabaseClientForTests?: SupabaseClient;
  env?: NodeJS.ProcessEnv;
}): Promise<{ ok: true; runId: string; changes: string[] } | { ok: false; message: string }> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const tenantId = opts.tenantId.trim();

  const { data: run, error: runError } = await supabase
    .from("fi_hli_trichoscopy_reconciliation_runs")
    .insert({
      tenant_id: tenantId,
      link_id: opts.linkId,
      run_type: "manual",
      status: "running",
      triggered_by_user_id: opts.triggeredByUserId ?? null,
    })
    .select("id")
    .single();

  if (runError || !run) return { ok: false, message: runError?.message ?? "run insert failed" };
  const runId = String((run as { id: string }).id);
  const changes: string[] = [];
  const discrepancies: string[] = [];

  try {
    const { data: link } = await supabase
      .from("fi_hli_trichoscopy_links")
      .select("*")
      .eq("id", opts.linkId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!link) {
      await supabase
        .from("fi_hli_trichoscopy_reconciliation_runs")
        .update({
          status: "failed",
          failures: ["link_not_found"],
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId);
      return { ok: false, message: "Link not found" };
    }

    const episodeId = (link as { hli_episode_id?: string | null }).hli_episode_id;
    const config = loadHliTrichoscopyConfig(opts.env);

    if (episodeId && !config.useStub) {
      const http = await hliTrichoscopyFetchJson({
        path: `/v1/trichoscopy/episodes/${encodeURIComponent(episodeId)}`,
        method: "GET",
        tenantId,
        config,
      });
      if (http.ok && http.body && typeof http.body === "object") {
        const body = http.body as Record<string, unknown>;
        const remoteStatus = mapHliTrichoscopyStatusToFios(String(body.status ?? ""));
        const localStatus = String((link as { status: string }).status);
        const confirmedRanks = new Set(["confirmed", "confirmed_with_limitations", "completed"]);
        if (remoteStatus !== localStatus) {
          if (confirmedRanks.has(localStatus) && !confirmedRanks.has(remoteStatus)) {
            discrepancies.push(`refused_downgrade:${localStatus}->${remoteStatus}`);
          } else {
            await supabase
              .from("fi_hli_trichoscopy_links")
              .update({ status: remoteStatus, last_synced_at: new Date().toISOString() })
              .eq("id", opts.linkId)
              .eq("tenant_id", tenantId);
            changes.push(`status:${localStatus}->${remoteStatus}`);
          }
        }
        const evidencePackId = body.evidencePackId
          ? String(body.evidencePackId)
          : body.active_evidence_pack_id
            ? String(body.active_evidence_pack_id)
            : null;
        if (evidencePackId) {
          const imported = await importConfirmedEvidencePack({
            tenantId,
            linkId: opts.linkId,
            evidencePackId,
            allowWithoutEntitlement: true,
            supabaseClientForTests: opts.supabaseClientForTests,
            env: opts.env,
          });
          if (imported.ok) changes.push(`evidence_pack:${imported.packId}`);
        }
      } else {
        discrepancies.push(`episode_fetch_failed:${http.status}`);
      }
    } else if (config.useStub) {
      changes.push("stub_reconcile_noop");
    }

    await supabase
      .from("fi_hli_trichoscopy_reconciliation_runs")
      .update({
        status: discrepancies.length ? "partial" : "completed",
        changes_made: changes,
        discrepancies,
        completed_at: new Date().toISOString(),
        hli_episode_id: episodeId ?? null,
      })
      .eq("id", runId);

    emitTrichoscopyTelemetry("reconciliation_completed", {
      tenant_id: tenantId,
      run_id: runId,
      changes: changes.length,
    });

    return { ok: true, runId, changes };
  } catch (err) {
    await supabase
      .from("fi_hli_trichoscopy_reconciliation_runs")
      .update({
        status: "failed",
        failures: [err instanceof Error ? err.message : "unknown"],
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId);
    return { ok: false, message: err instanceof Error ? err.message : "reconciliation failed" };
  }
}

export async function reconcileTrichoscopyEpisode(opts: {
  tenantId: string;
  episodeId: string;
  triggeredByUserId?: string | null;
  supabaseClientForTests?: SupabaseClient;
  env?: NodeJS.ProcessEnv;
}): Promise<{ ok: true; runId: string; changes: string[] } | { ok: false; message: string }> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { data: link } = await supabase
    .from("fi_hli_trichoscopy_links")
    .select("id")
    .eq("tenant_id", opts.tenantId.trim())
    .eq("hli_episode_id", opts.episodeId.trim())
    .maybeSingle();
  if (!link) return { ok: false, message: "No FiOS link for episode" };
  return reconcileTrichoscopyLink({
    linkId: String((link as { id: string }).id),
    tenantId: opts.tenantId,
    triggeredByUserId: opts.triggeredByUserId,
    supabaseClientForTests: opts.supabaseClientForTests,
    env: opts.env,
  });
}

export async function reconcileRecentTrichoscopyEvents(opts: {
  tenantId?: string;
  supabaseClientForTests?: SupabaseClient;
  env?: NodeJS.ProcessEnv;
}): Promise<{ ok: true; reconciled: number }> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  let query = supabase
    .from("fi_hli_trichoscopy_links")
    .select("id, tenant_id")
    .order("last_synced_at", { ascending: true, nullsFirst: true })
    .limit(25);
  if (opts.tenantId) query = query.eq("tenant_id", opts.tenantId.trim());
  const { data } = await query;
  let count = 0;
  for (const row of data ?? []) {
    const result = await reconcileTrichoscopyLink({
      linkId: String((row as { id: string }).id),
      tenantId: String((row as { tenant_id: string }).tenant_id),
      supabaseClientForTests: opts.supabaseClientForTests,
      env: opts.env,
    });
    if (result.ok) count += 1;
  }
  return { ok: true, reconciled: count };
}
