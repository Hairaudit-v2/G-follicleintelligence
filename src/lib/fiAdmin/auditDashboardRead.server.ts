import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AuditActivityRow,
  AuditDashboardSnapshot,
  AuditQueueItem,
} from "@/src/lib/fiAdmin/auditDashboardTypes";

export type {
  AuditActivityRow,
  AuditDashboardKpis,
  AuditDashboardSnapshot,
  AuditPipelineModelRuns,
  AuditPipelineSnapshot,
  AuditQueueItem,
} from "@/src/lib/fiAdmin/auditDashboardTypes";

async function countExact(
  supabase: SupabaseClient,
  table: string,
  match: { column: string; value: string },
  extra?: { column: string; value: string }
): Promise<number> {
  let q = supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(match.column, match.value);
  if (extra) q = q.eq(extra.column, extra.value);
  const { count, error } = await q;
  if (error) return 0;
  return typeof count === "number" ? count : 0;
}

/**
 * Audit queue rows (draft + changes_required) with intake patient labels.
 * Shared by GET /api/fi/audit/queue and the dashboard snapshot.
 */
export async function fetchAuditQueueForTenant(
  supabase: SupabaseClient,
  tenantId: string
): Promise<AuditQueueItem[]> {
  const tid = tenantId.trim();
  const { data: reports } = await supabase
    .from("fi_reports")
    .select("id, case_id, version, status, created_at")
    .eq("tenant_id", tid)
    .in("status", ["draft", "changes_required"])
    .order("created_at", { ascending: false });

  if (!reports?.length) return [];

  const caseIds = reports.reduce<string[]>((acc, report) => {
    const cid = String((report as { case_id: string }).case_id);
    if (!acc.includes(cid)) acc.push(cid);
    return acc;
  }, []);

  const { data: intakes } = await supabase
    .from("fi_intakes")
    .select("case_id, full_name, email")
    .in("case_id", caseIds);

  const intakeByCase = new Map(
    (intakes ?? []).map((i) => {
      const row = i as { case_id: string; full_name: string | null; email: string | null };
      return [row.case_id, { full_name: row.full_name ?? "", email: row.email ?? "" }];
    })
  );

  return reports.map((r) => {
    const row = r as {
      id: string;
      case_id: string;
      version: number;
      status: string;
      created_at: string;
    };
    const patient = intakeByCase.get(row.case_id) ?? null;
    return {
      report_id: row.id,
      case_id: row.case_id,
      version: row.version,
      report_status: row.status,
      created_at: row.created_at,
      patient: patient ? { full_name: patient.full_name, email: patient.email } : null,
    };
  });
}

/**
 * Read-only aggregate for AuditOS dashboard (fi_reports, fi_audits, fi_model_runs, fi_scorecards).
 */
export async function loadAuditDashboardSnapshot(
  supabase: SupabaseClient,
  tenantId: string
): Promise<AuditDashboardSnapshot> {
  const tid = tenantId.trim();

  const [
    queue,
    draft_reports,
    changes_required_reports,
    released_reports,
    oldestRow,
    recentRows,
    mrQueued,
    mrRunning,
    mrFailed,
    mrComplete,
    scorecards_total,
  ] = await Promise.all([
    fetchAuditQueueForTenant(supabase, tid),
    countExact(
      supabase,
      "fi_reports",
      { column: "tenant_id", value: tid },
      { column: "status", value: "draft" }
    ),
    countExact(
      supabase,
      "fi_reports",
      { column: "tenant_id", value: tid },
      { column: "status", value: "changes_required" }
    ),
    countExact(
      supabase,
      "fi_reports",
      { column: "tenant_id", value: tid },
      { column: "status", value: "released" }
    ),
    supabase
      .from("fi_reports")
      .select("created_at")
      .eq("tenant_id", tid)
      .in("status", ["draft", "changes_required"])
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("fi_audits")
      .select("id, report_id, case_id, status, note, created_at")
      .eq("tenant_id", tid)
      .order("created_at", { ascending: false })
      .limit(20),
    countExact(
      supabase,
      "fi_model_runs",
      { column: "tenant_id", value: tid },
      { column: "status", value: "queued" }
    ),
    countExact(
      supabase,
      "fi_model_runs",
      { column: "tenant_id", value: tid },
      { column: "status", value: "running" }
    ),
    countExact(
      supabase,
      "fi_model_runs",
      { column: "tenant_id", value: tid },
      { column: "status", value: "failed" }
    ),
    countExact(
      supabase,
      "fi_model_runs",
      { column: "tenant_id", value: tid },
      { column: "status", value: "complete" }
    ),
    countExact(supabase, "fi_scorecards", { column: "tenant_id", value: tid }),
  ]);

  const pending_reviews = draft_reports + changes_required_reports;
  const oldest = oldestRow.data as { created_at: string } | null;

  const recent_audit_activity: AuditActivityRow[] = (recentRows.data ?? []).map((row) => {
    const r = row as {
      id: string;
      report_id: string;
      case_id: string;
      status: string;
      note: string | null;
      created_at: string;
    };
    return {
      id: r.id,
      report_id: r.report_id,
      case_id: r.case_id,
      status: r.status,
      note: r.note,
      created_at: r.created_at,
    };
  });

  return {
    kpis: {
      draft_reports,
      changes_required_reports,
      released_reports,
      pending_reviews,
      oldest_queue_created_at: oldest?.created_at ?? null,
    },
    queue,
    recent_audit_activity,
    pipeline: {
      model_runs: {
        queued: mrQueued,
        running: mrRunning,
        failed: mrFailed,
        complete: mrComplete,
      },
      scorecards_total,
    },
  };
}
