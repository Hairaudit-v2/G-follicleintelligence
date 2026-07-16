/**
 * FI-HUBSPOT-BACKUP-1 Stage P3
 *
 * Manual scheduled-path runner (same contract as Vercel Cron).
 *
 * Usage:
 *   npm run hubspot:backup:scheduled -- --dataset notes
 *
 * Optional:
 *   --tenant-id <uuid>
 *   --integration-id <uuid>
 *   --notification-test   (privacy-safe alert injection; no backup)
 *
 * Requires: FI_HUBSPOT_RECOVERY_ACTOR_AUTH_USER_ID
 * Requires: FI_HUBSPOT_INCREMENTAL_BACKUP_ENABLED=true (for backup path)
 */

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
        "hubspot:backup:scheduled",
        "  --dataset notes",
        "  [--tenant-id <uuid>]",
        "  [--integration-id <uuid>]",
        "  [--notification-test]",
        "",
      ].join("\n")
    );
    return;
  }

  const dataset = argValue("--dataset") ?? "notes";
  if (dataset !== "notes") {
    throw new Error('Only --dataset notes is supported.');
  }

  const tenantId = argValue("--tenant-id");
  const integrationId = argValue("--integration-id");
  if (tenantId) process.env.FI_HUBSPOT_INCREMENTAL_BACKUP_TENANT_ID = tenantId;
  if (integrationId) process.env.FI_HUBSPOT_INCREMENTAL_BACKUP_INTEGRATION_ID = integrationId;

  const actorAuthUserId = process.env.FI_HUBSPOT_RECOVERY_ACTOR_AUTH_USER_ID?.trim() ?? "";
  if (!actorAuthUserId) throw new Error("FI_HUBSPOT_RECOVERY_ACTOR_AUTH_USER_ID is required.");

  if (hasFlag("--notification-test")) {
    const [{ supabaseAdmin }, alerts] = await Promise.all([
      import("@/lib/supabaseAdmin"),
      import("@/src/lib/onboarding-os/hubspotIncrementalBackupAlerts.server"),
    ]);
    const resolvedTenant =
      process.env.FI_HUBSPOT_INCREMENTAL_BACKUP_TENANT_ID?.trim() ||
      "c2615b95-b707-4485-aa5f-be8f78ec868a";
    const resolvedIntegration =
      process.env.FI_HUBSPOT_INCREMENTAL_BACKUP_INTEGRATION_ID?.trim() ||
      "ade8a7d0-ad45-4fd7-8d53-61d4806b95f6";
    const result = await alerts.sendHubspotIncrementalBackupNotificationTest(
      { tenantId: resolvedTenant, integrationId: resolvedIntegration },
      { supabaseClientForTests: supabaseAdmin() }
    );
    process.stdout.write(
      `${JSON.stringify({
        phase: "notification_test",
        ok: true,
        created: result.created,
        alert_id: result.alertId,
        idempotency_key: result.idempotencyKey,
      })}\n`
    );
    return;
  }

  const { runScheduledHubspotIncrementalNotesBackup } = await import(
    "@/src/lib/onboarding-os/hubspotScheduledIncrementalBackup.server"
  );

  const result = await runScheduledHubspotIncrementalNotesBackup({
    actorAuthUserId,
  });

  process.stdout.write(
    `${JSON.stringify({
      phase: "scheduled_incremental_backup",
      ...result,
    })}\n`
  );
  if (!result.ok && result.outcome !== "disabled") {
    process.exitCode = result.outcome === "overlap_blocked" ? 3 : 1;
  }
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Scheduled HubSpot backup failed."}\n`
  );
  process.exitCode = 1;
});
