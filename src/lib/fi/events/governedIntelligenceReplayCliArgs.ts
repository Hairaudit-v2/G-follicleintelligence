import {
  parseIntelligenceEventLogReplayCliArgs,
  type IntelligenceEventLogReplayCliResult,
} from "./intelligenceEventLogReplayCliArgs";
import type { FiIntelligenceReplayRunMode } from "./intelligenceReplayRunTypes";

export type ReplayIntelligenceEventLogsScriptParsed =
  | { kind: "direct_replay"; value: IntelligenceEventLogReplayCliResult }
  | {
      kind: "create_run";
      value: IntelligenceEventLogReplayCliResult;
    }
  | { kind: "submit_for_approval"; runId: string; printJson: boolean }
  | { kind: "approve_run"; runId: string; printJson: boolean }
  | { kind: "execute_run"; runId: string; printJson: boolean };

function countGovernedActions(args: string[]): number {
  let c = 0;
  for (const a of args) {
    if (a === "--create-run" || a === "--submit-for-approval" || a === "--approve-run" || a === "--execute-run") {
      c += 1;
    }
  }
  return c;
}

function readRunIdAfterFlag(args: string[], flag: string): { ok: true; runId: string } | { ok: false; message: string } {
  const i = args.indexOf(flag);
  if (i < 0) return { ok: false, message: `internal: missing ${flag}` };
  const id = args[i + 1];
  if (!id || id.startsWith("--")) {
    return { ok: false, message: `Missing run id after ${flag}` };
  }
  return { ok: true, runId: id };
}

/**
 * Parses argv for `scripts/replay-intelligence-event-logs.ts`, including Stage 15 governed run actions.
 */
export function parseReplayIntelligenceEventLogsScriptArgs(
  argv: string[]
): { ok: true; value: ReplayIntelligenceEventLogsScriptParsed } | { ok: false; exitCode: number; message: string } {
  const tail = argv.slice(2);
  const governedCount = countGovernedActions(tail);
  if (governedCount > 1) {
    return { ok: false, exitCode: 2, message: "Only one governed action flag is allowed per invocation." };
  }

  const printJson = tail.includes("--json");

  if (tail.includes("--create-run")) {
    const replayTail = tail.filter((a) => a !== "--create-run");
    const nested = parseIntelligenceEventLogReplayCliArgs(["node", "replay.mjs", ...replayTail], {
      includeDispatchFutureReplayMode: true,
    });
    if (!nested.ok) return nested;
    return { ok: true, value: { kind: "create_run", value: nested.value } };
  }

  if (tail.includes("--submit-for-approval")) {
    const id = readRunIdAfterFlag(tail, "--submit-for-approval");
    if (!id.ok) return { ok: false, exitCode: 2, message: id.message };
    return { ok: true, value: { kind: "submit_for_approval", runId: id.runId, printJson } };
  }

  if (tail.includes("--approve-run")) {
    const id = readRunIdAfterFlag(tail, "--approve-run");
    if (!id.ok) return { ok: false, exitCode: 2, message: id.message };
    return { ok: true, value: { kind: "approve_run", runId: id.runId, printJson } };
  }

  if (tail.includes("--execute-run")) {
    const id = readRunIdAfterFlag(tail, "--execute-run");
    if (!id.ok) return { ok: false, exitCode: 2, message: id.message };
    return { ok: true, value: { kind: "execute_run", runId: id.runId, printJson } };
  }

  const direct = parseIntelligenceEventLogReplayCliArgs(argv);
  if (!direct.ok) return direct;
  return { ok: true, value: { kind: "direct_replay", value: direct.value } };
}

export function isExecutableReplayModeForIntelligenceEventLogs(
  mode: FiIntelligenceReplayRunMode
): mode is "dry_run" | "validate_only" | "enqueue_shadow" {
  return mode === "dry_run" || mode === "validate_only" || mode === "enqueue_shadow";
}
