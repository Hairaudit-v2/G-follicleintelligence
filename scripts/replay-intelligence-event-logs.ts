/**
 * Stage 15: operator CLI for governed replay runs + Stage 14 direct replay.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseReplayIntelligenceEventLogsScriptArgs } from "../src/lib/fi/events/governedIntelligenceReplayCliArgs";
import { replayIntelligenceEventLogs } from "../src/lib/fi/events/replayIntelligenceEventLogs.server";
import {
  approveReplayRun,
  createReplayRunDraft,
  executeApprovedReplayRun,
  submitReplayRunForApproval,
} from "../src/lib/fi/events/intelligenceReplayRunService.server";

function loadRepoEnvFiles(): void {
  for (const name of [".env.local", ".env"] as const) {
    const p = resolve(process.cwd(), name);
    if (!existsSync(p)) continue;
    let raw = readFileSync(p, "utf8");
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const withoutExport = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
      const eq = withoutExport.indexOf("=");
      if (eq <= 0) continue;
      const key = withoutExport.slice(0, eq).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
      let val = withoutExport.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}

function printJsonLine(printJson: boolean, obj: unknown): void {
  const text = printJson ? JSON.stringify(obj, null, 2) : JSON.stringify(obj);
  process.stdout.write(`${text}\n`);
}

async function main(): Promise<void> {
  loadRepoEnvFiles();

  const parsed = parseReplayIntelligenceEventLogsScriptArgs(process.argv);
  if (!parsed.ok) {
    process.stderr.write(`${parsed.message}\n`);
    process.exit(parsed.exitCode);
  }

  const v = parsed.value;

  if (v.kind === "direct_replay") {
    const { mode, filters, printJson } = v.value;
    if (mode === "dispatch_future") {
      process.stderr.write("dispatch_future is only valid with --create-run (planning row), not direct replay.\n");
      process.exit(2);
    }
    const result = await replayIntelligenceEventLogs({
      mode,
      filters,
      omitPlatformAdminAssertForOperatorCli: true,
    });
    printJsonLine(printJson, { mode, filters, summary: result.summary, warnings: result.warnings, load_error: result.load_error });
    process.exit(0);
    return;
  }

  if (v.kind === "create_run") {
    const { mode, filters, printJson } = v.value;
    const r = await createReplayRunDraft({
      mode,
      filters,
      omitPlatformAdminAssertForOperatorCli: true,
    });
    printJsonLine(printJson, { action: "create_run", ok: r.ok, ...(r.ok ? { id: r.data.id } : { code: r.code, message: r.message }), filters, mode });
    process.exit(0);
    return;
  }

  if (v.kind === "submit_for_approval") {
    const r = await submitReplayRunForApproval(v.runId, null, { omitPlatformAdminAssertForOperatorCli: true });
    printJsonLine(v.printJson, {
      action: "submit_for_approval",
      runId: v.runId,
      ok: r.ok,
      ...(r.ok ? { id: r.data.id } : { code: r.code, message: r.message }),
    });
    process.exit(0);
    return;
  }

  if (v.kind === "approve_run") {
    const r = await approveReplayRun(v.runId, null, { omitPlatformAdminAssertForOperatorCli: true });
    printJsonLine(v.printJson, {
      action: "approve_run",
      runId: v.runId,
      ok: r.ok,
      ...(r.ok ? { id: r.data.id } : { code: r.code, message: r.message }),
    });
    process.exit(0);
    return;
  }

  if (v.kind === "execute_run") {
    const env = process.env as Record<string, string | undefined>;
    if (env.FI_INTELLIGENCE_GOVERNED_REPLAY_ENABLED !== "1") {
      printJsonLine(v.printJson, {
        action: "execute_run",
        runId: v.runId,
        ok: false,
        code: "governed_replay_disabled",
        message: "FI_INTELLIGENCE_GOVERNED_REPLAY_ENABLED must be 1 to execute governed replay runs.",
      });
      process.exit(0);
      return;
    }

    const r = await executeApprovedReplayRun(v.runId, null, {
      omitPlatformAdminAssertForOperatorCli: true,
    });
    printJsonLine(v.printJson, {
      action: "execute_run",
      runId: v.runId,
      ok: r.ok,
      ...(r.ok
        ? { replay_summary: r.data.replay_summary, warnings: r.data.warnings, load_error: r.data.load_error }
        : { code: r.code, message: r.message, warnings: r.warnings }),
    });
    process.exit(0);
    return;
  }

  process.stderr.write("Unhandled CLI branch\n");
  process.exit(1);
}

main().catch((e) => {
  process.stderr.write(e instanceof Error ? `${e.message}\n` : String(e));
  process.exit(1);
});
