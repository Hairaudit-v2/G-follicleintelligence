import type { ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  BarChart3,
  Calendar,
  Camera,
  ClipboardList,
  Dna,
  GraduationCap,
  LayoutGrid,
  ListTodo,
  Microscope,
  PieChart,
  PlusCircle,
  Scissors,
  Stethoscope,
  UserPlus,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { TenantOperationalDashboard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";
import { DashboardTodayAgenda } from "@/src/components/fi-admin/dashboard/DashboardTodayAgenda";
import { DashboardUpcomingReminders } from "@/src/components/fi-admin/dashboard/DashboardUpcomingReminders";
import { DashboardStaleLeads } from "@/src/components/fi-admin/dashboard/DashboardStaleLeads";
import { DashboardTasksDue } from "@/src/components/fi-admin/dashboard/DashboardTasksDue";
import { TenantHomeQuickCallIn } from "@/src/components/fi-admin/TenantHomeQuickCallIn";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";

function OsPanel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/[0.08] bg-gradient-to-br from-[#0a1424]/92 to-[#060d18]/88 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md sm:p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

function QuickCreateButton({
  href,
  disabled,
  hint,
  icon,
  label,
}: {
  href: string;
  disabled?: boolean;
  hint?: string;
  icon: ReactNode;
  label: string;
}) {
  const body = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.05] text-cyan-400">
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-left text-[13px] font-semibold leading-snug text-slate-100">{label}</span>
    </>
  );
  if (disabled) {
    return (
      <span
        title={hint}
        className="flex cursor-not-allowed items-center gap-3 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5 opacity-55"
      >
        {body}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border border-white/[0.1] bg-white/[0.04] px-2.5 py-2 transition hover:border-cyan-400/35 hover:bg-cyan-500/[0.1] hover:shadow-[0_0_0_1px_rgba(34,211,238,0.12)]"
    >
      {body}
    </Link>
  );
}

function NavTile({
  href,
  disabled,
  hint,
  icon,
  title,
  subtitle,
}: {
  href?: string;
  disabled?: boolean;
  hint?: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
}) {
  const inner = (
    <div className="flex flex-col gap-1.5">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.05] text-cyan-400">{icon}</span>
      <div>
        <p className="text-[13px] font-semibold text-slate-50">{title}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
  if (disabled || !href) {
    return (
      <div title={hint} className="cursor-not-allowed rounded-lg border border-dashed border-white/[0.08] bg-black/15 p-3 opacity-50">
        {inner}
      </div>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-lg border border-white/[0.09] bg-white/[0.03] p-3 transition hover:border-cyan-400/35 hover:bg-cyan-500/[0.08]"
    >
      {inner}
    </Link>
  );
}

function MetricTile({
  label,
  value,
  href,
  foot,
}: {
  label: string;
  value: string | number;
  href: string;
  foot?: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col justify-between rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2.5 transition hover:border-cyan-400/30 hover:bg-white/[0.05]"
    >
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1.5 font-mono text-lg font-semibold tabular-nums text-slate-50 sm:text-xl">{value}</p>
      {foot ? <p className="mt-1 text-[0.65rem] text-slate-600">{foot}</p> : null}
    </Link>
  );
}

/**
 * FI OS tenant home — launch / control centre layout (agenda-first, fast actions, module tiles).
 */
export function FiOsControlCentreHome(props: {
  data: TenantOperationalDashboard;
  showCrmNav: boolean;
  showBookingsBoard: boolean;
}) {
  const { data, showCrmNav, showBookingsBoard } = props;
  const base = `/fi-admin/${data.tenantId}`;
  const lc = data.launchControl;

  const now = new Date();
  const dateLine = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(now);

  return (
    <div className="space-y-4 pb-6 sm:space-y-5">
      <header className="flex flex-col gap-2 border-b border-white/[0.07] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={fiOsChromeClasses.sectionEyebrow}>Control centre</p>
          <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-50 sm:text-xl">{data.tenantName}</h1>
          <p className="mt-0.5 text-xs text-slate-500">{dateLine}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.canQuickCallIn ? <TenantHomeQuickCallIn tenantId={data.tenantId} /> : null}
          <Link
            href={`${base}/calendar`}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-50 transition hover:border-cyan-400/45 hover:bg-cyan-500/18",
            )}
          >
            <Calendar className="h-4 w-4 text-cyan-400" aria-hidden />
            Full calendar
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12 xl:gap-4">
        {/* Left rail — launch actions + metrics */}
        <div className="space-y-4 xl:col-span-3">
          <OsPanel>
            <p className={fiOsChromeClasses.sectionEyebrow}>Quick create</p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <QuickCreateButton
                href={`${base}/consultations/new`}
                icon={<Stethoscope className="h-5 w-5" aria-hidden />}
                label="New consultation"
              />
              <QuickCreateButton
                href={`${base}/patients/new`}
                disabled={!showBookingsBoard}
                hint="Requires bookings operator access."
                icon={<Users className="h-5 w-5" aria-hidden />}
                label="New patient"
              />
              <QuickCreateButton
                href={`${base}/crm`}
                disabled={!showCrmNav}
                hint="Requires CRM role."
                icon={<UserPlus className="h-5 w-5" aria-hidden />}
                label="New lead"
              />
              <QuickCreateButton
                href={`${base}/cases/new`}
                icon={<Scissors className="h-5 w-5" aria-hidden />}
                label="New surgery case"
              />
              <QuickCreateButton
                href={`${base}/foundation-integrity`}
                icon={<Camera className="h-5 w-5" aria-hidden />}
                label="Upload photos"
              />
              <QuickCreateButton
                href={`${base}/crm`}
                disabled={!showCrmNav}
                hint="Tasks live in LeadFlow."
                icon={<ListTodo className="h-5 w-5" aria-hidden />}
                label="Create task"
              />
            </div>
            {data.viewerStaffId ? (
              <Link
                href={`${base}/staff/me/hr`}
                className="mt-3 block rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-center text-xs font-semibold text-slate-300 transition hover:border-cyan-500/25 hover:text-cyan-300"
              >
                My HR portal
              </Link>
            ) : null}
          </OsPanel>

          <OsPanel>
            <p className={fiOsChromeClasses.sectionEyebrow}>Clinic pulse</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <MetricTile label="Consultations today" value={lc.consultationsToday} href={`${base}/calendar`} />
              <MetricTile label="Surgeries this week" value={lc.surgeriesThisWeek} href={`${base}/cases`} foot="Mon–Sun UTC" />
              <MetricTile label="Leads · follow-up" value={lc.leadsNeedingFollowUp} href={`${base}/crm`} foot="Stage dwell" />
              <MetricTile label="Open tasks" value={lc.openTasks} href={`${base}/crm`} foot="Active CRM" />
              <MetricTile
                label="Revenue"
                value={lc.revenueAvailable ? "Live" : "—"}
                href={`${base}/analytics`}
                foot={lc.revenueAvailable ? "Snapshot" : "Billing not connected"}
              />
            </div>
          </OsPanel>
        </div>

        {/* Centre — agenda */}
        <div className="min-w-0 xl:col-span-6">
          <DashboardTodayAgenda
            tenantId={data.tenantId}
            agendaRange={data.agendaRange}
            agendaByBucket={data.agendaByBucket}
            variant="launch"
          />
        </div>

        {/* Right — OS modules */}
        <div className="space-y-4 xl:col-span-3">
          <OsPanel>
            <p className={fiOsChromeClasses.sectionEyebrow}>Modules</p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <NavTile href={`${base}/calendar`} icon={<Calendar className="h-5 w-5" />} title="Calendar" subtitle="Operational schedule" />
              <NavTile
                href={`${base}/foundation-integrity`}
                icon={<Dna className="h-5 w-5" />}
                title="Patient Twin"
                subtitle="Identity & media health"
              />
              <NavTile href={`${base}/cases`} icon={<Scissors className="h-5 w-5" />} title="SurgeryOS" subtitle="Cases & pathway" />
              <NavTile
                href={`${base}/crm`}
                disabled={!showCrmNav}
                hint="CRM access required."
                icon={<PieChart className="h-5 w-5" />}
                title="LeadFlow CRM"
                subtitle="Pipeline & tasks"
              />
              <NavTile href={`${base}/audit`} icon={<Microscope className="h-5 w-5" />} title="AuditOS" subtitle="HairAudit queue" />
              <NavTile
                disabled
                hint="Coming soon."
                icon={<GraduationCap className="h-5 w-5" />}
                title="AcademyOS"
                subtitle="Training"
              />
              <NavTile href={`${base}/analytics`} icon={<BarChart3 className="h-5 w-5" />} title="AnalyticsOS" subtitle="Cross-module KPIs" />
              <NavTile href={`${base}/configuration`} icon={<LayoutGrid className="h-5 w-5" />} title="Settings" subtitle="Configuration" />
            </div>
          </OsPanel>

          <OsPanel className="hidden lg:block">
            <p className={fiOsChromeClasses.sectionEyebrow}>Pipeline</p>
            <div className="mt-3 space-y-2 text-sm">
              <Link className="flex items-center justify-between text-slate-400 hover:text-cyan-400" href={`${base}/consultations`}>
                <span className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" aria-hidden />
                  Open consultations
                </span>
                <span className="font-mono text-slate-200">{data.quickStats.openConsultations}</span>
              </Link>
              <Link className="flex items-center justify-between text-slate-400 hover:text-cyan-400" href={`${base}/crm`}>
                <span className="flex items-center gap-2">
                  <PlusCircle className="h-4 w-4" aria-hidden />
                  New leads (week)
                </span>
                <span className="font-mono text-slate-200">{data.quickStats.newLeadsThisWeek}</span>
              </Link>
              <Link className="flex items-center justify-between text-slate-400 hover:text-cyan-400" href={`${base}/calendar`}>
                <span className="flex items-center gap-2">
                  <Activity className="h-4 w-4" aria-hidden />
                  Staff on duty today
                </span>
                <span className="font-mono text-slate-200">{data.quickStats.staffOnDutyToday}</span>
              </Link>
            </div>
          </OsPanel>
        </div>
      </div>

      <DashboardUpcomingReminders
        tenantId={data.tenantId}
        items={data.upcomingReminders}
        viewerFiUserId={data.viewerFiUserId}
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <DashboardStaleLeads
          tenantId={data.tenantId}
          staleLeads={data.staleLeads}
          staleLeadThresholdDays={data.staleLeadThresholdDays}
        />
        <DashboardTasksDue tenantId={data.tenantId} tasks={data.tasksDue} viewerFiUserId={data.viewerFiUserId} />
      </div>
    </div>
  );
}
