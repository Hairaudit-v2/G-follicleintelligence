import Link from "next/link";

import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { FiCard } from "@/src/components/fi-design/FiCard";
import { FiKpiTile } from "@/src/components/fi-design/FiKpiTile";
import type { PhotoProtocolAlert } from "@/src/lib/hair-intelligence/photoProtocols/protocolAlerts";
import { fiOsPatientTwinPhotoProtocolHref } from "@/src/lib/hair-intelligence/photoProtocols/protocolDeepLinks";
import type { PhotoProtocolAnalyticsSummary } from "@/src/lib/hair-intelligence/photoProtocols/protocolAnalytics";

import { SummaryTile } from "./patientTwinWorkspaceUi";

function pct(n: number): string {
  return `${Math.round(100 * n)}%`;
}

function formatDurationMs(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return `${h}h ${rem}m`;
}

function severityClass(s: PhotoProtocolAlert["severity"], dark = false): string {
  if (s === "high") return dark ? "text-rose-300" : "text-rose-300";
  if (s === "medium") return dark ? "text-amber-300" : "text-amber-200";
  return dark ? "text-slate-400" : "text-slate-300";
}

function ProtocolMetricsGrid({
  summary,
  dark,
}: {
  summary: PhotoProtocolAnalyticsSummary;
  dark: boolean;
}) {
  const tiles = [
    { label: "Sessions (window)", value: String(summary.total_sessions), sub: "Including cancelled" },
    {
      label: "Completion rate",
      value: pct(summary.protocol_completion_rate),
      sub: "Complete ÷ non-cancelled",
      tone: summary.protocol_completion_rate >= 0.85 ? ("info" as const) : ("warning" as const),
    },
    {
      label: "Incomplete sessions",
      value: String(summary.incomplete_session_count),
      sub: "Not complete & not cancelled",
      tone: summary.incomplete_session_count > 0 ? ("warning" as const) : ("neutral" as const),
    },
    { label: "Needs retake (req.)", value: String(summary.needs_retake_count), sub: "Required slot rows" },
    { label: "Needs review (req.)", value: String(summary.needs_review_count), sub: "Captured below strong threshold" },
    {
      label: "Most missed slot",
      value: summary.most_commonly_missed_slot_slug ?? "—",
      sub: "Required slots only",
    },
    {
      label: "Audit readiness",
      value: `${summary.audit_readiness_score}`,
      sub: "0–100 composite score",
      tone: summary.audit_readiness_score >= 80 ? ("info" as const) : ("warning" as const),
    },
    {
      label: "Avg. time to complete",
      value: formatDurationMs(summary.average_time_to_complete_ms),
      sub: "Completed sessions only",
    },
  ];

  if (dark) {
    return (
      <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <SummaryTile key={t.label} label={t.label} value={t.value} sub={t.sub} tone={t.tone} />
        ))}
      </div>
    );
  }

  return (
    <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
      {tiles.map((t) => (
        <FiKpiTile
          key={t.label}
          label={t.label}
          value={t.value}
          description={t.sub}
          tone={t.tone === "warning" ? "warning" : t.tone === "info" ? "info" : "neutral"}
        />
      ))}
    </div>
  );
}

export function PhotoProtocolAnalyticsCard({
  tenantId,
  summary,
  alerts,
  scanNote,
  variant = "light",
}: {
  tenantId: string;
  summary: PhotoProtocolAnalyticsSummary;
  alerts: PhotoProtocolAlert[];
  scanNote: string | null;
  variant?: "light" | "darkGlass";
}) {
  const tid = tenantId.trim();
  const topAlerts = alerts.slice(0, 8);
  const dark = variant === "darkGlass";
  const shell = dark ? (
    <DashboardCard className="p-4 sm:p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeader
          title="Smart clinical photography"
          description="Protocol completion, gaps, and operational alerts for audit-ready imaging."
        />
        <Link
          href={`/fi-admin/${encodeURIComponent(tid)}/patients`}
          className="shrink-0 text-sm font-medium text-cyan-300 hover:text-cyan-200 hover:underline"
        >
          PatientOS
        </Link>
      </div>
      {scanNote ? (
        <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-950/25 p-2 text-xs text-amber-100/90">{scanNote}</p>
      ) : null}
      <ProtocolMetricsGrid summary={summary} dark={dark} />
      <div className="mt-6">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Top alerts</h3>
        {topAlerts.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No computed alerts in this window.</p>
        ) : (
          <ul className="mt-2 max-h-56 divide-y divide-white/[0.06] overflow-auto rounded-lg border border-white/[0.06] bg-[#0a101f]/50 text-sm">
            {topAlerts.map((a, i) => (
              <li key={`${a.session_id}-${a.type}-${i}`} className="px-3 py-2 text-slate-400">
                <span className={`text-xs font-semibold uppercase ${severityClass(a.severity, true)}`}>{a.severity}</span>
                <span className="text-xs text-slate-400"> · {a.type.replace(/_/g, " ")}</span>
                <p className="mt-0.5 text-slate-200">{a.message}</p>
                <p className="mt-1 text-xs text-slate-500">{a.recommended_action}</p>
                {a.patient_id ? (
                  <Link
                    href={fiOsPatientTwinPhotoProtocolHref(tid, a.patient_id)}
                    className="mt-1 inline-block text-xs font-medium text-cyan-300 hover:text-cyan-200 hover:underline"
                  >
                    Open patient twin (protocol)
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </DashboardCard>
  ) : (
    <FiCard>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Clinical photography protocol</h2>
          <p className="mt-1 text-sm text-slate-400">
            Stage 8C analytics for Smart Clinical Photography — completion, gaps, and operational alerts.
          </p>
        </div>
        <Link
          href={`/fi-admin/${encodeURIComponent(tid)}/patients`}
          className="shrink-0 text-sm font-medium text-cyan-300 hover:underline"
        >
          PatientOS
        </Link>
      </div>
      {scanNote ? (
        <p className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/10 p-2 text-xs text-amber-200">{scanNote}</p>
      ) : null}
      <ProtocolMetricsGrid summary={summary} dark={false} />
      <div className="mt-6">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Top alerts</h3>
        {topAlerts.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No computed alerts in this window.</p>
        ) : (
          <ul className="mt-2 max-h-56 divide-y divide-white/[0.06] overflow-auto rounded-lg border border-white/[0.06] text-sm">
            {topAlerts.map((a, i) => (
              <li key={`${a.session_id}-${a.type}-${i}`} className="px-3 py-2 text-slate-300">
                <span className={`text-xs font-semibold uppercase ${severityClass(a.severity)}`}>{a.severity}</span>
                <span className="text-xs text-slate-500"> · {a.type.replace(/_/g, " ")}</span>
                <p className="mt-0.5 text-slate-200">{a.message}</p>
                <p className="mt-1 text-xs text-slate-500">{a.recommended_action}</p>
                {a.patient_id ? (
                  <Link
                    href={fiOsPatientTwinPhotoProtocolHref(tid, a.patient_id)}
                    className="mt-1 inline-block text-xs font-medium text-cyan-300 hover:underline"
                  >
                    Open Patient Twin (protocol)
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </FiCard>
  );

  return (
    <div id="fi-os-photo-protocol-analytics" className="scroll-mt-24">
      {shell}
    </div>
  );
}
