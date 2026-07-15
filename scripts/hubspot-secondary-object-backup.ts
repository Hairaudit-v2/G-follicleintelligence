const TENANT_ID = "c2615b95-b707-4485-aa5f-be8f78ec868a";
const INTEGRATION_ID = "ade8a7d0-ad45-4fd7-8d53-61d4806b95f6";

export {};

async function main(): Promise<void> {
  const [{ supabaseAdmin }, connector] = await Promise.all([
    import("@/lib/supabaseAdmin"), import("@/src/lib/onboarding-os/hubspotConnector.server"),
  ]);
  const actorAuthUserId = process.env.FI_HUBSPOT_RECOVERY_ACTOR_AUTH_USER_ID?.trim() ?? "";
  if (!actorAuthUserId) throw new Error("FI_HUBSPOT_RECOVERY_ACTOR_AUTH_USER_ID is required.");
  const result = await connector.runHubspotSecondaryObjectBackup(INTEGRATION_ID, TENANT_ID, {
    actorAuthUserId, supabaseClientForTests: supabaseAdmin(), trustedServiceOperation: true,
  });
  if (!result.ok) throw new Error(result.error);
  process.stdout.write(`${JSON.stringify({ phase: "secondary_backup", run_id: result.runId,
    status: result.status, counters: result.counters })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "HubSpot secondary backup failed."}\n`);
  process.exitCode = 1;
});
