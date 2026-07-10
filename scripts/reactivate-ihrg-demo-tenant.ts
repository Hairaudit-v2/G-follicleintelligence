/**
 * Reactivate the IHRG enterprise demo tenant for prospective-customer showcase.
 *
 * - Clears archive flags if present
 * - Sets is_demo=true (still a demo/sandbox)
 * - Sets is_production_visible=true so it appears in FI Admin tenant directory
 * - Writes platform audit event
 *
 * Run:
 *   node scripts/run-with-system-ca.mjs tsx scripts/reactivate-ihrg-demo-tenant.ts
 *   node scripts/run-with-system-ca.mjs tsx scripts/reactivate-ihrg-demo-tenant.ts --hide
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { supabaseAdmin } from "../lib/supabaseAdmin";
import { ENTERPRISE_DEMO_TENANT_SLUG } from "../src/lib/enterprise-demo/enterpriseDemoConstants";

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
    .select(
      "id, name, slug, archived_at, is_demo, is_production_visible, archive_reason"
    )
    .eq("slug", ENTERPRISE_DEMO_TENANT_SLUG)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!tenant) {
    console.error(
      `Tenant slug "${ENTERPRISE_DEMO_TENANT_SLUG}" not found. Run npm run seed:enterprise-demo first.`
    );
    process.exit(1);
  }

  const row = tenant as {
    id: string;
    name: string;
    slug: string;
    archived_at: string | null;
    is_demo: boolean;
    is_production_visible: boolean;
    archive_reason: string | null;
  };

  console.log("Before:", {
    id: row.id,
    name: row.name,
    slug: row.slug,
    archived_at: row.archived_at,
    is_demo: row.is_demo,
    is_production_visible: row.is_production_visible,
  });

  const now = new Date().toISOString();
  const nextVisible = !hide;

  const { error: updateErr } = await sb
    .from("fi_tenants")
    .update({
      archived_at: null,
      archived_by: null,
      archive_reason: null,
      is_demo: true,
      is_production_visible: nextVisible,
      updated_at: now,
    })
    .eq("id", row.id);

  if (updateErr) throw new Error(updateErr.message);

  const eventKind = hide ? "tenant.demo_marked" : "tenant.restored";
  const { error: auditErr } = await sb.from("fi_platform_tenant_audit_events").insert({
    tenant_id: row.id,
    event_kind: eventKind,
    actor_auth_user_id: null,
    detail: {
      slug: row.slug,
      name: row.name,
      reason: hide
        ? "Showcase complete — re-hide IHRG demo from production directory"
        : "Reactivated for prospective-company enterprise showcase",
      previous: {
        archived_at: row.archived_at,
        is_demo: row.is_demo,
        is_production_visible: row.is_production_visible,
        archive_reason: row.archive_reason,
      },
      next: {
        archived_at: null,
        is_demo: true,
        is_production_visible: nextVisible,
      },
      source: "scripts/reactivate-ihrg-demo-tenant.ts",
    },
  });
  if (auditErr) {
    console.warn("Audit insert failed (non-fatal):", auditErr.message);
  }

  const { data: after } = await sb
    .from("fi_tenants")
    .select("id, name, slug, archived_at, is_demo, is_production_visible")
    .eq("id", row.id)
    .single();

  console.log(hide ? "Hidden again:" : "Reactivated:", after);
  console.log(
    nextVisible
      ? "IHRG is now production-visible (still tagged is_demo). Use FI Admin tenant switcher or /fi-admin/ihrg-global/global-command-centre."
      : "IHRG is hidden from the default production tenant directory again."
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
