/**
 * FI-HUBSPOT-IMPORT-1B — HubSpot owner → FI staff mapping pilot CLI.
 *
 * Modes:
 *   --preview
 *   --apply --approved-batch-id <uuid>   (requires FI_HUBSPOT_OWNER_MAP_CONFIRM=<uuid>)
 *   --rollback-preview --batch-id <uuid>
 *   --rollback-apply --batch-id <uuid> --reason <text>
 *       (requires FI_HUBSPOT_OWNER_MAP_ROLLBACK_CONFIRM=<uuid>)
 *
 * Optional:
 *   --expand                 (allow up to 25; default max remains 2 without this)
 *   --max-records <n>
 *   --output-json <path>
 *
 * Does not import contacts/leads/deals/timeline. Does not mutate fi_staff rows.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DEFAULT_TENANT_ID = "c2615b95-b707-4485-aa5f-be8f78ec868a";
const DEFAULT_INTEGRATION_ID = "ade8a7d0-ad45-4fd7-8d53-61d4806b95f6";

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

function argValue(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return null;
  const value = process.argv[idx + 1];
  if (!value || value.startsWith("--")) return null;
  return value.trim();
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

export {};

async function main(): Promise<void> {
  loadRepoEnvFiles();

  if (hasFlag("--help") || hasFlag("-h")) {
    process.stdout.write(
      [
        "hubspot:owner-mapping",
        "  --preview",
        "  --apply --approved-batch-id <uuid>",
        "  --rollback-preview --batch-id <uuid>",
        "  --rollback-apply --batch-id <uuid> --reason <text>",
        "  [--expand] [--max-records N] [--output-json path]",
        "",
      ].join("\n")
    );
    return;
  }

  const tenantId = argValue("--tenant-id") ?? DEFAULT_TENANT_ID;
  const integrationId = argValue("--integration-id") ?? DEFAULT_INTEGRATION_ID;
  const expandEnabled = hasFlag("--expand");
  const maxRaw = argValue("--max-records");
  const maxRecords = maxRaw ? Number.parseInt(maxRaw, 10) : expandEnabled ? 25 : 2;
  const outputJson = argValue("--output-json");

  const [{ supabaseAdmin }, mapping] = await Promise.all([
    import("@/lib/supabaseAdmin"),
    import("@/src/lib/integrations/hubspot/import/hubspotOwnerMapping.server"),
  ]);
  const client = supabaseAdmin();

  const beforeCount = await mapping.countHubspotStaffSourceIds(client, tenantId);
  let report;

  if (hasFlag("--preview")) {
    report = await mapping.previewHubspotOwnerStaffMapping(client, {
      tenantId,
      integrationId,
      maxRecords,
      expandEnabled,
      actorLabel: "cli-preview",
    });
  } else if (hasFlag("--apply")) {
    const approvedBatchId = argValue("--approved-batch-id");
    if (!approvedBatchId) throw new Error("--approved-batch-id is required for --apply");
    const confirm = process.env.FI_HUBSPOT_OWNER_MAP_CONFIRM?.trim() ?? "";
    report = await mapping.applyHubspotOwnerStaffMapping(client, {
      tenantId,
      integrationId,
      approvedBatchId,
      confirmToken: confirm,
      maxRecords,
      expandEnabled,
      actorLabel: "cli-apply",
    });
  } else if (hasFlag("--rollback-preview")) {
    const batchId = argValue("--batch-id");
    if (!batchId) throw new Error("--batch-id required");
    report = await mapping.previewRollbackHubspotOwnerStaffMapping(client, {
      tenantId,
      batchId,
    });
  } else if (hasFlag("--rollback-apply")) {
    const batchId = argValue("--batch-id");
    const reason = argValue("--reason");
    if (!batchId || !reason) throw new Error("--batch-id and --reason required");
    const confirm = process.env.FI_HUBSPOT_OWNER_MAP_ROLLBACK_CONFIRM?.trim() ?? "";
    report = await mapping.applyRollbackHubspotOwnerStaffMapping(client, {
      tenantId,
      batchId,
      confirmToken: confirm,
      reason,
      actorLabel: "cli-rollback",
    });
  } else {
    throw new Error("Specify --preview | --apply | --rollback-preview | --rollback-apply");
  }

  const afterCount = await mapping.countHubspotStaffSourceIds(client, tenantId);

  // Privacy-safe stdout: hash emails already; keep owner/staff ids for operator verification.
  const output = {
    ...report,
    verification: {
      hubspotStaffSourceIdsBefore: beforeCount,
      hubspotStaffSourceIdsAfter: afterCount,
      delta: afterCount - beforeCount,
    },
  };

  const json = JSON.stringify(output, null, 2);
  process.stdout.write(json + "\n");

  if (outputJson) {
    const path = resolve(process.cwd(), outputJson);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, json, "utf8");
  }

  if (!report.ok) process.exitCode = 1;
}

main().catch((err) => {
  process.stderr.write(String(err?.stack ?? err) + "\n");
  process.exitCode = 1;
});
