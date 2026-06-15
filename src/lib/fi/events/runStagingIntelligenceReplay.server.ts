import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { executeApprovedReplayRun } from "./intelligenceReplayRunService.server";
import type { FiIntelligenceReplayRunRow } from "./intelligenceReplayRunTypes";
import {
  STAGING_INTELLIGENCE_REPLAY_ROLLBACK_INSTRUCTIONS,
  isStagingIntelligenceActivationEnabled,
} from "./stagingActivationEnv";
import { isStagingActivationEventAllowed } from "./stagingActivationAllowlist";

export type RunStagingIntelligenceReplaySuccess = {
  replay_summary: import("./intelligenceEventLogReplayTypes").IntelligenceEventLogReplaySummary;
  warnings: import("./intelligenceEventLogReplayTypes").IntelligenceEventLogReplayWarning[];
  load_error?: string;
  rollback_instructions: readonly string[];
};

export type RunStagingIntelligenceReplayResult =
  | { ok: true; data: RunStagingIntelligenceReplaySuccess }
  | {
      ok: false;
      code: string;
      message: string;
      warnings?: string[];
      rollback_instructions: readonly string[];
    };

function assertAdmin(omit?: boolean): Promise<void> {
  if (omit) return Promise.resolve();
  return import("@/src/lib/fiOs/fiOsPlatformSystemGate.server").then((m) => m.assertFiPlatformAdminSystemAccess());
}

function rollback(): readonly string[] {
  return STAGING_INTELLIGENCE_REPLAY_ROLLBACK_INSTRUCTIONS;
}

/**
 * Stage 17: executes an already-approved governed replay run in **enqueue_shadow** only,
 * for the staging allow-listed event, when staging activation env is satisfied.
 * Never runs in production; does not add downstream dispatch (same as Stage 14/15 replay).
 */
export async function runStagingIntelligenceReplay(
  runId: string,
  actorId: string | null,
  options?: {
    supabaseClientForTests?: SupabaseClient;
    omitPlatformAdminAssertForOperatorCli?: boolean;
    env?: Record<string, string | undefined>;
    nodeEnv?: string;
  }
): Promise<RunStagingIntelligenceReplayResult> {
  const env = options?.env ?? (process.env as Record<string, string | undefined>);
  const nodeEnv = options?.nodeEnv ?? env.NODE_ENV ?? "";

  if (nodeEnv === "production") {
    return {
      ok: false,
      code: "staging_replay_production_blocked",
      message: "Staging intelligence replay activation is never permitted when NODE_ENV is production.",
      rollback_instructions: rollback(),
    };
  }

  if (!isStagingIntelligenceActivationEnabled({ env, nodeEnv })) {
    return {
      ok: false,
      code: "staging_activation_disabled",
      message:
        "Staging activation requires NODE_ENV !== production, FI_INTELLIGENCE_GOVERNED_REPLAY_ENABLED=1, FI_INTELLIGENCE_STAGING_ACTIVATION_ENABLED=1, and FI_INTELLIGENCE_STAGING_ALLOWED_EVENT=hairaudit.audit.completed.",
      rollback_instructions: rollback(),
    };
  }

  await assertAdmin(options?.omitPlatformAdminAssertForOperatorCli);

  const supabase = options?.supabaseClientForTests ?? supabaseAdmin();
  const { data: row, error: loadErr } = await supabase.from("fi_intelligence_replay_runs").select("*").eq("id", runId).maybeSingle();

  if (loadErr || !row) {
    return {
      ok: false,
      code: "not_found",
      message: loadErr?.message ?? "run not found",
      rollback_instructions: rollback(),
    };
  }

  const run = row as FiIntelligenceReplayRunRow;

  if (run.approval_status !== "approved") {
    return {
      ok: false,
      code: "invalid_state",
      message: `Staging activate requires approval_status approved; got ${run.approval_status}.`,
      rollback_instructions: rollback(),
    };
  }

  if (run.replay_mode !== "enqueue_shadow") {
    return {
      ok: false,
      code: "staging_replay_mode_blocked",
      message: `Staging activation run path requires replay_mode enqueue_shadow; got ${run.replay_mode}.`,
      rollback_instructions: rollback(),
    };
  }

  if (!isStagingActivationEventAllowed(run.event_name)) {
    return {
      ok: false,
      code: "staging_event_not_allowed",
      message: `Staging activation only allows hairaudit.audit.completed; got ${JSON.stringify(run.event_name)}.`,
      rollback_instructions: rollback(),
    };
  }

  const exec = await executeApprovedReplayRun(runId, actorId, {
    supabaseClientForTests: options?.supabaseClientForTests,
    omitPlatformAdminAssertForOperatorCli: options?.omitPlatformAdminAssertForOperatorCli,
    env,
    nodeEnv,
  });

  if (!exec.ok) {
    return {
      ok: false,
      code: exec.code,
      message: exec.message,
      warnings: exec.warnings,
      rollback_instructions: rollback(),
    };
  }

  return {
    ok: true,
    data: {
      replay_summary: exec.data.replay_summary,
      warnings: exec.data.warnings,
      load_error: exec.data.load_error,
      rollback_instructions: rollback(),
    },
  };
}
