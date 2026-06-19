"use client";

import type { ReactNode } from "react";
import { Activity, AlertTriangle, Building2, Camera, DollarSign, Globe2, Scissors, Shield } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  formatAlertTimestamp,
  formatCommandCentreMoney,
  formatCommandCentreNumber,
  formatCommandCentrePct,
  globalCommandCentreClasses,
} from "@/src/components/fi-admin/enterprise-demo/globalCommandCentreUi";
import type { GlobalCommandCentrePayload } from "@/src/lib/enterprise-demo/enterpriseDemoGlobalCommandCentreLoader.server";

type GlobalCommandCentreDashboardProps = {
  data: GlobalCommandCentrePayload;
};

function KpiTile({
  label,
  value,
  foot,
  icon,
}: {
  label: string;
  value: string;
  foot?: string;
  icon: ReactNode;
}) {
  return (
    <div className={globalCommandCentreClasses.kpiTile}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={globalCommandCentreClasses.kpiLabel}>{label}</div>
          <div className={globalCommandCentreClasses.kpiValue}>{value}</div>
          {foot ? <div className={globalCommandCentreClasses.kpiFoot}>{foot}</div> : null}
        </div>
        <div className="shrink-0 text-amber-400/70" aria-hidden>
          {icon}
        </div>
      </div>
    </div>
  );
}

function SnapshotMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className={globalCommandCentreClasses.metricTile}>
      <div className={globalCommandCentreClasses.metricLabel}>{label}</div>
      <div className={globalCommandCentreClasses.metricValue}>{value}</div>
    </div>
  );
}

