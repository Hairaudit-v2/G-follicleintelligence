import Link from "next/link";
import { Calendar } from "lucide-react";

import { FiCalendarBlock } from "@/src/components/fi-design/FiCalendarBlock";
import { FiCard } from "@/src/components/fi-design/FiCard";
import { FiKpiTile } from "@/src/components/fi-design/FiKpiTile";
import { FiPageHeader } from "@/src/components/fi-design/FiPageHeader";
import { FiQuickActionCard } from "@/src/components/fi-design/FiQuickActionCard";
import { FiSection } from "@/src/components/fi-design/FiSection";

type ClinicOsDashboardHomeProps = {
  tenantId: string;
  /** Clinic or brand display name; falls back to generic copy when null. */
  clinicLabel: string | null;
  /** Mirrors CRM shell nav — gates calendar, bookings, CRM links. */
  showCrmNav: boolean;
};

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
  const newConsultationHref = `${base}/consultations/new`;

  return (
    <div className="space-y-4">
      <p id="clinic-os-dash-preview-note" className="sr-only">
        Dashboard figures and schedule rows are placeholders only. They are not live clinical or operational data.
      </p>

      <FiCard>
        <FiPageHeader
          titleId="clinic-os-welcome-heading"
          eyebrow="Welcome back"
          title={workspaceName}
          description="Manage today&apos;s bookings, patients, clinical records and follow-ups from one place."
          primaryAction={
            <Link
              href={newBookingLauncherHref}
              className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
            >
              New booking
            </Link>
          }
          secondaryAction={
            crmHref ? (
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
            )
          }
        />
      </FiCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5" aria-describedby="clinic-os-dash-preview-note">
        <FiSection
          className="lg:col-span-4"
          title="Today"
          description="Today&apos;s clinic flow"
          headingId="clinic-os-today-heading"
        >
            <div>
              <FiCalendarBlock title="Consultations" timeLabel="AM" tone="consult" placeholder />
              <FiCalendarBlock title="PRP / Treatment" timeLabel="Midday" tone="treatment" placeholder />
              <FiCalendarBlock title="Surgery patients" timeLabel="PM" tone="surgery" placeholder />
              <FiCalendarBlock title="Follow-ups" timeLabel="PM" tone="followup" placeholder />
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
        </FiSection>

        <FiSection
          className="lg:col-span-4"
          title="Main actions"
          description="Shortcuts to common tasks"
          headingId="clinic-os-actions-heading"
        >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FiQuickActionCard
                title="Start consultation"
                description="Open the ConsultationOS workspace (preview — fields not saved yet)"
                href={newConsultationHref}
                badge="Preview"
              />
              <FiQuickActionCard
                title="Add new patient"
                description="Choose how to start — lead, booking, or profile"
                href={newPatientHref}
              />
              <FiQuickActionCard
                title="Book appointment"
                description="Choose how to book — patient, lead, consultation, or clinical patient"
                href={newBookingLauncherHref}
              />
              <FiQuickActionCard
                title="Create lead"
                description="CRM pipeline and new lead"
                href={crmHref ?? undefined}
                disabled={!crmHref}
                disabledReason={!crmHref ? "Requires CRM workspace access (fi_admin or crm_operator)." : undefined}
              />
              <FiQuickActionCard
                title="Open active patients"
                description="Patient list and worklists"
                href={casesHref}
              />
              <FiQuickActionCard title="Send message" description="Team and patient messaging" />
              <FiQuickActionCard title="View reports" description="Operational and clinical summaries" />
            </div>
        </FiSection>

        <FiSection
          className="lg:col-span-4"
          title="Operational snapshot"
          description="Preview tiles · not connected to live metrics"
          headingId="clinic-os-snapshot-heading"
        >
            <div className="grid grid-cols-1 gap-3">
              <FiKpiTile label="Unassigned leads" value="—" description="Leads awaiting owner" tone="info" />
              <FiKpiTile label="Pending follow-ups" value="—" description="Tasks due this week" tone="info" />
              <FiKpiTile label="Upcoming surgeries" value="—" description="Next 14 days" tone="info" />
              <FiKpiTile label="Open tasks" value="—" description="Across teams" tone="info" />
              <FiKpiTile label="Training reminders" value="—" description="Compliance and CPD" tone="info" />
              <FiKpiTile label="Audit alerts" value="—" description="Items needing review" tone="info" />
            </div>
        </FiSection>
      </div>
    </div>
  );
}
