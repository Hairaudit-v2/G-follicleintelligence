"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { FinancialOsSystemDiagnostics } from "@/src/components/fi-admin/financial-os/FinancialOsSystemDiagnostics";
import { financialOsClasses } from "@/src/components/fi-admin/financial-os/financialOsUi";
import type { FinancialOsCommandCentrePayload } from "@/src/lib/financialOs/financialOsCommandCentreLoader.server";
import {
  buildCollectionPriorities,
  buildConsultationRevenueBridge,
  buildFinancialAttentionPriorities,
  buildFinancialHealthCards,
  buildFinancialReportNavCards,
  buildProcedureProfitabilitySummary,
  buildRecentFinancialActivity,
  financialAttentionSeverityClass,
  financialOsLinkButtonClass,
  fmtFinancialMoney,
  fmtFinancialWhen,
  hasUrgentFinancialAttention,
} from "@/src/lib/fiAdmin/financialPresentation";

function FinancialOsPrimaryActions({ base }: { base: string }) {
  const financialModule = `${base}/financial`;
  return (
    <div className="mt-6 flex flex-wrap gap-2">
      <Link href={`${base}/payments`} className={financialOsLinkButtonClass}>
        Open Payments Inbox
      </Link>
      <Link href={`${base}/crm?view=workspace`} className={financialOsLinkButtonClass}>
        Open LeadFlow
      </Link>
      <Link href={`${base}/surgery-os`} className={financialOsLinkButtonClass}>
        Open SurgeryOS
      </Link>
      <Link href={`${base}/analytics`} className={financialOsLinkButtonClass}>
        Open AnalyticsOS
      </Link>
      <Link href={`${financialModule}/payment-requests`} className={financialOsLinkButtonClass}>
        Create payment request
      </Link>
    </div>
  );
}

