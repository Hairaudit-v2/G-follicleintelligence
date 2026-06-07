import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Calendar,
  ClipboardList,
  HeartPulse,
  Layers,
  LineChart,
  Stethoscope,
  UserPlus,
  Users,
} from "lucide-react";

import { DashboardCard, SectionHeader, StatCard } from "@/src/components/fi-admin/dashboard-ui";
import type { AnalyticsOsDashboardPayload, AnalyticsOsModuleHealthStatus } from "@/src/lib/fiAdmin/analyticsOsDashboardTypes";

const LINK_BTN =
  "inline-flex items-center justify-center rounded-lg border border-white/[0.1] bg-[#141C33]/60 px-3 py-2 text-sm font-medium text-[#E2E8F0] transition hover:border-[#22C1FF]/35 hover:text-[#22C1FF] disabled:pointer-events-none disabled:opacity-40";

const ICON = 20;

function formatPctRatio(ratio: number | null | undefined): string {
  if (ratio == null) return "—";
  return `${Math.round(ratio * 100)}%`;
}

function formatPctInt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${Math.round(n)}%`;
}

function statusBadgeClass(s: AnalyticsOsModuleHealthStatus): string {
  if (s === "healthy") return "text-emerald-300 ring-emerald-500/30";
  if (s === "attention") return "text-amber-200 ring-amber-400/35";
  return "text-slate-400 ring-white/10";
}

function statusLabel(s: AnalyticsOsModuleHealthStatus): string {
  if (s === "healthy") return "Healthy";
  if (s === "attention") return "Attention";
  return "Limited data";
}

export function AnalyticsOsDashboard({ model }: { model: AnalyticsOsDashboardPayload }) {
  const { tenantId, tenantName, showCrmNav, showBookingsBoard, operational, patient, surgery, audit, foundation, loadNotes, moduleHealth, riskRows } =
    model;
  const base = `/fi-admin/${tenantId}`;

  const op = operational.state === "ok" ? operational.data : null;
  const pat = patient.state === "ok" ? patient.data : null;
  const sur = surgery.state === "ok" ? surgery.data : null;
  const aud = audit.state === "ok" ? audit.data : null;
  const found = foundation.state === "ok" ? foundation.data : null;

  const agendaCount =
    op == null
      ? null
      : op.agendaByBucketCounts.consult +
        op.agendaByBucketCounts.surgery +
        op.agendaByBucketCounts.follow_up +
        op.agendaByBucketCounts.other;

  const conversionPct = op ? formatPctRatio(op.quickStats.conversionRateLast30d) : "—";

  return (
    <div className="mx-auto min-w-0 max-w-[88rem] space-y-8 pb-10 sm:space-y-10 sm:pb-14">
      <DashboardCard elevated className="relative overflow-hidden p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(560px_260px_at_0%_0%,rgba(34,193,255,0.11),transparent_55%),radial-gradient(420px_200px_at_100%_100%,rgba(124,58,237,0.07),transparent_50%)]"
          aria-hidden
        />
        <div className="relative border-l-4 border-[#22C1FF]/80 pl-5 sm:pl-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#22C1FF]/95">FI OS</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#F8FAFC] sm:text-4xl">AnalyticsOS</h1>
          <p className="mt-2 max-w-3xl text-base leading-relaxed text-[#94A3B8]">
            Executive intelligence across leads, patients, surgery, audit, foundation health, and clinic operations.
          </p>
          {tenantName ? (
            <p className="mt-2 text-sm text-[#64748B]">
              Tenant: <span className="font-medium text-[#CBD5E1]">{tenantName}</span>
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href={base} className={LINK_BTN}>
              Open ClinicOS
            </Link>
            {showCrmNav ? (
              <Link href={`${base}/crm`} className={LINK_BTN}>
                Open LeadFlow
              </Link>
            ) : (
              <span className={LINK_BTN} title="Requires CRM shell access">
                Open LeadFlow
              </span>
            )}
            <Link href={showCrmNav ? `${base}/patients` : `${base}/directory`} className={LINK_BTN}>
              Open PatientOS
            </Link>
            <Link href={`${base}/cases`} className={LINK_BTN}>
              Open SurgeryOS
            </Link>
            <Link href={`${base}/audit`} className={LINK_BTN}>
              Open AuditOS
            </Link>
            <Link href={`${base}/foundation-integrity`} className={LINK_BTN}>
              Open FoundationOS
            </Link>
            {showBookingsBoard ? (
              <Link href={`${base}/bookings`} className={LINK_BTN}>
                Open Bookings
              </Link>
            ) : null}
          </div>
        </div>
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6">
        <SectionHeader
          kicker="Overview"
          title="Executive KPI strip"
          description="Aggregates only — same definitions as module dashboards. Missing tiles mean that module snapshot did not load."
          className="mb-4"
        />
        <div className="-mx-1 overflow-x-auto overflow-y-visible px-1 pb-1 sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0">
        <div className="grid min-w-0 grid-cols-2 gap-3 sm:min-w-0 md:grid-cols-3 xl:grid-cols-5">
          <StatCard
            label="New leads (week)"
            value={op?.quickStats.newLeadsThisWeek ?? "—"}
            icon={<UserPlus size={ICON} strokeWidth={1.75} />}
          />
          <StatCard label="Conversion (30d)" value={conversionPct} icon={<LineChart size={ICON} strokeWidth={1.75} />} />
          <StatCard
            label="Total patients"
            value={pat?.kpis.totalPatients ?? "—"}
            icon={<Users size={ICON} strokeWidth={1.75} />}
          />
          <StatCard
            label="Active patient journeys"
            value={pat?.kpis.patientsWithActiveCases ?? "—"}
            icon={<Activity size={ICON} strokeWidth={1.75} />}
          />
          <StatCard
            label="Active cases"
            value={sur?.metrics.totalActiveCases ?? "—"}
            icon={<Layers size={ICON} strokeWidth={1.75} />}
          />
          <StatCard
            label="Today’s surgeries"
            value={sur?.todaySurgeriesCount ?? "—"}
            icon={<Calendar size={ICON} strokeWidth={1.75} />}
          />
          <StatCard
            label="Upcoming surgeries (30d)"
            value={sur?.metrics.upcomingSurgeries ?? "—"}
            icon={<Stethoscope size={ICON} strokeWidth={1.75} />}
          />
          <StatCard
            label="Readiness alerts"
            value={sur?.metrics.readinessReviewCases ?? "—"}
            icon={<AlertTriangle size={ICON} strokeWidth={1.75} />}
          />
          <StatCard
            label="Pending audit reviews"
            value={aud?.kpis.pending_reviews ?? "—"}
            icon={<ClipboardList size={ICON} strokeWidth={1.75} />}
          />
          <StatCard
            label="Twin readiness hint"
            value={found ? `${found.twin_coverage.twin_readiness_score_hint}%` : "—"}
            icon={<HeartPulse size={ICON} strokeWidth={1.75} />}
          />
        </div>
        </div>
      </DashboardCard>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <DashboardCard className="p-5 sm:p-6">
          <SectionHeader
            kicker="ClinicOS"
            title="Operational snapshot"
            description="From the tenant operational dashboard — same agenda window as home (72h)."
            className="mb-4"
          />
          {op ? (
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-lg border border-white/[0.06] bg-[#0c1220]/80 px-3 py-2">
                <dt className="text-[#64748B]">Today&apos;s agenda items</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-[#F8FAFC]">{agendaCount ?? 0}</dd>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-[#0c1220]/80 px-3 py-2">
                <dt className="text-[#64748B]">Upcoming reminders</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-[#F8FAFC]">{op.upcomingRemindersCount}</dd>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-[#0c1220]/80 px-3 py-2">
                <dt className="text-[#64748B]">Tasks due (horizon)</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-[#F8FAFC]">{op.tasksDueCount}</dd>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-[#0c1220]/80 px-3 py-2">
                <dt className="text-[#64748B]">Stale leads</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-[#F8FAFC]">{op.staleLeadsCount}</dd>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-[#0c1220]/80 px-3 py-2">
                <dt className="text-[#64748B]">No-shows today</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-[#F8FAFC]">{op.quickStats.todaysNoShows}</dd>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-[#0c1220]/80 px-3 py-2">
                <dt className="text-[#64748B]">Staff on duty today</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-[#F8FAFC]">{op.quickStats.staffOnDutyToday}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-[#94A3B8]">Limited data — operational dashboard did not load for this request.</p>
          )}
        </DashboardCard>

        <DashboardCard className="p-5 sm:p-6">
          <SectionHeader
            kicker="LeadFlow"
            title="LeadFlow analytics"
            description="CRM hygiene and velocity from the operational loader (no new funnel charts)."
            className="mb-4"
          />
          {op ? (
            <ul className="space-y-2 text-sm text-[#CBD5E1]">
              <li>
                <span className="text-[#64748B]">New leads this week:</span>{" "}
                <span className="font-semibold text-[#F8FAFC]">{op.quickStats.newLeadsThisWeek}</span>
              </li>
              <li>
                <span className="text-[#64748B]">30-day conversion rate:</span>{" "}
                <span className="font-semibold text-[#F8FAFC]">{conversionPct}</span>
                <span className="text-[#64748B]">
                  {" "}
                  ({op.quickStats.conversionWonLast30d} won / {op.quickStats.conversionClosedLast30d} closed)
                </span>
              </li>
              <li className="text-xs text-[#64748B]">
                Conversion reflects recent won/lost CRM stage transitions — not revenue or billing.
              </li>
              <li>
                <span className="text-[#64748B]">Stale leads (≥ {op.staleLeadThresholdDays}d in stage):</span>{" "}
                <span className="font-semibold text-[#F8FAFC]">{op.staleLeadsCount}</span>
              </li>
              <li>
                <span className="text-[#64748B]">Tasks due (active, horizon):</span>{" "}
                <span className="font-semibold text-[#F8FAFC]">{op.tasksDueCount}</span>
              </li>
              <li className="text-xs text-[#64748B]">Stage distribution deferred — not exposed on the operational snapshot.</li>
            </ul>
          ) : (
            <p className="text-sm text-[#94A3B8]">Limited data — CRM snapshot unavailable.</p>
          )}
        </DashboardCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <DashboardCard className="p-5 sm:p-6">
          <SectionHeader
            kicker="PatientOS"
            title="Patient analytics"
            description="Directory-aligned KPIs and PatientOS overview loader."
            className="mb-4"
          />
          {pat ? (
            <ul className="space-y-2 text-sm text-[#CBD5E1]">
              <li>
                Total patients: <span className="font-semibold text-[#F8FAFC]">{pat.kpis.totalPatients}</span>
              </li>
              <li>
                Recently added (30d):{" "}
                <span className="font-semibold text-[#F8FAFC]">{pat.kpis.recentlyAddedPatients}</span>
              </li>
              <li>
                With active cases:{" "}
                <span className="font-semibold text-[#F8FAFC]">{pat.kpis.patientsWithActiveCases}</span>
              </li>
              <li>
                With future bookings:{" "}
                <span className="font-semibold text-[#F8FAFC]">{pat.kpis.patientsWithUpcomingBookings}</span>
              </li>
              <li>
                Follow-up due (patients):{" "}
                <span className="font-semibold text-[#F8FAFC]">{pat.kpis.patientsNeedingFollowUp}</span>
              </li>
            </ul>
          ) : (
            <p className="text-sm text-[#94A3B8]">Limited data — patient aggregates unavailable.</p>
          )}
        </DashboardCard>

        <DashboardCard className="p-5 sm:p-6">
          <SectionHeader
            kicker="SurgeryOS"
            title="Surgery analytics"
            description="Derived from the same case worklist enrichment as SurgeryOS (read-only)."
            className="mb-4"
          />
          {sur ? (
            <ul className="space-y-2 text-sm text-[#CBD5E1]">
              <li>
                Today&apos;s surgeries: <span className="font-semibold text-[#F8FAFC]">{sur.todaySurgeriesCount}</span>
              </li>
              <li>
                Upcoming (30d window):{" "}
                <span className="font-semibold text-[#F8FAFC]">{sur.metrics.upcomingSurgeries}</span>
              </li>
              <li>
                Readiness alerts:{" "}
                <span className="font-semibold text-[#F8FAFC]">{sur.metrics.readinessReviewCases}</span>
              </li>
              <li>
                Planning queue:{" "}
                <span className="font-semibold text-[#F8FAFC]">{sur.metrics.incompletePlanningCases}</span>
              </li>
              <li>
                Follow-up queue (due):{" "}
                <span className="font-semibold text-[#F8FAFC]">{sur.metrics.followUpsDueCases}</span>
              </li>
              <li>
                Recently completed (14d):{" "}
                <span className="font-semibold text-[#F8FAFC]">{sur.recentCompletedCount}</span>
              </li>
            </ul>
          ) : (
            <p className="text-sm text-[#94A3B8]">Limited data — surgery worklist could not be composed.</p>
          )}
        </DashboardCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <DashboardCard className="p-5 sm:p-6">
          <SectionHeader
            kicker="AuditOS"
            title="Audit analytics"
            description="HairAudit report queue and pipeline counters."
            className="mb-4"
          />
          {aud ? (
            <ul className="space-y-2 text-sm text-[#CBD5E1]">
              <li>
                Draft reports: <span className="font-semibold text-[#F8FAFC]">{aud.kpis.draft_reports}</span>
              </li>
              <li>
                Changes required:{" "}
                <span className="font-semibold text-[#F8FAFC]">{aud.kpis.changes_required_reports}</span>
              </li>
              <li>
                Released: <span className="font-semibold text-[#F8FAFC]">{aud.kpis.released_reports}</span>
              </li>
              <li>
                Pending reviews:{" "}
                <span className="font-semibold text-[#F8FAFC]">{aud.kpis.pending_reviews}</span>
              </li>
              <li>
                Oldest queue item:{" "}
                <span className="font-semibold text-[#F8FAFC]">
                  {aud.kpis.oldest_queue_created_at
                    ? new Date(aud.kpis.oldest_queue_created_at).toLocaleDateString(undefined, { dateStyle: "medium" })
                    : aud.kpis.pending_reviews === 0
                      ? "—"
                      : "Unknown"}
                </span>
              </li>
            </ul>
          ) : (
            <p className="text-sm text-[#94A3B8]">Limited data — audit snapshot unavailable.</p>
          )}
        </DashboardCard>

        <DashboardCard className="p-5 sm:p-6">
          <SectionHeader
            kicker="FoundationOS"
            title="Foundation analytics"
            description="Twin health, linkage, and coverage hints from the FoundationOS dashboard loader."
            className="mb-4"
          />
          {found ? (
            <ul className="space-y-2 text-sm text-[#CBD5E1]">
              <li>
                Foundation patients:{" "}
                <span className="font-semibold text-[#F8FAFC]">{found.twin_health.foundation_patients}</span>
              </li>
              <li>
                Cases linked to foundation patient:{" "}
                <span className="font-semibold text-[#F8FAFC]">{found.twin_health.cases_with_foundation_patient}</span>
              </li>
              <li>
                Cases missing foundation patient:{" "}
                <span className="font-semibold text-[#F8FAFC]">{found.twin_health.cases_missing_foundation_patient}</span>
              </li>
              <li>
                Timeline coverage hint:{" "}
                <span className="font-semibold text-[#F8FAFC]">{formatPctInt(found.twin_coverage.timeline_coverage_pct)}</span>
              </li>
              <li>
                Media coverage hint:{" "}
                <span className="font-semibold text-[#F8FAFC]">{formatPctInt(found.twin_coverage.media_coverage_pct)}</span>
              </li>
              <li>
                CRM coverage hint:{" "}
                <span className="font-semibold text-[#F8FAFC]">{formatPctInt(found.twin_coverage.crm_coverage_pct)}</span>
              </li>
              <li>
                Audit coverage hint:{" "}
                <span className="font-semibold text-[#F8FAFC]">{formatPctInt(found.twin_coverage.audit_case_coverage_pct)}</span>
              </li>
              <li>
                Mean coverage hint:{" "}
                <span className="font-semibold text-[#F8FAFC]">{found.twin_coverage.twin_readiness_score_hint}%</span>
              </li>
            </ul>
          ) : (
            <p className="text-sm text-[#94A3B8]">Limited data — foundation dashboard unavailable.</p>
          )}
        </DashboardCard>
      </div>

      <DashboardCard className="p-5 sm:p-6">
        <SectionHeader
          kicker="Priorities"
          title="Risk / attention panel"
          description="Ranked by count — same signals as operational hygiene (no AI scoring)."
          className="mb-4"
        />
        {riskRows.length ? (
          <ol className="list-decimal space-y-2 pl-5 text-sm text-[#CBD5E1]">
            {riskRows.map((r) => (
              <li key={r.label} className="marker:text-[#64748B]">
                <span className="font-medium text-[#F8FAFC]">{r.label}</span>
                <span className="text-[#94A3B8]"> — {r.count}</span>
                {r.linkDisabled ? (
                  <span className="ml-2 text-xs text-[#64748B]">(open LeadFlow when CRM access is enabled)</span>
                ) : (
                  <Link href={r.href} className="ml-2 text-[#22C1FF] underline-offset-2 hover:underline">
                    Open
                  </Link>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-[#94A3B8]">No ranked risks with positive counts for the loaded snapshots.</p>
        )}
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6">
        <SectionHeader
          kicker="Modules"
          title="Module health"
          description="Healthy = loaded with no attention triggers for that module. Limited data = loader error or empty fallback."
          className="mb-4"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {moduleHealth.map((m) => (
            <div
              key={m.moduleId}
              className="flex min-w-0 flex-col rounded-xl border border-white/[0.08] bg-[#0c1220]/75 px-4 py-3"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="truncate text-sm font-semibold text-[#F8FAFC]">{m.label}</p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${statusBadgeClass(m.status)}`}
                >
                  {statusLabel(m.status)}
                </span>
              </div>
              <p className="mt-2 text-sm text-[#94A3B8]">{m.primaryMetric}</p>
              {m.detail ? <p className="mt-1 text-xs text-[#64748B]">{m.detail}</p> : null}
              {m.linkDisabled ? (
                <span className="mt-3 text-xs font-medium text-[#64748B]">Link disabled for this user</span>
              ) : (
                <Link href={m.href} className="mt-3 text-sm font-medium text-[#22C1FF] hover:underline">
                  Open module →
                </Link>
              )}
            </div>
          ))}
        </div>
      </DashboardCard>

      {loadNotes.length ? (
        <DashboardCard className="border-amber-500/25 bg-amber-950/20 p-5 sm:p-6">
          <div className="flex gap-2">
            <BarChart3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-200/90" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-100">Partial load notes</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-amber-50/90">
                {loadNotes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
              {found?.scan_notes?.length ? (
                <div className="mt-4 border-t border-amber-500/20 pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-200/80">Foundation scan notes</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-50/85">
                    {found.scan_notes.slice(0, 6).map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </DashboardCard>
      ) : found?.scan_notes?.length ? (
        <DashboardCard className="p-5 sm:p-6">
          <SectionHeader title="Foundation scan notes" description="Capped scans and view caveats from FoundationOS." className="mb-2" />
          <ul className="list-disc space-y-1 pl-5 text-xs text-[#94A3B8]">
            {found.scan_notes.slice(0, 8).map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </DashboardCard>
      ) : null}
    </div>
  );
}
