import Link from "next/link";
import type { FiHomeDashboardPayload } from "@/src/lib/fiOs/fiHomeDashboardLoader.server";
import {
  DashboardCard,
  InfoNotice,
  ProgressChecklist,
  ProgressChecklistItem,
  QuickActionCard,
  SectionHeader,
  StatCard,
} from "@/src/components/fi-admin/dashboard-ui";

export function FiHomeDashboard({
  data,
  showCrmShellExtras,
}: {
  data: FiHomeDashboardPayload;
  showCrmShellExtras: boolean;
}) {
  const base = `/fi-admin/${data.tenantId}`;
  const pct = Math.round(data.setupProgressRatio * 100);

  return (
    <div className="space-y-8 pb-12">
      <header className="space-y-2">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.32em] text-[#22C1FF]/90">
          Follicle Intelligence
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-[#F8FAFC] sm:text-3xl">Operating System</h1>
        <p className="text-sm text-[#94A3B8]">
          <span className="font-medium text-[#E2E8F0]">{data.tenantName}</span>
          {data.tenantSlug ? (
            <span className="text-[#64748B]">
              {" "}
              (<span className="font-mono text-xs text-[#94A3B8]">{data.tenantSlug}</span>)
            </span>
          ) : null}
        </p>
        <p className="max-w-2xl text-xs leading-relaxed text-[#94A3B8] sm:text-sm">
          Tenant home in Follicle Intelligence Admin — setup progress and shortcuts. Everything here is read-only
          context for operators.
        </p>
      </header>

      <DashboardCard className="p-5 sm:p-6" role="region" aria-labelledby="setup-progress-heading">
        <SectionHeader
          id="setup-progress-heading"
          title="Setup progress"
          description="Complete the checklist to bring this clinic workspace to full operational readiness."
        />
        <div className="mt-5">
          <ProgressChecklist percentComplete={pct}>
            <ProgressChecklistItem done={data.checklist.organisationCreated} label="Organisation created" />
            <ProgressChecklistItem done={data.checklist.clinicCreated} label="Clinic created" />
            <ProgressChecklistItem done={data.checklist.clinicSettingsComplete} label="Clinic settings completed" />
            <ProgressChecklistItem done={data.checklist.firstCaseCreated} label="First patient / case created" />
            {showCrmShellExtras ? (
              <>
                <ProgressChecklistItem
                  done={Boolean(data.checklist.crmAccessAvailable)}
                  label="CRM access available"
                  hint="Your account can open CRM, bookings, and calendar from the navigation."
                />
                <ProgressChecklistItem
                  done={Boolean(data.checklist.bookingsCalendarAvailable)}
                  label="Bookings & calendar available"
                  hint="Use Bookings and Calendar in the nav when you are ready to schedule."
                />
              </>
            ) : null}
          </ProgressChecklist>
        </div>
      </DashboardCard>

      <InfoNotice variant="info" title="Recommended next step">
        <p className="font-medium text-[#F8FAFC]">{data.nextAction.title}</p>
        <p className="mt-1 text-xs text-[#94A3B8]">{data.nextAction.description}</p>
        <Link
          href={data.nextAction.href}
          className="mt-3 inline-block text-sm font-semibold text-[#22C1FF] underline decoration-[#22C1FF]/40 underline-offset-4 transition hover:text-[#0EA5E9] hover:decoration-[#0EA5E9]/50"
        >
          Go there →
        </Link>
      </InfoNotice>

      <section className="space-y-4" aria-labelledby="actions-heading">
        <SectionHeader id="actions-heading" title="Main actions" description="Jump to the most common operator flows." />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickActionCard
            href={`${base}/cases/new`}
            title="Create first case"
            description="Guided wizard for person, patient, and case."
          />
          <QuickActionCard href={`${base}/cases`} title="View cases" description="Worklist, filters, and case detail." />
          <QuickActionCard
            href={`${base}/directory`}
            title="Directory"
            description="Search foundation records and manage orgs and clinics."
          />
          <QuickActionCard
            href={`${base}/configuration`}
            title="Configuration"
            description="Tenant, organisation, and clinic branding and settings."
          />
        </div>
      </section>

      {showCrmShellExtras ? (
        <DashboardCard className="p-5 sm:p-6">
          <SectionHeader
            id="crm-quick-heading"
            kicker="Scheduling"
            title="CRM & scheduling"
            description="Operational surfaces for intake and the calendar."
          />
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link
              href={`${base}/crm`}
              className="rounded-lg border border-white/[0.08] bg-[#141C33]/50 px-3 py-2 font-medium text-[#22C1FF] transition hover:border-[#22C1FF]/30 hover:bg-[#141C33]"
            >
              CRM
            </Link>
            <Link
              href={`${base}/bookings`}
              className="rounded-lg border border-white/[0.08] bg-[#141C33]/50 px-3 py-2 font-medium text-[#22C1FF] transition hover:border-[#22C1FF]/30 hover:bg-[#141C33]"
            >
              Bookings
            </Link>
            <Link
              href={`${base}/calendar`}
              className="rounded-lg border border-white/[0.08] bg-[#141C33]/50 px-3 py-2 font-medium text-[#22C1FF] transition hover:border-[#22C1FF]/30 hover:bg-[#141C33]"
            >
              Calendar
            </Link>
          </div>
        </DashboardCard>
      ) : null}

      <section className="space-y-4" aria-labelledby="status-heading">
        <SectionHeader
          id="status-heading"
          title="System status summary"
          description="Read-only snapshot counts for this tenant."
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          <StatCard label="Organisations" value={data.counts.organisations} />
          <StatCard label="Clinics" value={data.counts.clinics} />
          <StatCard label="Persons" value={data.counts.persons} />
          <StatCard label="Patients" value={data.counts.patients} />
          <StatCard label="Cases" value={data.counts.cases} />
        </div>
      </section>

      <InfoNotice variant="warning" title="About Foundation integrity">
        <p className="max-w-3xl text-xs leading-relaxed sm:text-sm">
          <Link
            href={`${base}/foundation-integrity`}
            className="font-semibold text-amber-200 underline decoration-amber-500/40 underline-offset-2 hover:text-amber-100"
          >
            Foundation integrity
          </Link>{" "}
          is a <strong className="text-amber-50">technical health</strong> screen for events, coverage, and data quality —
          not your daily clinic dashboard. For everyday clinical and operational work, use <strong className="text-amber-50">Cases</strong>{" "}
          and (when available) <strong className="text-amber-50">CRM / Bookings</strong>.
        </p>
      </InfoNotice>
    </div>
  );
}
