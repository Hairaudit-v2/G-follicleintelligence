import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { PatientOsSystemDiagnostics } from "@/src/components/fi-admin/patients/PatientOsSystemDiagnostics";
import type { PatientDirectorySummary } from "@/src/lib/patients/patientDirectoryLoader";
import type { PatientOsOverviewModel } from "@/src/lib/patients/patientOsDashboardLoader.server";
import {
  buildActivePatientJourneyItems,
  buildFollowUpContinuityItems,
  buildJourneyStageOverview,
  buildPatientAttentionPriorities,
  buildPatientJourneyHealthCards,
  buildRecentPatientActivityItems,
  hasUrgentPatientAttention,
  journeyStageBadgeClass,
  patientAttentionSeverityClass,
  patientOsLinkButtonClass,
  resolvePatientTwinShortcutHref,
} from "@/src/lib/fiAdmin/patientPresentation";

function PatientOsPrimaryActions({
  base,
  twinHref,
  showBookingsBoard,
}: {
  base: string;
  twinHref: string;
  showBookingsBoard: boolean;
}) {
  return (
    <div className="mt-6 flex flex-wrap gap-2">
      <Link
        href={`${base}/patients/new`}
        className="inline-flex items-center justify-center rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-500 focus-visible:outline focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#081020]"
      >
        New patient
      </Link>
      <Link href={twinHref} className={patientOsLinkButtonClass}>
        Open Patient Twin
      </Link>
      <Link href={`${base}/consultations`} className={patientOsLinkButtonClass}>
        Open Consultations
      </Link>
      <Link href={`${base}/cases`} className={patientOsLinkButtonClass}>
        Open SurgeryOS
      </Link>
      <Link href={`${base}/audit`} className={patientOsLinkButtonClass}>
        Open Audit Intelligence
      </Link>
      {showBookingsBoard ? (
        <Link href={`${base}/calendar`} className={patientOsLinkButtonClass}>
          Open Calendar
        </Link>
      ) : null}
    </div>
  );
}

function LinkedRecordPill({ label, active }: { label: string; active: boolean }) {
  if (!active) return null;
  return (
    <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#94A3B8] ring-1 ring-white/[0.08]">
      {label}
    </span>
  );
}

