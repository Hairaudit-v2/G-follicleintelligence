import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { ConsultationOsSystemDiagnostics } from "@/src/components/fi-admin/consultations/ConsultationOsSystemDiagnostics";
import type { ConsultationDashboardPayload } from "@/src/lib/fiAdmin/consultationDashboardTypes";
import {
  buildClinicalPlanningQueueItems,
  buildConsultationAttentionPriorities,
  buildConsultationHealthCards,
  buildConsultationRecordSummaries,
  buildConversionFollowUpQueueItems,
  buildTodayConsultationFlowItems,
  consultationAttentionSeverityClass,
  consultationFlowStateLabel,
  consultationOsLinkButtonClass,
  flowStateBadgeClass,
  hasUrgentConsultationAttention,
} from "@/src/lib/fiAdmin/consultationPresentation";

function ConsultationOsPrimaryActions({ base }: { base: string }) {
  return (
    <div className="mt-6 flex flex-wrap gap-2">
      <Link
        href={`${base}/consultations/new`}
        className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-500 focus-visible:outline focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#081020]"
      >
        New consultation
      </Link>
      <Link href={`${base}/calendar`} className={consultationOsLinkButtonClass}>
        Open Calendar
      </Link>
      <Link href={`${base}/crm`} className={consultationOsLinkButtonClass}>
        Open LeadFlow
      </Link>
      <Link href={`${base}/patients`} className={consultationOsLinkButtonClass}>
        Open PatientOS
      </Link>
      <Link href={`${base}/doctor`} className={consultationOsLinkButtonClass}>
        Open Doctor Workspace
      </Link>
    </div>
  );
}

