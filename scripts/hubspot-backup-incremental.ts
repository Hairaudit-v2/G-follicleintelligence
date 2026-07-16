/**
 * FI-HUBSPOT-INCREMENTAL-BACKUP-1
 *
 * Incremental HubSpot notes backup with fixed UTC cutoffs.
 *
 * Usage:
 *   npm run hubspot:backup:incremental -- --dataset notes \
 *     --cutoff-from 2026-07-16T00:00:00.000Z \
 *     --cutoff-to 2026-07-16T01:00:00.000Z
 *
 * Optional:
 *   --tenant-id <uuid>   (defaults to Evolved recovery tenant)
 *   --integration-id <uuid>
 *   --resume-run-id <uuid>
 *
 * Requires: FI_HUBSPOT_RECOVERY_ACTOR_AUTH_USER_ID
 * Does not create HubSpot objects. Does not schedule jobs.
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

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

export {};

async function main(): Promise<void> {
  if (hasFlag("--help") || hasFlag("-h")) {
    process.stdout.write(
      [
        "hubspot:backup:incremental",
        "  --dataset notes",
        "  --cutoff-from <UTC ISO-8601 with Z or offset>",
        "  --cutoff-to <UTC ISO-8601 with Z or offset>",
        "  [--tenant-id <uuid>]",
        "  [--integration-id <uuid>]",
        "  [--resume-run-id <uuid>]",
        "",
      ].join("\n")
    );
    return;
  }

  const dataset = argValue("--dataset") ?? "notes";
  const cutoffFrom = argValue("--cutoff-from");
  const cutoffTo = argValue("--cutoff-to");
  const tenantId = argValue("--tenant-id") ?? DEFAULT_TENANT_ID;
  const integrationId = argValue("--integration-id") ?? DEFAULT_INTEGRATION_ID;
  const resumeRunId = argValue("--resume-run-id");

  if (!cutoffFrom || !cutoffTo) {
    throw new Error("Both --cutoff-from and --cutoff-to are required (explicit UTC ISO-8601).");
  }

  const actorAuthUserId = process.env.FI_HUBSPOT_RECOVERY_ACTOR_AUTH_USER_ID?.trim() ?? "";
  if (!actorAuthUserId) throw new Error("FI_HUBSPOT_RECOVERY_ACTOR_AUTH_USER_ID is required.");

  const [{ supabaseAdmin }, connector] = await Promise.all([
    import("@/lib/supabaseAdmin"),
    import("@/src/lib/onboarding-os/hubspotConnector.server"),
  ]);

  const result = await connector.runHubspotIncrementalNotesBackup(
    integrationId,
    tenantId,
    {
      dataset,
      cutoffFrom,
      cutoffTo,
      resumeRunId,
    },
    {
      actorAuthUserId,
      supabaseClientForTests: supabaseAdmin(),
      trustedServiceOperation: true,
    }
  );

  if (!result.ok) {
    process.stdout.write(
      `${JSON.stringify({
        phase: "incremental_backup",
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
      phase: "incremental_backup",
      ok: true,
      run_id: result.runId,
      status: result.status,
      verification_state: result.verificationState,
      watermark_advanced: result.watermarkAdvanced,
      empty_range: result.emptyRange,
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
    `${error instanceof Error ? error.message : "HubSpot incremental backup failed."}\n`
  );
  process.exitCode = 1;
});
