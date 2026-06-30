import type { FiIntelligenceReplayRunMode } from "./intelligenceReplayRunTypes";
import type {
  IntelligenceEventLogReplayFilters,
  IntelligenceEventLogReplayMode,
} from "./intelligenceEventLogReplayTypes";

export type ParsedIntelligenceReplayCliMode =
  | IntelligenceEventLogReplayMode
  | FiIntelligenceReplayRunMode;

export type IntelligenceEventLogReplayCliResult = {
  mode: ParsedIntelligenceReplayCliMode;
  filters: IntelligenceEventLogReplayFilters;
  printJson: boolean;
};

function readValue(
  args: string[],
  i: number
): { value: string; nextIndex: number } | { error: string } {
  const v = args[i + 1];
  if (v === undefined || v.startsWith("--")) {
    return { error: "Missing value for flag" };
  }
  return { value: v, nextIndex: i + 1 };
}

/**
 * Parse argv for `scripts/replay-intelligence-event-logs.ts`.
 * Returns `{ ok: false, exitCode, message }` for invalid args (caller should exit non-zero).
 *
 * @param options.includeDispatchFutureReplayMode — when true (governed `--create-run` path), `--mode dispatch_future` is accepted for planning rows only.
 */
export function parseIntelligenceEventLogReplayCliArgs(
  argv: string[],
  options?: { includeDispatchFutureReplayMode?: boolean }
):
  | { ok: true; value: IntelligenceEventLogReplayCliResult }
  | { ok: false; exitCode: number; message: string } {
  const args = argv.slice(2);
  let mode: ParsedIntelligenceReplayCliMode = "dry_run";
  const filters: IntelligenceEventLogReplayFilters = {};
  let printJson = false;

  const MODES = new Set<ParsedIntelligenceReplayCliMode>(
    options?.includeDispatchFutureReplayMode
      ? (["dry_run", "validate_only", "enqueue_shadow", "dispatch_future"] as const)
      : (["dry_run", "validate_only", "enqueue_shadow"] as const)
  );

  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--json") {
      printJson = true;
      continue;
    }
    if (a === "--mode") {
      const r = readValue(args, i);
      if ("error" in r) return { ok: false, exitCode: 2, message: "Missing value for --mode" };
      if (!MODES.has(r.value as ParsedIntelligenceReplayCliMode)) {
        return { ok: false, exitCode: 2, message: `Invalid --mode ${JSON.stringify(r.value)}` };
      }
      mode = r.value as ParsedIntelligenceReplayCliMode;
      i = r.nextIndex;
      continue;
    }
    if (a === "--event-name") {
      const r = readValue(args, i);
      if ("error" in r)
        return { ok: false, exitCode: 2, message: "Missing value for --event-name" };
      filters.event_name = r.value;
      i = r.nextIndex;
      continue;
    }
    if (a === "--source") {
      const r = readValue(args, i);
      if ("error" in r) return { ok: false, exitCode: 2, message: "Missing value for --source" };
      filters.source = r.value;
      i = r.nextIndex;
      continue;
    }
    if (a === "--status") {
      const r = readValue(args, i);
      if ("error" in r) return { ok: false, exitCode: 2, message: "Missing value for --status" };
      filters.status = r.value;
      i = r.nextIndex;
      continue;
    }
    if (a === "--privacy-level") {
      const r = readValue(args, i);
      if ("error" in r)
        return { ok: false, exitCode: 2, message: "Missing value for --privacy-level" };
      filters.privacy_level = r.value;
      i = r.nextIndex;
      continue;
    }
    if (a === "--since") {
      const r = readValue(args, i);
      if ("error" in r) return { ok: false, exitCode: 2, message: "Missing value for --since" };
      filters.since = r.value;
      i = r.nextIndex;
      continue;
    }
    if (a === "--until") {
      const r = readValue(args, i);
      if ("error" in r) return { ok: false, exitCode: 2, message: "Missing value for --until" };
      filters.until = r.value;
      i = r.nextIndex;
      continue;
    }
    if (a === "--correlation-id") {
      const r = readValue(args, i);
      if ("error" in r)
        return { ok: false, exitCode: 2, message: "Missing value for --correlation-id" };
      filters.correlation_id = r.value;
      i = r.nextIndex;
      continue;
    }
    if (a === "--limit") {
      const r = readValue(args, i);
      if ("error" in r) return { ok: false, exitCode: 2, message: "Missing value for --limit" };
      const n = Number(r.value);
      if (!Number.isFinite(n)) return { ok: false, exitCode: 2, message: "Invalid --limit" };
      filters.limit = n;
      i = r.nextIndex;
      continue;
    }
    return { ok: false, exitCode: 2, message: `Unknown argument ${JSON.stringify(a)}` };
  }

  return { ok: true, value: { mode, filters, printJson } };
}
