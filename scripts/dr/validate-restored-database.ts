#!/usr/bin/env tsx
/**
 * FI-SECURITY-RESTORE-DRILL-1 database validator.
 *
 * Read-only by design. It must be pointed at an isolated restored Supabase
 * project and refuses the known production project ref.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const PRODUCTION_PROJECT_REF = "iqqvzgxoimxchhcnbzxl";
const PRODUCTION_HOST = `${PRODUCTION_PROJECT_REF}.supabase.co`;
const DEFAULT_TENANT_ID = "c2615b95-b707-4485-aa5f-be8f78ec868a";
const DEFAULT_PRE_MARKER_ID = "SMOKETEST-RECOVERY-MARKER-20260714";
const DEFAULT_PRE_MARKER_LEAD_ID = "70f2e1b0-e8b7-472e-8f3e-bb59c4b92511";
const DEFAULT_POST_MARKER_ID = "SMOKETEST-RESTORE-DRILL-POST-MUTATION";

type Check = {
  name: string;
  pass: boolean;
  detail?: string;
  data?: unknown;
};

type CountResult = {
  table: string;
  count: number | null;
  pass: boolean;
  error?: string;
};

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  let raw = readFileSync(path, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim().replace(/^export\s+/, "");
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(resolve(process.cwd(), ".env.restore-drill.local"));
loadEnvFile(resolve(process.cwd(), ".env.restore-drill"));

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function optionalEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function projectRefFromUrl(rawUrl: string): string {
  const host = new URL(rawUrl).host.toLowerCase();
  const match = /^([a-z0-9-]+)\.supabase\.co$/.exec(host);
  return match?.[1] ?? host;
}

function assertSafeTarget(url: string, expectedRef: string): string {
  const parsed = new URL(url);
  const host = parsed.host.toLowerCase();
  const projectRef = projectRefFromUrl(url);

  if (process.env.FI_DRILL_CONFIRM_NON_PRODUCTION !== "YES") {
    throw new Error("Refusing to run: set FI_DRILL_CONFIRM_NON_PRODUCTION=YES");
  }
  if (!expectedRef || expectedRef === PRODUCTION_PROJECT_REF) {
    throw new Error("Refusing to run: FI_DRILL_EXPECTED_PROJECT_REF is missing or production");
  }
  if (projectRef !== expectedRef) {
    throw new Error(
      `Refusing to run: URL project ref ${projectRef} does not match FI_DRILL_EXPECTED_PROJECT_REF ${expectedRef}`
    );
  }
  if (projectRef === PRODUCTION_PROJECT_REF || host === PRODUCTION_HOST) {
    throw new Error(`Refusing to run against known production project ${PRODUCTION_PROJECT_REF}`);
  }
  if (!host.endsWith(".supabase.co")) {
    throw new Error("Refusing to run: FI_RESTORE_SUPABASE_URL must be a Supabase project URL");
  }
  return projectRef;
}

function redactId(id: string | null): string | null {
  if (!id) return null;
  if (id.length <= 12) return `${id.slice(0, 4)}...`;
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

async function safeCount(sb: SupabaseClient, table: string, tenantId?: string): Promise<CountResult> {
  let query = sb.from(table).select("*", { count: "exact", head: true });
  if (tenantId) query = query.eq("tenant_id", tenantId);
  const { count, error } = await query;
  return {
    table,
    count: count ?? null,
    pass: !error,
    error: error?.message,
  };
}

async function rowExists(
  sb: SupabaseClient,
  table: string,
  id: string,
  tenantId?: string
): Promise<Check> {
  let query = sb.from(table).select("id, tenant_id").eq("id", id).limit(1);
  if (tenantId) query = query.eq("tenant_id", tenantId);
  const { data, error } = await query.maybeSingle();
  return {
    name: `representative:${table}`,
    pass: !error && Boolean(data?.id),
    detail: error?.message ?? (data?.id ? `found ${redactId(id)}` : `missing ${redactId(id)}`),
  };
}

async function main(): Promise<void> {
  const restoreUrl = requiredEnv("FI_RESTORE_SUPABASE_URL");
  const restoreKey = requiredEnv("FI_RESTORE_SUPABASE_SERVICE_ROLE_KEY");
  const expectedProjectRef = requiredEnv("FI_DRILL_EXPECTED_PROJECT_REF");
  const projectRef = assertSafeTarget(restoreUrl, expectedProjectRef);

  const tenantId = optionalEnv("FI_DRILL_EXPECTED_TENANT_ID") ?? DEFAULT_TENANT_ID;
  const preMarkerId = optionalEnv("FI_DRILL_PRE_RECOVERY_MARKER_ID") ?? DEFAULT_PRE_MARKER_ID;
  const preMarkerLeadId =
    optionalEnv("FI_DRILL_PRE_RECOVERY_LEAD_ID") ?? DEFAULT_PRE_MARKER_LEAD_ID;
  const postMarkerId = optionalEnv("FI_DRILL_POST_RECOVERY_MARKER_ID") ?? DEFAULT_POST_MARKER_ID;

  const sb = createClient(restoreUrl, restoreKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const checks: Check[] = [
    { name: "target_is_not_production", pass: true, detail: projectRef },
    { name: "expected_project_ref", pass: projectRef === expectedProjectRef, detail: projectRef },
  ];

  const { data: tenant, error: tenantError } = await sb
    .from("fi_tenants")
    .select("id, slug")
    .eq("id", tenantId)
    .maybeSingle();
  checks.push({
    name: "evolved_tenant_present",
    pass: !tenantError && tenant?.id === tenantId,
    detail: tenantError?.message ?? (tenant?.id ? "found" : "missing"),
  });

  const { data: preMarker, error: preMarkerError } = await sb
    .from("fi_crm_leads")
    .select("id, tenant_id, summary, created_at")
    .eq("tenant_id", tenantId)
    .or(`id.eq.${preMarkerLeadId},summary.ilike.${preMarkerId}%`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  checks.push({
    name: "pre_recovery_marker_present",
    pass:
      !preMarkerError &&
      Boolean(preMarker?.id) &&
      preMarker?.tenant_id === tenantId &&
      String(preMarker?.summary ?? "").includes(preMarkerId),
    detail: preMarkerError?.message ?? (preMarker?.id ? `found ${redactId(preMarker.id)}` : "missing"),
    data: preMarker?.created_at ? { created_at: preMarker.created_at } : undefined,
  });

  const { data: postMarker, error: postMarkerError } = await sb
    .from("fi_crm_leads")
    .select("id")
    .eq("tenant_id", tenantId)
    .ilike("summary", `${postMarkerId}%`)
    .limit(1)
    .maybeSingle();
  checks.push({
    name: "post_recovery_marker_absent",
    pass: !postMarkerError && !postMarker?.id,
    detail: postMarkerError?.message ?? (postMarker?.id ? "unexpectedly present" : "absent"),
  });

  const globalCountTables = ["fi_tenants", "fi_intelligence_event_logs"];
  const tenantCountTables = [
    "fi_users",
    "fi_staff",
    "fi_staff_access_grants",
    "fi_persons",
    "fi_patients",
    "fi_crm_leads",
    "fi_bookings",
    "fi_consultations",
    "fi_cases",
    "fi_payment_records",
    "fi_patient_images",
    "fi_pathology_requests",
    "fi_pathology_results",
    "fi_audits",
    "fi_integration_webhook_events",
  ];

  const counts: CountResult[] = [];
  for (const table of globalCountTables) counts.push(await safeCount(sb, table));
  for (const table of tenantCountTables) counts.push(await safeCount(sb, table, tenantId));
  checks.push({
    name: "critical_table_counts",
    pass: counts.every((c) => c.pass),
    detail: `${counts.filter((c) => c.pass).length}/${counts.length} counted`,
  });

  const representativeChecks: Check[] = [];
  const representativeMap: Array<[string, string, string]> = [
    ["FI_DRILL_EXPECTED_FI_USER_ID", "fi_users", "tenant"],
    ["FI_DRILL_EXPECTED_STAFF_ID", "fi_staff", "tenant"],
    ["FI_DRILL_EXPECTED_LEAD_ID", "fi_crm_leads", "tenant"],
    ["FI_DRILL_EXPECTED_PATIENT_ID", "fi_patients", "tenant"],
    ["FI_DRILL_EXPECTED_CASE_ID", "fi_cases", "tenant"],
    ["FI_DRILL_EXPECTED_BOOKING_ID", "fi_bookings", "tenant"],
    ["FI_DRILL_EXPECTED_CONSULTATION_ID", "fi_consultations", "tenant"],
    ["FI_DRILL_EXPECTED_PAYMENT_RECORD_ID", "fi_payment_records", "tenant"],
    ["FI_DRILL_EXPECTED_IMAGING_ROW_ID", "fi_patient_images", "tenant"],
    ["FI_DRILL_EXPECTED_PATHOLOGY_REQUEST_ID", "fi_pathology_requests", "tenant"],
    ["FI_DRILL_EXPECTED_PATHOLOGY_RESULT_ID", "fi_pathology_results", "tenant"],
  ];
  for (const [envName, table, scope] of representativeMap) {
    const id = optionalEnv(envName);
    if (id) representativeChecks.push(await rowExists(sb, table, id, scope === "tenant" ? tenantId : undefined));
  }
  checks.push({
    name: "representative_ids",
    pass: representativeChecks.every((c) => c.pass),
    detail: representativeChecks.length
      ? `${representativeChecks.filter((c) => c.pass).length}/${representativeChecks.length} found`
      : "no representative IDs supplied",
    data: representativeChecks,
  });

  const { data: staffUsers, error: staffUsersError } = await sb
    .from("fi_users")
    .select("id, auth_user_id")
    .eq("tenant_id", tenantId)
    .not("auth_user_id", "is", null)
    .limit(50);
  const fiUserIds = (staffUsers ?? []).map((r) => String((r as { id: string }).id));
  const { data: staffRows, error: staffRowsError } = fiUserIds.length
    ? await sb.from("fi_staff").select("id, fi_user_id").eq("tenant_id", tenantId).in("fi_user_id", fiUserIds)
    : { data: [], error: null };
  const mappedUserIds = new Set((staffRows ?? []).map((r) => String((r as { fi_user_id: string }).fi_user_id)));
  const unmapped = fiUserIds.filter((id) => !mappedUserIds.has(id));
  checks.push({
    name: "staff_mappings",
    pass: !staffUsersError && !staffRowsError && unmapped.length === 0,
    detail:
      staffUsersError?.message ??
      staffRowsError?.message ??
      `${mappedUserIds.size}/${fiUserIds.length} linked fi_users mapped to fi_staff`,
    data: { checkedLinkedFiUsers: fiUserIds.length, unmapped: unmapped.map(redactId) },
  });

  const staffIds = (staffRows ?? []).map((r) => String((r as { id: string }).id));
  const { data: grants, error: grantsError } = staffIds.length
    ? await sb
        .from("fi_staff_access_grants")
        .select("id, staff_member_id")
        .eq("tenant_id", tenantId)
        .in("staff_member_id", staffIds)
        .is("revoked_at", null)
    : { data: [], error: null };
  checks.push({
    name: "staff_access_grants",
    pass: !grantsError && staffIds.length > 0 && (grants?.length ?? 0) > 0,
    detail: grantsError?.message ?? `${grants?.length ?? 0} active grants for ${staffIds.length} staff rows`,
  });

  const expectedAuthUserId = optionalEnv("FI_DRILL_EXPECTED_AUTH_USER_ID");
  if (expectedAuthUserId) {
    const { data, error } = await sb.auth.admin.getUserById(expectedAuthUserId);
    checks.push({
      name: "representative_auth_user",
      pass: !error && Boolean(data.user?.id),
      detail: error?.message ?? (data.user?.id ? `found ${redactId(expectedAuthUserId)}` : "missing"),
    });
  }

  const { data: migrations, error: migrationsError } = await sb
    .schema("supabase_migrations")
    .from("schema_migrations")
    .select("version, name")
    .order("version", { ascending: false })
    .limit(10);
  const migrationHistoryVerifiedOutOfBand = process.env.FI_DRILL_MIGRATION_HISTORY_OUT_OF_BAND === "YES";
  checks.push({
    name: "migration_history",
    pass: (!migrationsError && Boolean(migrations?.length)) || migrationHistoryVerifiedOutOfBand,
    detail: migrationsError
      ? migrationHistoryVerifiedOutOfBand
        ? "REST schema unavailable; verified out-of-band by read-only SQL"
        : migrationsError.message
      : `latest ${migrations?.[0]?.version ?? "unknown"}`,
    data: migrations,
  });

  let buckets: unknown[] = [];
  const { data: bucketRows, error: bucketError } = await sb.storage.listBuckets();
  if (!bucketError) buckets = bucketRows.map((b) => ({ id: b.id, name: b.name, public: b.public }));
  checks.push({
    name: "storage_bucket_metadata_inventory",
    pass: !bucketError,
    detail: bucketError?.message ?? `${buckets.length} buckets listed`,
    data: buckets,
  });

  const evidence = {
    drill: "FI-SECURITY-RESTORE-DRILL-1",
    mode: "read-only",
    generatedAtUtc: new Date().toISOString(),
    projectRef,
    tenantId,
    recoveryPointUtc: optionalEnv("FI_DRILL_RECOVERY_POINT_UTC"),
    restoreRequestedAtUtc: optionalEnv("FI_DRILL_RESTORE_REQUESTED_AT_UTC"),
    databaseAvailableAtUtc: optionalEnv("FI_DRILL_DATABASE_AVAILABLE_AT_UTC"),
    checks,
    counts,
    verdict: checks.every((c) => c.pass) ? "PASS" : "FAIL",
  };

  const outDir = resolve(process.cwd(), "docs/security/restore-drill-evidence");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = resolve(outDir, `restored-database-${projectRef}-${stamp}.json`);
  writeFileSync(outPath, JSON.stringify(evidence, null, 2) + "\n", "utf8");

  console.log(JSON.stringify({ verdict: evidence.verdict, projectRef, evidencePath: outPath }, null, 2));
  if (evidence.verdict !== "PASS") process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
