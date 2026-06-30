"use client";

import { useMemo, useState, useTransition } from "react";

import { assignStaffToRosterEventAction } from "@/src/lib/actions/workforce-roster-actions";
import type { RosterCommandCentreEvent } from "@/src/lib/workforce-os/workforceRosterCommandCentre.server";
import type { RosterAssignableCandidate } from "@/src/lib/workforce-os/workforceRosterCandidates";
import { RosterCandidateList } from "@/src/components/fi/workforce/RosterCandidateList";

export type RosterAssignmentEditorProps = {
  tenantId: string;
  event: RosterCommandCentreEvent;
  candidatesByRole: Record<string, RosterAssignableCandidate[]>;
  onAssigned?: () => void;
  onClose?: () => void;
};

export function RosterAssignmentEditor({
  tenantId,
  event,
  candidatesByRole,
  onAssigned,
  onClose,
}: RosterAssignmentEditorProps) {
  const missingRoles = event.staffing.missingRoles.filter((row) => row.assigned < row.required);
  const defaultRole = missingRoles[0]?.role ?? Object.keys(candidatesByRole)[0] ?? "";
  const [role, setRole] = useState(defaultRole);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const candidates = useMemo(() => candidatesByRole[role] ?? [], [candidatesByRole, role]);

  function handleAssign() {
    if (!selectedStaffId || !role) return;
    setError(null);
    startTransition(async () => {
      const result = await assignStaffToRosterEventAction({
        tenantId,
        clinicId: event.clinicId,
        eventSource: event.eventSource,
        eventId: event.eventId,
        staffId: selectedStaffId,
        assignedRole: role,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        eventType: event.eventType,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onAssigned?.();
    });
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Assign staff</h3>
          <p className="mt-1 text-xs text-slate-400">
            {event.title} · {new Date(event.startsAt).toLocaleString("en-AU")}
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            Close
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-slate-400">
          Missing role
          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setSelectedStaffId(null);
            }}
            className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#0B1220] px-3 py-2 text-sm text-slate-100"
          >
            {missingRoles.length ? (
              missingRoles.map((row) => (
                <option key={row.role} value={row.role}>
                  {row.role} ({row.assigned}/{row.required})
                </option>
              ))
            ) : (
              Object.keys(candidatesByRole).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))
            )}
          </select>
        </label>
      </div>

      <div className="mt-4">
        <RosterCandidateList
          candidates={candidates}
          selectedStaffId={selectedStaffId}
          onSelect={setSelectedStaffId}
          disabled={pending}
        />
      </div>

      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || !selectedStaffId}
          onClick={handleAssign}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Assigning…" : "Confirm assignment"}
        </button>
      </div>
    </div>
  );
}
