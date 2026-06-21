"use client";

import { useState, useTransition } from "react";

import { ClinicalStaffingStatusBadge } from "@/src/components/fi/workforce/ClinicalStaffingStatusBadge";
import { formatRequiredRolesLine } from "@/src/lib/workforce-os/clinicalStaffingStatusDisplay";
import { removeStaffFromRosterEventAction } from "@/src/lib/actions/workforce-roster-actions";
import type { RosterCommandCentreEvent } from "@/src/lib/workforce-os/workforceRosterCommandCentre.server";
import type { RosterAssignableCandidate } from "@/src/lib/workforce-os/workforceRosterCandidates";
import { RosterAssignmentEditor } from "@/src/components/fi/workforce/RosterAssignmentEditor";

export type RosterEventStaffingCardProps = {
  tenantId: string;
  event: RosterCommandCentreEvent;
  selected?: boolean;
  candidatesByRole?: Record<string, RosterAssignableCandidate[]>;
  onSelect?: () => void;
  onRefresh?: () => void;
};

function formatWindow(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "—";
  const date = start.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
  const timeFmt = (d: Date) =>
    d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date} · ${timeFmt(start)}–${timeFmt(end)}`;
}

export function RosterEventStaffingCard({
  tenantId,
  event,
  selected,
  candidatesByRole,
  onSelect,
  onRefresh,
}: RosterEventStaffingCardProps) {
  const [editorOpen, setEditorOpen] = useState(selected ?? false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleRemove(assignmentId: string) {
    setRemoveError(null);
    startTransition(async () => {
      const result = await removeStaffFromRosterEventAction({ tenantId, assignmentId });
      if (!result.ok) {
        setRemoveError(result.error);
        return;
      }
      onRefresh?.();
    });
  }

  return (
    <article
      className={[
        "rounded-xl border p-4 transition",
        selected || editorOpen
          ? "border-cyan-400/40 bg-cyan-500/[0.04]"
          : "border-white/[0.08] bg-[#0F1629]/60",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <button type="button" onClick={onSelect} className="text-left">
            <h3 className="text-sm font-semibold text-slate-100">{event.title}</h3>
            <p className="mt-1 text-xs text-slate-400">
              {formatWindow(event.startsAt, event.endsAt)}
              {event.clinicName ? ` · ${event.clinicName}` : ""}
            </p>
            <p className="mt-0.5 text-xs capitalize text-slate-500">
              {event.eventType.replace(/_/g, " ")}
              {event.bookingTypeLabel ? ` · ${event.bookingTypeLabel}` : ""}
            </p>
          </button>
        </div>
        <ClinicalStaffingStatusBadge status={event.staffing.displayStatus} />
      </div>

      <dl className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Required</dt>
          <dd className="text-slate-300">{formatRequiredRolesLine(event.staffing.requiredRoles)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Assigned</dt>
          <dd className="text-slate-300">{formatRequiredRolesLine(event.staffing.assignedCounts)}</dd>
        </div>
      </dl>

      {event.staffing.missingRoles.length ? (
        <ul className="mt-2 space-y-1 text-xs text-amber-200">
          {event.staffing.missingRoles.map((row) => (
            <li key={row.role}>
              Missing {row.role}: {row.assigned}/{row.required}
            </li>
          ))}
        </ul>
      ) : null}

      {event.assignments.length ? (
        <ul className="mt-3 space-y-2">
          {event.assignments.map((row) => (
            <li
              key={row.assignmentId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs"
            >
              <div>
                <p className="font-medium text-slate-200">
                  {row.staffName} · <span className="capitalize">{row.assignedRole}</span>
                </p>
                <p className="text-slate-500">
                  {row.assignmentStatus}
                  {row.readinessScore != null ? ` · readiness ${row.readinessScore}` : ""}
                </p>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => handleRemove(row.assignmentId)}
                className="text-rose-300 hover:text-rose-200 disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {event.staffing.warnings.length ? (
        <ul className="mt-2 space-y-1 text-xs text-amber-100/90">
          {event.staffing.warnings.slice(0, 3).map((warning, index) => (
            <li key={`${index}-${warning}`}>{warning}</li>
          ))}
        </ul>
      ) : null}

      {removeError ? <p className="mt-2 text-xs text-rose-300">{removeError}</p> : null}

      <div className="mt-3">
        <button
          type="button"
          onClick={() => setEditorOpen((open) => !open)}
          className="text-xs font-medium text-cyan-300 hover:text-cyan-200 hover:underline"
        >
          {editorOpen ? "Hide assignment editor" : "Assign staff"}
        </button>
      </div>

      {editorOpen && candidatesByRole ? (
        <div className="mt-3">
          <RosterAssignmentEditor
            tenantId={tenantId}
            event={event}
            candidatesByRole={candidatesByRole}
            onAssigned={() => {
              onRefresh?.();
              setEditorOpen(false);
            }}
            onClose={() => setEditorOpen(false)}
          />
        </div>
      ) : null}
    </article>
  );
}
