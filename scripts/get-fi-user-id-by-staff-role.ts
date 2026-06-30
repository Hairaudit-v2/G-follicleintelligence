#!/usr/bin/env tsx
/** Output fi_user_id for staff with given role (for operator provisioning). */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { supabaseAdmin } from "../lib/supabaseAdmin";

function load(): void {
  const p = resolve(".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

load();

const role = process.argv.find((a) => a.startsWith("--role="))?.slice(7) ?? "reception";

async function main(): Promise<void> {
  const tid = process.env.EVOLVED_PERTH_TENANT_ID!.trim();
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("fi_staff")
    .select("fi_user_id, email, staff_role")
    .eq("tenant_id", tid)
    .eq("staff_role", role)
    .not("fi_user_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (!data?.fi_user_id) {
    console.error(`No staff with role=${role} and fi_user_id`);
    process.exit(1);
  }
  console.log(String(data.fi_user_id));
}

main();