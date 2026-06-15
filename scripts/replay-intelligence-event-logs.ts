/**
 * Stage 14: operator CLI for intelligence event log replay (dry-run by default).
 *
 * Run from repo root with Supabase service role (same as other admin scripts):
 *   pnpm exec node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs scripts/replay-intelligence-event-logs.ts
 *
 * Or: `pnpm run replay:intelligence-event-logs` (see package.json).
 *
 * Loads `.env.local` / `.env` like other maintenance scripts. Exits non-zero only on invalid args.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseIntelligenceEventLogReplayCliArgs } from "../src/lib/fi/events/intelligenceEventLogReplayCliArgs";
import { replayIntelligenceEventLogs } from "../src/lib/fi/events/replayIntelligenceEventLogs.server";

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

async function main(): Promise<void> {
  loadRepoEnvFiles();

  const parsed = parseIntelligenceEventLogReplayCliArgs(process.argv);
  if (!parsed.ok) {
    process.stderr.write(`${parsed.message}\n`);
    process.exit(parsed.exitCode);
  }

  const { mode, filters, printJson } = parsed.value;

  const result = await replayIntelligenceEventLogs({
    mode,
    filters,
    omitPlatformAdminAssertForOperatorCli: true,
  });

  const out = {
    mode,
    filters,
    summary: result.summary,
    warnings: result.warnings,
    load_error: result.load_error,
  };

  const text = printJson ? JSON.stringify(out, null, 2) : JSON.stringify(out);
  process.stdout.write(`${text}\n`);

  process.exit(0);
}

main().catch((e) => {
  process.stderr.write(e instanceof Error ? `${e.message}\n` : String(e));
  process.exit(1);
});
