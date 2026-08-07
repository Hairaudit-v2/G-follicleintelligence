/**
 * Reactivate / hide Follicle Demo Clinic (Package B) in the FI Admin directory.
 *
 *   npm run reactivate:follicle-demo-clinic
 *   npm run hide:follicle-demo-clinic
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { supabaseAdmin } from "../lib/supabaseAdmin";
import { CLINIC_DEMO_TENANT_SLUG } from "../src/lib/clinic-demo/clinicDemoConstants";

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
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}

loadRepoEnvFiles();

const hide = process.argv.includes("--hide");

async function main(): Promise<void> {
  const sb = supabaseAdmin();
  const { data: tenant, error } = await sb
    .from("fi_tenants")
    .select("id, name, slug, is_demo, is_production_visible")
    .eq("slug", CLINIC_DEMO_TENANT_SLUG)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!tenant) {
    console.error(
      `Tenant slug "${CLINIC_DEMO_TENANT_SLUG}" not found. Run npm run seed:follicle-demo-clinic first.`
    );
    process.exit(1);
  }

  const row = tenant as {
    id: string;
    name: string;
    slug: string;
    is_demo: boolean;
    is_production_visible: boolean;
  };

  console.log("Before:", row);

  const { error: updateErr } = await sb
    .from("fi_tenants")
    .update({
      archived_at: null,
      archived_by: null,
      archive_reason: null,
      is_demo: true,
      is_production_visible: !hide,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  if (updateErr) throw new Error(updateErr.message);

  console.log(
    hide
      ? "Hidden Follicle Demo Clinic from production-visible directory."
      : "Reactivated Follicle Demo Clinic (is_production_visible=true)."
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
