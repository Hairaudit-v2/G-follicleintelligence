"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { cn } from "@/lib/utils";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { StaffHrTaskMapEntryBanner } from "@/src/components/fi/workforce/StaffHrTaskMapEntryBanner";
import { RosterShiftDrawer } from "@/src/components/fi/workforce/RosterShiftDrawer";
import { RosterSidePanel } from "@/src/components/fi/workforce/RosterSidePanel";
import { RosterWeekGrid } from "@/src/components/fi/workforce/RosterWeekGrid";
import {
  applyDefaultClinicStandardHoursAction,
  clearGeneratedRosterShiftsAction,
  copyPreviousRosterPeriodAction,
  generateRosterFromStandardHoursAction,
} from "@/src/lib/actions/workforce-roster-actions";
import {
  rosterCadencePeriodLabel,
  rosterClearGeneratedActionLabel,
  rosterClearGeneratedConfirmMessage,
  rosterCopyPreviousActionLabel,
  rosterCreateBlankActionLabel,
  rosterCreateBlankConfirmMessage,
  rosterGenerateActionLabel,
  rosterRegenerateGeneratedActionLabel,
  shiftRosterPeriodStart,
} from "@/src/lib/workforce/rosterCadencePolicyCore";
import type { RosterCommandCentrePayload } from "@/src/lib/workforce-os/workforceRosterCommandCentre.server";
import type { RosterGridShift } from "@/src/lib/workforce-os/workforceRosterCommandCentre.server";
import {
  buildRosterCommandCentreHref,
  rosterCommandCentrePeriodQueryParams,
  rosterDateRangeFromPeriodStartParam,
  type RosterStaffingStatusFilter,
} from "@/src/lib/workforce-os/workforceRosterQueryParams";
import {
  buildStaffStandardHoursSetupIndexHref,
  buildWorkforceStaffProfileHref,
  STAFF_STANDARD_HOURS_MANAGE_DENIED_REASON,
} from "@/src/lib/workforce-os/staffStandardHoursRoutes";
import type { RosterAssignableCandidate } from "@/src/lib/workforce-os/workforceRosterCandidates";
import {
  closeRosterDrawer,
  openRosterShiftDrawer,
  pushRosterStandardHoursEditorNavigation,
  resolveRosterCellClickOutcome,
  resolveRosterDrawerStaffContext,
  resolveRosterDrawerStaffMemberId,
  resolveRosterManageDeniedMessage,
  resolveRosterPayloadWeekDayDates,
  ROSTER_DRAWER_STAFF_UNAVAILABLE_MESSAGE,
  ROSTER_PAGE_SCROLL_ROOT_CLASSES,
  shiftMatchesRosterCellDate,
  type RosterCommandCentreDrawerState,
} from "@/src/lib/workforce-os/rosterCommandCentreUxCore";
import { filterRosterGridStaffOptions } from "@/src/lib/workforce-os/rosterEligibleStaffCore";

const STATUS_FILTERS: Array<{ id: RosterStaffingStatusFilter | ""; label: string }> = [
  { id: "", label: "All statuses" },
  { id: "ready", label: "Ready" },
  { id: "missing_roles", label: "Missing roles" },
  { id: "warning", label: "Warning" },
  { id: "blocked", label: "Blocked" },
  { id: "no_template", label: "No template" },
];

export type RosterCommandCentreViewProps = {
  tenantId: string;
  payload: RosterCommandCentrePayload;
  eventDetails: Record<
    string,
    { candidatesByRole: Record<string, RosterAssignableCandidate[]> } | undefined
  >;
  filters: {
    periodStart: string;
    weekStart: string;
    clinicId: string;
    staffId: string;
    eventType: string;
    status: RosterStaffingStatusFilter | "";
  };
  useWorkforceOsRoute?: boolean;
  useTeamRoute?: boolean;
  canManage?: boolean;
  canManageStandardHours?: boolean;
  manageDeniedReason?: string;
};

function rosterDrawerShift(
  drawer: RosterCommandCentreDrawerState,
  shifts: RosterGridShift[]
): RosterGridShift | null {
  if (drawer.kind !== "shift" || !drawer.shiftId) return null;
  return shifts.find((shift) => shift.id === drawer.shiftId) ?? null;
}

function rosterPeriodStartFieldLabel(cadence: RosterCommandCentrePayload["rosterPlanning"]["rosterCadence"]): string {
  switch (cadence) {
    case "fortnightly":
      return "Fortnight starting";
    case "monthly":
      return "Month starting";
    default:
      return "Week starting";
  }
}

