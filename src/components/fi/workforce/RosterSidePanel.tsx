"use client";

import { RosterEventStaffingCard } from "@/src/components/fi/workforce/RosterEventStaffingCard";
import type { RosterCommandCentreEvent } from "@/src/lib/workforce-os/workforceRosterCommandCentre.server";
import { buildCoverageRoleGapLabels } from "@/src/lib/workforce-os/rosterGenerationCore";
import type { RosterAssignableCandidate } from "@/src/lib/workforce-os/workforceRosterCandidates";

export type RosterSidePanelProps = {
  tenantId: string;
  events: RosterCommandCentreEvent[];
  selectedEventKey: string | null;
  eventDetails: Record<
    string,
    { candidatesByRole: Record<string, RosterAssignableCandidate[]> } | undefined
  >;
  onRefresh: () => void;
  onSelectEvent: (eventKey: string) => void;
};

export function RosterSidePanel({
  tenantId,
  events,
  selectedEventKey,
  eventDetails,
  onRefresh,
  onSelectEvent,
}: RosterSidePanelProps) {
  const gapEvents = events.filter(
    (e) => e.staffing.displayStatus === "missing_roles" || e.staffing.displayStatus === "warning"
  );

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-white/[0.08] bg-[#0F1629]/60 p-4">
        <h3 className="text-sm font-semibold text-slate-100">Coverage warnings</h3>
        {gapEvents.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">All clinical events are fully staffed.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {gapEvents.slice(0, 6).map((event) => (
              <li
                key={event.eventKey}
                className="rounded-lg border border-amber-500/20 bg-amber-950/20 px-3 py-2"
              >
                <p className="text-xs font-medium text-amber-100">{event.title}</p>
                <ul className="mt-1 space-y-0.5 text-[11px] text-amber-200/90">
                  {buildCoverageRoleGapLabels(event.staffing.missingRoles).map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-100">Clinical events</h3>
        <div className="mt-2 space-y-2">
          {events.length === 0 ? (
            <p className="text-xs text-slate-500">No events in this week.</p>
          ) : (
            events.map((event) => (
              <RosterEventStaffingCard
                key={event.eventKey}
                tenantId={tenantId}
                event={event}
                selected={selectedEventKey === event.eventKey}
                candidatesByRole={eventDetails[event.eventKey]?.candidatesByRole}
                onSelect={() => onSelectEvent(event.eventKey)}
                onRefresh={onRefresh}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
