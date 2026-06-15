import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { parseReplayIntelligenceEventLogsScriptArgs } from "./governedIntelligenceReplayCliArgs";
import { STAGING_INTELLIGENCE_ACTIVATION_ALLOWED_EVENT } from "./stagingActivationAllowlist";
import { isStagingIntelligenceActivationEnabled } from "./stagingActivationEnv";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("Stage 18 staging rehearsal contracts (docs + guardrails)", () => {
  it("keeps staging activation allow-list pinned to hairaudit.audit.completed", () => {
    assert.equal(STAGING_INTELLIGENCE_ACTIVATION_ALLOWED_EVENT, "hairaudit.audit.completed");
  });

  it("keeps production staging activation false even when staging env vars are set", () => {
    assert.equal(
      isStagingIntelligenceActivationEnabled({
        env: {
          FI_INTELLIGENCE_GOVERNED_REPLAY_ENABLED: "1",
          FI_INTELLIGENCE_STAGING_ACTIVATION_ENABLED: "1",
          FI_INTELLIGENCE_STAGING_ALLOWED_EVENT: "hairaudit.audit.completed",
        },
        nodeEnv: "production",
      }),
      false
    );
  });

  it("blocks direct CLI replay when --mode dispatch_future (no planning-only path)", () => {
    const r = parseReplayIntelligenceEventLogsScriptArgs([
      "node",
      "replay-intelligence-event-logs.ts",
      "--mode",
      "dispatch_future",
      "--json",
    ]);
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.exitCode, 2);
    assert.match(r.message, /dispatch_future|Invalid --mode/i);
  });

  it("documents No production activation in the Stage 18 validation runbook", () => {
    const p = join(__dirname, "../../../../docs/stage18-staging-replay-validation-runbook.md");
    const text = readFileSync(p, "utf8");
    assert.match(text, /No production activation/i);
  });

  it("keeps governed execute blocking dispatch_future in source", () => {
    const p = join(__dirname, "intelligenceReplayRunService.server.ts");
    const src = readFileSync(p, "utf8");
    assert.match(src, /dispatch_future_blocked/);
    assert.match(src, /dispatch_future/);
  });
});
