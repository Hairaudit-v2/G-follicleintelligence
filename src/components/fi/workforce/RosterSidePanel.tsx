"use client";

import { useState, useTransition } from "react";

import {
  cancelRosterShiftAction,
  createRosterShiftAction,
} from "@/src/lib/actions/workforce-roster-actions";
import type {
  RosterCommandCentreEvent,
  RosterGridShift,
} from "@/src/lib/workforce-os/workforceRosterCommandCentre.server";
import { buildCoverageRoleGapLabels, shiftSourceDisplayLabel } from "@/src/lib/workforce-os/rosterGenerationCore";
import { RosterEventStaffingCard } from "@/src/components/fi/workforce/RosterEventStaffingCard";
import type { RosterAssignableCandidate } from "@/src/lib/workforce-os/workforceRosterCandidates";

const SHIFT_TYPES = [
  "clinic_day",
  "surgery_day",
  "consultation_day",
  "procedure_day",
  "training_day",
  "admin_day",
  "on_call",
] as const;

export type RosterSidePanelProps = {
  tenantId: string;
  clinics: Array<{ id: string; displayName: string }>;
  staffOptions: Array<{ id: string; name: string }>;
  selectedShift: RosterGridShift | null;
  draftCell: { staffId: string; localDate: string } | null;
  events: RosterCommandCentreEvent[];
  selectedEventKey: string | null;
  eventDetails: Record<
    string,
    { candidatesByRole: Record<string, RosterAssignableCandidate[]> } | undefined
  >;
  onRefresh: () => void;
  onSelectEvent: (eventKey: string) => void;
  onClearSelection: () => void;
};

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function RosterSidePanel({
  tenantId,
  clinics,
  staffOptions,
  selectedShift,
  draftCell,
  events,
  selectedEventKey,
  eventDetails,
  onRefresh,
  onSelectEvent,
  onClearSelection,
}: RosterSidePanelProps) {
  const editing = selectedShift;
  const creating = !editing && draftCell;

  const [staffId, setStaffId] = useState(editing?.staff_id ?? draftCell?.staffId ?? staffOptions[0]?.id ?? "");
  const [clinicId, setClinicId] = useState(editing?.clinic_id ?? "");
  const [shiftType, setShiftType] = useState<(typeof SHIFT_TYPES)[number]>(
    (editing?.shift_type as (typeof SHIFT_TYPES)[number]) ?? "clinic_day"
  );
  const [startsAt, setStartsAt] = useState(
    editing ? toDatetimeLocal(editing.starts_at) : draftCell ? `${draftCell.localDate}T09:00` : ""
  );
  const [endsAt, setEndsAt] = useState(
    editing ? toDatetimeLocal(editing.ends_at) : draftCell ? `${draftCell.localDate}T17:00` : ""
  );
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const gapEvents = events.filter(
    (e) => e.staffing.displayStatus === "missing_roles" || e.staffing.displayStatus === "warning"
  );

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createRosterShiftAction({
        tenantId,
        staffId,
        clinicId: clinicId || null,
        shiftType,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        notes: notes || "Manual adjustment",
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClearSelection();
      onRefresh();
    });
  }

  function handleCancelShift() {
    if (!editing) return;
    setError(null);
    startTransition(async () => {
      const result = await cancelRosterShiftAction({ tenantId, shiftId: editing.id });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClearSelection();
      onRefresh();
    });
  }

  return (
    <div className="space-y-4">
      {(editing || creating) && (
        <section className="rounded-xl border border-white/[0.08] bg-[#0F1629]/60 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-100">
              {editing ? "Edit shift" : "Add shift"}
            </h3>
            <button
              type="button"
              onClick={onClearSelection}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              Close
            </button>
          </div>
          {editing ? (
            <p className="mt-1 text-[11px] text-slate-500">
              {shiftSourceDisplayLabel(editing.shift_source)}
            </p>
          ) : null}

          <form onSubmit={handleCreate} className="mt-3 grid gap-2">
            <label className="block text-xs text-slate-400">
              Staff
              <select
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#0B1220] px-2 py-1.5 text-sm"
                required
                disabled={Boolean(editing)}
              >
                {staffOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-slate-400">
              Clinic
              <select
                value={clinicId}
                onChange={(e) => setClinicId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#0B1220] px-2 py-1.5 text-sm"
              >
                <option value="">Any clinic</option>
                {clinics.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-slate-400">
              Shift type
              <select
                value={shiftType}
                onChange={(e) => setShiftType(e.target.value as (typeof SHIFT_TYPES)[number])}
                className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#0B1220] px-2 py-1.5 text-sm"
              >
                {SHIFT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-slate-400">
              Starts
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#0B1220] px-2 py-1.5 text-sm"
                required
              />
            </label>
            <label className="block text-xs text-slate-400">
              Ends
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#0B1220] px-2 py-1.5 text-sm"
                required
              />
            </label>
            <label className="block text-xs text-slate-400">
              Notes
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#0B1220] px-2 py-1.5 text-sm"
                placeholder="Manual adjustment"
              />
            </label>
            <div className="flex flex-wrap gap-2 pt-1">
              {!editing ? (
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
                >
                  {pending ? "Saving…" : "Save shift"}
                </button>
              ) : null}
              {editing ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={handleCancelShift}
                  className="rounded-lg border border-rose-500/40 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-950/30 disabled:opacity-50"
                >
                  Cancel shift
                </button>
              ) : null}
            </div>
          </form>
          {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
        </section>
      )}

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
        <div className="mt-2 max-h-[420px] space-y-2 overflow-y-auto pr-1">
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
