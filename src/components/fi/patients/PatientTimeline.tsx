import type { PatientTimelineRow } from "@/src/lib/integrations/hubspot/loadPatientTimeline.server";

function formatTimestamp(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sourceLabel(source: string): string {
  if (source.startsWith("hubspot")) return "HubSpot";
  return source;
}

/**
 * Read-only chronological activity history for a patient (HubSpot timeline sync, etc.).
 * Presentational only — renders whatever rows it is given, newest first.
 */
export function PatientTimeline({ rows }: { rows: PatientTimelineRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">
        No communication or CRM activity has been synced for this patient yet.
      </div>
    );
  }

  return (
    <ol className="relative space-y-4 border-l border-gray-200 pl-5">
      {rows.map((row) => (
        <li key={row.id} className="relative">
          <span
            className="absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-sky-500"
            aria-hidden
          />
          <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
                  {sourceLabel(row.source)}
                </span>
                <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-600">
                  {row.event_type}
                </span>
              </div>
              <time className="text-xs text-gray-500" dateTime={row.event_timestamp}>
                {formatTimestamp(row.event_timestamp)}
              </time>
            </div>
            {row.title ? <p className="mt-2 text-sm font-medium text-gray-900">{row.title}</p> : null}
            {row.description ? <p className="mt-1 text-sm text-gray-600">{row.description}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
