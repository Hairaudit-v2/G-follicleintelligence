/**
 * Enable trial_require_consent_before_capture on Evolved Perth tenant config_json.
 *
 * Usage:
 *   pnpm run deploy:c4:enable-tenant
 *   pnpm run deploy:c4:enable-tenant -- --tenant-id <uuid> --dry-run
 */
import { createClient } from "@supabase/supabase-js";
import { loadRepoEnvFiles } from "./lib/loadRepoEnvFiles.mjs";

loadRepoEnvFiles();

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const tenantArgIdx = args.indexOf("--tenant-id");
const tenantId =
  (tenantArgIdx >= 0 ? args[tenantArgIdx + 1] : null)?.trim() ||
  process.env.EVOLVED_PERTH_TENANT_ID?.trim() ||
  process.env.FI_EVOLVED_TENANT_ID?.trim() ||
  process.env.FI_SMOKE_TENANT_ID?.trim();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
if (!tenantId) {
  console.error("Set EVOLVED_PERTH_TENANT_ID or pass --tenant-id <uuid>.");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: row, error } = await supabase
  .from("fi_tenants")
  .select("id, slug, config_json")
  .eq("id", tenantId)
  .maybeSingle();

if (error) {
  console.error("Tenant lookup failed:", error.message);
  process.exit(1);
}
if (!row) {
  console.error(`Tenant not found: ${tenantId}`);
  process.exit(1);
}

const raw = row.config_json;
const base =
  raw && typeof raw === "object" && !Array.isArray(raw) ? { ...raw } : {};
const feature_flags =
  base.feature_flags && typeof base.feature_flags === "object" && !Array.isArray(base.feature_flags)
    ? { ...base.feature_flags }
    : {};

if (feature_flags.trial_require_consent_before_capture === true) {
  console.log(
    `Tenant ${row.slug ?? row.id} already has trial_require_consent_before_capture=true`
  );
  process.exit(0);
}

feature_flags.trial_require_consent_before_capture = true;
const nextConfig = { ...base, feature_flags };

console.log(`Tenant: ${row.slug ?? row.id} (${row.id})`);
console.log("Setting config_json.feature_flags.trial_require_consent_before_capture = true");

if (dryRun) {
  console.log("Dry run — no update written.");
  console.log(JSON.stringify(nextConfig, null, 2));
  process.exit(0);
}

const { error: upErr } = await supabase
  .from("fi_tenants")
  .update({ config_json: nextConfig })
  .eq("id", tenantId);

if (upErr) {
  console.error("Update failed:", upErr.message);
  process.exit(1);
}

console.log("OK — trial consent gate enabled for tenant.");