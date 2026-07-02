"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertCircle, ArrowRight, CheckCircle2, FileCheck } from "lucide-react";

import { AuditOsSystemDiagnostics } from "@/src/components/fi-admin/audit/AuditOsSystemDiagnostics";
import { DashboardCard, SectionHeader, StatCard } from "@/src/components/fi-admin/dashboard-ui";
import { FiEmptyState } from "@/src/components/fi-design/FiEmptyState";
import type { AuditDashboardSnapshot } from "@/src/lib/fiAdmin/auditDashboardTypes";
import {
  auditOsLinkButtonClass,
  buildAuditAttentionPriorities,
  buildAuditHealthCards,
  buildEvidenceReadinessSummary,
  buildOutcomeSnapshotAreas,
  buildQualityTrendMetrics,
  buildRecentAuditCases,
  formatAuditDateTime,
  hasAuditWorkspaceData,
  hasUrgentAuditAttention,
} from "@/src/lib/fiAdmin/auditIntelligencePresentation";

type DashboardResponse = ({ ok: true } & AuditDashboardSnapshot) | { ok: false; error?: string };

function statusBadgeClass(label: string): string {
  if (label === "Released" || label === "Issued" || label === "Complete") {
    return "bg-emerald-500/15 text-emerald-100 ring-emerald-500/30";
  }
  if (label === "Evidence needed" || label === "Incomplete" || label === "Needs revision") {
    return "bg-amber-500/15 text-amber-100 ring-amber-400/35";
  }
  if (label === "Awaiting review" || label === "Ready for review" || label === "Under review") {
    return "bg-sky-500/15 text-sky-200 ring-sky-500/30";
  }
  return "bg-white/[0.06] text-[#CBD5E1] ring-white/10";
}

function outcomeStatusClass(status: "strong" | "building" | "limited"): string {
  if (status === "strong") return "text-emerald-300 ring-emerald-500/30";
  if (status === "building") return "text-sky-200 ring-sky-500/30";
  return "text-slate-400 ring-white/10";
}

function outcomeStatusLabel(status: "strong" | "building" | "limited"): string {
  if (status === "strong") return "Strong";
  if (status === "building") return "Building";
  return "Limited";
}