export function GlobalCommandCentreDashboard({ data }: GlobalCommandCentreDashboardProps) {
  const { networkKpis, clinicRiskRows, alerts, surgicalSnapshot, outcomeSnapshot } = data;

  return (
    <div className={globalCommandCentreClasses.page}>
      <header className={globalCommandCentreClasses.header}>
        <div>
          <p className={globalCommandCentreClasses.kicker}>
            {data.codename} · Global Command Centre
          </p>
          <h1 className={globalCommandCentreClasses.title}>{data.tenantName}</h1>
          <p className={globalCommandCentreClasses.subtitle}>
            Enterprise franchise intelligence · {data.todayYmd} · read-only simulation
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={globalCommandCentreClasses.badge}>Phase 1G</span>
          <span className={globalCommandCentreClasses.badge}>Demo tenant · {data.tenantSlug}</span>
        </div>
      </header>

      <div className={globalCommandCentreClasses.readOnlyBanner}>
        Read-only dashboard — no mutations. Aggregates seeded Phase 1A–1F enterprise demo data across{" "}
        {networkKpis.activeClinics} clinics.
      </div>

      <section aria-label="Network KPIs">
        <div className={globalCommandCentreClasses.kpiGrid}>
          <KpiTile
            label="Active clinics"
            value={String(networkKpis.activeClinics)}
            icon={<Building2 className="h-4 w-4" />}
          />
          <KpiTile
            label="Surgeries today"
            value={String(networkKpis.surgeriesToday)}
            foot="Scheduled procedures"
            icon={<Scissors className="h-4 w-4" />}
          />
          <KpiTile
            label="This week"
            value={String(networkKpis.surgeriesThisWeek)}
            foot="7-day surgical load"
            icon={<Activity className="h-4 w-4" />}
          />
          <KpiTile
            label="Financial risk"
            value={String(networkKpis.openFinancialRiskAlerts)}
            foot="Open franchise alerts"
            icon={<DollarSign className="h-4 w-4" />}
          />
          <KpiTile
            label="Imaging issues"
            value={String(networkKpis.protocolImagingIssues)}
            foot="Protocol / imaging gaps"
            icon={<Camera className="h-4 w-4" />}
          />
          <KpiTile
            label="Graft survival"
            value={formatCommandCentrePct(networkKpis.averageGraftSurvivalPct)}
            foot="Network average"
            icon={<Shield className="h-4 w-4" />}
          />
          <KpiTile
            label="Collected"
            value={formatCommandCentreMoney(networkKpis.revenueCollectedCents, networkKpis.currency)}
            icon={<DollarSign className="h-4 w-4" />}
          />
          <KpiTile
            label="Outstanding"
            value={formatCommandCentreMoney(networkKpis.revenueOutstandingCents, networkKpis.currency)}
            icon={<AlertTriangle className="h-4 w-4" />}
          />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.85fr)]">
        <section className={globalCommandCentreClasses.panel} aria-label="Clinic risk table">
          <div className={globalCommandCentreClasses.panelHeader}>
            <p className={globalCommandCentreClasses.panelKicker}>Franchise risk</p>
            <h2 className={globalCommandCentreClasses.panelTitle}>Clinic risk matrix</h2>
          </div>
          <div className={globalCommandCentreClasses.panelBody}>
            <div className="overflow-x-auto">
              <table className={globalCommandCentreClasses.table}>
                <thead>
                  <tr>
                    <th className={globalCommandCentreClasses.th}>Clinic</th>
                    <th className={globalCommandCentreClasses.th}>Risk</th>
                    <th className={globalCommandCentreClasses.th}>Revenue</th>
                    <th className={globalCommandCentreClasses.th}>Imaging</th>
                    <th className={globalCommandCentreClasses.th}>Surgical quality</th>
                    <th className={globalCommandCentreClasses.th}>Staff / training</th>
                  </tr>
                </thead>
                <tbody>
                  {clinicRiskRows.map((row) => (
                    <tr key={row.clinicId}>
                      <td className={globalCommandCentreClasses.td}>
                        <div className="font-medium text-slate-100">{row.clinicName}</div>
                        <div className="text-[10px] text-slate-500">
                          {row.city}, {row.country}
                        </div>
                      </td>
                      <td className={globalCommandCentreClasses.td}>
                        <span className={globalCommandCentreClasses.riskPill(row.riskScore)}>{row.riskScore}</span>
                      </td>
                      <td className={cn(globalCommandCentreClasses.td, "text-slate-400")}>{row.revenueStatus}</td>
                      <td className={cn(globalCommandCentreClasses.td, "text-slate-400")}>{row.imagingCompliance}</td>
                      <td className={cn(globalCommandCentreClasses.td, "text-slate-400")}>{row.surgicalQualityStatus}</td>
                      <td className={cn(globalCommandCentreClasses.td, "text-slate-500 italic")}>
                        {row.staffTrainingStatus}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className={globalCommandCentreClasses.panel} aria-label="Alert feed">
          <div className={globalCommandCentreClasses.panelHeader}>
            <p className={globalCommandCentreClasses.panelKicker}>Live feed</p>
            <h2 className={globalCommandCentreClasses.panelTitle}>Network alerts</h2>
          </div>
          <div className={cn(globalCommandCentreClasses.panelBody, "space-y-3")}>
            {alerts.map((alert) => (
              <article key={alert.id} className={globalCommandCentreClasses.alertItem(alert.severity)}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {alert.clinicName} · {alert.domain}
                    </p>
                    <h3 className="mt-0.5 text-sm font-semibold text-slate-100">{alert.title}</h3>
                  </div>
                  <span className="shrink-0 text-[10px] text-slate-500">{formatAlertTimestamp(alert.occurredAt)}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{alert.summary}</p>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={globalCommandCentreClasses.panel} aria-label="Surgical intelligence snapshot">
          <div className={globalCommandCentreClasses.panelHeader}>
            <p className={globalCommandCentreClasses.panelKicker}>SurgeryOS</p>
            <h2 className={globalCommandCentreClasses.panelTitle}>Surgical intelligence snapshot</h2>
          </div>
          <div className={globalCommandCentreClasses.panelBody}>
            <div className={globalCommandCentreClasses.metricGrid}>
              <SnapshotMetric label="Grafts extracted" value={formatCommandCentreNumber(surgicalSnapshot.totalGraftsExtracted)} />
              <SnapshotMetric label="Grafts implanted" value={formatCommandCentreNumber(surgicalSnapshot.totalGraftsImplanted)} />
              <SnapshotMetric label="Total hairs" value={formatCommandCentreNumber(surgicalSnapshot.totalHairs)} />
              <SnapshotMetric
                label="Transection profile"
                value={formatCommandCentrePct(surgicalSnapshot.averageTransectionRatePct)}
              />
              <SnapshotMetric label="Reconciled" value={String(surgicalSnapshot.reconciliationCompleted)} />
              <SnapshotMetric label="Pending / mismatch" value={`${surgicalSnapshot.reconciliationPending} / ${surgicalSnapshot.reconciliationMismatch}`} />
            </div>
          </div>
        </section>

        <section className={globalCommandCentreClasses.panel} aria-label="Outcome audit snapshot">
          <div className={globalCommandCentreClasses.panelHeader}>
            <p className={globalCommandCentreClasses.panelKicker}>AuditOS</p>
            <h2 className={globalCommandCentreClasses.panelTitle}>Outcome / audit snapshot</h2>
          </div>
          <div className={globalCommandCentreClasses.panelBody}>
            <div className={globalCommandCentreClasses.metricGrid}>
              <SnapshotMetric label="Survival estimate" value={formatCommandCentrePct(outcomeSnapshot.averageSurvivalEstimatePct)} />
              <SnapshotMetric label="Donor recovery" value={formatCommandCentrePct(outcomeSnapshot.averageDonorRecoveryScore)} />
              <SnapshotMetric label="Satisfaction" value={formatCommandCentrePct(outcomeSnapshot.averageSatisfactionScore)} />
              <SnapshotMetric label="Approved audits" value={String(outcomeSnapshot.auditsApproved)} />
              <SnapshotMetric label="With warnings" value={String(outcomeSnapshot.auditsWithWarnings)} />
              <SnapshotMetric label="Incomplete follow-up" value={String(outcomeSnapshot.incompleteFollowUp)} />
            </div>
          </div>
        </section>
      </div>

      <footer className="flex items-center gap-2 text-[10px] text-slate-600">
        <Globe2 className="h-3.5 w-3.5 text-amber-400/50" aria-hidden />
        Generated {formatAlertTimestamp(data.generatedAt)} · Project {data.codename} enterprise simulation
      </footer>
    </div>
  );
}
