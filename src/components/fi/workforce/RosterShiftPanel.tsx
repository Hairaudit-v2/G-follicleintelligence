"use client";

import { useState, useTransition } from "react";

import {
  cancelRosterShiftAction,
  createRosterShiftAction,
} from "@/src/lib/actions/workforce-roster-actions";
import type { FiStaffShiftRow } from "@/src/lib/workforce-os/workforceRostering.server";

const SHIFT_TYPES = [
  "clinic_day",
  "surgery_day",
  "consultation_day",
  "procedure_day",
  "training_day",
  "admin_day",
  "on_call",
] as const;

export type RosterShiftPanelProps = {
  tenantId: string;
  shifts: FiStaffShiftRow[];
  staffOptions: Array<{ id: string; name: string }>;
  clinics: Array<{ id: string; displayName: string }>;
  onChanged?: () => void;
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function RosterShiftPanel({
  tenantId,
  shifts,
  staffOptions,
  clinics,
  onChanged,
}: RosterShiftPanelProps) {
  const [staffId, setStaffId] = useState(staffOptions[0]?.id ?? "");
  const [clinicId, setClinicId] = useState("");
  const [shiftType, setShiftType] = useState<(typeof SHIFT_TYPES)[number]>("clinic_day");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
        notes: notes || null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotes("");
      onChanged?.();
    });
  }

  function handleCancel(shiftId: string) {
    setError(null);
    startTransition(async () => {
      const result = await cancelRosterShiftAction({ tenantId, shiftId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onChanged?.();
    });
  }

  return (
    <section className="rounded-xl border border-white/[0.08] bg-[#0F1629]/60 p-4">
      <h3 className="text-sm font-semibold text-slate-100">Shifts</h3>
      <p className="mt-1 text-xs text-slate-400">Schedule clinic and theatre shifts for staff.</p>

      <form onSubmit={handleCreate} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-slate-400">
          Staff
          <select
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#0B1220] px-3 py-2 text-sm text-slate-100"
            required
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
            className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#0B1220] px-3 py-2 text-sm text-slate-100"
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
            className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#0B1220] px-3 py-2 text-sm text-slate-100"
          >
            {SHIFT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.replace(/_/g, " ")}
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
            className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#0B1220] px-3 py-2 text-sm text-slate-100"
            required
          />
        </label>
        <label className="block text-xs text-slate-400">
          Ends
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#0B1220] px-3 py-2 text-sm text-slate-100"
            required
          />
        </label>
        <label className="block text-xs text-slate-400 sm:col-span-2">
          Notes
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#0B1220] px-3 py-2 text-sm text-slate-100"
            placeholder="Optional notes"
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending || !staffId}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
          >
            {pending ? "Creating…" : "Create shift"}
          </button>
        </div>
      </form>

      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}

      <div className="mt-5">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Upcoming shifts
        </h4>
        {shifts.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No shifts in this window.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {shifts.map((shift) => (
              <li
                key={shift.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs"
              >
                <div>
                  <p className="font-medium capitalize text-slate-200">
                    {shift.shift_type.replace(/_/g, " ")}
                  </p>
                  <p className="text-slate-400">
                    {formatDateTime(shift.starts_at)} → {formatDateTime(shift.ends_at)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleCancel(shift.id)}
                  className="text-rose-300 hover:text-rose-200 disabled:opacity-50"
                >
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
