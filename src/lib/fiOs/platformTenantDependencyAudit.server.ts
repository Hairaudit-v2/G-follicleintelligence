import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type FiTenantDependencyCounts = {
  clinics: number;
  staff: number;
  doctors: number;
  patients: number;
  consultations: number;
  cases: number;
  protocolSessions: number;
  patientImages: number;
  paymentRecords: number;
  calendarEvents: number;
  provisioningSessions: number;
  auditEvents: number;
  fiUsers: number;
  tenantAdminUsers: number;
};

export type FiTenantDependencyAuditResult = {
  tenantId: string;
  counts: FiTenantDependencyCounts;
  totalLinkedRecords: number;
};

type CountSpec = {
  key: keyof FiTenantDependencyCounts;
  table: string;
  filter?: { column: string; op: "ilike"; value: string };
};

const COUNT_SPECS: CountSpec[] = [
  { key: "clinics", table: "fi_clinics" },
  { key: "staff", table: "fi_staff" },
  {
    key: "doctors",
    table: "fi_staff",
    filter: { column: "staff_role", op: "ilike", value: "%doctor%" },
  },
  { key: "patients", table: "fi_patients" },
  { key: "consultations", table: "fi_consultations" },
  { key: "cases", table: "fi_cases" },
  { key: "protocolSessions", table: "hli_photo_protocol_sessions" },
  { key: "patientImages", table: "fi_patient_images" },
  { key: "paymentRecords", table: "fi_payment_records" },
  { key: "calendarEvents", table: "fi_calendar_events" },
  { key: "provisioningSessions", table: "fi_tenant_provisioning_sessions" },
  { key: "auditEvents", table: "fi_tenant_admin_audit_events" },
  { key: "fiUsers", table: "fi_users" },
  { key: "tenantAdminUsers", table: "fi_tenant_admin_users" },
];

async function countTenantRows(
  supabase: SupabaseClient,
  tenantId: string,
  spec: CountSpec
): Promise<number> {
  let q = supabase
    .from(spec.table)
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  if (spec.filter) {
    q = q.ilike(spec.filter.column, spec.filter.value);
  }
  const { count, error } = await q;
  if (error) {
    // Missing table in older environments — treat as zero for archive safety UI.
    if (/relation .* does not exist/i.test(error.message)) return 0;
    throw new Error(`${spec.table}: ${error.message}`);
  }
  return count ?? 0;
}

export type AuditTenantDependenciesOptions = {
  /** Unit tests only — inject mock client. */
  supabaseClientForTests?: SupabaseClient;
};

/** Returns linked-record counts used by the platform-admin archive safety check. */
export async function auditTenantDependencies(
  tenantId: string,
  opts?: AuditTenantDependenciesOptions
): Promise<FiTenantDependencyAuditResult> {
  const tid = tenantId.trim();
  if (!tid) throw new Error("tenantId is required.");

  const supabase = opts?.supabaseClientForTests ?? supabaseAdmin();
  const counts = {} as FiTenantDependencyCounts;

  for (const spec of COUNT_SPECS) {
    counts[spec.key] = await countTenantRows(supabase, tid, spec);
  }

  // Platform lifecycle audit events (separate table).
  const { count: platformAuditCount, error: platformAuditErr } = await supabase
    .from("fi_platform_tenant_audit_events")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tid);
  if (platformAuditErr && !/relation .* does not exist/i.test(platformAuditErr.message)) {
    throw new Error(`fi_platform_tenant_audit_events: ${platformAuditErr.message}`);
  }
  counts.auditEvents += platformAuditCount ?? 0;

  const totalLinkedRecords = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return { tenantId: tid, counts, totalLinkedRecords };
}
