/**
 * FI-TEAM-COHESION-1D — mint short-lived staff-access fixture tokens (no email/auth).
 *
 * Usage:
 *   node --import tsx scripts/e2e/mint-staff-access-token-fixtures.mts
 *   node --import tsx scripts/e2e/mint-staff-access-token-fixtures.mts --cleanup
 *
 * Prints FI_E2E_STAFF_ACCESS_* env lines; --cleanup deletes ids from the fixture file.
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

import { loadRepoEnvFiles } from "../lib/loadRepoEnvFiles.mjs";

loadRepoEnvFiles();

const TENANT_ID =
  process.env.FI_E2E_TENANT_ID?.trim() || "c2615b95-b707-4485-aa5f-be8f78ec868a";
/** Danica — roster view-only fixture; render-only (never Accept / Save PIN). */
const STAFF_MEMBER_ID = "d252fa42-2d7f-499c-b82d-82c536521575";
const FI_STAFF_ID = "6b7fcebb-557e-4236-b0a9-d37b21c87746";
const SINK_EMAIL = "e2e-staff-access+cohesion1d@example.test";

const FIXTURE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../e2e/.playwright/staff-access-token-fixture.json"
);

function hashToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

type FixtureRecord = {
  tenantId: string;
  staffMemberId: string;
  invitationId: string;
  pinSetupId: string;
  acceptToken: string;
  pinSetupToken: string;
  mintedAt: string;
};

function adminClient() {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function cleanup(ids?: FixtureRecord) {
  const record: FixtureRecord | null =
    ids ??
    (existsSync(FIXTURE_PATH)
      ? (JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as FixtureRecord)
      : null);
  if (!record) {
    console.log("No fixture file to clean up.");
    return;
  }

  const supabase = adminClient();
  const { error: pinErr } = await supabase
    .from("fi_staff_access_pin_setups")
    .delete()
    .eq("id", record.pinSetupId)
    .eq("tenant_id", record.tenantId);
  if (pinErr) throw new Error(`pin cleanup: ${pinErr.message}`);

  // Accept-page load may mint an extra pending setup when fi_staff_id is present —
  // we leave fi_staff_id null on the invite to avoid that; still scrub any leftover
  // sink-email invitation rows we own.
  const { error: invErr } = await supabase
    .from("fi_staff_login_invitations")
    .delete()
    .eq("id", record.invitationId)
    .eq("tenant_id", record.tenantId);
  if (invErr) throw new Error(`invite cleanup: ${invErr.message}`);

  if (existsSync(FIXTURE_PATH)) unlinkSync(FIXTURE_PATH);
  console.log("Cleaned fixture rows:", record.invitationId, record.pinSetupId);
}

async function mint() {
  if (existsSync(FIXTURE_PATH)) {
    console.log("Existing fixture found — cleaning first.");
    await cleanup();
  }

  const supabase = adminClient();
  const now = new Date();
  const expires = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const acceptToken = randomUUID();
  const pinSetupToken = randomUUID();
  const nowIso = now.toISOString();
  const expiresIso = expires.toISOString();

  // Omit fi_staff_id so accept-page load does not auto-mint a PIN setup.
  const { data: invite, error: inviteErr } = await supabase
    .from("fi_staff_login_invitations")
    .insert({
      tenant_id: TENANT_ID,
      staff_member_id: STAFF_MEMBER_ID,
      fi_staff_id: null,
      invite_email: SINK_EMAIL,
      invite_token_hash: hashToken(acceptToken),
      invite_link: `https://follicleintelligence.ai/fi-admin/${TENANT_ID}/workforce-os/staff-access/accept/${acceptToken}`,
      auth_invite_link: null,
      status: "pending",
      invited_at: nowIso,
      expires_at: expiresIso,
      resend_count: 0,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("id")
    .single();
  if (inviteErr) throw new Error(`invite insert: ${inviteErr.message}`);
  const invitationId = String((invite as { id: string }).id);

  const { data: pin, error: pinErr } = await supabase
    .from("fi_staff_access_pin_setups")
    .insert({
      tenant_id: TENANT_ID,
      staff_member_id: STAFF_MEMBER_ID,
      fi_staff_id: FI_STAFF_ID,
      login_invitation_id: invitationId,
      setup_token_hash: hashToken(pinSetupToken),
      status: "pending",
      expires_at: expiresIso,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("id")
    .single();
  if (pinErr) {
    await supabase.from("fi_staff_login_invitations").delete().eq("id", invitationId);
    throw new Error(`pin insert: ${pinErr.message}`);
  }
  const pinSetupId = String((pin as { id: string }).id);

  const record: FixtureRecord = {
    tenantId: TENANT_ID,
    staffMemberId: STAFF_MEMBER_ID,
    invitationId,
    pinSetupId,
    acceptToken,
    pinSetupToken,
    mintedAt: nowIso,
  };
  writeFileSync(FIXTURE_PATH, JSON.stringify(record, null, 2));

  console.log("Minted staff-access fixtures (2h TTL, no email sent).");
  console.log(`FI_E2E_STAFF_ACCESS_ACCEPT_TOKEN=${acceptToken}`);
  console.log(`FI_E2E_STAFF_ACCESS_PIN_SETUP_TOKEN=${pinSetupToken}`);
  console.log(`fixture_file=${FIXTURE_PATH}`);
}

const cleanupOnly = process.argv.includes("--cleanup");
if (cleanupOnly) {
  await cleanup();
} else {
  await mint();
}
