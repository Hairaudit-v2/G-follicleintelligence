/**
 * FI-HUBSPOT-IMPORT-1A — production-safe read-only dry-run against verified HubSpot staging + FI OS.
 *
 * HARD GUARDS:
 * - SELECT only (no insert/update/delete)
 * - No notifications, automations, watermark changes, or entity writes
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeEmail } from "@/src/lib/fi/foundation/normalize";
import {
  isScientificNotationPhone,
  isTestOrSmokeContact,
  normalizePhoneDigits,
  privacySafeSourceIdHash,
} from "./hubspotImportIdentity";
import {
  emptyFiIdentitySnapshot,
  runContactsImportDryRunCore,
  runOwnersImportDryRunCore,
  selectStratifiedContactCohort,
} from "./hubspotImportDryRunCore";
import { buildContactReconciliationMetrics, buildDryRunReport } from "./hubspotImportReconciliation";
import type {
  FiIdentitySnapshot,
  HubspotContactDryRunInput,
  HubspotImportDataset,
  HubspotImportDryRunReport,
  HubspotOwnerDryRunInput,
} from "./hubspotImportTypes";

export type HubspotImportDryRunOptions = {
  tenantId: string;
  integrationId: string;
  dataset: HubspotImportDataset;
  limit?: number;
  sourceId?: string;
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
  strict?: boolean;
  /** Fixed timestamp for deterministic evidence. */
  generatedAt?: string;
};

type MutationGuard = {
  inserts: number;
  updates: number;
  deletes: number;
  upserts: number;
};

function installMutationGuard(client: SupabaseClient): MutationGuard {
  const guard: MutationGuard = { inserts: 0, updates: 0, deletes: 0, upserts: 0 };
  const originalFrom = client.from.bind(client);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any).from = (table: string) => {
    const builder = originalFrom(table);
    const wrap = (method: "insert" | "update" | "delete" | "upsert") => {
      const orig = builder[method]?.bind(builder);
      if (!orig) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (builder as any)[method] = (..._args: unknown[]) => {
        guard[method === "insert" ? "inserts" : method === "update" ? "updates" : method === "delete" ? "deletes" : "upserts"] += 1;
        throw new Error(
          `DRY_RUN_WRITE_GUARD: refused ${method} on ${table} during HubSpot import dry-run`
        );
      };
    };
    wrap("insert");
    wrap("update");
    wrap("delete");
    wrap("upsert");
    return builder;
  };
  return guard;
}