export function FinancialOsCommandCentreDashboard(props: {
  data: FinancialOsCommandCentrePayload;
  surgeryEconomicsFilterOptions?: {
    procedureTypes: string[];
    surgeonOptions: Array<{ value: string; label: string }>;
    clinicOptions: Array<{ value: string; label: string }>;
  };
  revenueAttributionFilterOptions?: {
    sources: string[];
    campaigns: string[];
    consultantOptions: Array<{ value: string; label: string }>;
    clinicOptions: Array<{ value: string; label: string }>;
    procedureTypes: string[];
  };
  showDiagnosticsExpanded?: boolean;
}) {
  const {
    data,
    surgeryEconomicsFilterOptions,
    revenueAttributionFilterOptions,
    showDiagnosticsExpanded = false,
  } = props;
  const base = `/fi-admin/${data.tenantId}`;

  const healthCards = buildFinancialHealthCards(base, data);
  const attentionItems = buildFinancialAttentionPriorities(base, data, 5);
  const showCalmAttention = !hasUrgentFinancialAttention(attentionItems);
  const collectionItems = buildCollectionPriorities(base, data, 5);
  const profitability = buildProcedureProfitabilitySummary(data);
  const consultationBridge = buildConsultationRevenueBridge(data);
  const recentActivity = buildRecentFinancialActivity(data, 8);
  const reportNavCards = buildFinancialReportNavCards(base);

  return (
    <div className="mx-auto min-w-0 max-w-[88rem] space-y-8 pb-10 sm:space-y-10 sm:pb-14">
      <DashboardCard elevated className="relative overflow-hidden p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(560px_260px_at_0%_0%,rgba(34,193,255,0.11),transparent_55%),radial-gradient(420px_200px_at_100%_100%,rgba(124,58,237,0.07),transparent_50%)]"
          aria-hidden
        />
        <div className="relative border-l-4 border-[#22C1FF]/80 pl-5 sm:pl-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#22C1FF]/95">
            FI OS
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#F8FAFC] sm:text-4xl">
            FinancialOS
          </h1>
          <p className="mt-2 max-w-3xl text-base leading-relaxed text-[#94A3B8]">
            Revenue, payments, deposits, profitability, and collection priorities across clinic
            operations.
          </p>
          <FinancialOsPrimaryActions base={base} />
        </div>
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6">
        <SectionHeader
          kicker="Health"
          title="Financial health snapshot"
          description="Clinic-facing signals for revenue, collection risk, and procedure profitability."
          className="mb-4"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {healthCards.map((card) => (
            <Link
              key={card.id}
              href={card.href ?? `${base}/financial-os`}
              className="group flex min-w-0 flex-col rounded-xl border border-white/[0.08] bg-[#0c1220]/75 px-4 py-4 transition hover:border-[#22C1FF]/25"
            >
              <p className="text-sm font-semibold text-[#F8FAFC]">{card.label}</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-[#F8FAFC]">
                {card.value}
              </p>
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
          title="What needs financial attention"
          description="Top collection and payment priorities ranked for clinic owners — act here first."
          className="mb-4"
        />
        {showCalmAttention ? (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden />
            <p className="text-sm leading-relaxed text-[#CBD5E1]">
              Financial workflow is currently under control.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {attentionItems.map((item) => (
              <li key={item.id}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className={`flex items-start justify-between gap-4 rounded-xl border px-4 py-4 transition hover:border-[#22C1FF]/30 ${financialAttentionSeverityClass(item.severity)}`}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[#F8FAFC]">{item.headline}</p>
                      {item.detail ? (
                        <p className="mt-1 text-sm text-[#94A3B8]">{item.detail}</p>
                      ) : null}
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[#22C1FF]/70" aria-hidden />
                  </Link>
                ) : (
                  <div
                    className={`rounded-xl border px-4 py-4 ${financialAttentionSeverityClass(item.severity)}`}
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
          kicker="Collection"
          title="Collection priorities"
          description="Patients and invoices needing payment action — send reminders or open the payments inbox."
          className="mb-4"
        />
        {collectionItems.length === 0 ? (
          <p className="text-sm text-[#94A3B8]">No outstanding collection priorities right now.</p>
        ) : (
          <ul className="space-y-3">
            {collectionItems.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-white/[0.08] bg-[#0c1220]/50 px-4 py-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#F8FAFC]">{item.patientLabel}</p>
                    <p className="mt-1 text-sm text-[#94A3B8]">
                      {fmtFinancialMoney(item.amountDueCents, data.currency)} · {item.dueStatus}
                      {item.relatedContext ? ` · ${item.relatedContext}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-[#64748B]">Next action: {item.nextAction}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={item.invoiceHref} className={financialOsLinkButtonClass}>
                      Open invoice
                    </Link>
                    {item.patientHref ? (
                      <Link href={item.patientHref} className={financialOsLinkButtonClass}>
                        Open patient
                      </Link>
                    ) : null}
                    <Link href={item.paymentRequestHref} className={financialOsLinkButtonClass}>
                      Send payment request
                    </Link>
                    <Link href={item.paymentsInboxHref} className={financialOsLinkButtonClass}>
                      Payments Inbox
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardCard className="p-5 sm:p-6">
          <SectionHeader
            kicker="Profitability"
            title="Procedure profitability snapshot"
            description="Completed procedures with margin data — owner-facing summary only."
            className="mb-4"
          />
          {profitability.hasLimitedData && profitability.completedWithData === 0 ? (
            <p className="text-sm leading-relaxed text-[#94A3B8]">
              Procedure profitability will strengthen as surgery costs, payments, and case records
              are captured.
            </p>
          ) : (
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className={financialOsClasses.subPanel}>
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                  Procedures with data
                </dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums text-[#F8FAFC]">
                  {profitability.completedWithData}
                </dd>
              </div>
              <div className={financialOsClasses.subPanel}>
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                  Average procedure revenue
                </dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums text-[#F8FAFC]">
                  {profitability.averageRevenueCents != null
                    ? fmtFinancialMoney(profitability.averageRevenueCents, data.currency)
                    : "—"}
                </dd>
              </div>
              <div className={financialOsClasses.subPanel}>
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                  Average margin
                </dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums text-[#F8FAFC]">
                  {profitability.averageMarginPct.toFixed(1)}%
                </dd>
              </div>
              <div className={financialOsClasses.subPanel}>
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                  Missing cost data
                </dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums text-[#F8FAFC]">
                  {profitability.casesMissingCostData}
                </dd>
              </div>
              {profitability.bestMarginSignal ? (
                <div className={financialOsClasses.subPanel}>
                  <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-400/80">
                    Best margin
                  </dt>
                  <dd className="mt-1 text-sm text-[#CBD5E1]">{profitability.bestMarginSignal}</dd>
                </div>
              ) : null}
              {profitability.worstMarginSignal ? (
                <div className={financialOsClasses.subPanel}>
                  <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-400/80">
                    Lowest margin
                  </dt>
                  <dd className="mt-1 text-sm text-[#CBD5E1]">{profitability.worstMarginSignal}</dd>
                </div>
              ) : null}
            </dl>
          )}
          {profitability.hasLimitedData && profitability.completedWithData > 0 ? (
            <p className="mt-4 text-xs text-[#64748B]">
              Procedure profitability will strengthen as surgery costs, payments, and case records
              are captured.
            </p>
          ) : null}
        </DashboardCard>

        <DashboardCard className="p-5 sm:p-6">
          <SectionHeader
            kicker="LeadFlow"
            title="Consultation-to-revenue bridge"
            description="Financial gaps between consultations, quotes, and booked procedures."
            className="mb-4"
          />
          <ul className="space-y-3">
            {consultationBridge.map((item) => (
              <li key={item.id} className={financialOsClasses.subPanel}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#F8FAFC]">{item.label}</p>
                    <p className="mt-1 text-xs text-[#64748B]">{item.detail}</p>
                  </div>
                  <p className="text-xl font-semibold tabular-nums text-[#F8FAFC]">{item.value}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <Link href={`${base}/crm?view=workspace`} className={financialOsLinkButtonClass}>
              Open LeadFlow
            </Link>
          </div>
        </DashboardCard>
      </div>

      <DashboardCard className="p-5 sm:p-6">
        <SectionHeader
          kicker="Activity"
          title="Recent financial activity"
          description="Latest payments, invoices, deposits, and adjustments across clinic operations."
          className="mb-4"
        />
        {recentActivity.length === 0 ? (
          <p className="text-sm text-[#94A3B8]">
            Recent financial activity will appear as payments, invoices, deposits, and procedure
            costs are captured.
          </p>
        ) : (
          <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-[#0c1220]/50">
            {recentActivity.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#F8FAFC]">{item.label}</p>
                  <p className="mt-0.5 text-xs text-[#94A3B8]">{item.detail}</p>
                </div>
                <time className="shrink-0 text-xs tabular-nums text-[#64748B]">
                  {fmtFinancialWhen(item.occurredAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6">
        <SectionHeader
          kicker="Tools"
          title="Reports and deeper finance tools"
          description="Navigate to detailed finance modules — detail lives on dedicated pages, not this overview."
          className="mb-4"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {reportNavCards.map((card) => (
            <Link
              key={card.id}
              href={card.href}
              className="group flex min-w-0 flex-col rounded-xl border border-white/[0.08] bg-[#0c1220]/75 px-4 py-4 transition hover:border-[#22C1FF]/25"
            >
              <p className="text-sm font-semibold text-[#F8FAFC]">{card.title}</p>
              <p className="mt-2 text-xs leading-relaxed text-[#64748B]">{card.description}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#22C1FF]/80 opacity-0 transition group-hover:opacity-100">
                Open <ArrowRight className="h-3 w-3" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </DashboardCard>

      <FinancialOsSystemDiagnostics
        data={data}
        surgeryEconomicsFilterOptions={surgeryEconomicsFilterOptions}
        revenueAttributionFilterOptions={revenueAttributionFilterOptions}
        showDiagnosticsExpanded={showDiagnosticsExpanded}
      />
    </div>
  );
}
