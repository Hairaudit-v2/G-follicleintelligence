"use client";

import { DashboardCard, InfoNotice, SectionHeader, StatCard } from "@/src/components/fi-admin/dashboard-ui";
import type { FiOsNavigationAuditPageModel } from "@/src/lib/fiOs/navigation/fiOsNavigationAudit.server";
import type { FiOs1BWorkflowDomain } from "@/src/lib/fiOs/navigation/fiOsNavigation1BDomainMap";
import type { NavigationDriftClassification } from "@/src/lib/fiOs/navigation/fiOsNavigationDriftAudit";
import { AlertTriangle, CheckCircle2, Compass, Layers } from "lucide-react";

const DOMAIN_ORDER: FiOs1BWorkflowDomain[] = [
  "Today",
  "Calendar",
  "Front Desk",
  "Patients",
  "Pipeline",
  "Clinical",
  "Surgery",
  "Finance",
  "Team",
  "Reports",
  "Settings",
];

function classificationTone(c: NavigationDriftClassification): string {
  switch (c) {
    case "aligned":
      return "text-emerald-300";
    case "duplicate_surface":
    case "wrong_domain":
      return "text-rose-300";
    case "legacy_label":
    case "too_granular_primary":
    case "needs_grouping":
      return "text-amber-200";
    default:
      return "text-slate-400";
  }
}

export function FiOsNavigationDriftAuditSurface({ model }: { model: FiOsNavigationAuditPageModel }) {
  const { report, summary } = model;

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-16">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">D6G-A · Audit only</p>
        <h1 className="text-2xl font-semibold text-slate-50">FI OS navigation drift</h1>
        <p className="max-w-3xl text-sm text-slate-400">
          Compares the current All areas drawer, collapsed rail, and command palette catalog against
          FI-UX-REBUILD-1B workflow domains. No navigation changes are applied from this page.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Nav items catalogued" value={String(summary.totalItems)} icon={<Layers className="h-5 w-5" />} />
        <StatCard label="Aligned with 1B" value={String(summary.alignedCount)} icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label="Drift signals" value={String(summary.driftCount)} icon={<AlertTriangle className="h-5 w-5" />} />
        <StatCard
          label="D6 primary rail slots"
          value={`${report.d6PrimaryRailRecommendation.length}/6`}
          icon={<Compass className="h-5 w-5" />}
        />
      </div>

      <DashboardCard className="p-6" elevated>
        <SectionHeader title="Recommended D6G primary rail" description="Target candidates — not enforced yet." />
        <div className="mt-4 flex flex-wrap gap-2">
          {report.d6PrimaryRailRecommendation.map((slot) => (
            <span
              key={slot}
              className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-100"
            >
              {slot}
            </span>
          ))}
        </div>
      </DashboardCard>

      {report.duplicateDomains.length > 0 ? (
        <InfoNotice variant="warning" title="Duplicate 1B domains in primary sidebar">
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
            {report.duplicateDomains.map((d) => (
              <li key={d.domain}>
                <strong>{d.domain}</strong>: {d.itemIds.join(", ")}
              </li>
            ))}
          </ul>
        </InfoNotice>
      ) : null}

      <DashboardCard className="p-6" elevated>
        <SectionHeader title="1B domain mapping" description="Current catalog grouped by workflow domain." />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {DOMAIN_ORDER.map((domain) => {
            const rows = report.byDomain1B[domain] ?? [];
            if (!rows.length) return null;
            return (
              <div key={domain} className="rounded-lg border border-white/10 bg-[#0c1426]/60 p-4">
                <h3 className="text-sm font-semibold text-slate-100">
                  {domain}{" "}
                  <span className="font-normal text-slate-500">({rows.length})</span>
                </h3>
                <ul className="mt-2 space-y-1 text-xs text-slate-400">
                  {rows.map((r) => (
                    <li key={`${domain}-${r.id}`}>
                      {r.label}{" "}
                      <span className="text-slate-600">
                        · {r.id}
                        {r.source === "primary_sub_item" ? " (sub)" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </DashboardCard>

      {report.legacyLabels.length > 0 ? (
        <DashboardCard className="p-6" elevated>
          <SectionHeader title="Legacy labels" description="Module/OS language in staff-facing nav." />
          <ul className="mt-4 space-y-2 text-sm">
            {report.legacyLabels.map((l) => (
              <li key={l.id} className="rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                <span className="font-medium text-amber-100">{l.label}</span>{" "}
                <span className="text-slate-500">({l.id})</span>
                {l.reasons.length ? (
                  <p className="mt-1 text-xs text-slate-400">{l.reasons.join(" · ")}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </DashboardCard>
      ) : null}

      <DashboardCard className="p-6" elevated>
        <SectionHeader
          title="Move to More (recommendation)"
          description="Primary sidebar rows that should not stay on the collapsed rail."
        />
        <p className="mt-2 text-sm text-slate-400">{report.itemsForMore.join(", ") || "—"}</p>
      </DashboardCard>

      <DashboardCard className="p-6" elevated>
        <SectionHeader
          title="Hidden but route-preserved"
          description="Direct URLs that must remain reachable."
        />
        <ul className="mt-3 max-h-48 overflow-y-auto text-xs text-slate-500">
          {report.hiddenRoutePreserved.map((id) => (
            <li key={id}>{id}</li>
          ))}
        </ul>
      </DashboardCard>

      <InfoNotice variant="danger" title="Risky changes — proceed with caution">
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
          {report.riskyChanges.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </InfoNotice>

      <DashboardCard className="p-6" elevated>
        <SectionHeader title="Full drift register" description="Every catalogued nav item." />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-slate-500">
                <th className="py-2 pr-3">Label</th>
                <th className="py-2 pr-3">Id</th>
                <th className="py-2 pr-3">1B domain</th>
                <th className="py-2 pr-3">Drawer group</th>
                <th className="py-2 pr-3">Classification</th>
                <th className="py-2 pr-3">D6 placement</th>
              </tr>
            </thead>
            <tbody>
              {report.items.map((row) => (
                <tr key={`${row.item.source}-${row.item.id}`} className="border-b border-white/5">
                  <td className="py-2 pr-3 text-slate-200">{row.item.label}</td>
                  <td className="py-2 pr-3 font-mono text-slate-500">{row.item.id}</td>
                  <td className="py-2 pr-3 text-slate-400">{row.domain1B ?? "—"}</td>
                  <td className="py-2 pr-3 text-slate-500">{row.item.workflowGroupLabel ?? "—"}</td>
                  <td className={`py-2 pr-3 ${classificationTone(row.classification)}`}>
                    {row.classification}
                  </td>
                  <td className="py-2 pr-3 text-slate-500">{row.d6Placement}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DashboardCard>
    </div>
  );
}