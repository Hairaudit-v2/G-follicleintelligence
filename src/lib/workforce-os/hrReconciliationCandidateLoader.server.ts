import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  buildIiohrHrStaffFeedEnvDiagnostics,
  readIiohrHrStaffFeedUrl,
} from "@/src/lib/hr/iiohrHrStaffFeedEnv";
import { loadEvolvedPerthHrStaffRecordsForFiPush } from "@/src/lib/hr/loadEvolvedPerthHrStaffSnapshot.server";
import type { EvolvedStaffRecord } from "@/src/lib/workforce-os/iiohrStaffHrLinkReconciliationTypes";
import { mapIiohrPortalStaffToEvolvedStaffRecords } from "@/src/lib/workforce-os/hrReconciliationCandidateCore";

export type LoadIiohrReconciliationFeedResult = {
  evolvedStaffRecords: EvolvedStaffRecord[];
  rawFeedRowCount: number;
  skippedNonUuidCount: number;
  feedLoadError: string | null;
};

export async function loadIiohrReconciliationFeedRecords(): Promise<LoadIiohrReconciliationFeedResult> {
  const feed = readIiohrHrStaffFeedUrl();
  if (!feed?.url) {
    return {
      evolvedStaffRecords: [],
      rawFeedRowCount: 0,
      skippedNonUuidCount: 0,
      feedLoadError: null,
    };
  }

  try {
    const rawRows = await loadEvolvedPerthHrStaffRecordsForFiPush();
    const mapped = mapIiohrPortalStaffToEvolvedStaffRecords(rawRows);
    return {
      evolvedStaffRecords: mapped.records,
      rawFeedRowCount: rawRows.length,
      skippedNonUuidCount: mapped.skippedNonUuidCount,
      feedLoadError: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load IIOHR HR staff feed.";
    console.error("[hr_reconciliation] feed load failed:", message);
    return {
      evolvedStaffRecords: [],
      rawFeedRowCount: 0,
      skippedNonUuidCount: 0,
      feedLoadError: message,
    };
  }
}

export async function loadHrReconciliationDbDiagnostics(
  tenantId: string,
  client?: SupabaseClient
): Promise<{
  staffIdentityLinksCount: number;
  lastSuccessfulIiohrSyncAt: string | null;
}> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();

  const [linksResult, syncRunsResult] = await Promise.all([
    supabase
      .from("fi_staff_identity_links")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid),
    supabase
      .from("fi_staff_sync_runs")
      .select("finished_at")
      .eq("tenant_id", tid)
      .eq("source_system", "iiohr_hr")
      .eq("status", "success")
      .order("finished_at", { ascending: false })
      .limit(1),
  ]);

  if (linksResult.error) {
    console.error("[hr_reconciliation] identity links count failed:", linksResult.error.message);
  }
  if (syncRunsResult.error) {
    console.error("[hr_reconciliation] sync runs lookup failed:", syncRunsResult.error.message);
  }

  const lastRun = (syncRunsResult.data ?? [])[0] as { finished_at?: string | null } | undefined;

  return {
    staffIdentityLinksCount: linksResult.count ?? 0,
    lastSuccessfulIiohrSyncAt: lastRun?.finished_at ?? null,
  };
}

export function loadHrReconciliationEnvDiagnostics() {
  return buildIiohrHrStaffFeedEnvDiagnostics();
}
