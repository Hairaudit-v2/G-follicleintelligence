import Link from "next/link";
import {
  Activity,
  Briefcase,
  Building2,
  CalendarDays,
  CalendarRange,
  FolderKanban,
  Hospital,
  ListTodo,
  Network,
  PlusCircle,
  Settings,
  UserCircle2,
  Users,
} from "lucide-react";

import type { FiHomeDashboardPayload } from "@/src/lib/fiOs/fiHomeDashboardLoader.server";
import {
  DashboardCard,
  ProgressChecklistItem,
  QuickActionCard,
  SectionHeader,
  StatCard,
} from "@/src/components/fi-admin/dashboard-ui";

const ICON = 22;
const ICON_SM = 20;

function SetupProgressRing({ percent }: { percent: number }) {
  const pct = Math.min(100, Math.max(0, Math.round(percent)));
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);

  return (
    <div className="flex shrink-0 flex-col items-center">
      <div className="relative h-[7.5rem] w-[7.5rem] sm:h-32 sm:w-32">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120" aria-hidden>
          <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke="url(#fiHomeDashboardRingGrad)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
          <defs>
            <linearGradient id="fiHomeDashboardRingGrad" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#22C1FF" />
              <stop offset="0.55" stopColor="#0EA5E9" />
              <stop offset="1" stopColor="#7C3AED" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums tracking-tight text-[#F8FAFC] sm:text-3xl">{pct}%</span>
          <span className="text-xs font-medium text-[#94A3B8]">setup</span>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ percent }: { percent: number }) {
  const complete = percent >= 100;
  return (
    <div
      className={
        complete
          ? "inline-flex flex-wrap items-center gap-2 rounded-full border border-emerald-500/35 bg-emerald-950/40 px-4 py-2 text-sm font-medium text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.12)]"
          : "inline-flex flex-wrap items-center gap-2 rounded-full border border-[#22C1FF]/30 bg-[#22C1FF]/10 px-4 py-2 text-sm font-medium text-[#E0F2FE] shadow-[0_0_18px_rgba(34,193,255,0.12)]"
      }
    >
      <span className="inline-flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span
            className={
              complete
                ? "absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40"
                : "absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C1FF] opacity-35"
            }
          />
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${complete ? "bg-emerald-400" : "bg-[#22C1FF]"}`}
          />
        </span>
        Active clinic
      </span>
      <span className="text-white/25" aria-hidden>
        ·
      </span>
      <span className="text-[#94A3B8]">{complete ? "Setup complete" : `Setup in progress · ${percent}%`}</span>
    </div>
  );
}

const ctaButtonClass =
  "inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-cyan-950/40 transition duration-200 ease-out hover:-translate-y-0.5 hover:from-cyan-500 hover:to-sky-500 hover:shadow-xl hover:shadow-cyan-500/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#22C1FF]/60 sm:w-auto";

const crmLinkClass =
  "group flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[#141C33]/50 px-4 py-3 text-base font-medium text-[#F8FAFC] shadow-md shadow-black/20 backdrop-blur-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:border-[#22C1FF]/35 hover:bg-[#141C33] hover:text-[#22C1FF] hover:shadow-lg hover:shadow-cyan-500/10";

export function FiHomeDashboard({
  data,
  showCrmShellExtras,
}: {
  data: FiHomeDashboardPayload;
  showCrmShellExtras: boolean;
}) {
  const base = `/fi-admin/${data.tenantId}`;
  const pct = Math.round(data.setupProgressRatio * 100);
  const tenantMeta = data.tenantSlug?.trim()
    ? `Slug · ${data.tenantSlug}`
    : `Tenant ID · ${data.tenantId}`;

  return (
    <div className="space-y-8 pb-14 sm:space-y-10 sm:pb-16">
      {/* 1. Hero */}
      <DashboardCard elevated className="relative overflow-hidden p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_280px_at_0%_0%,rgba(34,193,255,0.12),transparent_55%),radial-gradient(400px_200px_at_100%_100%,rgba(124,58,237,0.08),transparent_50%)]"
          aria-hidden
        />
        <div className="relative border-l-4 border-[#22C1FF]/80 pl-5 sm:pl-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#22C1FF]/95">Follicle Intelligence OS</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#F8FAFC] sm:text-4xl">Welcome back</h1>
          <p className="mt-2 text-xl font-medium text-[#E2E8F0] sm:text-2xl">{data.tenantName}</p>
          <p className="mt-2 break-all font-mono text-sm leading-relaxed text-[#64748B] sm:text-base">{tenantMeta}</p>
          <div className="mt-5">
            <StatusPill percent={pct} />
          </div>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-[#94A3B8]">
            Read-only operator home — jump to setup tasks, patients, and configuration. Underlying data and access rules are
            unchanged.
          </p>
        </div>
      </DashboardCard>

      {/* 2. Quick actions */}
      <section aria-labelledby="quick-actions-heading">
        <SectionHeader
          id="quick-actions-heading"
          title="Quick actions"
          description="Most-used entry points for this clinic workspace."
          className="mb-4 sm:mb-5"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <QuickActionCard
            href={`${base}/cases/new`}
            title="Create first patient"
            description="Guided wizard for person, patient record, and clinical patient."
            icon={<PlusCircle size={ICON} strokeWidth={1.75} aria-hidden />}
          />
          <QuickActionCard
            href={`${base}/cases`}
            title="View patients"
            description="Worklist, filters, and full patient detail."
            icon={<ListTodo size={ICON} strokeWidth={1.75} aria-hidden />}
          />
          <QuickActionCard
            href={`${base}/directory`}
            title="Directory"
            description="Organisations, clinics, and foundation records."
            icon={<Network size={ICON} strokeWidth={1.75} aria-hidden />}
          />
          <QuickActionCard
            href={`${base}/configuration`}
            title="Configuration"
            description="Branding, contacts, and clinic-level settings."
            icon={<Settings size={ICON} strokeWidth={1.75} aria-hidden />}
          />
        </div>
      </section>

      {/* 3. Setup progress | Recommended next step */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
        <DashboardCard className="p-5 sm:p-6" role="region" aria-labelledby="setup-progress-heading">
          <SectionHeader
            id="setup-progress-heading"
            title="Setup progress"
            description="Track foundation milestones for this tenant."
          />
          <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
            <SetupProgressRing percent={pct} />
            <ul className="min-w-0 flex-1 space-y-3 border-t border-white/[0.08] pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
              <ProgressChecklistItem done={data.checklist.organisationCreated} label="Organisation created" />
              <ProgressChecklistItem done={data.checklist.clinicCreated} label="Clinic created" />
              <ProgressChecklistItem done={data.checklist.clinicSettingsComplete} label="Clinic settings completed" />
              <ProgressChecklistItem done={data.checklist.firstCaseCreated} label="First patient created" />
              {showCrmShellExtras ? (
                <>
                  <ProgressChecklistItem
                    done={Boolean(data.checklist.crmAccessAvailable)}
                    label="CRM access available"
                    hint="CRM, bookings, and calendar appear in navigation when your role allows."
                  />
                  <ProgressChecklistItem
                    done={Boolean(data.checklist.bookingsCalendarAvailable)}
                    label="Bookings & calendar available"
                    hint="Schedule and manage visits from Bookings and Calendar."
                  />
                </>
              ) : null}
            </ul>
          </div>
        </DashboardCard>

        <DashboardCard className="flex flex-col p-5 sm:p-6" role="region" aria-labelledby="next-step-heading">
          <SectionHeader
            id="next-step-heading"
            title="Recommended next step"
            description="Based on your current foundation and patient data."
          />
          <div className="mt-5 flex min-h-0 flex-1 flex-col rounded-xl border border-white/[0.06] bg-[#081020]/50 p-5 sm:p-6">
            <p className="text-lg font-semibold text-[#F8FAFC]">{data.nextAction.title}</p>
            <p className="mt-3 text-base leading-relaxed text-[#94A3B8]">{data.nextAction.description}</p>
            <div className="mt-auto pt-8">
              <Link href={data.nextAction.href} className={ctaButtonClass}>
                Continue
              </Link>
            </div>
          </div>
        </DashboardCard>
      </div>

      {/* 4. System overview */}
      <section aria-labelledby="system-overview-heading">
        <SectionHeader
          id="system-overview-heading"
          title="System overview"
          description="Snapshot counts for this tenant (read-only)."
          className="mb-4 sm:mb-5"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <StatCard
            label="Organisations"
            value={data.counts.organisations}
            icon={<Building2 size={ICON} strokeWidth={1.75} />}
          />
          <StatCard label="Clinics" value={data.counts.clinics} icon={<Hospital size={ICON} strokeWidth={1.75} />} />
          <StatCard label="Persons" value={data.counts.persons} icon={<Users size={ICON} strokeWidth={1.75} />} />
          <StatCard
            label="Patients"
            value={data.counts.patients}
            icon={<UserCircle2 size={ICON} strokeWidth={1.75} />}
          />
          <StatCard
            label="Patients"
            value={data.counts.cases}
            icon={<FolderKanban size={ICON} strokeWidth={1.75} />}
          />
        </div>
      </section>

      {/* 5. Foundation integrity */}
      <DashboardCard className="border-amber-500/20 bg-[#0F1629]/80 p-5 sm:p-6" role="region" aria-labelledby="foundation-integrity-heading">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0 space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-200">
                <Activity size={ICON_SM} strokeWidth={1.75} aria-hidden />
              </span>
              <h2 id="foundation-integrity-heading" className="text-lg font-semibold text-[#F8FAFC] sm:text-xl">
                Foundation Integrity
              </h2>
            </div>
            <p className="max-w-3xl text-base leading-relaxed text-[#94A3B8]">
              This screen is for <strong className="text-[#E2E8F0]">technical health</strong>,{" "}
              <strong className="text-[#E2E8F0]">event coverage</strong>, and{" "}
              <strong className="text-[#E2E8F0]">data integrity</strong> — not day-to-day clinical operations. Use{" "}
              <strong className="text-[#E2E8F0]">Patients</strong> and (when available) <strong className="text-[#E2E8F0]">CRM</strong>{" "}
              for routine work.
            </p>
          </div>
          <Link
            href={`${base}/foundation-integrity`}
            className="inline-flex shrink-0 items-center justify-center rounded-xl border border-amber-500/35 bg-amber-950/30 px-5 py-3.5 text-base font-semibold text-amber-100 shadow-md transition duration-200 ease-out hover:-translate-y-0.5 hover:border-amber-400/50 hover:bg-amber-950/50 hover:shadow-lg hover:shadow-amber-900/20"
          >
            View integrity
          </Link>
        </div>
      </DashboardCard>

      {/* 6. CRM quick links */}
      {showCrmShellExtras ? (
        <section aria-labelledby="crm-quick-heading">
          <DashboardCard className="p-5 sm:p-6">
            <SectionHeader
              id="crm-quick-heading"
              kicker="Operations"
              title="CRM & scheduling"
              description="Patients, pipeline, bookings, calendar, and platform checks."
              className="mb-5"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <Link href={`${base}/patients`} className={crmLinkClass}>
                <UserCircle2 className="shrink-0 text-[#22C1FF] transition group-hover:text-[#22C1FF]" size={ICON} strokeWidth={1.75} />
                Patients
              </Link>
              <Link href={`${base}/crm`} className={crmLinkClass}>
                <Briefcase className="shrink-0 text-[#22C1FF]" size={ICON} strokeWidth={1.75} />
                CRM
              </Link>
              <Link href={`${base}/bookings`} className={crmLinkClass}>
                <CalendarRange className="shrink-0 text-[#22C1FF]" size={ICON} strokeWidth={1.75} />
                Bookings
              </Link>
              <Link href={`${base}/calendar`} className={crmLinkClass}>
                <CalendarDays className="shrink-0 text-[#22C1FF]" size={ICON} strokeWidth={1.75} />
                Calendar
              </Link>
              <Link href={`${base}/system-status`} className={crmLinkClass}>
                <Activity className="shrink-0 text-[#22C1FF]" size={ICON} strokeWidth={1.75} />
                System status
              </Link>
            </div>
          </DashboardCard>
        </section>
      ) : null}
    </div>
  );
}
