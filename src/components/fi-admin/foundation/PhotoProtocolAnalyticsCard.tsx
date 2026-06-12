import Link from "next/link";

import { FiCard } from "@/src/components/fi-design/FiCard";
import { FiKpiTile } from "@/src/components/fi-design/FiKpiTile";
import type { PhotoProtocolAlert } from "@/src/lib/hair-intelligence/photoProtocols/protocolAlerts";
import type { PhotoProtocolAnalyticsSummary } from "@/src/lib/hair-intelligence/photoProtocols/protocolAnalytics";

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

function severityClass(s: PhotoProtocolAlert["severity"]): string {
  if (s === "high") return "text-rose-800";
  if (s === "medium") return "text-amber-900";
  return "text-slate-700";
}

export function PhotoProtocolAnalyticsCard({
  tenantId,
  summary,
  alerts,
  scanNote,
}: {
  tenantId: string;
  summary: PhotoProtocolAnalyticsSummary;
  alerts: PhotoProtocolAlert[];
  scanNote: string | null;
}) {
  const tid = tenantId.trim();
  const topAlerts = alerts.slice(0, 8);

  return (
    <div id="fi-os-photo-protocol-analytics" className="scroll-mt-24">
      <FiCard>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Clinical photography protocol</h2>
          <p className="mt-1 text-sm text-slate-600">
            Stage 8C analytics for Smart Clinical Photography — completion, gaps, and operational alerts (FI OS + future HairAudit / Hair Longevity sources).
          </p>
        </div>
        <Link
          href={`/fi-admin/${encodeURIComponent(tid)}/patients`}
          className="shrink-0 text-sm font-medium text-sky-700 hover:underline"
        >
          PatientOS
        </Link>
      </div>

      {scanNote ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50/80 p-2 text-xs text-amber-950">{scanNote}</p>
      ) : null}

      <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        <FiKpiTile label="Sessions (window)" value={String(summary.total_sessions)} description="Including cancelled" tone="neutral" />
        <FiKpiTile
          label="Completion rate"
          value={pct(summary.protocol_completion_rate)}
          description="Complete ÷ non-cancelled"
          tone={summary.protocol_completion_rate >= 0.85 ? "info" : "warning"}
        />
        <FiKpiTile
          label="Incomplete sessions"
          value={String(summary.incomplete_session_count)}
          description="Not complete & not cancelled"
          tone={summary.incomplete_session_count > 0 ? "warning" : "neutral"}
        />
        <FiKpiTile label="Needs retake (req.)" value={String(summary.needs_retake_count)} description="Required slot rows" tone="neutral" />
        <FiKpiTile label="Needs review (req.)" value={String(summary.needs_review_count)} description="Captured below strong threshold" tone="neutral" />
        <FiKpiTile
          label="Most missed slot"
          value={summary.most_commonly_missed_slot_slug ?? "—"}
          description="Required slots only"
          tone="neutral"
        />
        <FiKpiTile
          label="Audit readiness"
          value={`${summary.audit_readiness_score}`}
          description="0–100 composite (see runbook)"
          tone={summary.audit_readiness_score >= 80 ? "info" : "warning"}
        />
        <FiKpiTile
          label="Avg. time to complete"
          value={formatDurationMs(summary.average_time_to_complete_ms)}
          description="Completed sessions only"
          tone="neutral"
        />
      </div>

      <div className="mt-6">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Top alerts</h3>
        {topAlerts.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No computed alerts in this window.</p>
        ) : (
          <ul className="mt-2 max-h-56 divide-y divide-slate-100 overflow-auto rounded-lg border border-slate-100 text-sm">
            {topAlerts.map((a, i) => (
              <li key={`${a.session_id}-${a.type}-${i}`} className="px-3 py-2 text-slate-700">
                <span className={`text-xs font-semibold uppercase ${severityClass(a.severity)}`}>{a.severity}</span>
                <span className="text-xs text-slate-500"> · {a.type.replace(/_/g, " ")}</span>
                <p className="mt-0.5 text-slate-800">{a.message}</p>
                <p className="mt-1 text-xs text-slate-500">{a.recommended_action}</p>
                {a.patient_id ? (
                  <Link
                    href={`/fi-admin/${encodeURIComponent(tid)}/patients/${encodeURIComponent(a.patient_id)}/twin`}
                    className="mt-1 inline-block text-xs font-medium text-sky-700 hover:underline"
                  >
                    Open Patient Twin
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </FiCard>
    </div>
  );
}
