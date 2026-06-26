import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildCaseWorklistRows } from "@/src/lib/cases/casesIndexBuild";
import { loadCasesIndexExtensionBundle } from "@/src/lib/cases/casesIndexLoaders";
import { loadCasesIndexForTenant } from "@/src/lib/cases/caseLoaders";
import { deriveSurgeryOsDashboardModel } from "@/src/lib/cases/surgeryOsDashboardDerive";
import { loadTenantOperationalDashboard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";
import { loadFoundationOsDashboard } from "@/src/lib/fi/foundation/foundationOsDashboardRead.server";
import { loadAuditDashboardSnapshot } from "@/src/lib/fiAdmin/auditDashboardRead.server";
import {
  buildPatientOsOverviewFallback,
  loadPatientOsOverview,
} from "@/src/lib/patients/patientOsDashboardLoader.server";
import { loadPatientDirectorySummary } from "@/src/lib/patients/patientDirectoryLoader";
import type {
  AnalyticsOsAuditPublic,
  AnalyticsOsDashboardPayload,
  AnalyticsOsFoundationPublic,
  AnalyticsOsModuleHealthCard,
  AnalyticsOsModuleHealthStatus,
  AnalyticsOsModuleSnapshot,
  AnalyticsOsOperationalPublic,
  AnalyticsOsPatientPublic,
  AnalyticsOsRiskRow,
  AnalyticsOsSurgeryPublic,
} from "@/src/lib/fiAdmin/analyticsOsDashboardTypes";
import type { AuditDashboardSnapshot } from "@/src/lib/fiAdmin/auditDashboardTypes";
import type { FoundationOsDashboardPayload } from "@/src/lib/fi/foundation/foundationOsDashboardTypes";
import type { PatientOsOverviewModel } from "@/src/lib/patients/patientOsDashboardLoader.server";
import type { TenantOperationalDashboard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";
import type { SurgeryOsDashboardModel } from "@/src/lib/cases/surgeryOsDashboardDerive";

/**
 * User-facing AnalyticsOS load note. In production, never forward raw Error messages
 * (may contain SQL, paths, or internal details). Developers still see full text locally.
 */
function publicAnalyticsLoadNote(key: string, err: unknown): string {
  if (process.env.NODE_ENV === "production") {
    return `${key}: data could not be loaded.`;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return `${key}: ${msg || "unknown error"}`;
}

async function wrapLoad<T>(key: string, fn: () => Promise<T>): Promise<AnalyticsOsModuleSnapshot<T>> {
  try {
    const data = await fn();
    return { state: "ok", data };
  } catch (e) {
    return { state: "limited", error: publicAnalyticsLoadNote(key, e) };
  }
}

function healthFrom(
  limited: boolean,
  attention: boolean
): AnalyticsOsModuleHealthStatus {
  if (limited) return "limited_data";
  if (attention) return "attention";
  return "healthy";
}

function toOperationalPublic(d: TenantOperationalDashboard): AnalyticsOsOperationalPublic {
  return {
    tenantName: d.tenantName,
    agendaByBucketCounts: {
      consult: d.agendaByBucket.consult.length,
      surgery: d.agendaByBucket.surgery.length,
      follow_up: d.agendaByBucket.follow_up.length,
      other: d.agendaByBucket.other.length,
    },
    upcomingRemindersCount: d.upcomingReminders.length,
    tasksDueCount: d.tasksDue.length,
    staleLeadsCount: d.staleLeads.length,
    staleLeadThresholdDays: d.staleLeadThresholdDays,
    quickStats: { ...d.quickStats },
    launchControl: { ...d.launchControl },
  };
}

function toPatientPublic(d: PatientOsOverviewModel): AnalyticsOsPatientPublic {
  return { kpis: { ...d.kpis } };
}

function toSurgeryPublic(d: SurgeryOsDashboardModel): AnalyticsOsSurgeryPublic {
  return {
    todayYmd: d.todayYmd,
    metrics: { ...d.metrics },
    todaySurgeriesCount: d.todaySurgeries.length,
    recentCompletedCount: d.recentCompleted.length,
  };
}

function toAuditPublic(d: AuditDashboardSnapshot): AnalyticsOsAuditPublic {
  return { kpis: { ...d.kpis } };
}

function toFoundationPublic(d: FoundationOsDashboardPayload): AnalyticsOsFoundationPublic {
  return {
    twin_health: { ...d.twin_health },
    twin_coverage: { ...d.twin_coverage },
    scan_notes: [...d.scan_notes],
  };
}

function mapOpSnapshot(
  snap: AnalyticsOsModuleSnapshot<TenantOperationalDashboard>
): AnalyticsOsModuleSnapshot<AnalyticsOsOperationalPublic> {
  if (snap.state === "limited") return snap;
  return { state: "ok", data: toOperationalPublic(snap.data) };
}

function mapPatientSnapshot(
  snap: AnalyticsOsModuleSnapshot<PatientOsOverviewModel>
): AnalyticsOsModuleSnapshot<AnalyticsOsPatientPublic> {
  if (snap.state === "limited") return snap;
  return { state: "ok", data: toPatientPublic(snap.data) };
}

function mapSurgerySnapshot(
  snap: AnalyticsOsModuleSnapshot<SurgeryOsDashboardModel>
): AnalyticsOsModuleSnapshot<AnalyticsOsSurgeryPublic> {
  if (snap.state === "limited") return snap;
  return { state: "ok", data: toSurgeryPublic(snap.data) };
}

function mapAuditSnapshot(
  snap: AnalyticsOsModuleSnapshot<AuditDashboardSnapshot>
): AnalyticsOsModuleSnapshot<AnalyticsOsAuditPublic> {
  if (snap.state === "limited") return snap;
  return { state: "ok", data: toAuditPublic(snap.data) };
}

function mapFoundationSnapshot(
  snap: AnalyticsOsModuleSnapshot<FoundationOsDashboardPayload>
): AnalyticsOsModuleSnapshot<AnalyticsOsFoundationPublic> {
  if (snap.state === "limited") return snap;
  return { state: "ok", data: toFoundationPublic(snap.data) };
}

function buildRiskRows(
  base: string,
  showCrmNav: boolean,
  op: AnalyticsOsModuleSnapshot<TenantOperationalDashboard>,
  sur: AnalyticsOsModuleSnapshot<SurgeryOsDashboardModel>,
  aud: AnalyticsOsModuleSnapshot<AuditDashboardSnapshot>,
  found: AnalyticsOsModuleSnapshot<FoundationOsDashboardPayload>
): AnalyticsOsRiskRow[] {
  const rows: Omit<AnalyticsOsRiskRow, "rank">[] = [];

  if (op.state === "ok") {
    const stale = op.data.staleLeads.length;
    if (stale > 0) {
      rows.push({
        label: "Stale leads (pipeline hygiene)",
        count: stale,
        href: `${base}/crm`,
        linkDisabled: !showCrmNav,
      });
    }
    const tasks = op.data.tasksDue.length;
    if (tasks > 0) {
      rows.push({
        label: "CRM tasks due (horizon)",
        count: tasks,
        href: `${base}/crm`,
        linkDisabled: !showCrmNav,
      });
    }
  }

  if (sur.state === "ok") {
    const r = sur.data.metrics.readinessReviewCases;
    if (r > 0) {
      rows.push({ label: "Surgery readiness alerts (cases)", count: r, href: `${base}/cases` });
    }
  }

  if (aud.state === "ok") {
    const p = aud.data.kpis.pending_reviews;
    if (p > 0) {
      rows.push({ label: "Pending HairAudit reviews", count: p, href: `${base}/audit` });
    }
  }

  if (found.state === "ok") {
    const gaps = found.data.twin_health.cases_missing_foundation_patient;
    if (gaps > 0) {
      rows.push({
        label: "Cases missing foundation patient link",
        count: gaps,
        href: `${base}/foundation-integrity`,
      });
    }
  }

  rows.sort((a, b) => b.count - a.count);
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

function buildModuleHealth(
  base: string,
  showCrmNav: boolean,
  op: AnalyticsOsModuleSnapshot<TenantOperationalDashboard>,
  pat: AnalyticsOsModuleSnapshot<PatientOsOverviewModel>,
  sur: AnalyticsOsModuleSnapshot<SurgeryOsDashboardModel>,
  aud: AnalyticsOsModuleSnapshot<AuditDashboardSnapshot>,
  found: AnalyticsOsModuleSnapshot<FoundationOsDashboardPayload>
): AnalyticsOsModuleHealthCard[] {
  const opOk = op.state === "ok" ? op.data : null;
  const patOk = pat.state === "ok" ? pat.data : null;
  const surOk = sur.state === "ok" ? sur.data : null;
  const audOk = aud.state === "ok" ? aud.data : null;
  const foundOk = found.state === "ok" ? found.data : null;

  const agenda =
    opOk == null
      ? 0
      : opOk.agendaByBucket.consult.length +
        opOk.agendaByBucket.surgery.length +
        opOk.agendaByBucket.follow_up.length +
        opOk.agendaByBucket.other.length;

  const clinic: AnalyticsOsModuleHealthCard = {
    moduleId: "clinicos",
    label: "ClinicOS",
    href: base,
    status: healthFrom(
      op.state === "limited",
      Boolean(
        opOk &&
          (opOk.staleLeads.length > 0 ||
            opOk.tasksDue.length > 0 ||
            opOk.quickStats.todaysNoShows > 0)
      )
    ),
    primaryMetric: opOk ? `${agenda} agenda (72h)` : "—",
    detail: op.state === "limited" ? "Operational snapshot unavailable." : undefined,
  };

  const lead: AnalyticsOsModuleHealthCard = {
    moduleId: "leadflow",
    label: "LeadFlow",
    href: `${base}/crm`,
    linkDisabled: !showCrmNav,
    status: healthFrom(
      op.state === "limited",
      Boolean(opOk && (opOk.staleLeads.length > 0 || opOk.tasksDue.length > 0))
    ),
    primaryMetric:
      opOk != null
        ? `${opOk.quickStats.newLeadsThisWeek} new leads · week`
        : "—",
    detail:
      op.state === "limited"
        ? "Operational snapshot unavailable."
        : !showCrmNav
          ? "CRM navigation not enabled for this user."
          : undefined,
  };

  const patient: AnalyticsOsModuleHealthCard = {
    moduleId: "patientos",
    label: "PatientOS",
    href: showCrmNav ? `${base}/patients` : `${base}/directory`,
    status: healthFrom(
      pat.state === "limited",
      Boolean(patOk && patOk.kpis.patientsNeedingFollowUp > 0)
    ),
    primaryMetric: patOk ? `${patOk.kpis.totalPatients} patients` : "—",
    detail: pat.state === "limited" ? "Patient aggregates partially unavailable." : undefined,
  };

  const surgery: AnalyticsOsModuleHealthCard = {
    moduleId: "surgeryos",
    label: "SurgeryOS",
    href: `${base}/cases`,
    status: healthFrom(
      sur.state === "limited",
      Boolean(surOk && (surOk.metrics.readinessReviewCases > 0 || surOk.metrics.followUpsDueCases > 0))
    ),
    primaryMetric: surOk ? `${surOk.metrics.totalActiveCases} active cases` : "—",
    detail: sur.state === "limited" ? "Surgery worklist could not be derived." : undefined,
  };

  const audit: AnalyticsOsModuleHealthCard = {
    moduleId: "auditos",
    label: "AuditOS",
    href: `${base}/audit`,
    status: healthFrom(
      aud.state === "limited",
      Boolean(audOk && audOk.kpis.pending_reviews > 0)
    ),
    primaryMetric: audOk ? `${audOk.kpis.pending_reviews} pending reviews` : "—",
    detail: aud.state === "limited" ? "Audit snapshot unavailable." : undefined,
  };

  const foundation: AnalyticsOsModuleHealthCard = {
    moduleId: "foundationos",
    label: "FoundationOS",
    href: `${base}/foundation-integrity`,
    status: healthFrom(
      found.state === "limited",
      Boolean(foundOk && foundOk.twin_health.cases_missing_foundation_patient > 0)
    ),
    primaryMetric: foundOk
      ? `Twin readiness hint ${foundOk.twin_coverage.twin_readiness_score_hint}%`
      : "—",
    detail: found.state === "limited" ? "Foundation health snapshot unavailable." : undefined,
  };

  return [clinic, lead, patient, surgery, audit, foundation];
}

async function loadSurgerySnapshot(tenantId: string): Promise<SurgeryOsDashboardModel> {
  const baseRows = await loadCasesIndexForTenant(tenantId);
  const ext = await loadCasesIndexExtensionBundle(
    tenantId,
    baseRows.map((r) => r.id)
  );
  const enriched = buildCaseWorklistRows(tenantId, baseRows, ext);
  return deriveSurgeryOsDashboardModel(enriched);
}

async function loadPatientWithFallback(tenantId: string): Promise<AnalyticsOsModuleSnapshot<PatientOsOverviewModel>> {
  const direct = await wrapLoad("patientos", () => loadPatientOsOverview(tenantId));
  if (direct.state === "ok") return direct;
  try {
    const summary = await loadPatientDirectorySummary(tenantId);
    return { state: "ok", data: buildPatientOsOverviewFallback(summary) };
  } catch (e) {
    const prior = direct.state === "limited" ? direct.error : undefined;
    return {
      state: "limited",
      error: [prior, publicAnalyticsLoadNote("patientos_fallback", e)].filter(Boolean).join(" · "),
    };
  }
}

export type LoadAnalyticsOsDashboardContext = {
  showCrmNav: boolean;
  showBookingsBoard: boolean;
};

/**
 * Tenant-scoped read-only composition of ClinicOS, LeadFlow, PatientOS, SurgeryOS, AuditOS, and FoundationOS signals.
 * Each submodule is isolated — one failure does not block others.
 */
export async function loadAnalyticsOsDashboard(
  tenantId: string,
  ctx: LoadAnalyticsOsDashboardContext
): Promise<AnalyticsOsDashboardPayload> {
  const tid = tenantId.trim();
  const base = `/fi-admin/${tid}`;
  // SA-2 field-level redaction (follow-up): gate analytics.revenue / analytics.marketing_roi /
  // analytics.clinical_outcomes and prefer investor-safe values (analytics.investor_summary,
  // investor.deidentified_outcomes) for viewers without full read, via `getStaffFieldPermission`
  // / `redactObjectForStaffAccess` from `@/src/lib/staffAccess/staffFieldAccess.server`. An
  // investor sees the de-identified summary, never identifiable revenue detail. Apply at the
  // dashboard render boundary. Field access is clamped to AnalyticsOS module access by the engine.

  const [operational, patient, surgery, audit, foundation] = await Promise.all([
    wrapLoad("clinicos", () => loadTenantOperationalDashboard(tid)),
    loadPatientWithFallback(tid),
    wrapLoad("surgeryos", () => loadSurgerySnapshot(tid)),
    wrapLoad("auditos", () => loadAuditDashboardSnapshot(supabaseAdmin(), tid)),
    wrapLoad("foundationos", () => loadFoundationOsDashboard(tid)),
  ]);

  const loadNotes: string[] = [];
  for (const snap of [operational, patient, surgery, audit, foundation]) {
    if (snap.state === "limited" && snap.error) loadNotes.push(snap.error);
  }

  const tenantName = operational.state === "ok" ? operational.data.tenantName : null;

  return {
    tenantId: tid,
    tenantName,
    showCrmNav: ctx.showCrmNav,
    showBookingsBoard: ctx.showBookingsBoard,
    operational: mapOpSnapshot(operational),
    patient: mapPatientSnapshot(patient),
    surgery: mapSurgerySnapshot(surgery),
    audit: mapAuditSnapshot(audit),
    foundation: mapFoundationSnapshot(foundation),
    loadNotes,
    moduleHealth: buildModuleHealth(base, ctx.showCrmNav, operational, patient, surgery, audit, foundation),
    riskRows: buildRiskRows(base, ctx.showCrmNav, operational, surgery, audit, foundation),
  };
}
