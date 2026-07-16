/**
 * Resume an incremental HubSpot backup by run ID.
 * Reloads immutable cutoff_from / cutoff_to from the persisted run.
 *
 * Usage:
 *   npm run hubspot:backup:resume -- --run-id <uuid>
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
  if (!runId) throw new Error("--run-id is required.");
  const tenantId = argValue("--tenant-id") ?? DEFAULT_TENANT_ID;
  const integrationId = argValue("--integration-id") ?? DEFAULT_INTEGRATION_ID;
  const actorAuthUserId = process.env.FI_HUBSPOT_RECOVERY_ACTOR_AUTH_USER_ID?.trim() ?? "";
  if (!actorAuthUserId) throw new Error("FI_HUBSPOT_RECOVERY_ACTOR_AUTH_USER_ID is required.");

  const [{ supabaseAdmin }, connector] = await Promise.all([
    import("@/lib/supabaseAdmin"),
    import("@/src/lib/onboarding-os/hubspotConnector.server"),
  ]);

  const result = await connector.resumeHubspotIncrementalBackup(integrationId, tenantId, runId, {
    actorAuthUserId,
    supabaseClientForTests: supabaseAdmin(),
    trustedServiceOperation: true,
  });

  if (!result.ok) {
    process.stdout.write(
      `${JSON.stringify({
        phase: "incremental_resume",
        ok: false,
        error: result.error,
        exit_hint: result.exitHint ?? "failed",
      })}\n`
    );
    process.exitCode = result.exitHint === "validation" ? 2 : 1;
    return;
  }

  process.stdout.write(
    `${JSON.stringify({
      phase: "incremental_resume",
      ok: true,
      run_id: result.runId,
      status: result.status,
      verification_state: result.verificationState,
      watermark_advanced: result.watermarkAdvanced,
      cutoff_from: result.cutoffFrom,
      cutoff_to: result.cutoffTo,
      counters: result.counters,
    })}\n`
  );
  if (result.status !== "completed" || result.verificationState !== "passed") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "HubSpot incremental resume failed."}\n`
  );
  process.exitCode = 1;
});
