import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import {
  formatAge,
  loadIntegrationOsMonitoring,
  type IntegrationWebhookEventRow,
  type SystemHealthSeverity,
} from "@/src/lib/integrations/monitoring/loadIntegrationOsMonitoring.server";

export const dynamic = "force-dynamic";

const CARD = "rounded-xl border border-white/[0.08] bg-[#060d18]/80 p-4";

function fmtTs(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toISOString().replace("T", " ").slice(0, 19)}Z`;
}

function tsWithAge(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${fmtTs(value)} (${formatAge(Date.now() - d.getTime())} ago)`;
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "default" | "warn" | "alert" }) {
  const valueColor = tone === "alert" ? "text-red-300" : tone === "warn" ? "text-amber-300" : "text-slate-50";
  return (
    <div className={CARD}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-lg font-semibold ${valueColor}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "processed"
      ? "bg-emerald-500/15 text-emerald-300"
      : status === "error"
        ? "bg-red-500/15 text-red-300"
        : "bg-amber-500/15 text-amber-300";
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${tone}`}>{status}</span>;
}

function SeverityDot({ severity }: { severity: SystemHealthSeverity }) {
  const color = severity === "alert" ? "bg-red-400" : severity === "warn" ? "bg-amber-400" : "bg-emerald-400";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} aria-hidden />;
}

/** Last path segment of the webhook route template, for a compact column. */
function routeLabel(route: string): string {
  const seg = route.split("/").filter(Boolean).pop();
  return seg ?? route;
}

export default async function IntegrationOsMonitoringPage() {
  const data = await loadIntegrationOsMonitoring();
  const { timely, hubspot, recentWebhookEvents, systemHealth, errors } = data;

  return (
    <div className="space-y-8">
      <div>
        <p className={fiOsChromeClasses.sectionEyebrow}>IntegrationOS</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-50">Integrations monitoring</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Read-only, platform-wide health for inbound integrations. Counts are derived from{" "}
          <code className="text-xs text-slate-300">fi_integration_webhook_events</code> and{" "}
          <code className="text-xs text-slate-300">fi_import_batches</code>. Snapshot generated{" "}
          {fmtTs(data.generatedAt)}.
        </p>
      </div>

      {errors.length > 0 ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] p-4 text-sm text-red-300">
          <p className="font-medium">Some sections could not load:</p>
          <ul className="mt-1 list-inside list-disc text-xs">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Timely ---------------------------------------------------------------- */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Timely integration</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Stat label="Last webhook received" value={tsWithAge(timely.lastWebhookReceived)} />
          <Stat label="Last successful sync" value={tsWithAge(timely.lastSuccessfulSync)} />
          <Stat
            label="Failed sync count"
            value={timely.failedSyncCount}
            tone={timely.failedSyncCount > 0 ? "alert" : "default"}
          />
          <Stat label="Appointment create" value={timely.appointmentCreatedCount} />
          <Stat label="Appointment update" value={timely.appointmentUpdatedCount} />
          <Stat label="Cancelled" value={timely.appointmentCancelledCount} />
          <Stat label="Completed" value={timely.appointmentCompletedCount} />
        </div>
        <p className="text-xs text-slate-500">
          Appointment counts reflect recorded webhook <code className="text-slate-400">event_type</code> values (one row
          per unique delivery; duplicate/replayed deliveries are deduplicated and not counted twice).
        </p>
      </section>

      {/* HubSpot --------------------------------------------------------------- */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">HubSpot integration</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Imported leads" value={hubspot.importedLeads} />
          <Stat
            label="Failed imports"
            value={hubspot.failedImports}
            tone={hubspot.failedImports > 0 ? "warn" : "default"}
          />
          <Stat label="Duplicate records" value={hubspot.duplicateRecords} />
          <Stat label="Last import" value={tsWithAge(hubspot.lastImportAt)} />
        </div>
        <p className="text-xs text-slate-500">
          Aggregated across {hubspot.completedBatches} completed import batch(es). Duplicates = HubSpot records skipped
          because the record id was already imported; failed imports = genuine per-row commit errors.
        </p>
      </section>

      {/* System health -------------------------------------------------------- */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">System health</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="API failures (total)"
            value={systemHealth.apiFailuresTotal}
            tone={systemHealth.apiFailuresTotal > 0 ? "warn" : "default"}
          />
          <Stat
            label="API failures (24h)"
            value={systemHealth.apiFailures24h}
            tone={systemHealth.apiFailures24h > 0 ? "alert" : "default"}
          />
          <Stat
            label="Retry queue (errored)"
            value={systemHealth.retryErrored}
            tone={systemHealth.retryErrored > 0 ? "warn" : "default"}
          />
          <Stat
            label="Retry queue (stuck received)"
            value={systemHealth.retryStuckReceived}
            tone={systemHealth.retryStuckReceived > 0 ? "alert" : "default"}
          />
        </div>
        <div className={CARD}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stale sync alerts</p>
          {systemHealth.staleAlerts.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No alerts.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {systemHealth.staleAlerts.map((a) => (
                <li key={`${a.label}-${a.detail}`} className="flex items-center gap-2 text-sm text-slate-300">
                  <SeverityDot severity={a.severity} />
                  <span className="font-medium text-slate-200">{a.label}:</span>
                  <span className="text-slate-400">{a.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="text-xs text-slate-500">
          &quot;Retry queue&quot; reflects inbound webhook events Zapier may redeliver: errored events plus events stuck
          in <code className="text-slate-400">received</code> (claimed but never finalized). FI OS has no internal
          retry worker for these — redelivery is driven by Zapier&apos;s at-least-once policy.
        </p>
      </section>

      {/* Webhook events ------------------------------------------------------- */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Webhook events (last {recentWebhookEvents.length})
        </h2>
        {recentWebhookEvents.length === 0 ? (
          <p className="text-sm text-slate-500">No webhook events recorded yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-[#060d18]/80">
            <table className="min-w-full text-left text-sm text-slate-300">
              <thead className="border-b border-white/[0.08] text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Received</th>
                  <th className="px-3 py-2">Provider</th>
                  <th className="px-3 py-2">Route</th>
                  <th className="px-3 py-2">Event type</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {recentWebhookEvents.map((e: IntegrationWebhookEventRow) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-400">{fmtTs(e.created_at)}</td>
                    <td className="px-3 py-2 text-xs">{e.provider}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-300">{routeLabel(e.route)}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-200">{e.event_type}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={e.status} />
                    </td>
                    <td className="max-w-[28ch] truncate px-3 py-2 text-xs text-red-300/80" title={e.error_message ?? ""}>
                      {e.error_message ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-slate-500">
          Raw webhook payloads are intentionally not shown here (they may contain patient data); only metadata and
          status are surfaced.
        </p>
      </section>
    </div>
  );
}
