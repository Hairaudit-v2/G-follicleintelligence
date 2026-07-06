"use client";

import { useState, useTransition } from "react";

import {
  createRosterShiftAction,
  cancelRosterShiftAction,
  generateRosterFromStandardHoursAction,
  updateRosterShiftAction,
} from "@/src/lib/actions/workforce-roster-actions";
import type { RosterGridShift } from "@/src/lib/workforce-os/workforceRosterCommandCentre.server";
import {
  buildRosterShiftDrawerDefaults,
  buildRosterShiftFormValuesFromShift,
  formatRosterDrawerDateLabel,
  formatRosterShiftDrawerTitle,
  resolveRosterShiftDrawerChangedFields,
  resolveRosterShiftDrawerEditEligibility,
  rosterShiftDatetimeLocalToUtcIso,
  rosterShiftDrawerEditRequiresReason,
  staffHasWorkingStandardHoursForDate,
} from "@/src/lib/workforce-os/rosterCommandCentreUxCore";
import { shiftSourceDisplayLabel } from "@/src/lib/workforce-os/rosterGenerationCore";
import {
  ROSTER_MANUAL_ADJUSTMENT_REASONS,
  ROSTER_SHIFT_CANCELLATION_REASON_REQUIRED_MESSAGE,
  ROSTER_SHIFT_DRAWER_CANCELLATION_REASONS,
  ROSTER_SHIFT_EDIT_REASONS,
  ROSTER_SHIFT_EDIT_REASON_REQUIRED_MESSAGE,
  formatRosterAdjustmentReasonLabel,
  isGeneratedShiftSource,
} from "@/src/lib/workforce-os/rosterManualAdjustmentsCore";
import { ROSTER_MANAGE_DENIED_REASON } from "@/src/lib/workforce-os/staffStandardHoursRoutes";
import type { StaffStandardHoursDayInput } from "@/src/lib/workforce-os/staffStandardHoursCore";
import type { RosterCadence } from "@/src/lib/workforce/rosterCadencePolicyCore";
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
  rosterCadence?: RosterCadence;
  rosterCycleAnchorDate?: string;
  selectedShift: RosterGridShift | null;
  clinics: Array<{ id: string; displayName: string }>;
  staffTimezone?: string | null;
  tenantTimezone: string;
  canManage?: boolean;
  canManageStandardHours?: boolean;
  manageDeniedReason?: string;
  onClose: () => void;
  onRefresh: () => void;
  onEditStandardHours: (staffId: string) => void;
};

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
  rosterCadence = "weekly",
  rosterCycleAnchorDate = "2026-01-05",
  selectedShift,
  clinics,
  staffTimezone = null,
  tenantTimezone,
  canManage = true,
  canManageStandardHours = true,
  manageDeniedReason = ROSTER_MANAGE_DENIED_REASON,
  onClose,
  onRefresh,
  onEditStandardHours,
}: RosterShiftDrawerProps) {
  const viewingExistingShift = mode === "edit" && selectedShift ? selectedShift : null;
  const { canShowEditButton, canCancelShift, openInEditMode } =
    resolveRosterShiftDrawerEditEligibility(viewingExistingShift);

  const createDefaults = buildRosterShiftDrawerDefaults({
    staffId,
    localDate,
    staffRole,
    filterClinicId,
    standardHours,
    rosterCadence,
    rosterCycleAnchorDate,
  });

  const initialFormValues = viewingExistingShift
    ? buildRosterShiftFormValuesFromShift(viewingExistingShift, staffTimezone, tenantTimezone)
    : {
        clinicId: createDefaults.clinicId,
        shiftType: createDefaults.shiftType,
        startsAt: createDefaults.startsAt,
        endsAt: createDefaults.endsAt,
        notes: "",
      };

  const canGenerateFromStandardHours = staffHasWorkingStandardHoursForDate({
    standardHours,
    localDate,
    rosterCadence,
    rosterCycleAnchorDate,
  });

  const [isInlineEditing, setIsInlineEditing] = useState(
    () => openInEditMode && canManage
  );
  const [clinicId, setClinicId] = useState(initialFormValues.clinicId);
  const [shiftType, setShiftType] = useState(initialFormValues.shiftType);
  const [startsAt, setStartsAt] = useState(initialFormValues.startsAt);
  const [endsAt, setEndsAt] = useState(initialFormValues.endsAt);
  const [notes, setNotes] = useState(initialFormValues.notes);
  const [adjustmentReason, setAdjustmentReason] = useState("manual_adjustment");
  const [editReason, setEditReason] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancelNotes, setCancelNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function resetFormToOriginal() {
    setClinicId(initialFormValues.clinicId);
    setShiftType(initialFormValues.shiftType);
    setStartsAt(initialFormValues.startsAt);
    setEndsAt(initialFormValues.endsAt);
    setNotes(initialFormValues.notes);
    setEditReason("");
    setError(null);
  }

  function handleStartInlineEdit() {
    if (!canManage || !canShowEditButton) return;
    setIsInlineEditing(true);
    setError(null);
  }

  function handleCancelInlineEdit() {
    resetFormToOriginal();
    setIsInlineEditing(false);
  }

  const formReadOnly = Boolean(viewingExistingShift && !isInlineEditing) || !canManage;
  const showCreateSave = !viewingExistingShift && canManage;
  const showInlineEditControls = Boolean(viewingExistingShift && isInlineEditing && canManage);

  const editFormInput = (() => {
    const utcTimes = rosterShiftDatetimeLocalToUtcIso({
      startsAtLocal: startsAt,
      endsAtLocal: endsAt,
      staffTimezone,
      tenantTimezone,
    });
    const startsAtIso = "error" in utcTimes ? "" : utcTimes.startsAt;
    const endsAtIso = "error" in utcTimes ? "" : utcTimes.endsAt;
    return {
      clinicId,
      shiftType,
      startsAt,
      endsAt,
      notes,
      startsAtIso,
      endsAtIso,
    };
  })();

  const editReasonRequired =
    viewingExistingShift != null &&
    isInlineEditing &&
    rosterShiftDrawerEditRequiresReason(viewingExistingShift, editFormInput);

  function handleGenerateDay() {
    setError(null);
    if (!canManage) {
      setError(manageDeniedReason);
      return;
    }
    if (!canGenerateFromStandardHours) {
      setError(
        "No standard hours are set for this staff member on this day. Add a manual shift instead."
      );
      return;
    }
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
      if (result.data.createdCount === 0) {
        setError(
          "No standard hours are set for this staff member on this day. Add a manual shift instead."
        );
        return;
      }
      onClose();
      onRefresh();
    });
  }

  function handleCreateManual(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!canManage) {
      setError(manageDeniedReason);
      return;
    }
    const utcTimes = rosterShiftDatetimeLocalToUtcIso({
      startsAtLocal: startsAt,
      endsAtLocal: endsAt,
      staffTimezone,
      tenantTimezone,
    });
    if ("error" in utcTimes) {
      setError(utcTimes.error);
      return;
    }
    startTransition(async () => {
      const result = await createRosterShiftAction({
        tenantId,
        staffId,
        clinicId: clinicId || null,
        shiftType,
        startsAt: utcTimes.startsAt,
        endsAt: utcTimes.endsAt,
        notes: notes || null,
        adjustmentReason,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      onRefresh();
    });
  }

  function handleUpdateShift(e: React.FormEvent) {
    e.preventDefault();
    if (!viewingExistingShift || !canManage || !isInlineEditing) return;

    setError(null);

    if (editReasonRequired && !editReason.trim()) {
      setError(ROSTER_SHIFT_EDIT_REASON_REQUIRED_MESSAGE);
      return;
    }

    const changedFields = resolveRosterShiftDrawerChangedFields(viewingExistingShift, editFormInput);
    if (changedFields.length === 0) {
      setIsInlineEditing(false);
      return;
    }

    const utcTimes = rosterShiftDatetimeLocalToUtcIso({
      startsAtLocal: startsAt,
      endsAtLocal: endsAt,
      staffTimezone,
      tenantTimezone,
    });
    if ("error" in utcTimes) {
      setError(utcTimes.error);
      return;
    }

    startTransition(async () => {
      const result = await updateRosterShiftAction({
        tenantId,
        shiftId: viewingExistingShift.id,
        clinicId: clinicId || null,
        shiftType,
        startsAt: utcTimes.startsAt,
        endsAt: utcTimes.endsAt,
        notes: notes || null,
        editReason: editReasonRequired ? editReason : null,
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
    if (!viewingExistingShift || !canManage) return;
    if (!cancellationReason.trim()) {
      setError(ROSTER_SHIFT_CANCELLATION_REASON_REQUIRED_MESSAGE);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await cancelRosterShiftAction({
        tenantId,
        shiftId: viewingExistingShift.id,
        cancellationReason,
        notes: cancelNotes || null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      onRefresh();
    });
  }

  const readOnlyManageMessage = ROSTER_MANAGE_DENIED_REASON;
  const shiftIsGenerated =
    viewingExistingShift != null && isGeneratedShiftSource(viewingExistingShift.shift_source);

  return (
    <RosterRightDrawer
      open
      title={
        mode === "cell-actions"
          ? `${staffName} — ${formatRosterDrawerDateLabel(localDate)}`
          : formatRosterShiftDrawerTitle({
              mode: viewingExistingShift ? "edit" : "add",
              staffName,
              localDate,
            })
      }
      subtitle={
        mode === "cell-actions"
          ? "Add a manual shift, or optionally generate from standard hours."
          : null
      }
      onClose={onClose}
      testId="roster-shift-drawer"
    >
      {!canManage ? (
        <p
          className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-sm text-amber-100"
          data-testid="roster-shift-manage-denied"
        >
          {readOnlyManageMessage}
        </p>
      ) : null}

      {mode === "cell-actions" ? (
        <div className="space-y-3">
          {canManage ? (
            <>
              <ManualShiftForm
                staffName={staffName}
                clinicId={clinicId}
                clinics={clinics}
                shiftType={shiftType}
                startsAt={startsAt}
                endsAt={endsAt}
                notes={notes}
                adjustmentReason={adjustmentReason}
                editReason=""
                showAdjustmentReason
                showEditReason={false}
                pending={pending}
                readOnly={false}
                showSave={showCreateSave}
                saveLabel="Add shift"
                onClinicChange={setClinicId}
                onShiftTypeChange={setShiftType}
                onStartsAtChange={setStartsAt}
                onEndsAtChange={setEndsAt}
                onNotesChange={setNotes}
                onAdjustmentReasonChange={setAdjustmentReason}
                onEditReasonChange={setEditReason}
                onSubmit={handleCreateManual}
              />
              <button
                type="button"
                disabled={pending || !canGenerateFromStandardHours}
                onClick={handleGenerateDay}
                data-testid="generate-day-from-standard-hours"
                title={
                  !canGenerateFromStandardHours
                    ? "No standard hours are set for this day."
                    : "Optional template fill from standard hours"
                }
                className="w-full rounded-lg border border-cyan-500/35 px-4 py-2.5 text-left text-sm text-cyan-200 hover:bg-cyan-950/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Generate this day from standard hours (optional)
              </button>
              {!canGenerateFromStandardHours ? (
                <p
                  className="text-xs text-slate-500"
                  data-testid="generate-day-no-standard-hours"
                >
                  No standard hours template for this day — add a shift manually above.
                </p>
              ) : null}
              {canManageStandardHours ? (
                <button
                  type="button"
                  onClick={() => onEditStandardHours(staffId)}
                  className="w-full rounded-lg border border-white/[0.12] px-4 py-2.5 text-sm text-slate-400 hover:bg-white/[0.04]"
                >
                  Edit standard hours template
                </button>
              ) : null}
            </>
          ) : null}
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        </div>
      ) : (
        <div className="space-y-3">
          {viewingExistingShift ? (
            <p className="text-[11px] text-slate-500" data-testid="roster-shift-source-label">
              {shiftSourceDisplayLabel(viewingExistingShift.shift_source)}
            </p>
          ) : null}

          {canManage && canShowEditButton && !isInlineEditing ? (
            <button
              type="button"
              onClick={handleStartInlineEdit}
              data-testid="roster-shift-edit-start"
              className="w-full rounded-lg border border-cyan-500/40 bg-cyan-950/20 px-4 py-2.5 text-sm font-medium text-cyan-200 hover:bg-cyan-950/40"
            >
              Edit shift
            </button>
          ) : null}

          <ManualShiftForm
            staffName={staffName}
            clinicId={clinicId}
            clinics={clinics}
            shiftType={shiftType}
            startsAt={startsAt}
            endsAt={endsAt}
            notes={notes}
            adjustmentReason={adjustmentReason}
            editReason={editReason}
            showAdjustmentReason={!viewingExistingShift}
            showEditReason={showInlineEditControls && editReasonRequired}
            pending={pending}
            readOnly={formReadOnly}
            showSave={showCreateSave}
            saveLabel="Add manual shift"
            showInlineEditActions={showInlineEditControls}
            onClinicChange={setClinicId}
            onShiftTypeChange={setShiftType}
            onStartsAtChange={setStartsAt}
            onEndsAtChange={setEndsAt}
            onNotesChange={setNotes}
            onAdjustmentReasonChange={setAdjustmentReason}
            onEditReasonChange={setEditReason}
            onSubmit={viewingExistingShift && isInlineEditing ? handleUpdateShift : handleCreateManual}
            onCancelEdit={handleCancelInlineEdit}
          />

          {viewingExistingShift && canManage && canCancelShift && !isInlineEditing ? (
            <div
              className="space-y-3 rounded-lg border border-rose-500/20 bg-rose-950/10 p-3"
              data-testid="roster-shift-cancel-section"
            >
              <p className="text-sm font-medium text-rose-200">
                {shiftIsGenerated ? "Remove this shift" : "Cancel this shift"}
              </p>
              <label className="block text-xs text-slate-400">
                Cancellation reason
                <select
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#0B1220] px-2 py-2 text-sm"
                  data-testid="roster-shift-cancellation-reason"
                >
                  <option value="">Select a reason…</option>
                  {ROSTER_SHIFT_DRAWER_CANCELLATION_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {formatRosterAdjustmentReasonLabel(reason)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-slate-400">
                Notes (optional)
                <input
                  value={cancelNotes}
                  onChange={(e) => setCancelNotes(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#0B1220] px-2 py-2 text-sm"
                  placeholder="Additional context"
                />
              </label>
              <button
                type="button"
                disabled={pending || !cancellationReason.trim()}
                onClick={handleCancelShift}
                data-testid="roster-shift-cancel-confirm"
                className="rounded-lg border border-rose-500/40 px-3 py-2 text-sm text-rose-300 hover:bg-rose-950/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {shiftIsGenerated ? "Confirm remove shift" : "Confirm cancel shift"}
              </button>
            </div>
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
  adjustmentReason: string;
  editReason: string;
  showAdjustmentReason: boolean;
  showEditReason: boolean;
  pending: boolean;
  readOnly: boolean;
  showSave: boolean;
  saveLabel: string;
  showInlineEditActions?: boolean;
  onClinicChange: (v: string) => void;
  onShiftTypeChange: (v: string) => void;
  onStartsAtChange: (v: string) => void;
  onEndsAtChange: (v: string) => void;
  onNotesChange: (v: string) => void;
  onAdjustmentReasonChange: (v: string) => void;
  onEditReasonChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancelEdit?: () => void;
};

function ManualShiftForm({
  staffName,
  clinicId,
  clinics,
  shiftType,
  startsAt,
  endsAt,
  notes,
  adjustmentReason,
  editReason,
  showAdjustmentReason,
  showEditReason,
  pending,
  readOnly,
  showSave,
  saveLabel,
  showInlineEditActions = false,
  onClinicChange,
  onShiftTypeChange,
  onStartsAtChange,
  onEndsAtChange,
  onNotesChange,
  onAdjustmentReasonChange,
  onEditReasonChange,
  onSubmit,
  onCancelEdit,
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
          disabled={readOnly}
          className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#0B1220] px-2 py-2 text-sm disabled:opacity-70"
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
          disabled={readOnly}
          className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#0B1220] px-2 py-2 text-sm disabled:opacity-70"
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
          disabled={readOnly}
          className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#0B1220] px-2 py-2 text-sm disabled:opacity-70"
          required={!readOnly}
        />
      </label>
      <label className="block text-xs text-slate-400">
        Ends
        <input
          type="datetime-local"
          value={endsAt}
          onChange={(e) => onEndsAtChange(e.target.value)}
          disabled={readOnly}
          className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#0B1220] px-2 py-2 text-sm disabled:opacity-70"
          required={!readOnly}
        />
      </label>
      {showAdjustmentReason ? (
        <label className="block text-xs text-slate-400">
          Reason
          <select
            value={adjustmentReason}
            onChange={(e) => onAdjustmentReasonChange(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#0B1220] px-2 py-2 text-sm"
            data-testid="roster-shift-adjustment-reason"
          >
            {ROSTER_MANUAL_ADJUSTMENT_REASONS.map((reason) => (
              <option key={reason} value={reason}>
                {formatRosterAdjustmentReasonLabel(reason)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {showEditReason ? (
        <label className="block text-xs text-slate-400">
          Edit reason
          <select
            value={editReason}
            onChange={(e) => onEditReasonChange(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#0B1220] px-2 py-2 text-sm"
            data-testid="roster-shift-edit-reason"
            required
          >
            <option value="">Select a reason…</option>
            {ROSTER_SHIFT_EDIT_REASONS.map((reason) => (
              <option key={reason} value={reason}>
                {formatRosterAdjustmentReasonLabel(reason)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="block text-xs text-slate-400">
        Notes
        <input
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          disabled={readOnly}
          className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#0B1220] px-2 py-2 text-sm disabled:opacity-70"
          placeholder="Manual adjustment"
        />
      </label>
      {showSave ? (
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg border border-white/[0.12] px-4 py-2.5 text-sm font-medium text-slate-100 hover:bg-white/[0.04] disabled:opacity-50"
        >
          {pending ? "Saving…" : saveLabel}
        </button>
      ) : null}
      {showInlineEditActions ? (
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            data-testid="roster-shift-edit-save"
            className="flex-1 rounded-lg border border-cyan-500/40 bg-cyan-950/30 px-4 py-2.5 text-sm font-medium text-cyan-100 hover:bg-cyan-950/50 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onCancelEdit}
            data-testid="roster-shift-edit-cancel"
            className="flex-1 rounded-lg border border-white/[0.12] px-4 py-2.5 text-sm text-slate-200 hover:bg-white/[0.04] disabled:opacity-50"
          >
            Cancel editing
          </button>
        </div>
      ) : null}
    </form>
  );
}
