import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { loadIntelligenceEventLogsForAdmin } from "@/src/lib/fi/events/loadIntelligenceEventLogsForAdmin.server";

export const dynamic = "force-dynamic";

export default async function IntelligenceEventLogsPage() {
  const { rows, error, persistFlagSet, persistEffective } = await loadIntelligenceEventLogsForAdmin({ limit: 40 });

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
