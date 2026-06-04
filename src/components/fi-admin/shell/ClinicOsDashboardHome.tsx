import Link from "next/link";
import { ArrowRight, Calendar } from "lucide-react";

import { cn } from "@/lib/utils";

type ClinicOsDashboardHomeProps = {
  tenantId: string;
  /** Clinic or brand display name; falls back to generic copy when null. */
  clinicLabel: string | null;
  /** Mirrors CRM shell nav — gates calendar, bookings, CRM links. */
  showCrmNav: boolean;
};

function PlaceholderMetric({ value = "—" }: { value?: string }) {
  return <span className="text-2xl font-semibold tabular-nums tracking-tight text-slate-800">{value}</span>;
}

function FlowRow({ title, timeLabel }: { title: string; timeLabel: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900">{title}</p>
        <p className="text-xs text-slate-500">Placeholder schedule · not connected to calendar</p>
      </div>
      <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{timeLabel}</span>
    </div>
  );
}

function MainActionCard({
  title,
  description,
  href,
  disabledReason,
}: {
  title: string;
  description: string;
  href: string | null;
  disabledReason?: string;
}) {
  const baseClass =
    "flex flex-col rounded-xl border border-slate-200 bg-white p-4 text-left transition focus-within:ring-2 focus-within:ring-sky-400/35 focus-visible:outline-none";

  if (!href) {
    return (
      <div
        className={cn(
          baseClass,
          "cursor-not-allowed border-dashed bg-slate-50/80 text-slate-500 shadow-none hover:border-slate-200"
        )}
        aria-disabled="true"
        title={disabledReason ?? "Coming soon"}
      >
        <span className="text-sm font-semibold text-slate-700">{title}</span>
        <span className="mt-1 text-xs text-slate-500">{description}</span>
        <span className="mt-3 inline-flex w-fit rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Coming soon
        </span>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={cn(baseClass, "border-slate-200 shadow-sm hover:border-sky-200/80 hover:bg-sky-50/40")}
    >
      <span className="text-sm font-semibold text-slate-900">{title}</span>
      <span className="mt-1 text-xs text-slate-600">{description}</span>
      <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-sky-700">
        Open <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </span>
    </Link>
  );
}

function SnapshotCard({
  title,
  subtitle,
  value,
}: {
  title: string;
  subtitle: string;
  value?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <PlaceholderMetric value={value} />
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Preview</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}

/**
 * Feature-flagged clinic command-centre home (UI only, no data fetches).
 * Rendered from the tenant FI admin home route when `NEXT_PUBLIC_FI_CLINIC_OS_SHELL` is enabled.
 */
export function ClinicOsDashboardHome({ tenantId, clinicLabel, showCrmNav }: ClinicOsDashboardHomeProps) {
  const base = `/fi-admin/${tenantId.trim()}`;
  const workspaceName = clinicLabel?.trim() || "Your clinic";

  const calendarHref = `${base}/calendar`;
  const newBookingLauncherHref = `${base}/bookings/new`;
  const crmHref = showCrmNav ? `${base}/crm` : null;
  const casesHref = `${base}/cases`;
  const newPatientHref = `${base}/patients/new`;

  return (
    <div className="space-y-4">
      <p id="clinic-os-dash-preview-note" className="sr-only">
        Dashboard figures and schedule rows are placeholders only. They are not live clinical or operational data.
      </p>

      <section
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
        aria-labelledby="clinic-os-welcome-heading"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Welcome back</p>
            <h1 id="clinic-os-welcome-heading" className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              {workspaceName}
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-slate-600">
              Manage today&apos;s bookings, patients, cases and follow-ups from one place.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
            <Link
              href={newBookingLauncherHref}
              className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
            >
              New booking
            </Link>
            {crmHref ? (
              <Link
                href={crmHref}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-400/40 focus-visible:ring-offset-2"
              >
                New lead
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="inline-flex cursor-not-allowed items-center justify-center rounded-lg border border-dashed border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-400"
                title="Requires CRM workspace access"
              >
                New lead
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5" aria-describedby="clinic-os-dash-preview-note">
        {/* Today */}
        <section className="lg:col-span-4" aria-labelledby="clinic-os-today-heading">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 id="clinic-os-today-heading" className="text-sm font-semibold text-slate-900">
              Today
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">Today&apos;s clinic flow</p>
            <div className="mt-3">
              <FlowRow title="Consultations" timeLabel="AM" />
              <FlowRow title="PRP / Treatment" timeLabel="Midday" />
              <FlowRow title="Surgery cases" timeLabel="PM" />
              <FlowRow title="Follow-ups" timeLabel="PM" />
            </div>
            <div className="mt-4 border-t border-slate-100 pt-4">
              <Link
                href={calendarHref}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-2.5 text-sm font-medium text-slate-800 transition hover:border-sky-200 hover:bg-sky-50/60 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-400/40"
              >
                <Calendar className="h-4 w-4 text-sky-600" aria-hidden />
                Open Calendar
              </Link>
            </div>
          </div>
        </section>

        {/* Main actions */}
        <section className="lg:col-span-4" aria-labelledby="clinic-os-actions-heading">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 id="clinic-os-actions-heading" className="text-sm font-semibold text-slate-900">
              Main actions
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">Shortcuts to common tasks</p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MainActionCard
                title="Add new patient"
                description="Choose how to start — lead, booking, or profile"
                href={newPatientHref}
              />
              <MainActionCard
                title="Book appointment"
                description="Choose how to book — patient, lead, consultation, or case"
                href={newBookingLauncherHref}
              />
              <MainActionCard
                title="Create lead"
                description="CRM pipeline and new lead"
                href={crmHref}
              />
              <MainActionCard
                title="Open active cases"
                description="Case list and worklists"
                href={casesHref}
              />
              <MainActionCard title="Send message" description="Team and patient messaging" href={null} />
              <MainActionCard title="View reports" description="Operational and clinical summaries" href={null} />
            </div>
          </div>
        </section>

        {/* Operational snapshot */}
        <section className="lg:col-span-4" aria-labelledby="clinic-os-snapshot-heading">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 id="clinic-os-snapshot-heading" className="text-sm font-semibold text-slate-900">
              Operational snapshot
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">Preview tiles · not connected to live metrics</p>
            <div className="mt-4 grid grid-cols-1 gap-3">
              <SnapshotCard title="Unassigned leads" subtitle="Leads awaiting owner" value="—" />
              <SnapshotCard title="Pending follow-ups" subtitle="Tasks due this week" value="—" />
              <SnapshotCard title="Upcoming surgeries" subtitle="Next 14 days" value="—" />
              <SnapshotCard title="Open tasks" subtitle="Across teams" value="—" />
              <SnapshotCard title="Training reminders" subtitle="Compliance and CPD" value="—" />
              <SnapshotCard title="Audit alerts" subtitle="Items needing review" value="—" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
