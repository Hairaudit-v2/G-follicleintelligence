/**
 * FI-UX-REBUILD-1 S4.4/S4.5B — controlled Pipeline dual-run verification (read-only).
 *
 * Usage (from repo root):
 *
 *   node scripts/run-with-system-ca.mjs node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs scripts/pipeline-dualrun.ts <tenantUuid> [search]
 *
 * Or: pnpm run verify:pipeline-dualrun -- <tenantUuid> [search]
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
import {
  loadPipelineDualRunHarnessData,
  type PipelineLoaderTiming,
} from "@/src/lib/crm/pipelineLoaderOrchestration";
import {
  comparePipelineDualRun,
  isPipelineDualRunReasonApproved,
} from "@/src/lib/crm/pipelineDualRunComparison";

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

function countPresentationLeads(presentation: {
  columns: readonly { cards: readonly { leadId: string }[] }[];
}): number {
  const ids = new Set<string>();
  for (const col of presentation.columns) {
    for (const card of col.cards) ids.add(card.leadId);
  }
  return ids.size;
}

function collectIntentionalDifferences(
  comparison: ReturnType<typeof comparePipelineDualRun>
): Array<{ kind: string; count: number; reason: string | null }> {
  const buckets = new Map<string, { kind: string; count: number; reason: string | null }>();

  for (const m of comparison.stageMismatches) {
    if (!m.expected || !m.reason) continue;
    const key = `stage:${m.reason}`;
    const cur = buckets.get(key) ?? { kind: "stage", count: 0, reason: m.reason };
    cur.count += 1;
    buckets.set(key, cur);
  }

  for (const m of comparison.nextActionMismatches) {
    if (!m.expected || !isPipelineDualRunReasonApproved(m.reason)) continue;
    const key = `nextAction:${m.reason}`;
    const cur = buckets.get(key) ?? { kind: "nextAction", count: 0, reason: m.reason };
    cur.count += 1;
    buckets.set(key, cur);
  }

  return [...buckets.values()].sort((a, b) => a.reason?.localeCompare(b.reason ?? "") ?? 0);
}

async function run(): Promise<void> {
  loadDotEnvLocalSync();

  const tenantId = (process.argv[2] ?? process.env.PIPELINE_DUALRUN_TENANT_ID ?? "").trim();
  if (!tenantId) {
    console.error(
      "Usage: pnpm run verify:pipeline-dualrun -- <tenantUuid> [search]\n" +
        "Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in environment or .env.local"
    );
    process.exit(1);
  }

  const search = (process.argv[3] ?? process.env.PIPELINE_DUALRUN_SEARCH ?? "").trim();
  const searchParams: Record<string, string | string[] | undefined> = search ? { search } : {};

  const timings: { shell?: Partial<PipelineLoaderTiming>; full?: Partial<PipelineLoaderTiming> } =
    {};

  const started = Date.now();
  const harness = await loadPipelineDualRunHarnessData(tenantId, searchParams, {
    loadBoardIndex: loadCrmShellLeadsBoardIndex,
    loadStages: loadCrmShellPipelineStages,
    loadTasksByLeadIds: loadCrmTasksByLeadIds,
    loadCommunicationHintsByLeadIds: loadCrmCommunicationHintsByLeadIds,
    loadConsultationBookingsByLeadIds: loadConsultationBookingsByLeadIds,
    loadReminderJobsByLeadIds: loadReminderJobsByLeadIds,
    onTiming: (label, timing) => {
      timings[label === "shell" ? "shell" : "full"] = timing;
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
  const intentionalDifferences = collectIntentionalDifferences(comparison);
  const unknownStageCount = harness.full.diagnostics.unknownStageLeadIds.length;
  const truncated = harness.full.diagnostics.hiddenLeadCount > 0;

  const supabaseHost = (() => {
    try {
      const raw = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
      return new URL(raw.startsWith("http") ? raw : `https://${raw}`).host;
    } catch {
      return "unknown";
    }
  })();

  const report = {
    tenantId,
    environment: `staging_supabase:${supabaseHost}`,
    searchWindow: search || null,
    sourceLeadCount: harness.sourceTotal,
    legacyLeadCount: comparison.legacyLeadIds.length,
    pipelineLeadCount: comparison.pipelineLeadIds.length,
    shellLeadCount: countPresentationLeads(harness.shell),
    fullLeadCount: countPresentationLeads(harness.full),
    missingFromPipeline: comparison.missingFromPipeline,
    extraInPipeline: comparison.extraInPipeline,
    duplicatePipelineLeadIds: comparison.duplicatePipelineLeadIds,
    shellFullIdentity: identity.ok,
    stageMismatchCount: comparison.stageMismatches.filter((m) => !m.expected).length,
    ownerMismatchCount: comparison.ownerMismatches.length,
    overdueMismatchCount: comparison.overdueMismatches.length,
    conversionMismatchCount: comparison.conversionMismatches.length,
    consultationComparisonStatus:
      comparison.consultationMismatches.length === 0 ? "not_compared_legacy_board" : "mismatch",
    orphanTaskCount: comparison.orphanTaskIds.length,
    unknownStageCount,
    hiddenLeadCount: comparison.hiddenLeadCount,
    intentionalDifferences,
    truncated,
    performance: {
      shellBoardLoadMs: timings.shell?.boardLoadMs ?? null,
      shellStageLoadMs: timings.shell?.stageLoadMs ?? null,
      shellPresentationBuildMs: timings.shell?.presentationBuildMs ?? null,
      shellTotalMs: timings.shell?.totalMs ?? null,
      fullBoardLoadMs: timings.full?.boardLoadMs ?? null,
      fullTaskBatchMs: timings.full?.taskBatchMs ?? null,
      fullCommunicationBatchMs: timings.full?.communicationBatchMs ?? null,
      fullConsultationBatchMs: timings.full?.consultationBatchMs ?? null,
      fullReminderBatchMs: timings.full?.reminderBatchMs ?? null,
      fullPresentationBuildMs: timings.full?.presentationBuildMs ?? null,
      fullTotalMs: timings.full?.totalMs ?? null,
      harnessElapsedMs: Date.now() - started,
      leadCount: timings.full?.leadCount ?? timings.shell?.leadCount ?? null,
      taskCount: timings.full?.taskCount ?? null,
      bookingCount: timings.full?.bookingCount ?? null,
    },
    pass,
  };

  console.info(JSON.stringify(report, null, 2));

  if (!pass) process.exit(1);
}

run().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  const cause =
    err instanceof Error && err.cause instanceof Error
      ? {
          name: err.cause.name,
          code: (err.cause as NodeJS.ErrnoException).code ?? null,
          message: err.cause.message,
        }
      : null;
  console.error(
    JSON.stringify({
      error: "harness_failed",
      errorClass: err instanceof Error ? err.name : "Error",
      message: msg,
      cause,
      nodeVersion: process.version,
      nodeExtraCaCertsSet: Boolean(process.env.NODE_EXTRA_CA_CERTS?.trim()),
    })
  );
  process.exit(1);
});
