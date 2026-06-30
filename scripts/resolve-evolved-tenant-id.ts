#!/usr/bin/env tsx
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { supabaseAdmin } from "../lib/supabaseAdmin";

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

loadRepoEnvFiles();

async function main(): Promise<void> {
  const supabase = supabaseAdmin();
  const envId = process.env.EVOLVED_PERTH_TENANT_ID?.trim();
  const { data: all } = await supabase.from("fi_tenants").select("id, slug, name").order("slug");
  console.log("fi_tenants:");
  for (const t of (all ?? []) as { id: string; slug: string; name: string }[]) {
    const marker =
      t.id === envId ? " ← EVOLVED_PERTH_TENANT_ID" : t.slug === "evolved" ? " ← slug=evolved" : "";
    console.log(`  ${t.slug}: ${t.id} (${t.name})${marker}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});