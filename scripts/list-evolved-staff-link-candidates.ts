#!/usr/bin/env tsx
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { supabaseAdmin } from "../lib/supabaseAdmin";

function loadRepoEnvFiles(): void {
  for (const name of [".env.local", ".env"] as const) {
    const p = resolve(process.cwd(), name);
    if (!existsSync(p)) continue;
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
}

function redact(email: string | null): string {
  const e = String(email ?? "").trim();
  const at = e.indexOf("@");
  return at > 0 ? `${e[0]}***@${e.slice(at + 1)}` : "***";
}

loadRepoEnvFiles();

async function main(): Promise<void> {
  const tid = process.env.EVOLVED_PERTH_TENANT_ID?.trim();
  if (!tid) throw new Error("EVOLVED_PERTH_TENANT_ID missing");
  const sb = supabaseAdmin();

  const { data: staff, error } = await sb
    .from("fi_staff")
    .select("id, full_name, email, staff_role, fi_user_id")
    .eq("tenant_id", tid)
    .order("full_name");
  if (error) throw error;

  const userIds = [...new Set((staff ?? []).map((s) => s.fi_user_id).filter(Boolean))] as string[];
  const usersById = new Map<string, { role: string | null; auth_user_id: string | null; email: string | null }>();
  if (userIds.length) {
    const { data: users } = await sb
      .from("fi_users")
      .select("id, role, auth_user_id, email")
      .in("id", userIds);
    for (const u of users ?? []) {
      usersById.set(String(u.id), u as { role: string | null; auth_user_id: string | null; email: string | null });
    }
  }

  console.log("Staff link candidates (evolved-hair):");
  for (const s of staff ?? []) {
    const fu = s.fi_user_id ? usersById.get(String(s.fi_user_id)) : null;
    const auth = fu?.auth_user_id ? "linked" : fu ? "fi_user unlinked" : "no fi_user";
    const uid = s.fi_user_id ? String(s.fi_user_id).slice(0, 8) + "…" : "-";
    console.log(
      `${String(s.staff_role ?? "?").padEnd(16)} ${redact(s.email as string)} fi_user=${auth} role=${fu?.role ?? "-"} id=${uid}`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});