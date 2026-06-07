import Link from "next/link";
import type { ReactNode } from "react";
import { ClipboardList, ListChecks, Stethoscope, UserPlus, Users } from "lucide-react";

import { FiCard } from "@/src/components/fi-design/FiCard";
import { FiEmptyState } from "@/src/components/fi-design/FiEmptyState";
import { FiKpiTile } from "@/src/components/fi-design/FiKpiTile";
import { FiPageHeader } from "@/src/components/fi-design/FiPageHeader";
import { FiQuickActionCard } from "@/src/components/fi-design/FiQuickActionCard";
import type { PatientOsOverviewModel } from "@/src/lib/patients/patientOsDashboardLoader.server";

function SectionCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <FiCard>
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      <div className="mt-3">{children}</div>
    </FiCard>
  );
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function PatientOsOverviewPanels({
  tenantId,
  model,
  showCrmNav,
  showBookingsBoard,
}: {
  tenantId: string;
  model: PatientOsOverviewModel;
  showCrmNav: boolean;
  showBookingsBoard: boolean;
}) {
  const tid = tenantId.trim();
  const base = `/fi-admin/${tid}`;
  const { kpis } = model;

  return (
    <div className="min-w-0 space-y-6">
      <FiPageHeader
        eyebrow="FI OS"
        title="PatientOS"
        description="Patient records, profiles, clinical timelines, consultations, treatment history and care coordination."
        titleId="patientos-dashboard-heading"
        primaryAction={
          <Link
            href={`${base}/patients/new`}
            className="inline-flex w-full items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 sm:w-auto"
          >
            New patient
          </Link>
        }
        secondaryAction={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
            {showCrmNav ? (
              <Link
                href={`${base}/crm`}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
              >
                Open LeadFlow
              </Link>
            ) : null}
            <Link
              href={`${base}/cases`}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
            >
              Open SurgeryOS
            </Link>
          </div>
        }
      />

      <div className="grid min-w-0 grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <FiKpiTile label="Total patients" value={String(kpis.totalPatients)} description="All patient records" />
        <FiKpiTile
          label="Recently added"
          value={String(kpis.recentlyAddedPatients)}
          description="New patients (30 days)"
          tone="info"
        />
        <FiKpiTile
          label="Active case journeys"
          value={String(kpis.patientsWithActiveCases)}
          description="Distinct patients with an open case"
          tone={kpis.patientsWithActiveCases > 0 ? "info" : "neutral"}
        />
        <FiKpiTile
          label="Upcoming bookings"
          value={String(kpis.patientsWithUpcomingBookings)}
          description="Patients with a future appointment"
          tone={kpis.patientsWithUpcomingBookings > 0 ? "info" : "neutral"}
        />
        <FiKpiTile
          label="Follow-up due"
          value={String(kpis.patientsNeedingFollowUp)}
          description="Patients with a due case follow-up"
          tone={kpis.patientsNeedingFollowUp > 0 ? "warning" : "neutral"}
        />
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="min-w-0 space-y-5 lg:col-span-8">
          <SectionCard
            title="Recent patients"
            description="Most recently updated patient records — open a profile for the full chart and timeline."
          >
            {model.recentPatients.length === 0 ? (
              <FiEmptyState title="No patients yet" description="Create a patient or convert a lead to populate this list." />
            ) : (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                {model.recentPatients.map((p) => (
                  <li key={p.patientId} className="flex flex-col gap-1 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <Link href={`${base}/patients/${p.patientId}`} className="font-medium text-sky-700 hover:underline">
                        {p.displayName}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {[p.email, p.phone].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-slate-500">Updated {formatWhen(p.lastActivityAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Active patient journeys"
            description="Patients with a non-terminal case on SurgeryOS — longitudinal care anchored on the patient record."
          >
            {model.activeJourneys.length === 0 ? (
              <FiEmptyState
                title="No active journeys"
                description="When cases are in progress for linked patients, they will appear here with a shortcut into SurgeryOS."
              />
            ) : (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                {model.activeJourneys.map((j) => (
                  <li key={`${j.patientId}-${j.caseId}`} className="flex flex-col gap-1 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <Link href={`${base}/patients/${j.patientId}`} className="font-medium text-sky-700 hover:underline">
                        {j.displayName}
                      </Link>
                      <p className="text-xs text-slate-500">
                        Case status: {j.caseStatusLabel}
                        <span className="text-slate-400"> · </span>
                        Updated {formatWhen(j.updatedAt)}
                      </p>
                    </div>
                    <Link
                      href={`${base}/cases/${j.caseId}`}
                      className="shrink-0 text-xs font-semibold text-sky-700 hover:underline"
                    >
                      Open case
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Upcoming consultations & appointments"
            description="Next scheduled bookings for patients in this tenant (non-cancelled)."
          >
            {model.upcomingBookings.length === 0 ? (
              <FiEmptyState
                title="No upcoming bookings"
                description="When appointments are scheduled in Bookings or the calendar, they will appear here."
              />
            ) : (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                {model.upcomingBookings.map((b) => (
                  <li key={b.bookingId} className="flex flex-col gap-1 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <Link href={`${base}/patients/${b.patientId}`} className="font-medium text-sky-700 hover:underline">
                        {b.displayName}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {formatWhen(b.startAt)}
                        {b.title ? ` · ${b.title}` : ""}
                        <span className="text-slate-400"> · </span>
                        {b.bookingStatus}
                      </p>
                    </div>
                    <Link
                      href={`${base}/appointments/${b.bookingId}`}
                      className="shrink-0 text-xs font-semibold text-sky-700 hover:underline"
                    >
                      View appointment
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Clinical timeline highlights"
            description="Recent curated timeline events across cases (fi_timeline_events)."
          >
            {model.timelineHighlights.length === 0 ? (
              <FiEmptyState
                title="No timeline rows yet"
                description="Milestones and clinical events appear here when the foundation timeline is populated for cases."
              />
            ) : (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                {model.timelineHighlights.map((h) => (
                  <li key={h.id} className="flex flex-col gap-1 px-3 py-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{h.title ?? h.eventKind}</p>
                      <p className="text-xs text-slate-500">
                        {h.eventKind}
                        {h.patientId ? (
                          <>
                            <span className="text-slate-400"> · </span>
                            <Link href={`${base}/patients/${h.patientId}`} className="text-sky-700 hover:underline">
                              {h.patientDisplayName ?? "Patient"}
                            </Link>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                      <span className="text-xs text-slate-500">{formatWhen(h.occurredAt)}</span>
                      <Link href={`${base}/cases/${h.caseId}`} className="text-xs font-semibold text-sky-700 hover:underline">
                        Case
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="min-w-0 space-y-4 lg:col-span-4">
          <FiCard>
            <h2 className="text-sm font-semibold text-slate-900">Quick actions</h2>
            <p className="mt-1 text-sm text-slate-600">Shortcuts use existing FI OS routes only.</p>
            <div className="mt-4 grid grid-cols-1 gap-3">
              <FiQuickActionCard
                title="New patient"
                description="Intake hub — create a patient record for this tenant."
                href={`${base}/patients/new`}
                icon={<UserPlus className="h-5 w-5" aria-hidden />}
                showOpenAffordance={false}
                className="!min-h-0 sm:!min-h-0"
              />
              {showBookingsBoard ? (
                <FiQuickActionCard
                  title="New appointment"
                  description="Book a consultation or visit from the operator booking flow."
                  href={`${base}/bookings/new`}
                  icon={<Stethoscope className="h-5 w-5" aria-hidden />}
                  showOpenAffordance={false}
                  className="!min-h-0 sm:!min-h-0"
                />
              ) : (
                <FiQuickActionCard
                  title="New appointment"
                  description="Scheduling access is required to create bookings from PatientOS."
                  disabled
                  disabledReason="Enable bookings / CRM operator access to use this shortcut."
                  icon={<Stethoscope className="h-5 w-5 text-slate-400" aria-hidden />}
                  showOpenAffordance={false}
                  className="!min-h-0 sm:!min-h-0"
                />
              )}
              {showCrmNav ? (
                <FiQuickActionCard
                  title="Open LeadFlow"
                  description="CRM pipeline, leads, and commercial follow-up."
                  href={`${base}/crm`}
                  icon={<Users className="h-5 w-5" aria-hidden />}
                  showOpenAffordance={false}
                  className="!min-h-0 sm:!min-h-0"
                />
              ) : (
                <FiQuickActionCard
                  title="Open LeadFlow"
                  description="CRM workspace is not enabled for your role."
                  disabled
                  disabledReason="Ask an administrator for CRM shell access."
                  icon={<Users className="h-5 w-5 text-slate-400" aria-hidden />}
                  showOpenAffordance={false}
                  className="!min-h-0 sm:!min-h-0"
                />
              )}
              <FiQuickActionCard
                title="Open SurgeryOS"
                description="Case worklist, planning, procedures, and post-op."
                href={`${base}/cases`}
                icon={<ClipboardList className="h-5 w-5" aria-hidden />}
                showOpenAffordance={false}
                className="!min-h-0 sm:!min-h-0"
              />
              <FiQuickActionCard
                title="Open AuditOS"
                description="Report queue and audit decisions for this tenant."
                href={`${base}/audit`}
                icon={<ListChecks className="h-5 w-5" aria-hidden />}
                showOpenAffordance={false}
                className="!min-h-0 sm:!min-h-0"
              />
            </div>
          </FiCard>
        </div>
      </div>
    </div>
  );
}
