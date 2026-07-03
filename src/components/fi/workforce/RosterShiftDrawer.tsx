"use client";

import { useState, useTransition } from "react";

import {
  createRosterShiftAction,
  cancelRosterShiftAction,
  generateRosterFromStandardHoursAction,
} from "@/src/lib/actions/workforce-roster-actions";
import type { RosterGridShift } from "@/src/lib/workforce-os/workforceRosterCommandCentre.server";
import {
  buildRosterShiftDrawerDefaults,
  formatRosterDrawerDateLabel,
  formatRosterShiftDrawerTitle,
} from "@/src/lib/workforce-os/rosterCommandCentreUxCore";
import { shiftSourceDisplayLabel } from "@/src/lib/workforce-os/rosterGenerationCore";
import type { StaffStandardHoursDayInput } from "@/src/lib/workforce-os/staffStandardHoursCore";
import { RosterRightDrawer } from "@/src/components/fi/workforce/RosterRightDrawer";

const SHIFT_TYPES = [
  "clinic_day",
  "surgery_day",
  "consultation_day",
  "procedure_day",
  "training_day",
  "admin_day",
  "on_call",
] as const;

export type RosterShiftDrawerProps = {
  open: boolean;
  tenantId: string;
  mode: "add" | "edit" | "cell-actions";
  staffId: string;
  staffName: string;
  staffRole: string | null;
  localDate: string;
  filterClinicId: string;
  standardHours: StaffStandardHoursDayInput[] | undefined;
  selectedShift: RosterGridShift | null;
  clinics: Array<{ id: string; displayName: string }>;
  onClose: () => void;
  onRefresh: () => void;
  onEditStandardHours: (staffId: string) => void;
};

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function RosterShiftDrawer(props: RosterShiftDrawerProps) {
  if (!props.open) return null;

  const drawerKey = `${props.mode}-${props.staffId}-${props.localDate}-${props.selectedShift?.id ?? "new"}`;

  return <RosterShiftDrawerBody key={drawerKey} {...props} />;
}

function RosterShiftDrawerBody({
  tenantId,
  mode,
  staffId,
  staffName,
  staffRole,
  localDate,
  filterClinicId,
  standardHours,
  selectedShift,
  clinics,
  onClose,
  onRefresh,
  onEditStandardHours,
}: RosterShiftDrawerProps) {
  const editing = mode === "edit" && selectedShift ? selectedShift : null;
  const defaults = buildRosterShiftDrawerDefaults({
    staffId,
    localDate,
    staffRole,
    filterClinicId,
    standardHours,
  });

  const [clinicId, setClinicId] = useState(defaults.clinicId);
  const [shiftType, setShiftType] = useState(defaults.shiftType);
  const [startsAt, setStartsAt] = useState(
    editing ? toDatetimeLocal(editing.starts_at) : defaults.startsAt
  );
  const [endsAt, setEndsAt] = useState(
    editing ? toDatetimeLocal(editing.ends_at) : defaults.endsAt
  );
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleGenerateDay() {
    setError(null);
    startTransition(async () => {
      const result = await generateRosterFromStandardHoursAction({
        tenantId,
        rangeStartIso: `${localDate}T00:00:00.000Z`,
        rangeEndIso: `${localDate}T23:59:59.999Z`,
        staffIds: [staffId],
        overwriteGeneratedOnly: false,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      onRefresh();
    });
  }

  function handleCreateManual(e: React.FormEvent) {
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
      onClose();
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
      onClose();
      onRefresh();
    });
  }

  return (
    <RosterRightDrawer
      open
      title={
        mode === "cell-actions"
          ? `${staffName} — ${formatRosterDrawerDateLabel(localDate)}`
          : formatRosterShiftDrawerTitle({
              mode: editing ? "edit" : "add",
              staffName,
              localDate,
            })
      }
      subtitle={
        mode === "cell-actions"
          ? "Generate from standard hours or add a manual exception."
          : null
      }
      onClose={onClose}
      testId="roster-shift-drawer"
    >
      {mode === "cell-actions" ? (
        <div className="space-y-3">
          <button
            type="button"
            disabled={pending}
            onClick={handleGenerateDay}
            data-testid="generate-day-from-standard-hours"
            className="w-full rounded-lg bg-cyan-600 px-4 py-3 text-left text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
          >
            Generate this day from standard hours
          </button>
          <ManualShiftForm
            staffName={staffName}
            clinicId={clinicId}
            clinics={clinics}
            shiftType={shiftType}
            startsAt={startsAt}
            endsAt={endsAt}
            notes={notes}
            pending={pending}
            showSave
            onClinicChange={setClinicId}
            onShiftTypeChange={setShiftType}
            onStartsAtChange={setStartsAt}
            onEndsAtChange={setEndsAt}
            onNotesChange={setNotes}
            onSubmit={handleCreateManual}
          />
          <button
            type="button"
            onClick={() => onEditStandardHours(staffId)}
            className="w-full rounded-lg border border-white/[0.12] px-4 py-2.5 text-sm text-slate-200 hover:bg-white/[0.04]"
          >
            Edit standard hours
          </button>
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        </div>
      ) : (
        <div className="space-y-3">
          {editing ? (
            <p className="text-[11px] text-slate-500">
              {shiftSourceDisplayLabel(editing.shift_source)}
            </p>
          ) : null}
          <ManualShiftForm
            staffName={staffName}
            clinicId={clinicId}
            clinics={clinics}
            shiftType={shiftType}
            startsAt={startsAt}
            endsAt={endsAt}
            notes={notes}
            pending={pending}
            showSave={!editing}
            onClinicChange={setClinicId}
            onShiftTypeChange={setShiftType}
            onStartsAtChange={setStartsAt}
            onEndsAtChange={setEndsAt}
            onNotesChange={setNotes}
            onSubmit={handleCreateManual}
          />
          {editing ? (
            <button
              type="button"
              disabled={pending}
              onClick={handleCancelShift}
              className="rounded-lg border border-rose-500/40 px-3 py-2 text-sm text-rose-300 hover:bg-rose-950/30 disabled:opacity-50"
            >
              Cancel shift
            </button>
          ) : null}
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        </div>
      )}
    </RosterRightDrawer>
  );
}

