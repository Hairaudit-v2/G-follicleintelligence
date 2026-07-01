import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { processPendingImagingAiJobsForTenant } from "./imagingAiAnalysisJobWorker.server";
import type { ProcessImagingAiJobResult } from "./imagingAiAnalysisJobWorker.server";

export type ImagingAiAnalysisCronSummary = {
  ok: true;
  startedAt: string;
  durationMs: number;
  mode: "single_tenant" | "all_tenants";
  tenantId?: string;
  tenantsProcessed?: number;
  jobsProcessed: number;
  results: Array<{
    jobId: string;
    status: ProcessImagingAiJobResult["status"];
    analysisKind: string;
  }>;
};

export type ImagingAiAnalysisCronTenantRollup = {
  tenantId: string;
  processed: number;
  completed: number;
  failed: number;
  requeued: number;
};

export async function runImagingAiAnalysisCron(input: {
  tenantId?: string | null;
  limit?: number;
  perTenantLimit?: number;
  client?: SupabaseClient;
}): Promise<ImagingAiAnalysisCronSummary> {
  const startedAt = new Date().toISOString();
  const startMs = Date.now();
  const supabase = input.client ?? supabaseAdmin();
  const limit = Math.max(1, Math.min(input.limit ?? 5, 20));
  const perTenantLimit = Math.max(1, Math.min(input.perTenantLimit ?? 3, 20));

  const sanitize = (results: ProcessImagingAiJobResult[]) =>
    results.map((r) => ({
      jobId: r.jobId,
      status: r.status,
      analysisKind: r.analysisKind,
    }));

  if (input.tenantId?.trim()) {
    const tenantId = input.tenantId.trim();
    const results = await processPendingImagingAiJobsForTenant({
      tenantId,
      limit,
      client: supabase,
    });
    return {
      ok: true,
      startedAt,
      durationMs: Date.now() - startMs,
      mode: "single_tenant",
      tenantId,
      tenantsProcessed: 1,
      jobsProcessed: results.length,
      results: sanitize(results),
    };
  }

  const { data: tenants, error } = await supabase
    .from("fi_tenants")
    .select("id")
    .order("name")
    .limit(500);
  if (error) throw new Error(error.message);

  const allResults: ProcessImagingAiJobResult[] = [];
  for (const tenant of tenants ?? []) {
    const tenantId = String((tenant as { id: string }).id);
    const results = await processPendingImagingAiJobsForTenant({
      tenantId,
      limit: perTenantLimit,
      client: supabase,
    });
    allResults.push(...results);
  }

  return {
    ok: true,
    startedAt,
    durationMs: Date.now() - startMs,
    mode: "all_tenants",
    tenantsProcessed: (tenants ?? []).length,
    jobsProcessed: allResults.length,
    results: sanitize(allResults),
  };
}