export function RosterCommandCentreView({
  tenantId,
  payload,
  eventDetails,
  filters,
  useWorkforceOsRoute = false,
  useTeamRoute = false,
  canManage = true,
  canManageStandardHours = true,
  manageDeniedReason,
}: RosterCommandCentreViewProps) {
  const router = useRouter();
  const actionErrorRef = useRef<HTMLParagraphElement | null>(null);
  const [selectedEventKey, setSelectedEventKey] = useState(payload.preselectedEventKey);
  const [drawerState, setDrawerState] = useState<RosterCommandCentreDrawerState>({
    kind: "closed",
  });
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [ineligibleExpanded, setIneligibleExpanded] = useState(false);
  const [pending, startTransition] = useTransition();

  /** Normalise once — blank strings from pages must never surface as silent denies. */
  const manageDeniedMessage = resolveRosterManageDeniedMessage(manageDeniedReason);

  const rosterPlanning = payload.rosterPlanning;
  const rosterCadence = rosterPlanning.rosterCadence;
  const periodLabel = rosterCadencePeriodLabel(rosterCadence);

  const periodRange = useMemo(
    () => rosterDateRangeFromPeriodStartParam(filters.periodStart, rosterPlanning),
    [filters.periodStart, rosterPlanning]
  );

  const weekDayDates = useMemo(() => resolveRosterPayloadWeekDayDates(payload), [payload]);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const staffMissingStandardHours = payload.staffMissingStandardHours;
  const ineligibleStaffOptions = payload.ineligibleStaffOptions;
  const rosterGridStaffOptions =
    payload.rosterGridStaffOptions ??
    filterRosterGridStaffOptions(payload.staffOptions, payload.eligibleStaffIds);

  const drawerStaffMemberId = resolveRosterDrawerStaffMemberId(drawerState);
  const drawerShift = rosterDrawerShift(drawerState, payload.shifts);
  const drawerStaff = resolveRosterDrawerStaffContext({
    drawer: drawerState,
    staffOptions: payload.staffOptions,
    rosterGridStaffOptions,
    selectedShift: drawerShift,
  });
  const drawerDayShifts = useMemo(() => {
    if (drawerState.kind !== "shift" || !drawerStaffMemberId) return [];
    return payload.shifts.filter((shift) =>
      shiftMatchesRosterCellDate(shift, drawerStaffMemberId, drawerState.localDate)
    );
  }, [drawerState, drawerStaffMemberId, payload.shifts]);

  useEffect(() => {
    if (!actionError) return;
    actionErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [actionError]);

  function closeDrawer() {
    setDrawerState(closeRosterDrawer());
  }

  const openStandardHoursDrawer = useCallback(
    (staffMemberId: string) => {
      const result = pushRosterStandardHoursEditorNavigation(router, {
        tenantId,
        staffMemberId,
        canManage,
        manageDeniedReason: manageDeniedMessage,
      });
      if (result.outcome === "deny") {
        setActionError(result.reason);
        return;
      }
      setActionError(null);
    },
    [canManage, manageDeniedMessage, router, tenantId]
  );

  function handleApplyDefaultClinicHours() {
    if (!canManage) {
      setActionError(manageDeniedMessage);
      return;
    }
    const count = staffMissingStandardHours.length;
    const confirmed = window.confirm(
      `Apply default clinic hours (Mon–Fri 08:30–17:00, 30 min break) to ${count} staff member${count === 1 ? "" : "s"} without standard hours?\n\nExisting standard hours will not be changed.`
    );
    if (!confirmed) return;

    setActionError(null);
    setActionMessage(null);
    startTransition(async () => {
      const result = await applyDefaultClinicStandardHoursAction({ tenantId });
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      setActionMessage(
        `Default clinic hours applied to ${result.data.appliedCount} staff (${result.data.skippedCount} skipped — already configured).`
      );
      refresh();
    });
  }

  function pushFilters(next: Partial<RosterCommandCentreViewProps["filters"]>) {
    const merged = { ...filters, ...next };
    router.push(
      buildRosterCommandCentreHref({
        tenantId,
        ...rosterCommandCentrePeriodQueryParams(merged.periodStart, rosterPlanning),
        clinicId: merged.clinicId || null,
        staffId: merged.staffId || null,
        eventType: merged.eventType || null,
        status: merged.status || null,
        eventSource: selectedEventKey?.split(":")[0] as "booking" | undefined,
        eventId: selectedEventKey?.split(":")[1] ?? null,
        useWorkforceOsRoute,
        useTeamRoute,
      })
    );
  }

  function shiftDisplayedPeriod(direction: -1 | 1) {
    pushFilters({
      periodStart: shiftRosterPeriodStart(filters.periodStart, rosterCadence, direction),
      weekStart: shiftRosterPeriodStart(filters.periodStart, rosterCadence, direction),
    });
  }

  function openShiftDrawer(input: {
    mode: "add" | "edit" | "cell-actions";
    staffMemberId: string;
    localDate: string;
    shiftId: string | null;
    selectedShift?: RosterGridShift | null;
  }) {
    const nextDrawer = openRosterShiftDrawer(input);
    const staff = resolveRosterDrawerStaffContext({
      drawer: nextDrawer,
      staffOptions: payload.staffOptions,
      rosterGridStaffOptions,
      selectedShift: input.selectedShift ?? null,
    });
    if (!staff) {
      setActionError(ROSTER_DRAWER_STAFF_UNAVAILABLE_MESSAGE);
      return;
    }
    setActionError(null);
    setDrawerState(nextDrawer);
  }

  function handleCellClick(staffId: string, localDate: string) {
    const clickOutcome = resolveRosterCellClickOutcome({
      staffId,
      eligibleStaffIds: payload.eligibleStaffIds,
      canManage,
      manageDeniedReason: manageDeniedMessage,
    });

    if (clickOutcome.outcome === "deny") {
      setActionError(clickOutcome.message);
      return;
    }

    openShiftDrawer({
      mode: clickOutcome.mode,
      staffMemberId: staffId,
      localDate,
      shiftId: null,
    });
  }

  function handleShiftClick(shift: RosterGridShift) {
    openShiftDrawer({
      mode: "edit",
      staffMemberId: shift.staff_id,
      localDate: shift.localDate ?? shift.starts_at.slice(0, 10),
      shiftId: shift.id,
      selectedShift: shift,
    });
  }

  function handleGenerateRoster(overwriteGeneratedOnly: boolean) {
    setActionError(null);
    setActionMessage(null);
    startTransition(async () => {
      const result = await generateRosterFromStandardHoursAction({
        tenantId,
        rangeStartIso: periodRange.startsAt,
        rangeEndIso: periodRange.endsAt,
        staffIds: filters.staffId ? [filters.staffId] : undefined,
        overwriteGeneratedOnly,
      });
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      setActionMessage(
        `Generate roster: ${result.data.createdCount} shifts created, ${result.data.skippedCount} skipped.`
      );
      refresh();
    });
  }

  function handleCopyPreviousPeriod() {
    setActionError(null);
    setActionMessage(null);
    startTransition(async () => {
      const result = await copyPreviousRosterPeriodAction({
        tenantId,
        targetPeriodStartIso: filters.periodStart,
        staffIds: filters.staffId ? [filters.staffId] : undefined,
      });
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      setActionMessage(
        `${rosterCopyPreviousActionLabel(rosterCadence)}: ${result.data.createdCount} shifts copied.`
      );
      refresh();
    });
  }

  function handleClearGeneratedShifts(confirmMessage: string, successPrefix: string) {
    if (!canManage) {
      setActionError(manageDeniedMessage);
      return;
    }
    if (!window.confirm(confirmMessage)) return;

    setActionError(null);
    setActionMessage(null);
    startTransition(async () => {
      const result = await clearGeneratedRosterShiftsAction({
        tenantId,
        rangeStartIso: periodRange.startsAt,
        rangeEndIso: periodRange.endsAt,
        staffIds: filters.staffId ? [filters.staffId] : undefined,
      });
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      setActionMessage(
        `${successPrefix}: ${result.data.cancelledCount} generated shift${result.data.cancelledCount === 1 ? "" : "s"} removed. Manual shifts were kept.`
      );
      refresh();
    });
  }

  function handleCreateBlankFortnight() {
    handleClearGeneratedShifts(
      rosterCreateBlankConfirmMessage(rosterCadence),
      rosterCreateBlankActionLabel(rosterCadence)
    );
  }

  function handleResetGeneratedFortnight() {
    handleClearGeneratedShifts(
      rosterClearGeneratedConfirmMessage(rosterCadence),
      rosterClearGeneratedActionLabel(rosterCadence)
    );
  }

  return (
    <div
      className={cn(ROSTER_PAGE_SCROLL_ROOT_CLASSES, fiOsChromeClasses.pageScrollContent, "space-y-6")}
      data-testid="roster-command-centre"
      data-roster-cadence={rosterCadence}
      data-roster-drawer-kind={drawerState.kind}
    >
      <header>
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">WorkforceOS</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50">
          Roster Command Centre
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Build the {periodLabel} roster manually, copy a previous period, or optionally generate
          from standard hours. Adjust individual shifts at any time — changes persist until you
          choose to regenerate.
        </p>
        {!useTeamRoute ? (
          <p className="mt-2 text-xs text-slate-500">
            <Link
              href={`/fi-admin/${tenantId}/workforce-os`}
              className="text-cyan-400 hover:text-cyan-300"
            >
              Workforce Command Centre
            </Link>
            {" · "}
            <Link href={`/fi-admin/${tenantId}/hr-os`} className="text-cyan-400 hover:text-cyan-300">
              HR dashboard
            </Link>
          </p>
        ) : null}
      </header>

      <StaffHrTaskMapEntryBanner tenantId={tenantId} surface="roster_command_centre" />

      {!canManage ? (
        <section
          className="rounded-xl border border-slate-500/30 bg-slate-900/60 px-4 py-3"
          data-testid="roster-manage-denied-banner"
          role="status"
        >
          <p className="text-sm font-medium text-slate-200">View-only roster access</p>
          <p className="mt-1 text-xs text-slate-400">{manageDeniedMessage}</p>
        </section>
      ) : null}

      <section className="rounded-2xl border border-white/[0.08] bg-[#0F1629]/60 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => shiftDisplayedPeriod(-1)}
              className="rounded-lg border border-white/[0.08] px-2 py-2 text-sm text-slate-300 hover:bg-white/[0.04]"
              aria-label={`Previous ${periodLabel}`}
            >
              ←
            </button>
            <label className="block text-xs text-slate-400">
              {rosterPeriodStartFieldLabel(rosterCadence)}
              <input
                id="roster-period-start"
                name="periodStart"
                type="date"
                value={filters.periodStart}
                onChange={(e) =>
                  pushFilters({ periodStart: e.target.value, weekStart: e.target.value })
                }
                className="mt-1 block rounded-lg border border-white/[0.08] bg-[#0B1220] px-3 py-2 text-sm text-slate-100"
                data-testid="roster-period-start-input"
              />
            </label>
            <button
              type="button"
              onClick={() => shiftDisplayedPeriod(1)}
              className="rounded-lg border border-white/[0.08] px-2 py-2 text-sm text-slate-300 hover:bg-white/[0.04]"
              aria-label={`Next ${periodLabel}`}
            >
              →
            </button>
          </div>

          <label className="block text-xs text-slate-400">
            Clinic
            <select
              id="roster-clinic-filter"
              name="clinicId"
              value={filters.clinicId}
              onChange={(e) => pushFilters({ clinicId: e.target.value })}
              className="mt-1 block min-w-[140px] rounded-lg border border-white/[0.08] bg-[#0B1220] px-3 py-2 text-sm text-slate-100"
            >
              <option value="">All clinics</option>
              {payload.clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs text-slate-400">
            Staff
            <select
              id="roster-staff-filter"
              name="staffId"
              value={filters.staffId}
              onChange={(e) => pushFilters({ staffId: e.target.value })}
              className="mt-1 block min-w-[140px] rounded-lg border border-white/[0.08] bg-[#0B1220] px-3 py-2 text-sm text-slate-100"
            >
              <option value="">All staff</option>
              {payload.staffOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs text-slate-400">
            Event type
            <input
              id="roster-event-type-filter"
              name="eventType"
              value={filters.eventType}
              onChange={(e) => pushFilters({ eventType: e.target.value })}
              placeholder="e.g. surgery"
              className="mt-1 block rounded-lg border border-white/[0.08] bg-[#0B1220] px-3 py-2 text-sm text-slate-100"
            />
          </label>

          <label className="block text-xs text-slate-400">
            Staffing status
            <select
              id="roster-status-filter"
              name="status"
              value={filters.status}
              onChange={(e) =>
                pushFilters({ status: e.target.value as RosterStaffingStatusFilter | "" })
              }
              className="mt-1 block min-w-[140px] rounded-lg border border-white/[0.08] bg-[#0B1220] px-3 py-2 text-sm text-slate-100"
            >
              {STATUS_FILTERS.map((f) => (
                <option key={f.label} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap gap-2 pb-0.5">
            <button
              type="button"
              disabled={pending}
              onClick={handleCreateBlankFortnight}
              className="rounded-lg border border-white/[0.12] px-3 py-2 text-sm font-medium text-slate-100 hover:bg-white/[0.04] disabled:opacity-50"
              data-testid="roster-create-blank-button"
            >
              {rosterCreateBlankActionLabel(rosterCadence)}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => handleGenerateRoster(false)}
              className="rounded-lg border border-cyan-500/40 px-3 py-2 text-sm text-cyan-300 hover:bg-cyan-950/30 disabled:opacity-50"
              data-testid="roster-generate-button"
              title="Optional — uses standard hours as a template"
            >
              {rosterGenerateActionLabel(rosterCadence)}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={handleCopyPreviousPeriod}
              className="rounded-lg border border-white/[0.12] px-3 py-2 text-sm text-slate-200 hover:bg-white/[0.04] disabled:opacity-50"
              data-testid="roster-copy-previous-button"
            >
              {rosterCopyPreviousActionLabel(rosterCadence)}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={handleResetGeneratedFortnight}
              className="rounded-lg border border-amber-500/30 px-3 py-2 text-sm text-amber-200 hover:bg-amber-950/20 disabled:opacity-50"
              data-testid="roster-clear-generated-button"
            >
              {rosterClearGeneratedActionLabel(rosterCadence)}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => handleGenerateRoster(true)}
              className="rounded-lg border border-white/[0.08] px-3 py-2 text-xs text-slate-400 hover:bg-white/[0.04] disabled:opacity-50"
              data-testid="roster-regenerate-button"
              title="Replaces generated shifts only — manual shifts are preserved"
            >
              {rosterRegenerateGeneratedActionLabel()}
            </button>
          </div>
        </div>

        {actionMessage ? (
          <p className="mt-3 text-sm text-emerald-300" role="status" data-testid="roster-action-message">
            {actionMessage}
          </p>
        ) : null}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Clinical events", value: payload.summary.totalClinicalEvents },
          { label: "Ready", value: payload.summary.readyEvents, tone: "text-emerald-300" },
          {
            label: "Missing roles",
            value: payload.summary.missingRoleEvents,
            tone: "text-amber-300",
          },
          { label: "Open roles", value: payload.summary.openRequiredRoles, tone: "text-rose-300" },
        ].map((tile) => (
          <div
            key={tile.label}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
          >
            <p className="text-xs text-slate-500">{tile.label}</p>
            <p className={`mt-2 text-2xl font-semibold ${tile.tone ?? "text-slate-100"}`}>
              {tile.value}
            </p>
          </div>
        ))}
      </section>

      {staffMissingStandardHours.length > 0 && canManageStandardHours ? (
        <section
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/25 bg-amber-950/20 px-4 py-3"
          data-testid="roster-standard-hours-banner"
        >
          <p className="text-sm text-amber-100">
            Some staff have no standard hours template. You can still build this roster manually —
            standard hours are optional and only used when you choose Generate.
          </p>
          {canManage ? (
            <div className="flex shrink-0 flex-wrap gap-2">
              <Link
                href={buildStaffStandardHoursSetupIndexHref(tenantId)}
                className="rounded-lg border border-amber-400/40 bg-amber-950/40 px-4 py-2 text-sm font-medium text-amber-100 hover:bg-amber-950/60"
                data-testid="roster-standard-hours-banner-cta"
              >
                Set standard hours (optional)
              </Link>
              <button
                type="button"
                disabled={pending}
                onClick={handleApplyDefaultClinicHours}
                className="rounded-lg border border-amber-400/40 bg-amber-950/40 px-4 py-2 text-sm font-medium text-amber-100 hover:bg-amber-950/60 disabled:opacity-50"
                data-testid="roster-apply-default-clinic-hours"
              >
                Apply default clinic hours
              </button>
            </div>
          ) : (
            <span
              className="shrink-0 cursor-not-allowed rounded-lg border border-white/[0.12] px-4 py-2 text-sm text-slate-500"
              title={STAFF_STANDARD_HOURS_MANAGE_DENIED_REASON}
              data-testid="roster-standard-hours-banner-cta-disabled"
            >
              Set standard hours
            </span>
          )}
        </section>
      ) : null}


      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold capitalize text-slate-100">{periodLabel} roster</h2>
          <p className="mt-1 text-xs text-slate-500">
            Click an empty cell to <strong className="font-medium text-slate-300">Add shift</strong>{" "}
            or mark sick/personal leave. Click an existing shift to edit or cancel it. Standard
            hours are optional — use Generate only when you want a template fill.
          </p>
        </div>
        {actionError ? (
          <p
            ref={actionErrorRef}
            className="rounded-lg border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-sm text-rose-100"
            role="alert"
            data-testid="roster-action-error"
          >
            {actionError}
          </p>
        ) : null}
        <RosterWeekGrid
          tenantId={tenantId}
          weekDayDates={weekDayDates}
          staffOptions={rosterGridStaffOptions}
          shifts={payload.shifts}
          availabilityCells={payload.availabilityCells}
          standardHoursByStaffId={payload.standardHoursByStaffId}
          rosterCadence={rosterCadence}
          rosterCycleAnchorDate={rosterPlanning.rosterCycleAnchorDate}
          canManage={canManage}
          manageDeniedReason={manageDeniedMessage}
          showStandardHoursEditor={canManageStandardHours}
          selectedShiftId={drawerShift?.id ?? null}
          onCellClick={handleCellClick}
          onShiftClick={handleShiftClick}
          onEditStandardHours={openStandardHoursDrawer}
        />
      </section>

      {ineligibleStaffOptions.length > 0 ? (
        <section
          className="rounded-xl border border-slate-500/25 bg-slate-950/30 px-4 py-3"
          data-testid="roster-ineligible-staff-section"
        >
          <button
            type="button"
            onClick={() => setIneligibleExpanded((open) => !open)}
            className="flex w-full items-center justify-between gap-3 text-left"
            aria-expanded={ineligibleExpanded}
            data-testid="roster-ineligible-staff-toggle"
          >
            <div>
              <h2 className="text-sm font-semibold text-slate-200">
                Not rostered this period ({ineligibleStaffOptions.length})
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Staff on leave, maternity leave, inactive, or otherwise excluded from roster
                generation for the selected {periodLabel}.
              </p>
            </div>
            <span className="text-xs text-slate-400">{ineligibleExpanded ? "Hide" : "Show"}</span>
          </button>
          {ineligibleExpanded ? (
            <ul className="mt-3 space-y-2">
              {ineligibleStaffOptions.map((staff) => (
                <li
                  key={staff.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-slate-300"
                  data-testid={`roster-ineligible-staff-${staff.id}`}
                >
                  <div className="min-w-0">
                    <Link
                      href={buildWorkforceStaffProfileHref(tenantId, staff.id)}
                      className="font-medium text-slate-100 hover:text-cyan-300"
                    >
                      {staff.name}
                    </Link>
                    {staff.role ? (
                      <span className="ml-2 capitalize text-slate-500">{staff.role}</span>
                    ) : null}
                    <span className="text-slate-500"> · </span>
                    <span className="text-amber-200/90">{staff.reasonLabel}</span>
                    <span className="text-slate-500"> · </span>
                    <Link
                      href={buildWorkforceStaffProfileHref(tenantId, staff.id)}
                      className="text-[11px] text-cyan-400/90 hover:text-cyan-300"
                    >
                      Manage employment
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <RosterSidePanel
        tenantId={tenantId}
        events={payload.events}
        selectedEventKey={selectedEventKey}
        eventDetails={eventDetails}
        onRefresh={refresh}
        onSelectEvent={setSelectedEventKey}
      />

      {drawerState.kind === "shift" && drawerStaff && drawerStaffMemberId ? (
        <RosterShiftDrawer
          open
          tenantId={tenantId}
          mode={drawerState.mode}
          staffId={drawerStaffMemberId}
          staffName={drawerStaff.name}
          staffRole={drawerStaff.role}
          localDate={drawerState.localDate}
          filterClinicId={filters.clinicId}
          standardHours={payload.standardHoursByStaffId[drawerStaffMemberId]}
          rosterCadence={rosterCadence}
          rosterCycleAnchorDate={rosterPlanning.rosterCycleAnchorDate}
          selectedShift={drawerShift}
          dayShifts={drawerDayShifts}
          clinics={payload.clinics}
          staffTimezone={payload.staffTimezoneByStaffId[drawerStaffMemberId] ?? null}
          tenantTimezone={payload.tenantTimezone}
          canManage={canManage}
          manageDeniedReason={manageDeniedMessage}
          canManageStandardHours={canManageStandardHours}
          onClose={closeDrawer}
          onRefresh={refresh}
          onEditStandardHours={openStandardHoursDrawer}
        />
      ) : null}


    </div>
  );
}
