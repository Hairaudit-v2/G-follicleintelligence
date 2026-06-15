import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { compareIntelligenceEventLogsToFiEvents } from "@/src/lib/fi/events/compareIntelligenceEventLogsToFiEvents.server";
import { loadIntelligenceEventLogsForAdmin } from "@/src/lib/fi/events/loadIntelligenceEventLogsForAdmin.server";
import { replayIntelligenceEventLogs } from "@/src/lib/fi/events/replayIntelligenceEventLogs.server";

export const dynamic = "force-dynamic";

export default async function IntelligenceEventLogsPage() {
  const [{ rows, error, persistFlagSet, persistEffective }, replayDryRun, compare] = await Promise.all([
    loadIntelligenceEventLogsForAdmin({ limit: 40 }),
    replayIntelligenceEventLogs({
      mode: "dry_run",
      filters: { limit: 25, order: "newest_first" },
    }),
    compareIntelligenceEventLogsToFiEvents({ limit: 120 }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className={fiOsChromeClasses.sectionEyebrow}>Intelligence core</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-50">Intelligence event logs</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Read-only view of <code className="text-xs text-slate-300">public.fi_intelligence_event_logs</code>. Rows contain
          sanitized metadata only (no raw clinical payloads). Persistence is{" "}
          <strong className="text-slate-200">{persistEffective ? "effective in this environment" : "off"}</strong>
          {persistFlagSet && !persistEffective ? " (flag is set but production or policy gate forces off)" : null}.
        </p>
      </div>

      <section className="rounded-xl border border-white/[0.08] bg-[#060d18]/80 p-4 text-sm text-slate-300">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stage 14 replay filters</h2>
        <p className="mt-2 text-slate-400">
          Supported candidate filters (CLI and server helpers):{" "}
          <code className="text-xs text-slate-300">event_name</code>, <code className="text-xs text-slate-300">source</code>,{" "}
          <code className="text-xs text-slate-300">status</code>, <code className="text-xs text-slate-300">privacy_level</code>,{" "}
          <code className="text-xs text-slate-300">since</code> / <code className="text-xs text-slate-300">until</code> on{" "}
          <code className="text-xs text-slate-300">created_at</code>, <code className="text-xs text-slate-300">correlation_id</code>,{" "}
          <code className="text-xs text-slate-300">limit</code> (1–500), <code className="text-xs text-slate-300">order</code>{" "}
          <span className="text-slate-500">(newest_first | oldest_first)</span>. Default replay mode is dry-run (no writes).
        </p>
        <p className="mt-2 font-mono text-xs text-slate-500">
          pnpm run replay:intelligence-event-logs -- --json
        </p>
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-[#060d18]/80 p-4 text-sm text-slate-300">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Replay dry-run (latest window)</h2>
        {replayDryRun.load_error ? (
          <p className="mt-2 text-red-400">Replay load error: {replayDryRun.load_error}</p>
        ) : (
          <p className="mt-2 text-slate-400">
            Mode <code className="text-xs text-slate-200">{replayDryRun.summary.mode}</code> — candidates loaded:{" "}
            <strong className="text-slate-200">{replayDryRun.summary.candidates_loaded}</strong> (limit 25, newest first).
          </p>
        )}
        {replayDryRun.warnings.length > 0 ? (
          <ul className="mt-2 list-inside list-disc text-xs text-amber-300/90">
            {replayDryRun.warnings.map((w) => (
              <li key={`${w.code}-${w.message}`}>
                {w.code}: {w.message}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-[#060d18]/80 p-4 text-sm text-slate-300">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Compare vs fi_events (sampled)</h2>
        {compare.error ? (
          <p className="mt-2 text-red-400">Compare error: {compare.error}</p>
        ) : (
          <div className="mt-2 space-y-2 text-slate-400">
            <p>
              Intelligence rows: <strong className="text-slate-200">{compare.summary.intelligence_rows_sampled}</strong> —{" "}
              <code className="text-xs text-slate-300">fi_events</code> rows:{" "}
              <strong className="text-slate-200">{compare.summary.fi_events_rows_sampled}</strong>. Field names:{" "}
              <code className="text-xs text-slate-300">{compare.summary.source_system}</code> vs{" "}
              <code className="text-xs text-slate-300">{compare.summary.source}</code>
              {compare.summary.fi_events_correlation_from_payload_disabled
                ? " (no correlation column on fi_events; payload not read)"
                : null}
              .
            </p>
            {compare.summary.event_names_only_in_intelligence.length > 0 ? (
              <p className="text-xs">
                Event names only in intelligence sample:{" "}
                <span className="font-mono text-slate-300">{compare.summary.event_names_only_in_intelligence.join(", ")}</span>
              </p>
            ) : null}
            {compare.summary.event_types_only_in_fi_events.length > 0 ? (
              <p className="text-xs">
                Event types only in fi_events sample:{" "}
                <span className="font-mono text-slate-300">{compare.summary.event_types_only_in_fi_events.join(", ")}</span>
              </p>
            ) : null}
          </div>
        )}
      </section>

      {error ? (
        <p className="text-sm text-red-400">Could not load logs: {error}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">No rows yet, or persistence has not written in this project.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-[#060d18]/80">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead className="border-b border-white/[0.08] text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Event</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Privacy</th>
                <th className="px-3 py-2">Warnings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-400">
                    {new Date(r.created_at).toISOString().replace("T", " ").slice(0, 19)}Z
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-200">{r.event_name}</td>
                  <td className="px-3 py-2 text-xs">{r.source}</td>
                  <td className="px-3 py-2 text-xs">{r.status}</td>
                  <td className="px-3 py-2 text-xs">{r.privacy_level}</td>
                  <td className="px-3 py-2 text-xs">{r.warnings?.length ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