export function PatientOsDashboard({
  tenantId,
  overview,
  summary,
  showBookingsBoard,
  showDiagnosticsExpanded = false,
  sessionLabel,
}: {
  tenantId: string;
  overview: PatientOsOverviewModel;
  summary: PatientDirectorySummary;
  showBookingsBoard: boolean;
  showDiagnosticsExpanded?: boolean;
  sessionLabel?: string;
}) {
  const base = `/fi-admin/${tenantId}`;
  const healthCards = buildPatientJourneyHealthCards(base, overview, summary);
  const attentionItems = buildPatientAttentionPriorities(base, overview, summary, 5);
  const showCalmAttention = !hasUrgentPatientAttention(attentionItems);
  const activeJourneys = buildActivePatientJourneyItems(base, overview, 8);
  const journeyStages = buildJourneyStageOverview(overview, summary);
  const followUpItems = buildFollowUpContinuityItems(base, overview, summary);
  const recentActivity = buildRecentPatientActivityItems(base, overview, 8);
  const twinHref = resolvePatientTwinShortcutHref(base, overview);

  return (
    <div className="mx-auto min-w-0 max-w-[88rem] space-y-8 pb-10 sm:space-y-10 sm:pb-14">
      <DashboardCard elevated className="relative overflow-hidden p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(560px_260px_at_0%_0%,rgba(34,193,255,0.12),transparent_55%),radial-gradient(420px_200px_at_100%_100%,rgba(99,102,241,0.06),transparent_50%)]"
          aria-hidden
        />
        <div className="relative border-l-4 border-cyan-400/80 pl-5 sm:pl-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300/95">FI OS</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#F8FAFC] sm:text-4xl">
            PatientOS
          </h1>
          <p className="mt-2 max-w-3xl text-base leading-relaxed text-[#94A3B8]">
            Patient journey coordination across consultations, treatment planning, surgery,
            follow-up, media, and outcomes.
          </p>
          <PatientOsPrimaryActions
            base={base}
            twinHref={twinHref}
            showBookingsBoard={showBookingsBoard}
          />
        </div>
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6">
        <SectionHeader
          kicker="Snapshot"
          title="Patient journey snapshot"
          description="Clinic-facing signals for active care, upcoming visits, and records needing attention."
          className="mb-4"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {healthCards.map((card) => (
            <Link
              key={card.id}
              href={card.href ?? `${base}/patients`}
              className="group flex min-w-0 flex-col rounded-xl border border-white/[0.08] bg-[#0c1220]/75 px-4 py-4 transition hover:border-cyan-400/25"
            >
              <p className="text-sm font-semibold text-[#F8FAFC]">{card.label}</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-[#F8FAFC]">
                {card.value}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-[#64748B]">{card.detail}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-cyan-300/80 opacity-0 transition group-hover:opacity-100">
                View <ArrowRight className="h-3 w-3" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6">
        <SectionHeader
          kicker="Priorities"
          title="What needs patient attention"
          description="Top patient journey priorities ranked for clinical and operational follow-through."
          className="mb-4"
        />
        {showCalmAttention ? (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden />
            <p className="text-sm leading-relaxed text-[#CBD5E1]">
              Patient journey flow is currently under control.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {attentionItems.map((item) => (
              <li key={item.id}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className={`flex items-start justify-between gap-4 rounded-xl border px-4 py-4 transition hover:border-cyan-400/30 ${patientAttentionSeverityClass(item.severity)}`}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[#F8FAFC]">{item.headline}</p>
                      {item.detail ? (
                        <p className="mt-1 text-sm text-[#94A3B8]">{item.detail}</p>
                      ) : null}
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-cyan-300/70" aria-hidden />
                  </Link>
                ) : (
                  <div
                    className={`rounded-xl border px-4 py-4 ${patientAttentionSeverityClass(item.severity)}`}
                  >
                    <p className="font-semibold text-[#F8FAFC]">{item.headline}</p>
                    {item.detail ? (
                      <p className="mt-1 text-sm text-[#94A3B8]">{item.detail}</p>
                    ) : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6">
        <SectionHeader
          kicker="Queue"
          title="Active patient journeys"
          description="Patients on an active care pathway — open the profile, twin, or linked SurgeryOS case."
          className="mb-4"
        />
        {activeJourneys.length === 0 ? (
          <p className="text-sm text-[#94A3B8]">
            Active patient journeys will appear when cases are linked to patient records on
            SurgeryOS.
          </p>
        ) : (
          <ul className="space-y-3">
            {activeJourneys.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-white/[0.08] bg-[#0c1220]/60 px-4 py-4 sm:px-5 sm:py-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[#F8FAFC]">{item.displayName}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${journeyStageBadgeClass(item.journeyStage)}`}
                      >
                        {item.journeyStageLabel}
                      </span>
                    </div>
                    <p className="text-sm text-[#CBD5E1]">{item.nextStepLabel}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#94A3B8]">
                      <span>Clinical: {item.clinicalStatus}</span>
                      {item.operationalBlocker ? (
                        <span className="text-amber-200/90">
                          Blocker: {item.operationalBlocker}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <LinkedRecordPill label="Consultation" active={item.linkedConsultation} />
                      <LinkedRecordPill label="Surgery" active={item.linkedSurgery} />
                      <LinkedRecordPill label="Audit" active={item.linkedAudit} />
                      <LinkedRecordPill label="Media" active={item.linkedMedia} />
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Link href={item.patientHref} className={patientOsLinkButtonClass}>
                      Open patient
                    </Link>
                    <Link href={item.twinHref} className={patientOsLinkButtonClass}>
                      Patient Twin
                    </Link>
                    {item.bookingHref && showBookingsBoard ? (
                      <Link href={item.bookingHref} className={patientOsLinkButtonClass}>
                        Book appointment
                      </Link>
                    ) : showBookingsBoard ? (
                      <Link href={`${base}/bookings/new`} className={patientOsLinkButtonClass}>
                        Book appointment
                      </Link>
                    ) : null}
                    <Link href={item.consultationHref} className={patientOsLinkButtonClass}>
                      Consultations
                    </Link>
                    {item.caseHref ? (
                      <Link href={item.caseHref} className={patientOsLinkButtonClass}>
                        Surgery case
                      </Link>
                    ) : null}
                    {item.linkedAudit ? (
                      <Link href={item.auditHref} className={patientOsLinkButtonClass}>
                        Audit evidence
                      </Link>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6">
        <SectionHeader
          kicker="Stages"
          title="Journey stages overview"
          description="Compact grouped view — not a full analytics dashboard."
          className="mb-4"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {journeyStages.map((stage) => (
            <div
              key={stage.id}
              className="rounded-xl border border-white/[0.08] bg-[#0c1220]/60 px-4 py-4"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-[#F8FAFC]">{stage.label}</p>
                <p className="text-2xl font-semibold tabular-nums text-[#F8FAFC]">{stage.count}</p>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[#64748B]">{stage.interpretation}</p>
            </div>
          ))}
        </div>
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6">
        <SectionHeader
          kicker="Continuity"
          title="Follow-up and care continuity"
          description="Connects conceptually to Doctor Workspace and Audit Intelligence — not a full clinical twin."
          className="mb-4"
        />
        {followUpItems.length === 0 ? (
          <p className="text-sm text-[#94A3B8]">
            Care continuity signals are clear across active patient journeys.
          </p>
        ) : (
          <ul className="space-y-3">
            {followUpItems.map((item) => (
              <li key={item.id}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="flex items-start justify-between gap-4 rounded-xl border border-white/[0.08] bg-[#0c1220]/60 px-4 py-4 transition hover:border-cyan-400/25"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[#F8FAFC]">
                        {item.label}
                        <span className="ml-2 tabular-nums text-cyan-300">{item.count}</span>
                      </p>
                      <p className="mt-1 text-sm text-[#94A3B8]">{item.detail}</p>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-cyan-300/70" aria-hidden />
                  </Link>
                ) : (
                  <div className="rounded-xl border border-white/[0.08] bg-[#0c1220]/60 px-4 py-4">
                    <p className="font-semibold text-[#F8FAFC]">{item.label}</p>
                    <p className="mt-1 text-sm text-[#94A3B8]">{item.detail}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`${base}/doctor`} className={patientOsLinkButtonClass}>
            Open Doctor Workspace
          </Link>
          <Link href={`${base}/audit`} className={patientOsLinkButtonClass}>
            Open Audit Intelligence
          </Link>
        </div>
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6">
        <SectionHeader
          kicker="Activity"
          title="Recent patient activity"
          description="Consultations, bookings, procedures, media, and reports as they are linked to patient records."
          className="mb-4"
        />
        {recentActivity.length === 0 ? (
          <p className="text-sm text-[#94A3B8]">
            Recent patient activity will appear as consultations, bookings, procedures, media, and
            reports are linked.
          </p>
        ) : (
          <ul className="space-y-2">
            {recentActivity.map((item) => (
              <li key={item.id}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="flex flex-col gap-1 rounded-lg border border-white/[0.06] px-3 py-3 transition hover:border-cyan-400/20 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#F8FAFC]">{item.activityLabel}</p>
                      <p className="text-xs text-[#64748B]">{item.patientName}</p>
                    </div>
                    <span className="shrink-0 text-xs text-[#94A3B8]">{item.whenLabel}</span>
                  </Link>
                ) : (
                  <div className="flex flex-col gap-1 rounded-lg border border-white/[0.06] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#F8FAFC]">{item.activityLabel}</p>
                      <p className="text-xs text-[#64748B]">{item.patientName}</p>
                    </div>
                    <span className="shrink-0 text-xs text-[#94A3B8]">{item.whenLabel}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeader
            kicker="Directory"
            title="Full patient list"
            description="Searchable patient directory with filters and pagination — not the default workspace view."
          />
          <Link href={`${base}/patients?view=list`} className={patientOsLinkButtonClass}>
            View all patients
          </Link>
        </div>
        <p className="text-sm text-[#94A3B8]">
          {summary.totalPatients > 0
            ? `${summary.totalPatients} patient records in this clinic. Open the list view for search, filters, slide-over preview, and full profiles.`
            : "No patients yet — create a patient or convert a lead to begin coordinating journeys."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`${base}/patients?view=list`} className={patientOsLinkButtonClass}>
            List view
          </Link>
          <Link href={`${base}/patients/new`} className={patientOsLinkButtonClass}>
            New patient
          </Link>
          {showBookingsBoard ? (
            <Link href={`${base}/appointments`} className={patientOsLinkButtonClass}>
              Appointments
            </Link>
          ) : null}
        </div>
      </DashboardCard>

      <PatientOsSystemDiagnostics
        tenantId={tenantId}
        overview={overview}
        summary={summary}
        showDiagnosticsExpanded={showDiagnosticsExpanded}
        sessionLabel={sessionLabel}
      />
    </div>
  );
}
