/**
 * FI-HUBSPOT-IMPORT-1E-R — fixed-cutoff contact staging refresh.
 *
 * Preview:
 *   npm run hubspot:contact-staging-refresh -- --preview --ids-file <json>
 *     --cutoff-from <UTC> --cutoff-to <UTC> --output-json <path>
 *
 * Apply:
 *   npm run hubspot:contact-staging-refresh -- --apply --ids-file <json>
 *     --cutoff-from <UTC> --cutoff-to <UTC> --approved-checksum <sha256>
 *     --output-json <path>
 *
 * This script only writes contact staging, a sync-run row, and import audit
 * provenance. It cannot create FI leads/patients or update mappings/watermarks.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DEFAULT_TENANT_ID = "c2615b95-b707-4485-aa5f-be8f78ec868a";
const DEFAULT_INTEGRATION_ID = "ade8a7d0-ad45-4fd7-8d53-61d4806b95f6";

function loadRepoEnvFiles(): void {
  for (const name of [".env.local", ".env"] as const) {
    const path = resolve(process.cwd(), name);
    if (!existsSync(path)) continue;
    let raw = readFileSync(path, "utf8");
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const equals = trimmed.indexOf("=");
      if (equals <= 0) continue;
      const key = trimmed.slice(0, equals).trim();
      let value = trimmed.slice(equals + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index < 0) return null;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value.trim() : null;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function idsFromArtifact(path: string): string[] {
  const parsed = JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8")) as {
    contacts?: Array<{ hubspotContactId?: string }>;
    contactIds?: string[];
  };
  return [
    ...(parsed.contactIds ?? []),
    ...(parsed.contacts ?? []).map((contact) => contact.hubspotContactId ?? ""),
  ];
}

type CountSnapshot = {
  leads: number;
  patients: number;
  staff: number;
  users: number;
  mappings: number;
  stagingContacts: number;
  notesWatermark: string | null;
  contactWatermark: string | null;
};

async function main(): Promise<void> {
  loadRepoEnvFiles();
  const preview = hasFlag("--preview");
  const apply = hasFlag("--apply");
  if (preview === apply) throw new Error("Choose exactly one of --preview or --apply");

  const tenantId = argValue("--tenant-id") ?? DEFAULT_TENANT_ID;
  const integrationId = argValue("--integration-id") ?? DEFAULT_INTEGRATION_ID;
  const idsFile = argValue("--ids-file");
  const cutoffFrom = argValue("--cutoff-from");
  const cutoffTo = argValue("--cutoff-to");
  const approvedChecksum = argValue("--approved-checksum");
  const outputJson = argValue("--output-json");
  if (!idsFile || !cutoffFrom || !cutoffTo) {
    throw new Error("--ids-file, --cutoff-from and --cutoff-to are required");
  }

  const [{ supabaseAdmin }, connector, backup, core, expansion, expansionCore] =
    await Promise.all([
      import("@/lib/supabaseAdmin"),
      import("@/src/lib/onboarding-os/hubspotConnector.server"),
      import("@/src/lib/onboarding-os/hubspotBackupEngine.server"),
      import("@/src/lib/onboarding-os/hubspotContactRefreshCore"),
      import("@/src/lib/integrations/hubspot/import/hubspotContactLeadExpansion.server"),
      import("@/src/lib/integrations/hubspot/import/hubspotContactLeadExpansionCore"),
    ]);

  const ids = core.normalizeContactRefreshIds(idsFromArtifact(idsFile));
  if (ids.length !== 21) {
    throw new Error(`CONTACT_REFRESH_GUARD: expected 21 reviewed IDs, received ${ids.length}`);
  }

  const supabase = supabaseAdmin();
  const { data: integration, error: integrationError } = await supabase
    .from("fi_tenant_external_integrations")
    .select("id, tenant_id, provider, config, status")
    .eq("id", integrationId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (integrationError || !integration || integration.provider !== "hubspot") {
    throw new Error("CONTACT_REFRESH_GUARD: tenant-scoped HubSpot integration not found");
  }

  const token = await connector.loadHubspotAccessToken(supabase, integrationId);
  if (!token) throw new Error("CONTACT_REFRESH_GUARD: HubSpot credential unavailable");

  const identity = await backup.hubspotReadJson<{ portalId?: number | string }>(
    "/integrations/v1/me",
    token
  );
  const configuredPortalId = String(
    (integration.config as Record<string, unknown> | null)?.portal_id ?? ""
  );
  const livePortalId = String(identity.portalId ?? "");
  core.assertPortalOwnership({ configuredPortalId, livePortalId });

  const properties = [
    "firstname",
    "lastname",
    "email",
    "phone",
    "mobilephone",
    "hubspot_owner_id",
    "lifecyclestage",
    "hs_lead_status",
    "lead_source",
    "hs_analytics_source",
    "contact_type",
    "stage_of_journey",
    "createdate",
    "lastmodifieddate",
  ].join(",");
  const contacts = await Promise.all(
    ids.map((id) =>
      backup.hubspotReadJson<
        import("@/src/lib/onboarding-os/hubspotConnectorTypes").HubspotApiContact & {
          archived?: boolean;
        }
      >(`/crm/v3/objects/contacts/${id}`, token, {
        properties,
        associations: "deals,companies",
        archived: "true",
      })
    )
  );
  const returnedIds = core.normalizeContactRefreshIds(
    contacts.map((contact) => contact.id ?? "")
  );
  if (returnedIds.join("|") !== ids.join("|")) {
    throw new Error("CONTACT_REFRESH_GUARD: HubSpot did not return the approved contact set");
  }
  const refreshSources = contacts.map((contact) => ({
    id: String(contact.id),
    createdAt: contact.createdAt ?? null,
    updatedAt: contact.updatedAt ?? null,
    archived: Boolean(contact.archived),
    properties: contact.properties,
  }));
  core.assertContactRefreshFixedCutoff({ cutoffTo, contacts: refreshSources });
  const checksum = core.computeContactRefreshChecksum({
    tenantId,
    integrationId,
    portalId: livePortalId,
    cutoffTo,
    contacts: refreshSources,
  });
  if (apply && (!approvedChecksum || approvedChecksum !== checksum)) {
    throw new Error("CONTACT_REFRESH_GUARD: approved preview checksum mismatch");
  }

  const countTenantTable = async (table: string): Promise<number> => {
    const { count, error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);
    if (error) throw new Error(`Unable to count ${table}`);
    return count ?? 0;
  };
  const readWatermark = async (dataset: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from("fi_external_hubspot_backup_watermarks")
      .select("watermark_timestamp")
      .eq("tenant_id", tenantId)
      .eq("source_system", "hubspot")
      .eq("dataset", dataset)
      .maybeSingle();
    if (error) throw new Error(`Unable to read ${dataset} watermark`);
    return data?.watermark_timestamp ? String(data.watermark_timestamp) : null;
  };
  const snapshot = async (): Promise<CountSnapshot> => {
    const [
      leads,
      patients,
      staff,
      users,
      mappingResult,
      stagingResult,
      notesWatermark,
      contactWatermark,
    ] = await Promise.all([
      countTenantTable("fi_crm_leads"),
      countTenantTable("fi_patients"),
      countTenantTable("fi_staff"),
      countTenantTable("fi_users"),
      supabase
        .from("fi_external_record_mappings")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("integration_id", integrationId)
        .eq("source_provider", "hubspot")
        .eq("source_entity_type", "contact")
        .eq("fi_entity_type", "lead"),
      supabase
        .from("fi_external_hubspot_contact_staging")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("integration_id", integrationId),
      readWatermark("notes"),
      readWatermark("contacts"),
    ]);
    return {
      leads,
      patients,
      staff,
      users,
      mappings: mappingResult.count ?? 0,
      stagingContacts: stagingResult.count ?? 0,
      notesWatermark,
      contactWatermark,
    };
  };

  const before = await snapshot();
  const inventoryBefore = await expansion.buildContactLeadExpansionInventory(supabase, {
    tenantId,
    integrationId,
  });
  const beforeById = new Map(
    inventoryBefore.rows
      .filter((row) => ids.includes(row.hubspotContactId))
      .map((row) => [row.hubspotContactId, expansionCore.toInventorySignatureRow(row)])
  );
  const { data: stagingBefore } = await supabase
    .from("fi_external_hubspot_contact_staging")
    .select("hubspot_contact_id, sync_run_id, payload_checksum, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .eq("integration_id", integrationId)
    .in("hubspot_contact_id", ids);

  let syncRunId: string | null = null;
  let stagingResult:
    | Awaited<ReturnType<typeof backup.stageHubspotContactRefreshBatch>>
    | null = null;
  if (apply) {
    const actorAuthUserId = process.env.FI_HUBSPOT_RECOVERY_ACTOR_AUTH_USER_ID?.trim();
    if (!actorAuthUserId) {
      throw new Error("CONTACT_REFRESH_GUARD: FI_HUBSPOT_RECOVERY_ACTOR_AUTH_USER_ID required");
    }
    const { data: run, error: runError } = await supabase
      .from("fi_external_hubspot_sync_runs")
      .insert({
        integration_id: integrationId,
        tenant_id: tenantId,
        status: "started",
        backup_run_type: "incremental",
        incremental_dataset: "contacts",
        incremental_cutoff_from: new Date(cutoffFrom).toISOString(),
        incremental_cutoff_to: new Date(cutoffTo).toISOString(),
        incremental_verification_state: "pending",
        contacts_complete: false,
        deals_complete: false,
        detail: {
          milestone: core.HUBSPOT_CONTACT_REFRESH_MILESTONE,
          dataset: "contacts",
          refresh_scope: "approved_exact_ids",
          approved_checksum: checksum,
          approved_ids: ids,
          portal_id: livePortalId,
          promotion_enabled: false,
          patient_creation: false,
          mapping_mutation: false,
          watermark_advance: false,
          side_effects: [],
        },
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (runError || !run) throw new Error("Unable to start contact refresh sync run");
    syncRunId = String(run.id);
    await supabase.from("fi_external_hubspot_import_audit").insert({
      integration_id: integrationId,
      tenant_id: tenantId,
      sync_run_id: syncRunId,
      action: "sync_started",
      actor_auth_user_id: actorAuthUserId,
      actor_label: "FI-HUBSPOT-IMPORT-1E-R contact staging refresh",
      detail: {
        milestone: core.HUBSPOT_CONTACT_REFRESH_MILESTONE,
        dataset: "contacts",
        cutoff_from: new Date(cutoffFrom).toISOString(),
        cutoff_to: new Date(cutoffTo).toISOString(),
        checksum,
        record_count: contacts.length,
      },
    });

    try {
      stagingResult = await backup.stageHubspotContactRefreshBatch({
        supabase,
        contacts,
        tenantId,
        integrationId,
        syncRunId,
      });
      if (stagingResult.failed > 0 || stagingResult.skipped > 0) {
        throw new Error("Contact staging refresh did not persist every approved contact");
      }
      await supabase
        .from("fi_external_hubspot_sync_runs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          contacts_discovered: contacts.length,
          contacts_staged: stagingResult.staged,
          contacts_skipped: stagingResult.skipped,
          contacts_failed: stagingResult.failed,
          contacts_duplicates: stagingResult.duplicates,
          contacts_archived: stagingResult.archived,
          contacts_complete: true,
          deals_complete: false,
          incremental_verification_state: "passed",
          incremental_checkpoint: {
            phase: "complete",
            approved_ids: ids,
            cutoff_to: new Date(cutoffTo).toISOString(),
          },
          detail: {
            milestone: core.HUBSPOT_CONTACT_REFRESH_MILESTONE,
            dataset: "contacts",
            refresh_scope: "approved_exact_ids",
            approved_checksum: checksum,
            approved_ids: ids,
            portal_id: livePortalId,
            promotion_enabled: false,
            patient_creation: false,
            mapping_mutation: false,
            watermark_advance: false,
            side_effects: [],
            staging_result: stagingResult,
          },
        })
        .eq("id", syncRunId);
      await supabase.from("fi_external_hubspot_import_audit").insert({
        integration_id: integrationId,
        tenant_id: tenantId,
        sync_run_id: syncRunId,
        action: "sync_completed",
        actor_auth_user_id: actorAuthUserId,
        actor_label: "FI-HUBSPOT-IMPORT-1E-R contact staging refresh",
        detail: {
          milestone: core.HUBSPOT_CONTACT_REFRESH_MILESTONE,
          dataset: "contacts",
          checksum,
          staging_result: stagingResult,
          no_fi_mutations: true,
          watermark_advance: false,
        },
      });
    } catch (error) {
      await supabase
        .from("fi_external_hubspot_sync_runs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          contacts_failed: contacts.length,
          incremental_verification_state: "failed",
          detail: {
            milestone: core.HUBSPOT_CONTACT_REFRESH_MILESTONE,
            dataset: "contacts",
            safe_reason: "Approved contact staging refresh failed.",
            watermark_advance: false,
          },
        })
        .eq("id", syncRunId);
      throw error;
    }
  }

  const after = await snapshot();
  core.assertRefreshMutationIsolation({
    leadsBefore: before.leads,
    leadsAfter: after.leads,
    patientsBefore: before.patients,
    patientsAfter: after.patients,
    staffBefore: before.staff,
    staffAfter: after.staff,
    usersBefore: before.users,
    usersAfter: after.users,
    mappingsBefore: before.mappings,
    mappingsAfter: after.mappings,
    notesWatermarkBefore: before.notesWatermark,
    notesWatermarkAfter: after.notesWatermark,
    contactWatermarkBefore: before.contactWatermark,
    contactWatermarkAfter: after.contactWatermark,
  });

  const inventoryAfter = await expansion.buildContactLeadExpansionInventory(supabase, {
    tenantId,
    integrationId,
  });
  const signatureRows = inventoryAfter.rows.map((row) =>
    expansionCore.toInventorySignatureRow(row)
  );
  const coverage = expansionCore.reconcileContactCoverage(signatureRows);
  expansionCore.assertCoverageReconciled(coverage);
  const afterReviewedRows = inventoryAfter.rows
    .filter((row) => ids.includes(row.hubspotContactId))
    .map((row) => expansionCore.toInventorySignatureRow(row));
  const beforeReviewedRows = [...beforeById.values()];
  const classificationDelta = expansionCore.diffInventorySignatures(
    beforeReviewedRows,
    afterReviewedRows
  );
  const { data: stagingAfter } = await supabase
    .from("fi_external_hubspot_contact_staging")
    .select(
      "hubspot_contact_id, sync_run_id, payload_checksum, hubspot_created_at, hubspot_updated_at, archived, email, phone, raw_payload"
    )
    .eq("tenant_id", tenantId)
    .eq("integration_id", integrationId)
    .in("hubspot_contact_id", ids);

  const report = {
    milestone: core.HUBSPOT_CONTACT_REFRESH_MILESTONE,
    mode: preview ? "preview" : "apply",
    tenantId,
    integrationId,
    portalOwnership: {
      configuredPortalId,
      livePortalId,
      match: configuredPortalId === livePortalId,
    },
    cutoff: {
      from: new Date(cutoffFrom).toISOString(),
      to: new Date(cutoffTo).toISOString(),
      immutable: true,
      dataset: "contacts",
    },
    approvedIds: ids,
    checksum,
    syncRunId,
    stagingResult,
    counts: { before, after },
    stagingBefore,
    stagingAfter,
    sourceContacts: contacts.map((contact) => ({
      hubspotContactId: contact.id,
      createdAt: contact.createdAt ?? null,
      updatedAt: contact.updatedAt ?? null,
      archived: Boolean(
        (contact as typeof contact & { archived?: boolean }).archived
      ),
      ownerId: contact.properties?.hubspot_owner_id ?? null,
      lifecycleStage: contact.properties?.lifecyclestage ?? null,
      leadStatus: contact.properties?.hs_lead_status ?? null,
      nameQuality: Boolean(
        contact.properties?.firstname?.trim() || contact.properties?.lastname?.trim()
      ),
      emailQuality: Boolean(contact.properties?.email?.trim()),
      phoneQuality: Boolean(
        contact.properties?.phone?.trim() || contact.properties?.mobilephone?.trim()
      ),
    })),
    reviewedContacts: afterReviewedRows,
    classificationDelta,
    inventory: {
      signature: expansionCore.computeInventorySignature(signatureRows),
      summary: inventoryAfter.summary,
      decisionCounts: Object.fromEntries(
        [...new Set(inventoryAfter.rows.map((row) => row.decision))]
          .sort()
          .map((decision) => [
            decision,
            inventoryAfter.rows.filter((row) => row.decision === decision).length,
          ])
      ),
      coverage,
    },
    guards: {
      tenantIsolated: true,
      portalMatched: true,
      fixedCutoff: true,
      stagingOnly: true,
      noMigrationApply: true,
      noPatientCreationOrLinking: true,
      noMappingOverwrite: true,
      notesWatermarkUnchanged: before.notesWatermark === after.notesWatermark,
      contactWatermarkUnchanged: before.contactWatermark === after.contactWatermark,
      noSideEffects: true,
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
