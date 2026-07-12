/**
 * FI-UX-REBUILD-1 S4.4 — controlled Pipeline dual-run verification (read-only).
 *
 * Usage (from repo root):
 *
 *   node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs scripts/pipeline-dualrun.ts <tenantUuid> [search]
 *
 * Requires `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (e.g. from `.env.local`).
 * Optional: `PIPELINE_DUALRUN_SEARCH` for filter text.
 *
 * Read-only: does not mutate leads, tasks, stages, bookings, or conversions.
 */
import fs from "node:fs";
import path from "node:path";

import { comparePipelineTierIdentity } from "@/src/lib/crm/pipelineLoader";
import {
  loadCrmShellLeadsBoardIndex,
  loadCrmShellPipelineStages,
} from "@/src/lib/crm/crmShellLoaders";
import {
  loadConsultationBookingsByLeadIds,
  loadCrmCommunicationHintsByLeadIds,
  loadCrmTasksByLeadIds,
  loadReminderJobsByLeadIds,
} from "@/src/lib/crm/pipelineLoaderBatch.server";
import { loadPipelineDualRunHarnessData } from "@/src/lib/crm/pipelineLoaderOrchestration";
import { comparePipelineDualRun } from "@/src/lib/crm/pipelineDualRunComparison";

function loadDotEnvLocalSync(): void {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  const raw = fs.readFileSync(p, "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

async function run(): Promise<void> {
  loadDotEnvLocalSync();

  const tenantId = (process.argv[2] ?? process.env.PIPELINE_DUALRUN_TENANT_ID ?? "").trim();
  if (!tenantId) {
    console.error(
      "Usage: node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs scripts/pipeline-dualrun.ts <tenantUuid> [search]\n" +
        "Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in environment or .env.local"
    );
    process.exit(1);
  }

  const search = (process.argv[3] ?? process.env.PIPELINE_DUALRUN_SEARCH ?? "").trim();
  const searchParams: Record<string, string | string[] | undefined> = search
    ? { search }
    : {};

  const started = Date.now();
  const harness = await loadPipelineDualRunHarnessData(tenantId, searchParams, {
    loadBoardIndex: loadCrmShellLeadsBoardIndex,
    loadStages: loadCrmShellPipelineStages,
    loadTasksByLeadIds: loadCrmTasksByLeadIds,
    loadCommunicationHintsByLeadIds: loadCrmCommunicationHintsByLeadIds,
    loadConsultationBookingsByLeadIds: loadConsultationBookingsByLeadIds,
    loadReminderJobsByLeadIds: loadReminderJobsByLeadIds,
    onTiming: (label, timing) => {
      console.info(`[pipeline-dualrun] ${label}`, JSON.stringify(timing));
    },
  });
  const nowMs = Date.now();

  const identity = comparePipelineTierIdentity(harness.shell, harness.full);
  const comparison = comparePipelineDualRun({
    legacyCards: harness.legacyCards,
    legacyStages: harness.legacyStages,
    pipeline: harness.full,
    tenantId,
    nowMs,
  });

  const pass = comparison.pass && identity.ok;

  console.info(
    JSON.stringify(
      {
        tenantId,
        mode: "live_service_role_harness",
        elapsedMs: Date.now() - started,
        legacyLeadCount: comparison.legacyLeadIds.length,
        pipelineLeadCount: comparison.pipelineLeadIds.length,
        sourceTotal: harness.sourceTotal,
        missingFromPipeline: comparison.missingFromPipeline,
        extraInPipeline: comparison.extraInPipeline,
        duplicatePipelineLeadIds: comparison.duplicatePipelineLeadIds,
        stageMismatchCount: comparison.stageMismatches.filter((m) => !m.expected).length,
        ownerMismatchCount: comparison.ownerMismatches.length,
        overdueMismatchCount: comparison.overdueMismatches.length,
        conversionMismatchCount: comparison.conversionMismatches.length,
        hiddenLeadCount: comparison.hiddenLeadCount,
        orphanTaskCount: comparison.orphanTaskIds.length,
        shellFullIdentityOk: identity.ok,
        shellFullMissing: identity.ok ? [] : identity.missingFromFull,
        shellFullExtra: identity.ok ? [] : identity.extraInFull,
        pass,
      },
      null,
      2
    )
  );

  if (!pass) process.exit(1);
}

run().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(JSON.stringify({ error: "harness_failed", message: msg }));
  process.exit(1);
});