export function AuditOsDashboard({
  showDiagnosticsExpanded = false,
}: {
  showDiagnosticsExpanded?: boolean;
}) {
  const params = useParams();
  const tenantId = (params.tenantId as string)?.trim() ?? "";
  const base = `/fi-admin/${tenantId}`;

  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!tenantId) return;
    setLoading(true);
    fetch(`/api/fi/audit/dashboard?tenant_id=${encodeURIComponent(tenantId)}`)
      .then((r) => r.json() as Promise<DashboardResponse>)
      .then(setData)
      .catch(() => setData({ ok: false, error: "Request failed." }))
      .finally(() => setLoading(false));
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!tenantId) {
    return <p className="text-sm text-[#94A3B8]">Missing tenant.</p>;
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-dashed border-white/[0.1] bg-[#0c1220]/60 px-4 py-10 text-center text-sm text-[#94A3B8]">
        Loading quality review…
      </div>
    );
  }

  if (!data || !data.ok) {
    return (
      <FiEmptyState
        title="Could not load dashboard"
        description={
          data && !data.ok ? (data.error ?? "Unknown error.") : "No response from server."
        }
        action={
          <button
            type="button"
            onClick={() => load()}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
          >
            Retry
          </button>
        }
      />
    );
  }

  const snapshot: AuditDashboardSnapshot = {
    kpis: data.kpis,
    queue: data.queue,
    recent_audit_activity: data.recent_audit_activity,
    pipeline: data.pipeline,
  };

  const healthCards = buildAuditHealthCards(snapshot);
  const attentionItems = buildAuditAttentionPriorities(base, snapshot, 5);
  const showCalmAttention = !hasUrgentAuditAttention(attentionItems);
  const outcomeAreas = buildOutcomeSnapshotAreas(snapshot);
  const evidence = buildEvidenceReadinessSummary(data.kpis);
  const recentCases = buildRecentAuditCases(data.queue, data.recent_audit_activity, 8);
  const qualityTrends = buildQualityTrendMetrics(data.kpis);
  const hasData = hasAuditWorkspaceData(snapshot);
  const pendingAnchor = data.kpis.pending_reviews > 0 ? "#recent-audit-cases" : undefined;

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
          <h1
            id="auditos-dashboard-heading"
            className="mt-3 text-3xl font-semibold tracking-tight text-[#F8FAFC] sm:text-4xl"
          >
            Quality review
          </h1>
          <p className="mt-2 max-w-3xl text-base leading-relaxed text-[#94A3B8]">
            Clinical quality, outcome review, patient evidence, and readiness across surgical
            cases.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/hair-audit/admin" className={auditOsLinkButtonClass}>
              Open HairAudit
            </Link>
            <Link href={`${base}/cases`} className={auditOsLinkButtonClass}>
              Open cases
            </Link>
            <Link href={`${base}/foundation-integrity`} className={auditOsLinkButtonClass}>
              Open health record
            </Link>
            <Link href={`${base}/cases`} className={auditOsLinkButtonClass}>
              Open surgery
            </Link>
            {pendingAnchor ? (
              <Link href={`${base}/audit${pendingAnchor}`} className={auditOsLinkButtonClass}>
                Review pending reports
              </Link>
            ) : (
              <span className={auditOsLinkButtonClass} title="No pending reports">
                Review pending reports
              </span>
            )}
          </div>
        </div>
      </DashboardCard>

      {!hasData ? (
        <DashboardCard className="p-5 sm:p-6">
          <FiEmptyState
            title="No audit data yet"
            description="When surgical cases enter review and outcome reports are captured, clinical quality signals will appear here."
          />
        </DashboardCard>
      ) : null}

      <DashboardCard className="p-5 sm:p-6">
        <SectionHeader
          kicker="Health"
          title="Clinical audit health"
          description="Clinic-facing signals for outcome review, evidence completeness, and report readiness."
          className="mb-4"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {healthCards.map((card) => (
            <div
              key={card.id}
              className="flex min-w-0 flex-col rounded-xl border border-white/[0.08] bg-[#0c1220]/75 px-4 py-4"
            >
              <p className="text-sm font-semibold text-[#F8FAFC]">{card.label}</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-[#F8FAFC]">
                {card.value}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-[#64748B]">{card.detail}</p>
            </div>
          ))}
        </div>
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6">
        <SectionHeader
          kicker="Priorities"
          title="What needs attention"
          description="Top audit priorities ranked for clinical leads — act here first."
          className="mb-4"
        />
        {showCalmAttention ? (
          <div className="flex gap-3 rounded-xl border border-emerald-500/25 bg-emerald-950/20 px-4 py-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden />
            <p className="text-sm leading-relaxed text-emerald-50/95">
              No urgent audit issues detected. Continue capturing consistent evidence to strengthen
              outcome intelligence.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {attentionItems.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-[#0c1220]/75 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex min-w-0 gap-3">
                  <AlertCircle
                    className={`mt-0.5 h-5 w-5 shrink-0 ${
                      item.severity === "critical"
                        ? "text-orange-300"
                        : item.severity === "warning"
                          ? "text-amber-200"
                          : "text-sky-300"
                    }`}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#F8FAFC]">{item.headline}</p>
                    {item.detail ? (
                      <p className="mt-1 text-xs leading-relaxed text-[#64748B]">{item.detail}</p>
                    ) : null}
                  </div>
                </div>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#22C1FF] hover:text-[#22C1FF]/80"
                  >
                    Review
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6">
        <SectionHeader
          kicker="Outcomes"
          title="Outcome intelligence snapshot"
          description="Clinical interpretation of donor recovery, growth visibility, and follow-up coverage."
          className="mb-4"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {outcomeAreas.map((area) => (
            <div
              key={area.id}
              className="flex min-w-0 flex-col rounded-xl border border-white/[0.08] bg-[#0c1220]/75 px-4 py-4"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-[#F8FAFC]">{area.label}</p>
                {area.id !== "limited" ? (
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${outcomeStatusClass(area.status)}`}
                  >
                    {outcomeStatusLabel(area.status)}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[#94A3B8]">{area.summary}</p>
            </div>
          ))}
        </div>
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6">
        <SectionHeader
          kicker="Evidence"
          title="Evidence readiness"
          description="Photo, media, and report readiness across cases in audit review."
          className="mb-4"
        />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Complete evidence sets"
            value={evidence.completeSets}
            icon={<FileCheck size={18} />}
          />
          <StatCard label="Incomplete evidence sets" value={evidence.incompleteSets} />
          <StatCard label="Missing follow-up photos" value={evidence.missingFollowUp} />
          <StatCard label="Ready for auditor review" value={evidence.readyForReview} />
        </div>
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6" id="recent-audit-cases">
        <SectionHeader
          kicker="Cases"
          title="Recent audit cases"
          description="Surgical cases in active or recent audit review with evidence and report readiness."
          className="mb-4"
        />
        {recentCases.length === 0 ? (
          <p className="text-sm text-[#64748B]">
            No cases in audit review yet. Link surgery cases to begin outcome tracking.
          </p>
        ) : (
          <ul className="space-y-3">
            {recentCases.map((row) => (
              <li
                key={row.id}
                className="rounded-xl border border-white/[0.08] bg-[#0c1220]/75 px-4 py-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[#F8FAFC]">{row.patientLabel}</p>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${statusBadgeClass(row.statusLabel)}`}
                      >
                        {row.statusLabel}
                      </span>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
                      <div>
                        <dt className="text-[#64748B]">Evidence readiness</dt>
                        <dd className="mt-0.5 font-medium text-[#CBD5E1]">{row.evidenceLabel}</dd>
                      </div>
                      <div>
                        <dt className="text-[#64748B]">Report readiness</dt>
                        <dd className="mt-0.5 font-medium text-[#CBD5E1]">{row.reportLabel}</dd>
                      </div>
                      <div>
                        <dt className="text-[#64748B]">Last updated</dt>
                        <dd className="mt-0.5 font-medium text-[#CBD5E1]">
                          {formatAuditDateTime(row.updatedAt)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:shrink-0 lg:justify-end">
                    <Link href={`${base}/cases/${row.caseId}`} className={auditOsLinkButtonClass}>
                      Open case
                    </Link>
                    <Link href={`${base}/audit/${row.reportId}`} className={auditOsLinkButtonClass}>
                      Review evidence
                    </Link>
                    <Link href={`${base}/cases/${row.caseId}`} className={auditOsLinkButtonClass}>
                      View patient twin
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
          kicker="Trends"
          title="Quality trends"
          description="Simple outcome and evidence rates from completed audit activity."
          className="mb-4"
        />
        {qualityTrends ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {qualityTrends.map((metric) => (
              <StatCard key={metric.id} label={metric.label} value={metric.value} />
            ))}
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-[#64748B]">
            Quality trend intelligence will appear once more reports and follow-up evidence are
            completed.
          </p>
        )}
      </DashboardCard>

      <AuditOsSystemDiagnostics
        snapshot={snapshot}
        showDiagnosticsExpanded={showDiagnosticsExpanded}
      />
    </div>
  );
}
