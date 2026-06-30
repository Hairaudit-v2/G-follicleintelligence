#!/usr/bin/env tsx
/**
 * Provision a real Evolved operator: Supabase Auth invite + fi_users row.
 * Dry-run by default; pass --commit to execute.
 *
 * Usage:
 *   npx tsx scripts/provision-evolved-operator.ts --email=ops@evolvedhair.com.au --role=fi_admin --display-name="Ops Lead"
 *   npx tsx scripts/provision-evolved-operator.ts --email=... --role=crm_operator --commit
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: EVOLVED_PERTH_TENANT_ID, FI_BASE_URL or NEXT_PUBLIC_SITE_URL (invite redirect)
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { supabaseAdmin } from "../lib/supabaseAdmin";

const VALID_ROLES = new Set(["fi_admin", "crm_operator", "clinical_operator"]);

function loadRepoEnvFiles(): void {
  for (const name of [".env.local", ".env"] as const) {
    const p = resolve(process.cwd(), name);
    if (!existsSync(p)) continue;
    let raw = readFileSync(p, "utf8");
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const withoutExport = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
      const eq = withoutExport.indexOf("=");
      if (eq <= 0) continue;
      const key = withoutExport.slice(0, eq).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
      let val = withoutExport.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}

function arg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3).trim() : null;
}

function redactEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 1) return "***";
  return `${email[0]}***@${email.slice(at + 1)}`;
}

loadRepoEnvFiles();

async function resolveTenantId(supabase: ReturnType<typeof supabaseAdmin>): Promise<string> {
  const fromEnv = process.env.EVOLVED_PERTH_TENANT_ID?.trim();
  if (fromEnv) {
    const { data, error } = await supabase.from("fi_tenants").select("id").eq("id", fromEnv).maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return fromEnv;
    console.warn(`WARN: EVOLVED_PERTH_TENANT_ID not found in DB; resolving by slug`);
  }
  const { data, error } = await supabase.from("fi_tenants").select("id").eq("slug", "evolved").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No fi_tenants row with slug=evolved");
  return String((data as { id: string }).id);
}

async function main(): Promise<void> {
  const fiUserIdArg = arg("fi-user-id")?.trim() ?? "";
  let email = arg("email")?.toLowerCase() ?? "";
  const role = arg("role") ?? "crm_operator";
  const displayName = arg("display-name") ?? "";
  const promoteRole = process.argv.includes("--promote-role");
  const commit = process.argv.includes("--commit");

  const supabase = supabaseAdmin();
  const tenantId = await resolveTenantId(supabase);

  if (fiUserIdArg) {
    const { data: row, error } = await supabase
      .from("fi_users")
      .select("id, email, role, auth_user_id")
      .eq("id", fiUserIdArg)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error || !row) {
      console.error(`FAIL: --fi-user-id not found for tenant: ${error?.message ?? "missing"}`);
      process.exit(1);
    }
    email = String((row as { email: string | null }).email ?? "").toLowerCase();
    if (!email) {
      console.error("FAIL: fi_users row has no email");
      process.exit(1);
    }
    if (promoteRole && commit) {
      const { error: roleErr } = await supabase
        .from("fi_users")
        .update({ role, updated_at: new Date().toISOString() })
        .eq("id", fiUserIdArg)
        .eq("tenant_id", tenantId);
      if (roleErr) {
        console.error(`FAIL promote role: ${roleErr.message}`);
        process.exit(1);
      }
      console.log(`PASS: promoted fi_users role to ${role}`);
    } else if (promoteRole) {
      console.log(`DRY-RUN: would promote fi_users role to ${role}`);
    }
  }

  if (!email || !email.includes("@")) {
    console.error("Missing or invalid --email= (or --fi-user-id= with email on row)");
    process.exit(1);
  }
  if (!VALID_ROLES.has(role)) {
    console.error(`Invalid --role= (allowed: ${[...VALID_ROLES].join(", ")})`);
    process.exit(1);
  }
  if (email.endsWith("@follicleintelligence.local")) {
    console.error("Refusing seed @follicleintelligence.local addresses for real operator provisioning");
    process.exit(1);
  }

  const rawBase =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.FI_BASE_URL?.trim() ||
    "https://www.follicleintelligence.ai";
  const origin = rawBase.replace(/\/fi-admin\/?$/i, "").replace(/\/$/, "");
  const redirectTo = `${origin}/follicle-intelligence/confirm`;

  console.log(`Provision Evolved operator (${commit ? "COMMIT" : "DRY-RUN"})`);
  console.log(`  tenant: ${tenantId}`);
  console.log(`  email: ${redactEmail(email)}`);
  console.log(`  role: ${role}`);
  console.log(`  redirect: ${redirectTo}`);

  const { data: existingUser, error: existErr } = fiUserIdArg
    ? await supabase
        .from("fi_users")
        .select("id, auth_user_id, role")
        .eq("id", fiUserIdArg)
        .eq("tenant_id", tenantId)
        .maybeSingle()
    : await supabase
        .from("fi_users")
        .select("id, auth_user_id, role")
        .eq("tenant_id", tenantId)
        .eq("email", email)
        .maybeSingle();
  if (existErr) {
    console.error(`FAIL: ${existErr.message}`);
    process.exit(1);
  }

  let fiUserId = existingUser ? String((existingUser as { id: string }).id) : null;
  let authUserId = existingUser?.auth_user_id
    ? String((existingUser as { auth_user_id: string }).auth_user_id)
    : null;

  if (!authUserId) {
    const { data: rpcAuth, error: rpcErr } = await supabase.rpc("fi_admin_lookup_auth_user_id_by_email", {
      _email: email,
    });
    if (rpcErr) {
      console.error(`FAIL auth lookup RPC: ${rpcErr.message}`);
      process.exit(1);
    }
    if (rpcAuth) authUserId = String(rpcAuth);
  }

  if (!commit) {
    console.log("---");
    console.log("DRY-RUN actions:");
    if (!fiUserId) console.log("  INSERT fi_users row");
    else console.log(`  UPDATE fi_users id=${fiUserId.slice(0, 8)}…`);
    if (!authUserId) console.log("  INVITE auth user by email");
    else console.log(`  LINK existing auth_user_id=${authUserId.slice(0, 8)}…`);
    console.log("Re-run with --commit to execute.");
    return;
  }

  if (!authUserId) {
    const { data: inv, error: invErr } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { fi_tenant_id: tenantId, fi_role: role },
    });
    if (invErr || !inv.user?.id) {
      console.error(`FAIL invite: ${invErr?.message ?? "no user id"}`);
      process.exit(1);
    }
    authUserId = inv.user.id;
    console.log(`PASS: invited auth user ${authUserId.slice(0, 8)}…`);
  } else {
    console.log(`PASS: existing auth user ${authUserId.slice(0, 8)}…`);
  }

  if (!fiUserId) {
    const { data: inserted, error: insErr } = await supabase
      .from("fi_users")
      .insert({
        tenant_id: tenantId,
        email,
        role,
        auth_user_id: authUserId,
        display_name: displayName || null,
      })
      .select("id")
      .single();
    if (insErr || !inserted) {
      console.error(`FAIL insert fi_users: ${insErr?.message ?? "no row"}`);
      process.exit(1);
    }
    fiUserId = String((inserted as { id: string }).id);
    console.log(`PASS: created fi_users ${fiUserId.slice(0, 8)}…`);
  } else {
    const patch: Record<string, unknown> = {
      auth_user_id: authUserId,
      updated_at: new Date().toISOString(),
    };
    if (displayName) patch.display_name = displayName;
    const { error: updErr } = await supabase
      .from("fi_users")
      .update(patch)
      .eq("id", fiUserId)
      .eq("tenant_id", tenantId);
    if (updErr) {
      console.error(`FAIL update fi_users: ${updErr.message}`);
      process.exit(1);
    }
    console.log(`PASS: linked fi_users ${fiUserId.slice(0, 8)}…`);
  }

  console.log("---");
  console.log("Record in docs/production/evidence/evolved-identity-audit.md:");
  console.log(`  role=${role} fi_users.id=${fiUserId} auth_linked=Y`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});