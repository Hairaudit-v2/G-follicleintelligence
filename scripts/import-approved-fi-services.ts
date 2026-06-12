/**
 * Stage 7A.3 — Import `approved_for_import` from fi-services-seed-approved.json into `fi_services`.
 *
 * Default: **dry-run** (no DB writes). Use `--commit` to apply.
 *
 * Usage:
 *   npx tsx scripts/import-approved-fi-services.ts --tenant-id=<uuid> --admin-key=<key>
 *   npx tsx scripts/import-approved-fi-services.ts --tenant-id=<uuid> --admin-key=<key> --commit
 *
 * Env (alternative to --admin-key):
 *   FI_IMPORT_ADMIN_KEY — same value as FI_ADMIN_API_KEY (never commit this).
 *
 * Optional:
 *   --file=docs/timely-import/output/fi-services-seed-approved.json
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { supabaseAdmin } from "../lib/supabaseAdmin";
import {
  buildApprovedServicesImportPlan,
  summarizeImportPlan,
  type ExistingFiServiceSnapshot,
} from "../src/lib/timelyImport/approvedFiServicesImportPlan";
import type { FiServiceApprovedPayload } from "../src/lib/timelyImport/buildApprovedFiSeed";
import { isFiAdminApiKeyMatch } from "../src/lib/crm/crmFiAdminApiKeyMatch";

function argValue(prefix: string): string | undefined {
  const a = process.argv.find((x) => x.startsWith(prefix));
  if (!a) return undefined;
  const v = a.slice(prefix.length).trim();
  return v || undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function assertAdminKey(): string {
  const fromArg = argValue("--admin-key=");
  const fromEnv = process.env.FI_IMPORT_ADMIN_KEY?.trim();
  const key = (fromArg ?? fromEnv ?? "").trim();
  const expected = process.env.FI_ADMIN_API_KEY;
  if (!isFiAdminApiKeyMatch(key, expected)) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          error:
            "Invalid or missing admin key. Pass --admin-key=... matching FI_ADMIN_API_KEY, or set FI_IMPORT_ADMIN_KEY for this run.",
        },
        null,
        2
      )
    );
    process.exit(1);
  }
  return key;
}

async function loadExistingSnapshots(tenantId: string): Promise<ExistingFiServiceSnapshot[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_services")
    .select("id, name, category, booking_type")
    .eq("tenant_id", tenantId.trim());
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: String((r as { id: string }).id),
    name: String((r as { name: string }).name ?? ""),
    category: (r as { category: string | null }).category != null ? String((r as { category: string | null }).category) : null,
    booking_type: (r as { booking_type: string | null }).booking_type != null ? String((r as { booking_type: string | null }).booking_type) : null,
  }));
}

async function assertTenantExists(tenantId: string): Promise<void> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from("fi_tenants").select("id").eq("id", tenantId.trim()).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Tenant not found: ${tenantId}`);
}

async function main(): Promise<void> {
  const tenantId = argValue("--tenant-id=")?.trim();
  if (!tenantId) {
    console.error(JSON.stringify({ ok: false, error: "Missing required --tenant-id=<uuid>." }, null, 2));
    process.exit(1);
  }

  assertAdminKey();

  const root = path.resolve(__dirname, "..");
  const fileArg = argValue("--file=");
  const file = path.resolve(fileArg ?? path.join(root, "docs", "timely-import", "output", "fi-services-seed-approved.json"));
  if (!fs.existsSync(file)) {
    console.error(JSON.stringify({ ok: false, error: `Approved seed file not found: ${file}` }, null, 2));
    process.exit(1);
  }

  const payload = JSON.parse(fs.readFileSync(file, "utf8")) as FiServiceApprovedPayload;
  const approved = payload.approved_for_import ?? [];
  if (!Array.isArray(approved) || approved.length === 0) {
    console.error(JSON.stringify({ ok: false, error: "No approved_for_import rows in file." }, null, 2));
    process.exit(1);
  }

  const commit = hasFlag("--commit");
  await assertTenantExists(tenantId);
  const existing = await loadExistingSnapshots(tenantId);
  const plan = buildApprovedServicesImportPlan(approved, existing);
  const counts = summarizeImportPlan(plan);

  const execWarnings: string[] = [...plan.warnings];

  if (!commit) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun: true,
          tenantId,
          sourceFile: path.relative(root, file).replace(/\\/g, "/"),
          created: counts.created,
          updated: counts.updated,
          skipped: counts.skipped,
          warnings: plan.warnings,
          plan: plan.entries.map((e) => ({
            name: e.approved.name,
            action: e.action,
            existingId: e.existingId,
            detail: e.detail,
          })),
          hint: "Re-run with --commit to apply changes.",
        },
        null,
        2
      )
    );
    return;
  }

  const supabase = supabaseAdmin();
  const now = new Date().toISOString();
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const e of plan.entries) {
    if (e.action === "skip") {
      skipped++;
      continue;
    }
    const a = e.approved;
    const body = {
      name: a.name.trim(),
      duration_minutes: a.duration_minutes,
      base_price: a.base_price,
      color: a.color?.trim() || null,
      category: a.category?.trim() || null,
      is_active: a.is_active,
      booking_type: a.booking_type?.trim() || null,
      updated_at: now,
    };

    if (e.action === "create") {
      const { error } = await supabase.from("fi_services").insert({
        tenant_id: tenantId.trim(),
        ...body,
        created_at: now,
      });
      if (error) {
        execWarnings.push(`Insert failed for "${a.name}": ${error.message}`);
        skipped++;
        continue;
      }
      created++;
      continue;
    }

    if (e.action === "update" && e.existingId) {
      const { error } = await supabase.from("fi_services").update(body).eq("tenant_id", tenantId.trim()).eq("id", e.existingId);
      if (error) {
        execWarnings.push(`Update failed for "${a.name}" (${e.existingId}): ${error.message}`);
        skipped++;
        continue;
      }
      updated++;
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun: false,
        tenantId,
        sourceFile: path.relative(root, file).replace(/\\/g, "/"),
        created,
        updated,
        skipped,
        warnings: execWarnings,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }, null, 2));
  process.exit(1);
});
