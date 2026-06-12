/**
 * Post-import audit for a HubSpot Stage 1 batch (metadata.import_batch_id).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/hubspot-post-import-audit.ts <import_batch_uuid>
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import { buildFiPersonsMetadataSearchOrFilter, patientDirectorySearchIlikePattern } from "../src/lib/patients/patientDirectorySearch";

function loadEnvLocal(): void {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const BATCH_ID = (process.argv[2] ?? "").trim();
if (!BATCH_ID) {
  console.error("Usage: npx tsx --env-file=.env.local scripts/hubspot-post-import-audit.ts <import_batch_uuid>");
  process.exit(1);
}

function hub(meta: unknown): Record<string, unknown> {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return {};
  const h = (meta as Record<string, unknown>).hubspot;
  if (h && typeof h === "object" && !Array.isArray(h)) return h as Record<string, unknown>;
  return {};
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (use .env.local or --env-file)");
  }
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: batchRow, error: be } = await supabase
    .from("fi_import_batches")
    .select("id, tenant_id, status, imported_row_count, metadata")
    .eq("id", BATCH_ID)
    .maybeSingle();
  if (be) throw new Error(be.message);
  if (!batchRow) {
    console.error(JSON.stringify({ ok: false, error: "fi_import_batches row not found for id", batchId: BATCH_ID }, null, 2));
    process.exit(2);
  }

  const tenantId = String((batchRow as { tenant_id: string }).tenant_id);

  const { count: personsTotal, error: pce } = await supabase
    .from("fi_persons")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .filter("metadata->>import_batch_id", "eq", BATCH_ID);
  if (pce) throw new Error(pce.message);

  const { data: persons20, error: pe } = await supabase
    .from("fi_persons")
    .select("id, metadata, created_at")
    .eq("tenant_id", tenantId)
    .filter("metadata->>import_batch_id", "eq", BATCH_ID)
    .order("created_at", { ascending: true })
    .limit(20);
  if (pe) throw new Error(pe.message);

  const personChecks = (persons20 ?? []).map((row) => {
    const m = (row as { metadata: unknown }).metadata;
    const h = hub(m);
    const first = str(h.first_name);
    const last = str(h.last_name);
    const email = str(h.email);
    const phone = str(h.phone_number);
    const ok = Boolean(first && last && email && phone);
    return {
      person_id: String((row as { id: string }).id),
      first_name: first,
      last_name: last,
      email,
      phone_number: phone,
      all_four_present: ok,
      missing: [first ? null : "first_name", last ? null : "last_name", email ? null : "email", phone ? null : "phone_number"].filter(
        Boolean
      ),
    };
  });

  const { data: leads10, error: le } = await supabase
    .from("fi_crm_leads")
    .select("id, person_id, patient_id, current_stage_id, metadata, summary")
    .eq("tenant_id", tenantId)
    .filter("metadata->>import_batch_id", "eq", BATCH_ID)
    .order("created_at", { ascending: true })
    .limit(10);
  if (le) throw new Error(le.message);

  const leadIds = (leads10 ?? []).map((r) => String((r as { id: string }).id));
  const stageIds = Array.from(
    new Set((leads10 ?? []).map((r) => (r as { current_stage_id: string | null }).current_stage_id).filter(Boolean))
  ) as string[];

  const stageLabelById = new Map<string, string>();
  const stageSlugById = new Map<string, string>();
  if (stageIds.length) {
    const { data: stages, error: se } = await supabase
      .from("fi_crm_pipeline_stages")
      .select("id, label, slug")
      .eq("tenant_id", tenantId)
      .in("id", stageIds);
    if (se) throw new Error(se.message);
    for (const s of stages ?? []) {
      const id = String((s as { id: string }).id);
      stageLabelById.set(id, String((s as { label: string }).label));
      stageSlugById.set(id, String((s as { slug: string }).slug));
    }
  }

  const sourceByLeadId = new Map<string, { source_system: string; source_lead_id: string }[]>();
  if (leadIds.length) {
    const { data: srcRows, error: srcErr } = await supabase
      .from("fi_crm_lead_source_ids")
      .select("lead_id, source_system, source_lead_id")
      .eq("tenant_id", tenantId)
      .in("lead_id", leadIds);
    if (srcErr) throw new Error(srcErr.message);
    for (const r of srcRows ?? []) {
      const lid = String((r as { lead_id: string }).lead_id);
      const list = sourceByLeadId.get(lid) ?? [];
      list.push({
        source_system: String((r as { source_system: string }).source_system),
        source_lead_id: String((r as { source_lead_id: string }).source_lead_id),
      });
      sourceByLeadId.set(lid, list);
    }
  }

  const leadChecks = (leads10 ?? []).map((row) => {
    const r = row as {
      id: string;
      current_stage_id: string | null;
      metadata: unknown;
    };
    const h = hub(r.metadata);
    const mappedSlug = str(h.mapped_pipeline_slug);
    const stageLabel = r.current_stage_id ? stageLabelById.get(r.current_stage_id) ?? "(unknown stage id)" : null;
    const stageSlug = r.current_stage_id ? stageSlugById.get(r.current_stage_id) ?? null : null;
    const leadStatus = str(h.lead_status);
    const sources = sourceByLeadId.get(r.id) ?? [];
    const hasHubspotDeal = sources.some((s) => s.source_system === "hubspot_deal");
    const hasHubspotLeadSourceRow = sources.some((s) => s.source_system === "hubspot");
    const slugMatchesStage = mappedSlug && stageSlug ? mappedSlug === stageSlug : null;
    return {
      lead_id: r.id,
      current_stage_id: r.current_stage_id,
      stage_label: stageLabel,
      stage_slug: stageSlug,
      mapped_pipeline_slug: mappedSlug,
      slug_matches_current_stage: slugMatchesStage,
      lead_status_snapshot: leadStatus,
      fi_crm_lead_source_ids: sources,
      /** HubSpot contact id is on fi_person_source_ids; lead table may only list hubspot_deal. */
      has_hubspot_lead_source_row: hasHubspotLeadSourceRow,
      has_hubspot_deal_source: hasHubspotDeal,
    };
  });

  const { data: patients10, error: patE } = await supabase
    .from("fi_patients")
    .select("id, person_id, metadata, patient_status")
    .eq("tenant_id", tenantId)
    .filter("metadata->>import_batch_id", "eq", BATCH_ID)
    .order("created_at", { ascending: true })
    .limit(10);
  if (patE) throw new Error(patE.message);

  const patientChecks = (patients10 ?? []).map((row) => {
    const r = row as { id: string; person_id: string; metadata: unknown; patient_status: string };
    const h = hub(r.metadata);
    const cls = str(h.import_classification);
    const okClass = cls === "patient" || cls === "mixed_patient_lead";
    return {
      patient_id: r.id,
      person_id: r.person_id,
      import_classification: cls,
      acceptable_patient_row: okClass,
      patient_status: r.patient_status,
    };
  });

  const { data: allBatchPatients, error: apE } = await supabase
    .from("fi_patients")
    .select("id, metadata")
    .eq("tenant_id", tenantId)
    .filter("metadata->>import_batch_id", "eq", BATCH_ID);
  if (apE) throw new Error(apE.message);
  const badClassification = (allBatchPatients ?? []).filter((row) => {
    const cls = str(hub((row as { metadata: unknown }).metadata).import_classification);
    return cls !== "patient" && cls !== "mixed_patient_lead";
  });

  const { data: batchPersonIdsRows } = await supabase
    .from("fi_persons")
    .select("id")
    .eq("tenant_id", tenantId)
    .filter("metadata->>import_batch_id", "eq", BATCH_ID);
  const batchPersonIdSet = new Set((batchPersonIdsRows ?? []).map((r) => String((r as { id: string }).id)));

  const searchTerms = ["Tjania Smith", "Mohamed Hassan", "Simon", "Ratheesh"];
  const searchAudit: Record<string, unknown>[] = [];
  for (const term of searchTerms) {
    const pattern = patientDirectorySearchIlikePattern(term);
    const orFilter = buildFiPersonsMetadataSearchOrFilter(pattern);
    const { data: hits, error: se } = await supabase.from("fi_persons").select("id").eq("tenant_id", tenantId).or(orFilter).limit(50);
    if (se) {
      searchAudit.push({ term, error: se.message });
      continue;
    }
    const hitIds = new Set((hits ?? []).map((r) => String((r as { id: string }).id)));
    const hitsInBatch = Array.from(hitIds).filter((id) => batchPersonIdSet.has(id));
    searchAudit.push({
      term,
      total_hits_capped_50: hitIds.size,
      batch_person_hits: hitsInBatch.length,
      sample_batch_person_ids: hitsInBatch.slice(0, 5),
    });
  }

  let hubspotSourceRows: { id: string; person_id: string; source_person_id: string }[] = [];
  const batchPersonIds = (batchPersonIdsRows ?? []).map((r) => String((r as { id: string }).id));
  if (batchPersonIds.length > 0) {
    const { data, error: hsErr } = await supabase
      .from("fi_person_source_ids")
      .select("id, person_id, source_person_id")
      .eq("tenant_id", tenantId)
      .eq("source_system", "hubspot")
      .in("person_id", batchPersonIds);
    if (hsErr) throw new Error(hsErr.message);
    hubspotSourceRows = (data ?? []) as { id: string; person_id: string; source_person_id: string }[];
  }

  const bySourcePid = new Map<string, string[]>();
  for (const r of hubspotSourceRows) {
    const sp = String((r as { source_person_id: string }).source_person_id);
    const pid = String((r as { person_id: string }).person_id);
    const list = bySourcePid.get(sp) ?? [];
    list.push(pid);
    bySourcePid.set(sp, list);
  }
  const duplicateHubspotSourcePersonIds = Array.from(bySourcePid.entries()).filter(([, ids]) => ids.length > 1);

  const expectedHubKeys = new Set([
    "record_id",
    "first_name",
    "last_name",
    "email",
    "phone_number",
    "lifecycle_stage",
    "lead_status",
    "stage_of_journey",
  ]);

  const metadataStructureSamples = (persons20 ?? []).slice(0, 3).map((row) => {
    const m = (row as { id: string; metadata: unknown }).metadata;
    const meta = m && typeof m === "object" && !Array.isArray(m) ? (m as Record<string, unknown>) : {};
    const ib = str(meta.import_batch_id);
    const h = hub(meta);
    const keys = Object.keys(h);
    const hasCore = expectedHubKeys.size === Array.from(expectedHubKeys).filter((k) => k in h).length;
    const extraKeys = keys.filter((k) => !expectedHubKeys.has(k));
    return {
      person_id: row.id,
      has_top_level_import_batch_id: ib === BATCH_ID,
      hubspot_key_count: keys.length,
      has_all_expected_hubspot_keys: hasCore,
      extra_hubspot_keys_beyond_minimum: extraKeys.slice(0, 12),
    };
  });

  const report = {
    ok: true,
    batch: {
      id: BATCH_ID,
      tenant_id: tenantId,
      fi_import_batches: {
        status: (batchRow as { status?: string }).status,
        imported_row_count: (batchRow as { imported_row_count?: number | null }).imported_row_count,
      },
    },
    counts: {
      fi_persons_with_batch: personsTotal ?? 0,
      fi_crm_leads_with_batch: null as number | null,
      fi_patients_with_batch: null as number | null,
    },
    "1_sample_20_fi_persons_hubspot_fields": {
      pass_all_four: personChecks.every((p) => p.all_four_present),
      failures: personChecks.filter((p) => !p.all_four_present),
      samples: personChecks,
    },
    "2_sample_10_fi_crm_leads": {
      note:
        "Pipeline: mapped_pipeline_slug should match fi_crm_pipeline_stages.slug for current_stage_id. HubSpot contact Record ID is on fi_person_source_ids (hubspot); fi_crm_lead_source_ids often uses hubspot_deal for deal ids.",
      samples: leadChecks,
    },
    "3_sample_10_fi_patients_classification": {
      all_acceptable: patientChecks.every((p) => p.acceptable_patient_row),
      bad_rows_in_entire_batch: badClassification.length,
      samples: patientChecks,
    },
    "4_search_audit_tenant_wide_then_batch_overlap": searchAudit,
    "5_duplicate_fi_person_source_ids_hubspot": {
      duplicate_source_person_id_count: duplicateHubspotSourcePersonIds.length,
      duplicates: duplicateHubspotSourcePersonIds.map(([source_person_id, person_ids]) => ({
        source_person_id,
        person_ids,
      })),
    },
    "6_metadata_structure": {
      expected_minimum_hubspot_keys: Array.from(expectedHubKeys),
      note: "Importer also stores additional hubspot keys (e.g. mapped_pipeline_slug); has_all_expected_hubspot_keys requires the seven user-listed fields plus record_id.",
      samples: metadataStructureSamples,
    },
  };

  const { count: lc } = await supabase
    .from("fi_crm_leads")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .filter("metadata->>import_batch_id", "eq", BATCH_ID);
  const { count: pc } = await supabase
    .from("fi_patients")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .filter("metadata->>import_batch_id", "eq", BATCH_ID);
  report.counts.fi_crm_leads_with_batch = lc ?? 0;
  report.counts.fi_patients_with_batch = pc ?? 0;

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
