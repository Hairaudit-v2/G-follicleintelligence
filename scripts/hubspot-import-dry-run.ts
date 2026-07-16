/**
 * FI-HUBSPOT-IMPORT-1A — read-only HubSpot → FI OS import dry-run.
 *
 * Usage:
 *   npm run hubspot:import:dry-run -- --tenant-id <uuid> --integration-id <uuid> --dataset contacts --mapping-version v1
 *
 * Optional:
 *   --limit 100
 *   --source-id <hubspot id>
 *   --created-from / --created-to / --updated-from / --updated-to
 *   --output-json <path>
 *   --strict
 *
 * Performs ZERO FI OS entity writes. Does not alter backup watermarks.
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
        "hubspot:import:dry-run",
        "  --dataset contacts|owners",
        "  [--tenant-id <uuid>]",
        "  [--integration-id <uuid>]",
        "  [--mapping-version v1]",
        "  [--limit 100]",
        "  [--source-id <id>]",
        "  [--created-from <ISO>]",
        "  [--created-to <ISO>]",
        "  [--updated-from <ISO>]",
        "  [--updated-to <ISO>]",
        "  [--output-json <path>]",
        "  [--strict]",
        "",
      ].join("\n")
    );
    return;
  }

  const dataset = (argValue("--dataset") ?? "contacts") as "contacts" | "owners";
  const tenantId = argValue("--tenant-id") ?? DEFAULT_TENANT_ID;
  const integrationId = argValue("--integration-id") ?? DEFAULT_INTEGRATION_ID;
  const mappingVersion = argValue("--mapping-version") ?? "v1";
  const limitRaw = argValue("--limit");
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 100;
  const sourceId = argValue("--source-id");
  const outputJson = argValue("--output-json");
  const strict = hasFlag("--strict");

  if (mappingVersion !== "v1") {
    throw new Error(`Unsupported mapping version: ${mappingVersion} (only v1 in FI-HUBSPOT-IMPORT-1A)`);
  }
  if (!Number.isFinite(limit) || limit < 1) {
    throw new Error("--limit must be a positive integer");
  }

  const [{ supabaseAdmin }, dryRunMod] = await Promise.all([
    import("@/lib/supabaseAdmin"),
    import("@/src/lib/integrations/hubspot/import/hubspotImportDryRun.server"),
  ]);

  const client = supabaseAdmin();
  const generatedAt = new Date().toISOString();
  const result = await dryRunMod.runHubspotImportDryRun(client, {
    tenantId,
    integrationId,
    dataset,
    limit,
    sourceId: sourceId ?? undefined,
    createdFrom: argValue("--created-from") ?? undefined,
    createdTo: argValue("--created-to") ?? undefined,
    updatedFrom: argValue("--updated-from") ?? undefined,
    updatedTo: argValue("--updated-to") ?? undefined,
    strict,
    generatedAt,
  });

  let stagingTotal: number | null = null;
  if (dataset === "contacts") {
    stagingTotal = await dryRunMod.countHubspotContactStaging(client, tenantId, integrationId);
  }

  // Privacy-safe CLI output: strip proposed entity ids from stdout if --strict, keep hashes.
  const privacySafeDecisions = result.report.decisions.map((d) => ({
    sourceIdHash: d.sourceIdHash,
    decision: d.decision,
    proposedFiEntityType: d.proposedFiEntityType,
    proposedFiEntityId: d.proposedFiEntityId ? "[redacted-uuid]" : null,
    identityTier: d.identityTier,
    reasonCode: d.reasonCode,
    sideEffectRisks: d.sideEffectRisks,
    mappingVersion: d.mappingVersion,
  }));

  const output = {
    ...result.report,
    decisions: privacySafeDecisions,
    productionDryRunMeta: {
      cohortSize: result.cohortSize,
      stagingContactCountSampled: result.stagingContactCountSampled,
      stagingContactTotal: stagingTotal,
      mutationGuard: result.mutationGuard,
      ownerClassSummary: result.ownerDryRun
        ? result.ownerDryRun.ownerClasses.reduce<Record<string, number>>((acc, c) => {
            acc[c] = (acc[c] ?? 0) + 1;
            return acc;
          }, {})
        : null,
    },
  };

  const json = JSON.stringify(output, null, 2);
  process.stdout.write(json + "\n");

  if (outputJson) {
    const path = resolve(process.cwd(), outputJson);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, json, "utf8");
  }

  if (
    result.mutationGuard.inserts +
      result.mutationGuard.updates +
      result.mutationGuard.deletes +
      result.mutationGuard.upserts >
    0
  ) {
    process.exitCode = 2;
    return;
  }

  if (result.report.verdict === "RED") {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  process.stderr.write(String(err?.stack ?? err) + "\n");
  process.exitCode = 1;
});
