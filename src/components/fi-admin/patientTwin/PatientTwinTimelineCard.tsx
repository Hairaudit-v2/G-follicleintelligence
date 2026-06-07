import Link from "next/link";

import { FiSection } from "@/src/components/fi-design/FiSection";
import type { PatientTwinV1 } from "@/src/lib/patientTwin/patientTwinTypes";

function shortWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export type PatientTwinTimelineCardProps = {
  tenantId: string;
  twin: PatientTwinV1;
};

export function PatientTwinTimelineCard({ tenantId, twin }: PatientTwinTimelineCardProps) {
  const items = twin.timeline.items;
  const empty = items.length === 0;

  return (
    <FiSection
      surfaceVariant="darkGlass"
      headingId="patient-twin-timeline-heading"
      title="Foundation timeline"
      description={`fi_timeline_events feed (${twin.timeline.order}). Showing ${items.length} item(s), cap ${twin.timeline.item_cap}. CRM activity is summarised in the CRM card.`}
    >
      {empty ? (
        <p className="text-sm text-[#94A3B8]">No foundation timeline events for this patient.</p>
      ) : (
        <ul className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
          {items.map((ev) => (
            <li
              key={ev.source_id}
              className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-[#E2E8F0]">{ev.title ?? ev.event_kind}</p>
                <time className="text-xs text-[#64748B]" dateTime={ev.occurred_at}>
                  {shortWhen(ev.occurred_at)}
                </time>
              </div>
              <p className="mt-1 text-xs text-[#64748B]">
                <span className="font-mono text-[#475569]">{ev.source_type}</span> ·{" "}
                <Link
                  href={`/fi-admin/${tenantId}/cases/${ev.case_id}`}
                  className="text-cyan-200/80 hover:text-cyan-100 hover:underline"
                >
                  Case {ev.case_id.slice(0, 8)}…
                </Link>
              </p>
            </li>
          ))}
        </ul>
      )}
    </FiSection>
  );
}