type ManualShiftFormProps = {
  staffName: string;
  clinicId: string;
  clinics: Array<{ id: string; displayName: string }>;
  shiftType: string;
  startsAt: string;
  endsAt: string;
  notes: string;
  pending: boolean;
  showSave: boolean;
  onClinicChange: (v: string) => void;
  onShiftTypeChange: (v: string) => void;
  onStartsAtChange: (v: string) => void;
  onEndsAtChange: (v: string) => void;
  onNotesChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
};

function ManualShiftForm({
  staffName,
  clinicId,
  clinics,
  shiftType,
  startsAt,
  endsAt,
  notes,
  pending,
  showSave,
  onClinicChange,
  onShiftTypeChange,
  onStartsAtChange,
  onEndsAtChange,
  onNotesChange,
  onSubmit,
}: ManualShiftFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3"
      data-testid="roster-manual-shift-form"
    >
      <p className="text-sm font-medium text-slate-100" data-testid="roster-shift-staff-label">
        {staffName}
      </p>
      <label className="block text-xs text-slate-400">
        Clinic
        <select
          value={clinicId}
          onChange={(e) => onClinicChange(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#0B1220] px-2 py-2 text-sm"
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
          onChange={(e) => onShiftTypeChange(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#0B1220] px-2 py-2 text-sm"
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
          onChange={(e) => onStartsAtChange(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#0B1220] px-2 py-2 text-sm"
          required
        />
      </label>
      <label className="block text-xs text-slate-400">
        Ends
        <input
          type="datetime-local"
          value={endsAt}
          onChange={(e) => onEndsAtChange(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#0B1220] px-2 py-2 text-sm"
          required
        />
      </label>
      <label className="block text-xs text-slate-400">
        Notes
        <input
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#0B1220] px-2 py-2 text-sm"
          placeholder="Manual adjustment"
        />
      </label>
      {showSave ? (
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg border border-white/[0.12] px-4 py-2.5 text-sm font-medium text-slate-100 hover:bg-white/[0.04] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Add manual shift"}
        </button>
      ) : null}
    </form>
  );
}
