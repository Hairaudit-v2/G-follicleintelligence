/**
 * FI-HUBSPOT-IMPORT-1E — controlled contact→lead expansion CLI.
 *
 * Modes:
 *   --inventory             Write-free full decision inventory + DQ profile
 *   --select-batch          Persist next bounded batch (E1≤100)
 *   --preview               Immutable preview from approved decisions
 *   --apply --approved-batch-id --checksum
 *   --reconcile --batch-id
 *   --replay --approved-batch-id --checksum   (same as apply; expects already_applied)
 *   --rollback-preview --batch-id
 *   --gate-status           Prior-batch reconciliation gate
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
  const maxSize = argValue("--max") ? Number(argValue("--max")) : undefined;

  const [{ supabaseAdmin }, expansion] = await Promise.all([
    import("@/lib/supabaseAdmin"),
    import("@/src/lib/integrations/hubspot/import/hubspotContactLeadExpansion.server"),
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
    mappings:
      (
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

  if (hasFlag("--inventory") || hasFlag("--profile")) {
    const inventory = await expansion.buildContactLeadExpansionInventory(client, {
      tenantId,
      integrationId,
    });
    const decisionCounts: Record<string, number> = {};
    for (const r of inventory.rows) {
      decisionCounts[r.decision] = (decisionCounts[r.decision] ?? 0) + 1;
    }
    const expansionCore = await import(
      "@/src/lib/integrations/hubspot/import/hubspotContactLeadExpansionCore"
    );
    const signatureRows = inventory.rows.map((r) => expansionCore.toInventorySignatureRow(r));
    const inventorySignature = expansionCore.computeInventorySignature(signatureRows);
    const coverage = expansionCore.reconcileContactCoverage(signatureRows);
    expansionCore.assertCoverageReconciled(coverage);
    report = {
      ...report,
      mode: hasFlag("--profile") ? "profile" : "inventory",
      generatedAt: new Date().toISOString(),
      summary: inventory.summary,
      dataQuality: inventory.dataQuality,
      deferredEnrichment: inventory.deferredEnrichment,
      decisionCounts,
      inventorySignature,
      coverage,
      sampleReady: inventory.rows
        .filter((r) => r.decision === "link_existing_lead" && r.approvedForApply)
        .slice(0, 20)
        .map((r) => ({
          hubspotContactId: r.hubspotContactId,
          displayName: r.displayName,
          reasonCode: r.reasonCode,
          identityTier: r.identityTier,
        })),
      ...(hasFlag("--full-signature")
        ? {
            signatureRows,
          }
        : {}),
    };
  } else if (hasFlag("--select-batch")) {
    const selected = await expansion.selectAndPersistExpansionBatch(client, {
      tenantId,
      integrationId,
      maxSize,
      operatorLabel: "1e-cli-select",
    });
    report = {
      ...report,
      mode: "select-batch",
      batchSequence: selected.batchSequence,
      batchMax: selected.batchMax,
      selectedCount: selected.selected.length,
      selected: selected.selected.map((r) => ({
        hubspotContactId: r.hubspotContactId,
        displayName: r.displayName,
        decision: r.decision,
        proposedLeadId: r.proposedLeadId,
        reasonCode: r.reasonCode,
      })),
      summary: selected.summary,
    };
  } else if (hasFlag("--preview")) {
    const preview = await expansion.previewContactLeadExpansionBatch(client, {
      tenantId,
      integrationId,
      maxSize,
      operatorLabel: "1e-cli-preview",
    });
    report = { ...report, mode: "preview", preview };
  } else if (hasFlag("--apply") || hasFlag("--replay")) {
    const batchId = argValue("--approved-batch-id");
    const checksum = argValue("--checksum");
    if (!batchId || !checksum) throw new Error("--approved-batch-id and --checksum required");
    const confirm =
      process.env.FI_HUBSPOT_CONTACT_LEAD_EXPANSION_CONFIRM?.trim() ?? "";
    const result = await expansion.applyContactLeadExpansionBatch(client, {
      tenantId,
      integrationId,
      approvedBatchId: batchId,
      confirmToken: confirm,
      expectedChecksum: checksum,
      actorLabel: hasFlag("--replay") ? "1e-cli-replay" : "1e-cli-apply",
    });
    report = {
      ...report,
      mode: hasFlag("--replay") ? "replay" : "apply",
      result,
    };
  } else if (hasFlag("--reconcile")) {
    const batchId = argValue("--batch-id");
    if (!batchId) throw new Error("--batch-id required");
    const reconciliation = await expansion.reconcileContactLeadExpansionBatch(client, {
      tenantId,
      batchId,
    });
    report = { ...report, mode: "reconcile", reconciliation };
  } else if (hasFlag("--rollback-preview")) {
    const batchId = argValue("--batch-id");
    if (!batchId) throw new Error("--batch-id required");
    const rollback = await expansion.previewRollbackContactLeadExpansionBatch(client, {
      tenantId,
      batchId,
    });
    report = { ...report, mode: "rollback-preview", rollback };
  } else if (hasFlag("--gate-status")) {
    const gate = await expansion.getPriorExpansionBatchGate(client, tenantId);
    report = { ...report, mode: "gate-status", gate };
  } else {
    const workspace = await expansion.loadContactLeadExpansionWorkspace(client, {
      tenantId,
      integrationId,
      filter: "all",
    });
    report = {
      ...report,
      mode: "workspace",
      summary: workspace.summary,
      dataQuality: workspace.dataQuality,
      batchPolicy: workspace.batchPolicy,
      batchMax: workspace.batchMax,
      priorGate: workspace.priorGate,
      rowCount: workspace.rows.length,
    };
  }

  const after = {
    leads: await count("fi_crm_leads"),
    patients: await count("fi_patients"),
    mappings:
      (
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
