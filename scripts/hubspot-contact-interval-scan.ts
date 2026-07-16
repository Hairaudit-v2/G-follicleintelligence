/**
 * FI-HUBSPOT-IMPORT-1E-W — read-only HubSpot contact interval scan.
 *
 * Searches contacts by createdate and lastmodifieddate inside a fixed UTC window.
 * Does not write HubSpot objects, staging rows, mappings, or watermarks.
 *
 * Usage:
 *   node scripts/run-with-system-ca.mjs node -r ./scripts/patch-server-only-for-scripts.cjs \
 *     ./node_modules/tsx/dist/cli.mjs scripts/hubspot-contact-interval-scan.ts \
 *     --cutoff-from 2026-07-16T03:45:02.366Z \
 *     --cutoff-to 2026-07-16T16:00:34.530Z \
 *     --output-json docs/audits/.tmp-import-1e-w-contact-interval.json
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

type SearchHit = {
  id: string;
  createdAt: string | null;
  updatedAt: string | null;
  archived: boolean;
};

async function searchContactsByProperty(input: {
  accessToken: string;
  property: "createdate" | "lastmodifieddate";
  cutoffFromMs: string;
  cutoffToMs: string;
  hubspotPostJson: typeof import("@/src/lib/onboarding-os/hubspotBackupEngine.server").hubspotPostJson;
}): Promise<SearchHit[]> {
  const hits: SearchHit[] = [];
  let after: string | undefined;
  for (let page = 0; page < 100; page += 1) {
    const body: Record<string, unknown> = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: input.property,
              operator: "GTE",
              value: input.cutoffFromMs,
            },
            {
              propertyName: input.property,
              operator: "LT",
              value: input.cutoffToMs,
            },
          ],
        },
      ],
      properties: ["createdate", "lastmodifieddate", "email"],
      sorts: [{ propertyName: input.property, direction: "ASCENDING" }],
      limit: 100,
    };
    if (after) body.after = after;
    const pageResult = await input.hubspotPostJson<{
      results?: Array<{
        id?: string;
        createdAt?: string;
        updatedAt?: string;
        archived?: boolean;
        properties?: Record<string, string | null>;
      }>;
      paging?: { next?: { after?: string } };
    }>("/crm/v3/objects/contacts/search", input.accessToken, body);
    for (const row of pageResult.results ?? []) {
      const id = row.id?.trim();
      if (!id) continue;
      hits.push({
        id,
        createdAt: row.properties?.createdate ?? row.createdAt ?? null,
        updatedAt: row.properties?.lastmodifieddate ?? row.updatedAt ?? null,
        archived: Boolean(row.archived),
      });
    }
    after = pageResult.paging?.next?.after;
    if (!after) break;
  }
  return hits;
}

async function main(): Promise<void> {
  loadRepoEnvFiles();
  const cutoffFrom = argValue("--cutoff-from");
  const cutoffTo = argValue("--cutoff-to");
  const tenantId = argValue("--tenant-id") ?? DEFAULT_TENANT_ID;
  const integrationId = argValue("--integration-id") ?? DEFAULT_INTEGRATION_ID;
  const outputJson = argValue("--output-json");
  if (!cutoffFrom || !cutoffTo) {
    throw new Error("--cutoff-from and --cutoff-to are required");
  }

  const [{ supabaseAdmin }, connector, backupEngine, expansion, expansionCore] = await Promise.all([
    import("@/lib/supabaseAdmin"),
    import("@/src/lib/onboarding-os/hubspotConnector.server"),
    import("@/src/lib/onboarding-os/hubspotBackupEngine.server"),
    import("@/src/lib/integrations/hubspot/import/hubspotContactLeadExpansion.server"),
    import("@/src/lib/integrations/hubspot/import/hubspotContactLeadExpansionCore"),
  ]);

  const fromMs = String(Date.parse(cutoffFrom));
  const toMs = String(Date.parse(cutoffTo));
  if (!Number.isFinite(Number(fromMs)) || !Number.isFinite(Number(toMs))) {
    throw new Error("Invalid cutoff timestamps");
  }

  const supabase = supabaseAdmin();
  const token = await connector.loadHubspotAccessToken(supabase, integrationId);
  if (!token) throw new Error("HubSpot access token unavailable");

  const [createdHits, modifiedHits] = await Promise.all([
    searchContactsByProperty({
      accessToken: token,
      property: "createdate",
      cutoffFromMs: fromMs,
      cutoffToMs: toMs,
      hubspotPostJson: backupEngine.hubspotPostJson,
    }),
    searchContactsByProperty({
      accessToken: token,
      property: "lastmodifieddate",
      cutoffFromMs: fromMs,
      cutoffToMs: toMs,
      hubspotPostJson: backupEngine.hubspotPostJson,
    }),
  ]);

  const byId = new Map<string, SearchHit & { createdInInterval: boolean; modifiedInInterval: boolean }>();
  for (const hit of createdHits) {
    byId.set(hit.id, { ...hit, createdInInterval: true, modifiedInInterval: false });
  }
  for (const hit of modifiedHits) {
    const prev = byId.get(hit.id);
    if (prev) prev.modifiedInInterval = true;
    else byId.set(hit.id, { ...hit, createdInInterval: false, modifiedInInterval: true });
  }

  const inventory = await expansion.buildContactLeadExpansionInventory(supabase, {
    tenantId,
    integrationId,
  });
  const inventoryById = new Map(inventory.rows.map((r) => [r.hubspotContactId, r]));

  const { data: stagingRows } = await supabase
    .from("fi_external_hubspot_contact_staging")
    .select("hubspot_contact_id, payload_checksum, hubspot_created_at, hubspot_updated_at")
    .eq("tenant_id", tenantId)
    .eq("integration_id", integrationId)
    .in("hubspot_contact_id", [...byId.keys()].length ? [...byId.keys()] : ["__none__"]);

  const stagingById = new Map(
    (stagingRows ?? []).map((r) => [String((r as { hubspot_contact_id: string }).hubspot_contact_id), r])
  );

  const { data: mappingRows } = await supabase
    .from("fi_external_record_mappings")
    .select("external_id, fi_entity_id, detail")
    .eq("tenant_id", tenantId)
    .eq("integration_id", integrationId)
    .eq("source_provider", "hubspot")
    .eq("source_entity_type", "contact")
    .eq("fi_entity_type", "lead")
    .in("external_id", [...byId.keys()].length ? [...byId.keys()] : ["__none__"]);

  const mappingById = new Map(
    (mappingRows ?? []).map((r) => [String((r as { external_id: string }).external_id), r])
  );

  const contacts = [...byId.values()]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((hit) => {
      const inv = inventoryById.get(hit.id);
      const staging = stagingById.get(hit.id) as
        | {
            payload_checksum?: string | null;
            hubspot_created_at?: string | null;
            hubspot_updated_at?: string | null;
          }
        | undefined;
      const mapping = mappingById.get(hit.id) as
        | { fi_entity_id?: string; detail?: { import_batch_id?: string; milestone?: string } }
        | undefined;
      const revalidation = {
        sameTenant: true,
        sameSourceContactId: Boolean(hit.id),
        uniqueLeadTarget: Boolean(inv?.proposedLeadId || mapping?.fi_entity_id),
        newDuplicate: false,
        newPatientWarning: Boolean(inv?.patientProtectionWarning),
        targetConflict: inv?.decision === "quarantine_multi_target_conflict",
        wrongTenant: inv?.decision === "wrong_tenant",
        existingMappingValid: Boolean(mapping?.fi_entity_id),
      };
      let revalidationStatus: "not_required" | "safe" | "needs_follow_up" = "not_required";
      if (byId.size > 0) {
        try {
          if (inv && mapping) {
            expansionCore.assertChangedContactIdentitySafe({
              sameTenant: true,
              sameSourceContactId: true,
              uniqueLeadTarget: Boolean(mapping.fi_entity_id),
              newDuplicate: false,
              newPatientWarning: Boolean(inv.patientProtectionWarning),
              targetConflict: inv.decision === "quarantine_multi_target_conflict",
              wrongTenant: inv.decision === "wrong_tenant",
              existingMappingValid: true,
            });
            revalidationStatus = "safe";
          } else if (inv) {
            revalidationStatus = inv.decision.startsWith("quarantine_")
              ? "safe"
              : "needs_follow_up";
          } else {
            revalidationStatus = "needs_follow_up";
          }
        } catch {
          revalidationStatus = "needs_follow_up";
        }
      }
      return {
        hubspotContactId: hit.id,
        createdAt: hit.createdAt,
        updatedAt: hit.updatedAt,
        archived: hit.archived,
        createdInInterval: hit.createdInInterval,
        modifiedInInterval: hit.modifiedInInterval,
        inStaging: Boolean(staging),
        stagingPayloadChecksum: staging?.payload_checksum ?? null,
        inInventory: Boolean(inv),
        inventoryDecision: inv?.decision ?? null,
        inventoryReasonCode: inv?.reasonCode ?? null,
        proposedLeadId: inv?.proposedLeadId ?? null,
        mappingLeadId: mapping?.fi_entity_id ?? null,
        mappingBatchId: mapping?.detail?.import_batch_id ?? null,
        mappingMilestone: mapping?.detail?.milestone ?? null,
        revalidation,
        revalidationStatus,
      };
    });

  const report = {
    mode: "contact-interval-scan",
    tenantId,
    integrationId,
    cutoffFrom,
    cutoffTo,
    semantics: "property >= cutoff_from AND property < cutoff_to",
    limitation:
      "HubSpot Search uses createdate/lastmodifieddate independently; a contact may appear in both sets.",
    createdCount: createdHits.length,
    modifiedCount: modifiedHits.length,
    uniqueContactCount: contacts.length,
    contacts,
    summary: inventory.summary,
    readOnly: true,
    watermarkUntouched: true,
  };

  const json = JSON.stringify(report, null, 2);
  process.stdout.write(json + "\n");
  if (outputJson) {
    const path = resolve(process.cwd(), outputJson);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, json, "utf8");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