function prop(raw: Record<string, unknown> | null | undefined, ...keys: string[]): string | null {
  if (!raw) return null;
  const props = (raw.properties as Record<string, unknown> | undefined) ?? raw;
  for (const key of keys) {
    const v = props[key];
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return null;
}

async function loadOwnerSnapshot(
  supabase: SupabaseClient,
  tenantId: string,
  integrationId: string
): Promise<{
  owners: HubspotOwnerDryRunInput[];
  snapshotPartial: Pick<FiIdentitySnapshot, "externalOwnerToStaff" | "staffEmailToStaff">;
}> {
  const snapshotPartial = {
    externalOwnerToStaff: new Map<string, { staffId: string; isActive: boolean }>(),
    staffEmailToStaff: new Map<string, { staffId: string; isActive: boolean }>(),
  };

  const { data: ownerRows, error: ownerErr } = await supabase
    .from("fi_external_hubspot_owner_inventory")
    .select("hubspot_owner_id, archived, raw_payload, tenant_id, integration_id")
    .eq("tenant_id", tenantId)
    .eq("integration_id", integrationId)
    .limit(500);
  if (ownerErr) throw new Error(`owner inventory: ${ownerErr.message}`);

  const { data: staffSourceRows, error: ssErr } = await supabase
    .from("fi_staff_source_ids")
    .select("staff_id, source_staff_id, source_system")
    .eq("tenant_id", tenantId)
    .eq("source_system", "hubspot")
    .limit(2000);
  if (ssErr) throw new Error(`staff source ids: ${ssErr.message}`);

  const staffIds = (staffSourceRows ?? []).map((r) => String((r as { staff_id: string }).staff_id));
  let staffActive = new Map<string, boolean>();
  if (staffIds.length) {
    const { data: staffRows, error: stErr } = await supabase
      .from("fi_staff")
      .select("id, is_active")
      .eq("tenant_id", tenantId)
      .in("id", staffIds);
    if (stErr) throw new Error(`fi_staff: ${stErr.message}`);
    staffActive = new Map(
      (staffRows ?? []).map((r) => [
        String((r as { id: string }).id),
        Boolean((r as { is_active: boolean }).is_active),
      ])
    );
  }

  for (const row of staffSourceRows ?? []) {
    const r = row as { staff_id: string; source_staff_id: string };
    snapshotPartial.externalOwnerToStaff.set(String(r.source_staff_id), {
      staffId: String(r.staff_id),
      isActive: staffActive.get(String(r.staff_id)) ?? false,
    });
  }

  const { data: staffEmailRows, error: seErr } = await supabase
    .from("fi_staff")
    .select("id, is_active, email")
    .eq("tenant_id", tenantId)
    .limit(2000);
  if (!seErr && staffEmailRows) {
    for (const row of staffEmailRows) {
      const r = row as { id: string; is_active: boolean; email?: string | null };
      const n = normalizeEmail(r.email ?? null);
      if (!n) continue;
      // First wins; multiples would require a multi-map (v1 keeps first).
      if (!snapshotPartial.staffEmailToStaff.has(n)) {
        snapshotPartial.staffEmailToStaff.set(n, {
          staffId: String(r.id),
          isActive: Boolean(r.is_active),
        });
      }
    }
  }

  // Fallback: fi_users email if staff email columns absent / empty.
  if (snapshotPartial.staffEmailToStaff.size === 0) {
    const { data: users, error: uErr } = await supabase
      .from("fi_users")
      .select("id, email")
      .eq("tenant_id", tenantId)
      .limit(2000);
    if (!uErr && users) {
      const { data: staffByUser } = await supabase
        .from("fi_staff")
        .select("id, is_active, fi_user_id")
        .eq("tenant_id", tenantId)
        .not("fi_user_id", "is", null)
        .limit(2000);
      const userToStaff = new Map(
        (staffByUser ?? []).map((r) => [
          String((r as { fi_user_id: string }).fi_user_id),
          {
            staffId: String((r as { id: string }).id),
            isActive: Boolean((r as { is_active: boolean }).is_active),
          },
        ])
      );
      for (const u of users) {
        const email = normalizeEmail((u as { email?: string }).email ?? null);
        const staff = userToStaff.get(String((u as { id: string }).id));
        if (email && staff && !snapshotPartial.staffEmailToStaff.has(email)) {
          snapshotPartial.staffEmailToStaff.set(email, staff);
        }
      }
    }
  }

  const owners: HubspotOwnerDryRunInput[] = (ownerRows ?? []).map((row) => {
    const r = row as {
      hubspot_owner_id: string;
      archived: boolean;
      raw_payload: Record<string, unknown>;
      tenant_id: string;
      integration_id: string;
    };
    const email =
      normalizeEmail(prop(r.raw_payload, "email", "userId")) ??
      normalizeEmail(String((r.raw_payload as { email?: string }).email ?? "")) ??
      null;
    const type = String(prop(r.raw_payload, "type") ?? "").toLowerCase();
    return {
      hubspotOwnerId: String(r.hubspot_owner_id),
      tenantId: String(r.tenant_id),
      integrationId: String(r.integration_id),
      emailNormalized: email,
      archived: Boolean(r.archived),
      isSystemOwner: type === "system" || type === "bot" || !email,
      isTestOwner: Boolean(email && (email.includes("test") || email.endsWith("@example.com"))),
      displayNameHash: privacySafeSourceIdHash(String(r.hubspot_owner_id)),
    };
  });

  return { owners, snapshotPartial };
}

async function loadContactIdentitySnapshot(
  supabase: SupabaseClient,
  tenantId: string,
  integrationId: string,
  contactIds: string[],
  emails: string[]
): Promise<FiIdentitySnapshot> {
  const snapshot = emptyFiIdentitySnapshot();

  if (contactIds.length) {
    const { data: personSrc } = await supabase
      .from("fi_person_source_ids")
      .select("person_id, source_person_id")
      .eq("tenant_id", tenantId)
      .eq("source_system", "hubspot")
      .in("source_person_id", contactIds);
    for (const row of personSrc ?? []) {
      const r = row as { person_id: string; source_person_id: string };
      snapshot.externalContactToPerson.set(String(r.source_person_id), String(r.person_id));
    }

    const { data: patientSrc } = await supabase
      .from("fi_patient_source_ids")
      .select("patient_id, source_patient_id")
      .eq("tenant_id", tenantId)
      .eq("source_system", "hubspot")
      .in("source_patient_id", contactIds);
    for (const row of patientSrc ?? []) {
      const r = row as { patient_id: string; source_patient_id: string };
      snapshot.externalContactToPatient.set(String(r.source_patient_id), String(r.patient_id));
    }

    const { data: extMaps } = await supabase
      .from("fi_external_record_mappings")
      .select("external_id, fi_entity_type, fi_entity_id")
      .eq("tenant_id", tenantId)
      .eq("integration_id", integrationId)
      .eq("source_provider", "hubspot")
      .eq("source_entity_type", "contact")
      .in("external_id", contactIds);
    for (const row of extMaps ?? []) {
      const r = row as { external_id: string; fi_entity_type: string; fi_entity_id: string };
      if (r.fi_entity_type === "person") {
        snapshot.externalContactToPerson.set(String(r.external_id), String(r.fi_entity_id));
      } else if (r.fi_entity_type === "lead") {
        snapshot.externalContactToLead.set(String(r.external_id), String(r.fi_entity_id));
      } else if (r.fi_entity_type === "patient") {
        snapshot.externalContactToPatient.set(String(r.external_id), String(r.fi_entity_id));
      }
    }
  }

  const personIds = Array.from(
    new Set([
      ...snapshot.externalContactToPerson.values(),
      ...(emails.length
        ? (
            await supabase
              .from("fi_persons")
              .select("id, metadata")
              .eq("tenant_id", tenantId)
              .in("metadata->>email_normalized", emails)
              .limit(2000)
          ).data?.map((r) => {
            const id = String((r as { id: string }).id);
            const meta = (r as { metadata?: { email_normalized?: string } }).metadata;
            const em = normalizeEmail(meta?.email_normalized ?? null);
            if (em) {
              const list = snapshot.emailToPersonIds.get(em) ?? [];
              list.push(id);
              snapshot.emailToPersonIds.set(em, list);
            }
            return id;
          }) ?? []
        : []),
    ])
  );

  if (personIds.length) {
    const { data: leads } = await supabase
      .from("fi_crm_leads")
      .select("id, person_id, current_stage_id")
      .eq("tenant_id", tenantId)
      .in("person_id", personIds)
      .limit(5000);
    const stageIds = Array.from(
      new Set(
        (leads ?? [])
          .map((l) => (l as { current_stage_id?: string | null }).current_stage_id)
          .filter(Boolean) as string[]
      )
    );
    const stageSlug = new Map<string, string>();
    if (stageIds.length) {
      const { data: stages } = await supabase
        .from("fi_crm_pipeline_stages")
        .select("id, slug")
        .eq("tenant_id", tenantId)
        .in("id", stageIds);
      for (const s of stages ?? []) {
        stageSlug.set(String((s as { id: string }).id), String((s as { slug: string }).slug));
      }
    }
    for (const lead of leads ?? []) {
      const r = lead as { id: string; person_id: string; current_stage_id?: string | null };
      const list = snapshot.personToLeadIds.get(String(r.person_id)) ?? [];
      list.push(String(r.id));
      snapshot.personToLeadIds.set(String(r.person_id), list);
      if (r.current_stage_id) {
        const slug = stageSlug.get(String(r.current_stage_id));
        if (slug) snapshot.leadCurrentStageSlug.set(String(r.id), slug);
      }
    }

    const { data: patients } = await supabase
      .from("fi_patients")
      .select("id, person_id")
      .eq("tenant_id", tenantId)
      .in("person_id", personIds)
      .limit(5000);
    for (const p of patients ?? []) {
      const r = p as { id: string; person_id: string };
      snapshot.personToPatientId.set(String(r.person_id), String(r.id));
    }
  }

  return snapshot;
}

function mapStagingContactRow(row: Record<string, unknown>): HubspotContactDryRunInput {
  const r = row as {
    hubspot_contact_id: string;
    email: string | null;
    phone: string | null;
    import_status: string | null;
    raw_payload: Record<string, unknown>;
    tenant_id: string;
    integration_id: string;
    created_at: string;
    updated_at: string;
  };
  const emailNormalized = normalizeEmail(r.email ?? prop(r.raw_payload, "email"));
  const phoneRaw = r.phone ?? prop(r.raw_payload, "phone", "mobilephone");
  const phoneCorrupted = isScientificNotationPhone(phoneRaw);
  const lifecycleStage = prop(r.raw_payload, "lifecyclestage", "lifecycle_stage");
  const leadStatus = prop(r.raw_payload, "hs_lead_status", "lead_status");
  const ownerId = prop(r.raw_payload, "hubspot_owner_id", "owner_id");
  const archived = String(prop(r.raw_payload, "archived") ?? "false").toLowerCase() === "true";
  const contactId = String(r.hubspot_contact_id);
  return {
    hubspotContactId: contactId,
    tenantId: String(r.tenant_id),
    integrationId: String(r.integration_id),
    emailNormalized,
    phoneDigits: phoneCorrupted ? null : normalizePhoneDigits(phoneRaw),
    phoneCorrupted,
    hubspotOwnerId: ownerId,
    lifecycleStage,
    leadStatus,
    dealStageLabel: null,
    archived,
    isTestOrSmoke: isTestOrSmokeContact({
      emailNormalized,
      hubspotContactId: contactId,
      lifecycleStage,
    }),
    sourceCreatedAt: prop(r.raw_payload, "createdate") ?? r.created_at,
    sourceUpdatedAt: prop(r.raw_payload, "lastmodifieddate", "hs_lastmodifieddate") ?? r.updated_at,
    importStatus: r.import_status,
  };
}

async function loadContactsFromStaging(
  supabase: SupabaseClient,
  opts: HubspotImportDryRunOptions
): Promise<HubspotContactDryRunInput[]> {
  const selectCols =
    "hubspot_contact_id, email, phone, lead_source, import_status, raw_payload, tenant_id, integration_id, created_at, updated_at";

  const applyFilters = (q: ReturnType<SupabaseClient["from"]>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let out: any = q
      .select(selectCols)
      .eq("tenant_id", opts.tenantId)
      .eq("integration_id", opts.integrationId);
    if (opts.sourceId) out = out.eq("hubspot_contact_id", opts.sourceId);
    if (opts.createdFrom) out = out.gte("created_at", opts.createdFrom);
    if (opts.createdTo) out = out.lt("created_at", opts.createdTo);
    if (opts.updatedFrom) out = out.gte("updated_at", opts.updatedFrom);
    if (opts.updatedTo) out = out.lt("updated_at", opts.updatedTo);
    return out;
  };

  // Merge earliest + latest HubSpot IDs so stratification is not biased to Stage-1 imports.
  const half = Math.min(Math.max((opts.limit ?? 100) * 5, 250), 1000);
  const qAsc = applyFilters(supabase.from("fi_external_hubspot_contact_staging"))
    .order("hubspot_contact_id", { ascending: true })
    .limit(half);
  const qDesc = applyFilters(supabase.from("fi_external_hubspot_contact_staging"))
    .order("hubspot_contact_id", { ascending: false })
    .limit(half);

  const [ascRes, descRes] = await Promise.all([qAsc, qDesc]);
  if (ascRes.error) throw new Error(`contact staging asc: ${ascRes.error.message}`);
  if (descRes.error) throw new Error(`contact staging desc: ${descRes.error.message}`);

  const byId = new Map<string, HubspotContactDryRunInput>();
  for (const row of [...(ascRes.data ?? []), ...(descRes.data ?? [])]) {
    const mapped = mapStagingContactRow(row as Record<string, unknown>);
    byId.set(mapped.hubspotContactId, mapped);
  }
  return Array.from(byId.values());
}

/**
 * Read-only production dry-run. Never writes FI OS entities or backup watermarks.
 */
export async function runHubspotImportDryRun(
  supabase: SupabaseClient,
  opts: HubspotImportDryRunOptions
): Promise<{
  report: HubspotImportDryRunReport;
  mutationGuard: MutationGuard;
  ownerDryRun: ReturnType<typeof runOwnersImportDryRunCore> | null;
  cohortSize: number;
  stagingContactCountSampled: number;
}> {
  const guard = installMutationGuard(supabase);

  if (opts.dataset === "owners") {
    const { owners, snapshotPartial } = await loadOwnerSnapshot(
      supabase,
      opts.tenantId,
      opts.integrationId
    );
    const snapshot = emptyFiIdentitySnapshot();
    snapshot.externalOwnerToStaff = snapshotPartial.externalOwnerToStaff;
    snapshot.staffEmailToStaff = snapshotPartial.staffEmailToStaff;
    const ownerDryRun = runOwnersImportDryRunCore({
      tenantId: opts.tenantId,
      owners: opts.limit ? owners.slice(0, opts.limit) : owners,
      snapshot,
    });
    const metrics = buildContactReconciliationMetrics({
      decisions: [],
      sourceIds: owners.map((o) => o.hubspotOwnerId),
      wrongTenantCount: 0,
      ownerClasses: ownerDryRun.ownerClasses,
    });
    const report = buildDryRunReport({
      tenantId: opts.tenantId,
      integrationId: opts.integrationId,
      dataset: "owners",
      decisions: [],
      metrics,
      generatedAt: opts.generatedAt,
    });
    // Attach owner classifications in a privacy-safe way via metrics only.
    (report as HubspotImportDryRunReport & { ownerClassifications?: unknown }).ownerClassifications =
      ownerDryRun.classifications;
    return {
      report,
      mutationGuard: guard,
      ownerDryRun,
      cohortSize: ownerDryRun.classifications.length,
      stagingContactCountSampled: 0,
    };
  }

  if (opts.dataset !== "contacts") {
    const metrics = buildContactReconciliationMetrics({
      decisions: [],
      sourceIds: [],
      wrongTenantCount: 0,
      ownerClasses: [],
    });
    const report = buildDryRunReport({
      tenantId: opts.tenantId,
      integrationId: opts.integrationId,
      dataset: opts.dataset,
      decisions: [],
      metrics,
      generatedAt: opts.generatedAt,
    });
    report.verdict = "AMBER";
    report.verdictReasons = [
      `Dataset ${opts.dataset} dry-run inventory is defined; executable cohort dry-run in 1A is contacts/owners only.`,
    ];
    return {
      report,
      mutationGuard: guard,
      ownerDryRun: null,
      cohortSize: 0,
      stagingContactCountSampled: 0,
    };
  }

  const { owners, snapshotPartial } = await loadOwnerSnapshot(
    supabase,
    opts.tenantId,
    opts.integrationId
  );
  const ownerDryRun = runOwnersImportDryRunCore({
    tenantId: opts.tenantId,
    owners,
    snapshot: {
      ...emptyFiIdentitySnapshot(),
      externalOwnerToStaff: snapshotPartial.externalOwnerToStaff,
      staffEmailToStaff: snapshotPartial.staffEmailToStaff,
    },
  });

  const allContacts = await loadContactsFromStaging(supabase, opts);
  const limit = opts.limit ?? 100;

  // Pre-load identity for stratification using external maps for the pool.
  const poolIds = allContacts.map((c) => c.hubspotContactId).filter(Boolean);
  const poolEmails = Array.from(
    new Set(allContacts.map((c) => c.emailNormalized).filter(Boolean) as string[])
  ).slice(0, 1500);

  let snapshot = await loadContactIdentitySnapshot(
    supabase,
    opts.tenantId,
    opts.integrationId,
    poolIds.slice(0, 1500),
    poolEmails
  );
  snapshot.externalOwnerToStaff = snapshotPartial.externalOwnerToStaff;
  snapshot.staffEmailToStaff = snapshotPartial.staffEmailToStaff;

  const cohort = opts.sourceId
    ? allContacts.filter((c) => c.hubspotContactId === opts.sourceId).slice(0, limit)
    : selectStratifiedContactCohort(allContacts, snapshot, limit);

  // Refresh snapshot focused on cohort (ensures lead maps for selected emails).
  snapshot = await loadContactIdentitySnapshot(
    supabase,
    opts.tenantId,
    opts.integrationId,
    cohort.map((c) => c.hubspotContactId),
    Array.from(new Set(cohort.map((c) => c.emailNormalized).filter(Boolean) as string[]))
  );
  snapshot.externalOwnerToStaff = snapshotPartial.externalOwnerToStaff;
  snapshot.staffEmailToStaff = snapshotPartial.staffEmailToStaff;

  const { report } = runContactsImportDryRunCore({
    tenantId: opts.tenantId,
    integrationId: opts.integrationId,
    contacts: cohort,
    snapshot,
    ownerClasses: ownerDryRun.ownerClasses,
    generatedAt: opts.generatedAt,
  });

  if (opts.strict) {
    if (guard.inserts + guard.updates + guard.deletes + guard.upserts > 0) {
      throw new Error("DRY_RUN_STRICT: mutation guard recorded writes");
    }
    if (report.entityWritesPerformed !== false) {
      throw new Error("DRY_RUN_STRICT: entityWritesPerformed must be false");
    }
  }

  return {
    report,
    mutationGuard: guard,
    ownerDryRun,
    cohortSize: cohort.length,
    stagingContactCountSampled: allContacts.length,
  };
}

/** Aggregate-only full contact staging counts (no PII). */
export async function countHubspotContactStaging(
  supabase: SupabaseClient,
  tenantId: string,
  integrationId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("fi_external_hubspot_contact_staging")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("integration_id", integrationId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}
