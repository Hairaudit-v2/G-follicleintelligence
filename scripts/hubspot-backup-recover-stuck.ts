/**
 * Stuck-run recovery for incremental HubSpot backups.
 * Does NOT advance watermarks. Does NOT delete checkpoints.
 *
 * Usage:
 *   npm run hubspot:backup:recover-stuck -- --run-id <uuid> --reason "stale after process crash" [--to failed|started]
 */

const DEFAULT_TENANT_ID = "c2615b95-b707-4485-aa5f-be8f78ec868a";
const DEFAULT_INTEGRATION_ID = "ade8a7d0-ad45-4fd7-8d53-61d4806b95f6";

function argValue(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return null;
  const value = process.argv[idx + 1];
  if (!value || value.startsWith("--")) return null;
  return value.trim();
}

export {};

async function main(): Promise<void> {
  const runId = argValue("--run-id");
  const reason = argValue("--reason");
  const to = (argValue("--to") ?? "failed") as "failed" | "started";
  if (!runId) throw new Error("--run-id is required.");
  if (!reason) throw new Error("--reason is required.");
  if (to !== "failed" && to !== "started") {
    throw new Error("--to must be failed or started.");
  }
  const tenantId = argValue("--tenant-id") ?? DEFAULT_TENANT_ID;
  const integrationId = argValue("--integration-id") ?? DEFAULT_INTEGRATION_ID;
  const actorAuthUserId = process.env.FI_HUBSPOT_RECOVERY_ACTOR_AUTH_USER_ID?.trim() ?? "";
  if (!actorAuthUserId) throw new Error("FI_HUBSPOT_RECOVERY_ACTOR_AUTH_USER_ID is required.");

  const [{ supabaseAdmin }, connector] = await Promise.all([
    import("@/lib/supabaseAdmin"),
    import("@/src/lib/onboarding-os/hubspotConnector.server"),
  ]);

  const result = await connector.recoverStuckHubspotIncrementalRun(
    integrationId,
    tenantId,
    { runId, reason, transitionTo: to },
    {
      actorAuthUserId,
      supabaseClientForTests: supabaseAdmin(),
      trustedServiceOperation: true,
    }
  );

  if (!result.ok) {
    process.stdout.write(
      `${JSON.stringify({ phase: "incremental_recover_stuck", ok: false, error: result.error })}\n`
    );
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    `${JSON.stringify({
      phase: "incremental_recover_stuck",
      ok: true,
      run_id: runId,
      previous_status: result.previousStatus,
      transition_to: to,
      watermark_advanced: false,
    })}\n`
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "HubSpot stuck-run recovery failed."}\n`
  );
  process.exitCode = 1;
});
