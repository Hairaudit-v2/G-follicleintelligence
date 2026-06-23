import Link from "next/link";
import { AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";

import { CrmLeadIndexViewTabs } from "@/src/components/fi/crm/CrmLeadIndexViewTabs";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { LeadFlowNewLeadButton } from "@/src/components/fi-admin/leadflow/LeadFlowNewLeadButton";
import { LeadFlowSystemDiagnostics } from "@/src/components/fi-admin/leadflow/LeadFlowSystemDiagnostics";
import type { LeadFlowDashboardPayload } from "@/src/lib/fiAdmin/leadFlowDashboardTypes";
import {
  attentionSeverityClass,
  buildAtRiskLeadItems,
  buildBookingReadinessItems,
  buildConversionSnapshotMetrics,
  buildLeadFlowAttentionPriorities,
  buildLeadFlowHealthCards,
  buildRecentLeadActivity,
  formatLeadFlowDateTime,
  hasUrgentLeadFlowAttention,
  leadFlowLinkButtonClass,
  readinessBadgeClass,
} from "@/src/lib/fiAdmin/leadFlowPresentation";
import type { ParsedCrmLeadListQuery } from "@/src/lib/crm/crmLeadListQuery";
import type { CrmShellClinicOption, CrmShellOrgOption, CrmShellUserPickerOption } from "@/src/lib/crm/types";

function LeadFlowPrimaryActions({ base }: { base: string }) {
  return (
    <div className="mt-6 flex flex-wrap gap-2">
      <LeadFlowNewLeadButton />
      <Link href={`${base}/calendar`} className={leadFlowLinkButtonClass}>
        Open Calendar
      </Link>
      <Link href={`${base}/consultations`} className={leadFlowLinkButtonClass}>
        Open Consultations
      </Link>
      <Link href={`${base}/consultation-conversion`} className={leadFlowLinkButtonClass}>
        Open Conversion Board
      </Link>
      <Link href={`${base}/settings/imports/hubspot`} className={leadFlowLinkButtonClass}>
        Import leads
      </Link>
    </div>
  );
}

export function LeadFlowDashboard({
  tenantId,
  payload,
  owners,
  scope,
  query,
  showDiagnosticsExpanded = false,
  sessionLabel,
}: {
  tenantId: string;
  payload: LeadFlowDashboardPayload;
  owners: CrmShellUserPickerOption[];
  scope: { organisations: CrmShellOrgOption[]; clinics: CrmShellClinicOption[] };
  query: ParsedCrmLeadListQuery;
  showDiagnosticsExpanded?: boolean;
  sessionLabel?: string;
}) {
  const base = `/fi-admin/${tenantId}`;
  const healthCards = buildLeadFlowHealthCards(base, payload);
  const attentionItems = buildLeadFlowAttentionPriorities(base, payload, 5);
  const showCalmAttention = !hasUrgentLeadFlowAttention(attentionItems);
  const bookingItems = buildBookingReadinessItems(base, payload, 5);
  const atRiskItems = buildAtRiskLeadItems(base, payload, 5);
  const conversionMetrics = buildConversionSnapshotMetrics(payload.conversionKpis, payload.conversionLostCount);
  const recentActivity = buildRecentLeadActivity(base, payload.recentActivity, 8);

  return (
    <div className="mx-auto min-w-0 max-w-[88rem] space-y-8 pb-10 sm:space-y-10 sm:pb-14">
      <DashboardCard elevated className="relative overflow-hidden p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(560px_260px_at_0%_0%,rgba(34,193,255,0.11),transparent_55%),radial-gradient(420px_200px_at_100%_100%,rgba(124,58,237,0.07),transparent_50%)]"
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="border-l-4 border-[#22C1FF]/80 pl-5 sm:pl-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#22C1FF]/95">FI OS</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#F8FAFC] sm:text-4xl">LeadFlow</h1>
            <p className="mt-2 max-w-3xl text-base leading-relaxed text-[#94A3B8]">
              Consultation conversion, follow-up priority, booking readiness, and revenue opportunity across every
              enquiry.
            </p>
            <LeadFlowPrimaryActions base={base} />
          </div>
          <CrmLeadIndexViewTabs tenantId={tenantId} query={query} variant="dark" />
        </div>
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6">
        <SectionHeader
          kicker="Health"
          title="Conversion health"
          description="Clinic-facing signals for enquiry momentum, follow-up rhythm, and booking readiness."
          className="mb-4"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {healthCards.map((card) => (
            <Link
              key={card.id}
              href={card.href ?? `${base}/crm`}
              className="group flex min-w-0 flex-col rounded-xl border border-white/[0.08] bg-[#0c1220]/75 px-4 py-4 transition hover:border-[#22C1FF]/25"
            >
              <p className="text-sm font-semibold text-[#F8FAFC]">{card.label}</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-[#F8FAFC]">{card.value}</p>
              <p className="mt-2 text-xs leading-relaxed text-[#64748B]">{card.detail}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#22C1FF]/80 opacity-0 transition group-hover:opacity-100">
                View <ArrowRight className="h-3 w-3" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6">
        <SectionHeader
          kicker="Priorities"
          title="What needs attention"
          description="Top conversion priorities ranked for clinic owners — act here first."
          className="mb-4"
        />
        {showCalmAttention ? (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden />
            <p className="text-sm leading-relaxed text-[#CBD5E1]">
              No urgent lead follow-ups detected. Keep response times tight to protect conversion.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {attentionItems.map((item) => (
              <li key={item.id}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className={`flex items-start justify-between gap-4 rounded-xl border px-4 py-4 transition hover:border-[#22C1FF]/30 ${attentionSeverityClass(item.severity)}`}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[#F8FAFC]">{item.headline}</p>
                      {item.detail ? <p className="mt-1 text-sm text-[#94A3B8]">{item.detail}</p> : null}
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[#22C1FF]/70" aria-hidden />
                  </Link>
                ) : (
                  <div className={`rounded-xl border px-4 py-4 ${attentionSeverityClass(item.severity)}`}>
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
          kicker="Booking"
          title="Booking readiness"
          description="Leads closest to consultation booking — with a clear next step."
          className="mb-4"
        />
        {bookingItems.length === 0 ? (
          <p className="text-sm text-[#94A3B8]">Active leads will appear here as enquiries are captured and qualified.</p>
        ) : (
          <ul className="space-y-3">
            {bookingItems.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-white/[0.08] bg-[#0c1220]/60 px-4 py-4 sm:px-5 sm:py-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[#F8FAFC]">{item.leadName}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${readinessBadgeClass(item.readinessLabel)}`}
                      >
                        {item.readinessLabel}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#94A3B8]">
                      {item.sourceLabel ? <span>Source: {item.sourceLabel}</span> : null}
                      {item.treatmentInterest ? <span>Interest: {item.treatmentInterest}</span> : null}
                    </div>
                    <p className="text-sm text-[#CBD5E1]">{item.nextAction}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Link href={item.leadHref} className={leadFlowLinkButtonClass}>
                      Open lead
                    </Link>
                    <Link href={item.bookHref} className={leadFlowLinkButtonClass}>
                      Book consult
                    </Link>
                    <Link href={item.followUpHref} className={leadFlowLinkButtonClass}>
                      Send follow-up
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6">
        <SectionHeader
          kicker="Intervention"
          title="At-risk opportunities"
          description="Leads that may slip away without timely outreach."
          className="mb-4"
        />
        {atRiskItems.length === 0 ? (
          <p className="text-sm text-[#94A3B8]">No at-risk leads flagged right now.</p>
        ) : (
          <ul className="space-y-3">
            {atRiskItems.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.leadHref}
                  className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-4 py-4 transition hover:border-amber-400/35"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" aria-hidden />
                  <div className="min-w-0">
                    <p className="font-semibold text-[#F8FAFC]">{item.leadName}</p>
                    <p className="mt-1 text-sm text-[#94A3B8]">{item.message}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6">
        <SectionHeader
          kicker="Conversion"
          title="Consultation conversion snapshot"
          description="Lightweight funnel signals — open Conversion Board for full workflow."
          className="mb-4"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {conversionMetrics.map((metric) => (
            <div
              key={metric.id}
              className="rounded-xl border border-white/[0.08] bg-[#0c1220]/75 px-4 py-4"
            >
              <p className="text-sm font-semibold text-[#F8FAFC]">{metric.label}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-[#F8FAFC]">{metric.value}</p>
              <p className="mt-2 text-xs leading-relaxed text-[#64748B]">{metric.detail}</p>
            </div>
          ))}
        </div>
        <p className="mt-4">
          <Link href={`${base}/consultation-conversion`} className="text-sm font-semibold text-[#22C1FF] hover:underline">
            Open Conversion Board →
          </Link>
        </p>
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6">
        <SectionHeader
          kicker="Activity"
          title="Recent lead activity"
          description="Enquiries, consultations, follow-ups, and imports — newest first."
          className="mb-4"
        />
        {recentActivity.length === 0 ? (
          <p className="text-sm text-[#94A3B8]">
            Recent lead activity will appear here as enquiries, consultations, and follow-ups are captured.
          </p>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {recentActivity.map((row) => (
              <li key={row.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#F8FAFC]">{row.label}</p>
                  <p className="text-xs text-[#64748B]">{row.detail}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs text-[#94A3B8]">
                  <time dateTime={row.occurredAt}>{formatLeadFlowDateTime(row.occurredAt)}</time>
                  {row.leadHref ? (
                    <Link href={row.leadHref} className="font-semibold text-[#22C1FF] hover:underline">
                      Open
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>

      <LeadFlowSystemDiagnostics
        tenantId={tenantId}
        payload={payload}
        owners={owners}
        scope={scope}
        showDiagnosticsExpanded={showDiagnosticsExpanded}
        sessionLabel={sessionLabel}
      />
    </div>
  );
}
