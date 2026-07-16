/**
 * FI-HUBSPOT-IMPORT-1C — production read/classify unresolved owners + optional preview/apply.
 *
 * Modes:
 *   --classify-defaults   Save non-mapping classifications for unresolved owners
 *   --preview             Build apply preview from proposed decisions
 *   --apply --approved-batch-id --checksum  (FI_HUBSPOT_OWNER_MAP_CONFIRM=batchId)
 *
 * Does not create staff/users/leads/patients.
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
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
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

function argValue(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return null;
  const v = process.argv[idx + 1];
  if (!v || v.startsWith("--")) return null;
  return v.trim();
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

async function main(): Promise<void> {
  loadRepoEnvFiles();
  const tenantId = argValue("--tenant-id") ?? DEFAULT_TENANT_ID;
  const integrationId = argValue("--integration-id") ?? DEFAULT_INTEGRATION_ID;
  const outputJson = argValue("--output-json");

  const [{ supabaseAdmin }, resolution, mapping] = await Promise.all([
    import("@/lib/supabaseAdmin"),
    import("@/src/lib/integrations/hubspot/import/hubspotOwnerResolution.server"),
    import("@/src/lib/integrations/hubspot/import/hubspotOwnerMapping.server"),
  ]);
  const client = supabaseAdmin();

  const before = await mapping.countHubspotStaffSourceIds(client, tenantId);
  let report: Record<string, unknown> = { tenantId, integrationId, before };

  if (hasFlag("--classify-defaults")) {
    const workspace = await resolution.loadOwnerResolutionWorkspace(client, {
      tenantId,
      integrationId,
      filter: "all",
    });

    const saved: Array<{ ownerId: string; state: string }> = [];
    for (const row of workspace.rows) {
      if (["mapped", "already_applied", "proposed"].includes(row.resolutionState)) continue;
      if (row.decisionId && row.resolutionState !== "unresolved" && row.resolutionState !== "no_matching_staff") {
        continue;
      }

      // Classifications only — never auto-propose or map from this script.
      type ClassifyState =
        | "unresolved"
        | "no_matching_staff"
        | "archived_source_owner"
        | "historical_only"
        | "conflict"
        | "excluded";
      let state: ClassifyState = "unresolved";
      if (row.archived) state = "archived_source_owner";
      else if (row.candidates.length === 0) state = "no_matching_staff";
      else if (row.conflictReason) state = "conflict";
      else if (!row.email) state = "historical_only";
      else state = "unresolved";

      await resolution.saveOwnerResolutionDecision(client, {
        tenantId,
        integrationId,
        operatorFiUserId: null,
        decision: {
          hubspotOwnerId: row.hubspotOwnerId,
          resolutionState: state,
          operatorNote: "1C default classification from production review script",
          matchEvidence: { classifier: "hubspot-owner-resolution-review" },
        },
      });
      saved.push({ ownerId: row.hubspotOwnerId, state });
    }

    const afterWorkspace = await resolution.loadOwnerResolutionWorkspace(client, {
      tenantId,
      integrationId,
      filter: "all",
    });
    report = {
      ...report,
      mode: "classify-defaults",
      savedCount: saved.length,
      saved,
      summary: afterWorkspace.summary,
      policy: afterWorkspace.oneOwnerPerStaffPolicy,
    };
  } else if (hasFlag("--preview")) {
    const preview = await resolution.previewOwnerResolutionApplyBatch(client, {
      tenantId,
      integrationId,
      maxMappings: 10,
      operatorLabel: "1c-cli-preview",
    });
    report = { ...report, mode: "preview", preview };
  } else if (hasFlag("--apply")) {
    const batchId = argValue("--approved-batch-id");
    const checksum = argValue("--checksum");
    if (!batchId || !checksum) throw new Error("--approved-batch-id and --checksum required");
    const confirm = process.env.FI_HUBSPOT_OWNER_MAP_CONFIRM?.trim() ?? "";
    const result = await resolution.applyOwnerResolutionBatch(client, {
      tenantId,
      integrationId,
      approvedBatchId: batchId,
      confirmToken: confirm,
      expectedChecksum: checksum,
      actorLabel: "1c-cli-apply",
    });
    report = { ...report, mode: "apply", result };
  } else {
    const workspace = await resolution.loadOwnerResolutionWorkspace(client, {
      tenantId,
      integrationId,
      filter: "all",
    });
    report = {
      ...report,
      mode: "summary",
      summary: workspace.summary,
      unresolvedSample: workspace.rows
        .filter((r) => ["unresolved", "no_matching_staff", "archived_source_owner", "conflict"].includes(r.resolutionState))
        .slice(0, 40)
        .map((r) => ({
          hubspotOwnerId: r.hubspotOwnerId,
          displayName: r.displayName,
          archived: r.archived,
          state: r.resolutionState,
          ownedContacts: r.ownedContacts,
          ownedDeals: r.ownedDeals,
          candidateCount: r.candidates.length,
        })),
    };
  }

  const after = await mapping.countHubspotStaffSourceIds(client, tenantId);
  report = { ...report, after, delta: after - before };

  const json = JSON.stringify(report, null, 2);
  process.stdout.write(json + "\n");
  if (outputJson) {
    const path = resolve(process.cwd(), outputJson);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, json, "utf8");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