export function ConsultationOsDashboard({
  tenantId,
  payload,
  showDiagnosticsExpanded = false,
  sessionLabel,
}: {
  tenantId: string;
  payload: ConsultationDashboardPayload;
  showDiagnosticsExpanded?: boolean;
  sessionLabel?: string;
}) {
  const base = `/fi-admin/${tenantId}`;
  const healthCards = buildConsultationHealthCards(base, payload);
  const attentionItems = buildConsultationAttentionPriorities(base, payload, 5);
  const showCalmAttention = !hasUrgentConsultationAttention(attentionItems);
  const todayFlow = buildTodayConsultationFlowItems(base, payload, 8);
  const clinicalPlanning = buildClinicalPlanningQueueItems(base, payload, 5);
  const conversionQueue = buildConversionFollowUpQueueItems(base, payload, 5);
  const recentRecords = buildConsultationRecordSummaries(base, payload, 8);

  return (
    <div className="mx-auto min-w-0 max-w-[88rem] space-y-8 pb-10 sm:space-y-10 sm:pb-14">
      <DashboardCard elevated className="relative overflow-hidden p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(560px_260px_at_0%_0%,rgba(139,92,246,0.12),transparent_55%),radial-gradient(420px_200px_at_100%_100%,rgba(34,193,255,0.06),transparent_50%)]"
          aria-hidden
        />
        <div className="relative border-l-4 border-violet-400/80 pl-5 sm:pl-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-300/95">FI OS</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#F8FAFC] sm:text-4xl">Consultations</h1>
          <p className="mt-2 max-w-3xl text-base leading-relaxed text-[#94A3B8]">
            Clinical assessment, treatment planning, quote readiness, and patient follow-up across every consultation.
          </p>
          <ConsultationOsPrimaryActions base={base} />
        </div>
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6">
        <SectionHeader
          kicker="Health"
          title="Consultation health snapshot"
          description="Clinic-facing signals for preparation, clinical planning, and conversion readiness."
          className="mb-4"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {healthCards.map((card) => (
            <Link
              key={card.id}
              href={card.href ?? `${base}/consultations`}
              className="group flex min-w-0 flex-col rounded-xl border border-white/[0.08] bg-[#0c1220]/75 px-4 py-4 transition hover:border-violet-400/25"
            >
              <p className="text-sm font-semibold text-[#F8FAFC]">{card.label}</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-[#F8FAFC]">{card.value}</p>
              <p className="mt-2 text-xs leading-relaxed text-[#64748B]">{card.detail}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-violet-300/80 opacity-0 transition group-hover:opacity-100">
                View <ArrowRight className="h-3 w-3" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6">
        <SectionHeader
          kicker="Priorities"
          title="What needs consultation attention"
          description="Top consultation priorities ranked for clinical and commercial follow-through."
          className="mb-4"
        />
        {showCalmAttention ? (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden />
            <p className="text-sm leading-relaxed text-[#CBD5E1]">
              Consultation workflow is currently under control.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {attentionItems.map((item) => (
              <li key={item.id}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className={`flex items-start justify-between gap-4 rounded-xl border px-4 py-4 transition hover:border-violet-400/30 ${consultationAttentionSeverityClass(item.severity)}`}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[#F8FAFC]">{item.headline}</p>
                      {item.detail ? <p className="mt-1 text-sm text-[#94A3B8]">{item.detail}</p> : null}
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-violet-300/70" aria-hidden />
                  </Link>
                ) : (
                  <div className={`rounded-xl border px-4 py-4 ${consultationAttentionSeverityClass(item.severity)}`}>
                    <p className="font-semibold text-[#F8FAFC]">{item.headline}</p>
                    {item.detail ? <p className="mt-1 text-sm text-[#94A3B8]">{item.detail}</p> : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6">
        <SectionHeader
          kicker="Today"
          title="Today&apos;s consultation flow"
          description="Lightweight view of today&apos;s consultations — open Calendar for full scheduling."
          className="mb-4"
        />
        {todayFlow.length === 0 ? (
          <p className="text-sm text-[#94A3B8]">No consultations scheduled for today.</p>
        ) : (
          <ul className="space-y-3">
            {todayFlow.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-white/[0.08] bg-[#0c1220]/60 px-4 py-4 sm:px-5 sm:py-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[#F8FAFC]">{item.patientOrLeadName}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${flowStateBadgeClass(item.flowState)}`}
                      >
                        {consultationFlowStateLabel(item.flowState)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#94A3B8]">
                      <span>{item.timeLabel}</span>
                      <span>{item.consultationType}</span>
                      <span>Clinical: {item.clinicalStatus}</span>
                      {item.commercialStatus ? <span>Commercial: {item.commercialStatus}</span> : null}
                    </div>
                    <p className="text-sm text-[#CBD5E1]">{item.nextAction}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Link href={item.consultationHref} className={consultationOsLinkButtonClass}>
                      {item.primaryActionLabel}
                    </Link>
                    {item.patientHref ? (
                      <Link href={item.patientHref} className={consultationOsLinkButtonClass}>
                        Open patient
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
          kicker="Clinical"
          title="Clinical planning queue"
          description="Consultations needing clinical judgement before treatment recommendation."
          className="mb-4"
        />
        {clinicalPlanning.length === 0 ? (
          <p className="text-sm text-[#94A3B8]">
            Clinical planning items will appear here as consultation assessments are captured.
          </p>
        ) : (
          <ul className="space-y-3">
            {clinicalPlanning.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.consultationHref}
                  className="flex items-start justify-between gap-4 rounded-xl border border-white/[0.08] bg-[#0c1220]/60 px-4 py-4 transition hover:border-violet-400/25"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[#F8FAFC]">{item.patientOrLeadName}</p>
                    <p className="mt-1 text-xs text-[#64748B]">{item.consultationType}</p>
                    <p className="mt-2 text-sm text-violet-200/90">{item.planningLabel}</p>
                    <p className="mt-1 text-sm text-[#94A3B8]">{item.nextAction}</p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-violet-300/70" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6">
        <SectionHeader
          kicker="Conversion"
          title="Conversion and follow-up queue"
          description="Consultation outcomes needing commercial follow-up — not a full CRM view."
          className="mb-4"
        />
        {conversionQueue.length === 0 ? (
          <p className="text-sm text-[#94A3B8]">No conversion follow-ups flagged right now.</p>
        ) : (
          <ul className="space-y-3">
            {conversionQueue.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-white/[0.08] bg-[#0c1220]/60 px-4 py-4 sm:px-5 sm:py-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold text-[#F8FAFC]">{item.patientOrLeadName}</p>
                    <p className="text-sm text-amber-200/90">{item.followUpLabel}</p>
                    <p className="text-sm text-[#94A3B8]">{item.nextAction}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {item.consultationHref ? (
                      <Link href={item.consultationHref} className={consultationOsLinkButtonClass}>
                        Open consultation
                      </Link>
                    ) : null}
                    {item.leadHref ? (
                      <Link href={item.leadHref} className={consultationOsLinkButtonClass}>
                        Open lead
                      </Link>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4">
          <Link href={`${base}/crm`} className={consultationOsLinkButtonClass}>
            Open LeadFlow
          </Link>
        </div>
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeader
            kicker="Records"
            title="Consultation records"
            description="Recent consultations with status and next action."
          />
          <Link href={`${base}/consultations?view=list`} className={consultationOsLinkButtonClass}>
            View all consultations
          </Link>
        </div>
        {recentRecords.length === 0 ? (
          <p className="text-sm text-[#94A3B8]">No consultation records yet.</p>
        ) : (
          <ul className="space-y-3">
            {recentRecords.map((record) => (
              <li key={record.id}>
                <Link
                  href={record.consultationHref}
                  className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-[#0c1220]/60 px-4 py-4 transition hover:border-violet-400/25 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[#F8FAFC]">{record.patientOrLeadName}</p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#64748B]">
                      <span>{record.dateLabel}</span>
                      <span>{record.statusLabel}</span>
                      {record.treatmentInterest ? <span>{record.treatmentInterest}</span> : null}
                      {record.assignedClinician ? <span>{record.assignedClinician}</span> : null}
                    </div>
                    <p className="mt-1 text-sm text-[#94A3B8]">{record.nextAction}</p>
                  </div>
                  <ArrowRight className="hidden h-4 w-4 shrink-0 text-violet-300/70 sm:block" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`${base}/consultations?view=list`} className={consultationOsLinkButtonClass}>
            List view
          </Link>
          <Link href={`${base}/consultation-conversion`} className={consultationOsLinkButtonClass}>
            Conversion board
          </Link>
        </div>
      </DashboardCard>

      <ConsultationOsSystemDiagnostics
        tenantId={tenantId}
        payload={payload}
        showDiagnosticsExpanded={showDiagnosticsExpanded}
        sessionLabel={sessionLabel}
      />
    </div>
  );
}
