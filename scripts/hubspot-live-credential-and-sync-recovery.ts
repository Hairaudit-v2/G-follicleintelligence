const TENANT_ID = "c2615b95-b707-4485-aa5f-be8f78ec868a";
const INTEGRATION_ID = "ade8a7d0-ad45-4fd7-8d53-61d4806b95f6";

async function main(): Promise<void> {
  const [{ supabaseAdmin }, connector] = await Promise.all([
    import("@/lib/supabaseAdmin"),
    import("@/src/lib/onboarding-os/hubspotConnector.server"),
  ]);
  const supabase = supabaseAdmin();
  const actorAuthUserId = process.env.FI_HUBSPOT_RECOVERY_ACTOR_AUTH_USER_ID?.trim() ?? "";
  if (!actorAuthUserId) throw new Error("FI_HUBSPOT_RECOVERY_ACTOR_AUTH_USER_ID is required.");

  const live = await connector.verifyHubspotCredentialLive(INTEGRATION_ID, TENANT_ID, {
    actorAuthUserId,
    supabaseClientForTests: supabase,
    trustedServiceOperation: true,
  });
  if (!live.ok) throw new Error(live.error);
  process.stdout.write(`${JSON.stringify({ phase: "live_probe", ...live.verification })}\n`);
  if (!live.verification.credentialValid || !live.verification.portalIdentityMatch) return;

  const sync = await connector.runHubspotSync(INTEGRATION_ID, TENANT_ID, {
    actorAuthUserId,
    supabaseClientForTests: supabase,
    trustedServiceOperation: true,
  });
  process.stdout.write(`${JSON.stringify({ phase: "sync", ok: sync.ok, status: sync.ok ? sync.syncRun.status : "failed" })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "HubSpot recovery failed."}\n`);
  process.exitCode = 1;
});
