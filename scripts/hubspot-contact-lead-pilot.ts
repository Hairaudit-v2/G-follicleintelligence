/**
 * FI-HUBSPOT-IMPORT-1D — production contact→lead pilot CLI.
 *
 * Modes:
 *   (default)               Build/rebuild cohort + summary
 *   --preview               Immutable preview from approved decisions
 *   --apply --approved-batch-id --checksum
 *   --rollback-preview --batch-id
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

  const [{ supabaseAdmin }, pilot] = await Promise.all([
    import("@/lib/supabaseAdmin"),
    import("@/src/lib/integrations/hubspot/import/hubspotContactLeadPilot.server"),
  ]);
  const client = supabaseAdmin();

  const count = async (table: string) => {
    const { count: n, error } = await client
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
    return n ?? 0;
  };

  const before = {
    leads: await count("fi_crm_leads"),
    patients: await count("fi_patients"),
    mappings: (
      await client
        .from("fi_external_record_mappings")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("source_provider", "hubspot")
        .eq("source_entity_type", "contact")
        .eq("fi_entity_type", "lead")
    ).count ?? 0,
  };

  let report: Record<string, unknown> = { tenantId, integrationId, before };

  if (hasFlag("--preview")) {
    const preview = await pilot.previewContactLeadPilotBatch(client, {
      tenantId,
      integrationId,
      operatorLabel: "1d-cli-preview",
    });
    report = { ...report, mode: "preview", preview };
  } else if (hasFlag("--apply")) {
    const batchId = argValue("--approved-batch-id");
    const checksum = argValue("--checksum");
    if (!batchId || !checksum) throw new Error("--approved-batch-id and --checksum required");
    const confirm = process.env.FI_HUBSPOT_CONTACT_LEAD_CONFIRM?.trim() ?? "";
    const result = await pilot.applyContactLeadPilotBatch(client, {
      tenantId,
      integrationId,
      approvedBatchId: batchId,
      confirmToken: confirm,
      expectedChecksum: checksum,
      actorLabel: "1d-cli-apply",
    });
    report = { ...report, mode: "apply", result };
  } else if (hasFlag("--rollback-preview")) {
    const batchId = argValue("--batch-id");
    if (!batchId) throw new Error("--batch-id required");
    const rollback = await pilot.previewRollbackContactLeadPilotBatch(client, {
      tenantId,
      batchId,
    });
    report = { ...report, mode: "rollback-preview", rollback };
  } else {
    const workspace = await pilot.loadContactLeadPilotWorkspace(client, {
      tenantId,
      integrationId,
      filter: "all",
      rebuildCohort: hasFlag("--rebuild"),
    });
    report = {
      ...report,
      mode: "cohort",
      summary: workspace.summary,
      rows: workspace.rows.map((r) => ({
        hubspotContactId: r.hubspotContactId,
        displayName: r.displayName,
        decision: r.decision,
        approvedForApply: r.approvedForApply,
        proposedLeadId: r.proposedLeadId,
        reasonCode: r.reasonCode,
        ownerResolutionStatus: r.ownerResolutionStatus,
      })),
    };
  }

  const after = {
    leads: await count("fi_crm_leads"),
    patients: await count("fi_patients"),
    mappings: (
      await client
        .from("fi_external_record_mappings")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("source_provider", "hubspot")
        .eq("source_entity_type", "contact")
        .eq("fi_entity_type", "lead")
    ).count ?? 0,
  };
  report = {
    ...report,
    after,
    deltas: {
      leads: after.leads - before.leads,
      patients: after.patients - before.patients,
      mappings: after.mappings - before.mappings,
    },
  };

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
