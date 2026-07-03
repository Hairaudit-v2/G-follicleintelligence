"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";

import { cn } from "@/lib/utils";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { StaffStandardHoursPanel } from "@/src/components/fi/workforce/StaffStandardHoursPanel";
import { RosterRightDrawer } from "@/src/components/fi/workforce/RosterRightDrawer";
import { RosterShiftDrawer } from "@/src/components/fi/workforce/RosterShiftDrawer";
import { RosterSidePanel } from "@/src/components/fi/workforce/RosterSidePanel";
import { RosterWeekGrid } from "@/src/components/fi/workforce/RosterWeekGrid";
import {
  copyPreviousRosterPeriodAction,
  generateRosterFromStandardHoursAction,
} from "@/src/lib/actions/workforce-roster-actions";
import type { RosterCommandCentrePayload } from "@/src/lib/workforce-os/workforceRosterCommandCentre.server";
import type { RosterGridShift } from "@/src/lib/workforce-os/workforceRosterCommandCentre.server";
import {
  buildRosterCommandCentreHref,
  type RosterStaffingStatusFilter,
} from "@/src/lib/workforce-os/workforceRosterQueryParams";
import type { RosterAssignableCandidate } from "@/src/lib/workforce-os/workforceRosterCandidates";
import {
  emptyStandardHoursWeek,
  staffHasConfiguredStandardHours,
} from "@/src/lib/workforce-os/staffStandardHoursCore";
import {
  closeRosterDrawer,
  formatStandardHoursDrawerTitle,
  listStaffMissingStandardHours,
  openRosterMissingStandardHoursSetupDrawer,
  openRosterShiftDrawer,
  openRosterStandardHoursDrawer,
  resolveRosterCellClickIntent,
  resolveRosterDrawerStaffMemberId,
  resolveRosterDrawerStaffName,
  ROSTER_PAGE_SCROLL_ROOT_CLASSES,
  type RosterCommandCentreDrawerState,
} from "@/src/lib/workforce-os/rosterCommandCentreUxCore";
import {
  groupDatesIntoWeekRows,
  isRosterCadenceConfigured,
  rosterCadencePeriodLabel,
  rosterCopyPreviousActionLabel,
  rosterGenerateActionLabel,
  shiftRosterPeriodStart,
} from "@/src/lib/workforce/rosterCadencePolicyCore";

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
};

function rosterDrawerShift(
  drawer: RosterCommandCentreDrawerState,
  shifts: RosterGridShift[]
): RosterGridShift | null {
  if (drawer.kind !== "shift" || !drawer.shiftId) return null;
  return shifts.find((shift) => shift.id === drawer.shiftId) ?? null;
}

function rosterDrawerStaffOption(
  drawer: RosterCommandCentreDrawerState,
  staffOptions: RosterCommandCentrePayload["staffOptions"]
) {
  const staffMemberId = resolveRosterDrawerStaffMemberId(drawer);
  if (!staffMemberId) return null;
  return staffOptions.find((staff) => staff.id === staffMemberId) ?? null;
}

function rosterGridSections(
  payload: RosterCommandCentrePayload
): Array<{ key: string; title?: string; dates: string[] }> {
  const cadence = payload.rosterPlanning.rosterCadence;
  const dates = payload.periodDayDates;

  if (cadence === "fortnightly") {
    return [
      { key: "week-a", title: "Week A", dates: dates.slice(0, 7) },
      { key: "week-b", title: "Week B", dates: dates.slice(7, 14) },
    ];
  }

  if (cadence === "monthly") {
    const rows = groupDatesIntoWeekRows(dates, payload.rosterPlanning.rosterWeekStartDay);
    return rows.map((row, index) => ({
      key: `month-week-${index}`,
      title: `Week ${index + 1}`,
      dates: row,
    }));
  }

  return [{ key: "weekly", dates }];
}

export function RosterCommandCentreView({
  tenantId,
  payload,
  eventDetails,
  filters,
  useWorkforceOsRoute = false,
}: RosterCommandCentreViewProps) {
  const router = useRouter();
  const cadence = payload.rosterPlanning.rosterCadence;
  const periodLabel = rosterCadencePeriodLabel(cadence);
  const [selectedEventKey, setSelectedEventKey] = useState(payload.preselectedEventKey);
  const [drawerState, setDrawerState] = useState<RosterCommandCentreDrawerState>({
    kind: "closed",
  });
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const periodRange = useMemo(
    () => ({ startsAt: payload.dateRange.startsAt, endsAt: payload.dateRange.endsAt }),
    [payload.dateRange]
  );

  const gridSections = useMemo(() => rosterGridSections(payload), [payload]);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const staffMissingStandardHours = useMemo(
    () => listStaffMissingStandardHours(payload.staffOptions, payload.standardHoursByStaffId),
    [payload.staffOptions, payload.standardHoursByStaffId]
  );

  const drawerStaff = rosterDrawerStaffOption(drawerState, payload.staffOptions);
  const drawerStaffName = resolveRosterDrawerStaffName(drawerState, payload.staffOptions);
  const drawerStaffMemberId = resolveRosterDrawerStaffMemberId(drawerState);
  const drawerShift = rosterDrawerShift(drawerState, payload.shifts);
  const standardHoursDays =
    drawerState.kind === "standard_hours" &&
    payload.standardHoursByStaffId[drawerState.staffMemberId]
      ? payload.standardHoursByStaffId[drawerState.staffMemberId]
      : emptyStandardHoursWeek();

  function closeDrawer() {
    setDrawerState(closeRosterDrawer());
  }

  function openStandardHours(staffId: string) {
    setDrawerState(openRosterStandardHoursDrawer(staffId));
  }

  function openSetupPanel() {
    setDrawerState(openRosterMissingStandardHoursSetupDrawer());
  }

  function pushFilters(next: Partial<RosterCommandCentreViewProps["filters"]>) {
    const merged = { ...filters, ...next };
    const periodStart = merged.periodStart || merged.weekStart;
    router.push(
      buildRosterCommandCentreHref({
        tenantId,
        periodStart: cadence !== "monthly" ? periodStart : undefined,
        monthStart: cadence === "monthly" ? periodStart.slice(0, 7) : undefined,
        weekStart: cadence === "weekly" ? periodStart : undefined,
        clinicId: merged.clinicId || null,
        staffId: merged.staffId || null,
        eventType: merged.eventType || null,
        status: merged.status || null,
        eventSource: selectedEventKey?.split(":")[0] as "booking" | undefined,
        eventId: selectedEventKey?.split(":")[1] ?? null,
        useWorkforceOsRoute,
      })
    );
  }

  function shiftPeriod(direction: -1 | 1) {
    const next = shiftRosterPeriodStart(filters.periodStart, cadence, direction);
    pushFilters({ periodStart: next, weekStart: next });
  }

  function handleCellClick(staffId: string, localDate: string) {
    const standardHours = payload.standardHoursByStaffId[staffId];
    const hasStandardHours = staffHasConfiguredStandardHours(standardHours);
    const intent = resolveRosterCellClickIntent({ hasStandardHours });

    if (intent === "open_standard_hours") {
      openStandardHours(staffId);
      return;
    }

    setDrawerState(
      openRosterShiftDrawer({
        mode: "cell-actions",
        staffMemberId: staffId,
        localDate,
        shiftId: null,
      })
    );
  }

  function handleShiftClick(shift: RosterGridShift) {
    setDrawerState(
      openRosterShiftDrawer({
        mode: "edit",
        staffMemberId: shift.staff_id,
        localDate: shift.starts_at.slice(0, 10),
        shiftId: shift.id,
      })
    );
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
        `${rosterGenerateActionLabel(cadence)}: ${result.data.createdCount} shifts created, ${result.data.skippedCount} skipped (${result.data.cadence}).`
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
        `${rosterCopyPreviousActionLabel(cadence)}: ${result.data.createdCount} shifts copied.`
      );
      refresh();
    });
  }

  const periodPickerLabel =
    cadence === "monthly"
      ? "Month"
      : cadence === "fortnightly"
        ? "Fortnight starting"
        : "Week starting";

  const rosterSectionTitle =
    cadence === "monthly"
      ? "Monthly roster"
      : cadence === "fortnightly"
        ? "Fortnightly roster"
        : "Weekly roster";

  return (
    <div
      className={cn(ROSTER_PAGE_SCROLL_ROOT_CLASSES, fiOsChromeClasses.pageScrollContent, "space-y-6")}
      data-testid="roster-command-centre"
      data-roster-cadence={cadence}
    >
      <header>
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">WorkforceOS</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50">
          Roster Command Centre
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Set standard hours once, generate the {periodLabel} roster, adjust shifts as needed, and
          monitor clinical staffing coverage.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Cadence:{" "}
          <span data-testid="roster-cadence-label" className="text-slate-300">
            {cadence}
          </span>
          {" · "}
          <Link
            href={`/fi-admin/${tenantId}/settings/clinic-setup`}
            className="text-cyan-400 hover:text-cyan-300"
          >
            Clinic setup
          </Link>
          {" · "}
          <Link
            href={`/fi-admin/${tenantId}/workforce-os`}
            className="text-cyan-400 hover:text-cyan-300"
          >
            Workforce Command Centre
          </Link>
        </p>
      </header>

      {!isRosterCadenceConfigured(payload.rosterPlanning) ? (
        <section
          className="rounded-xl border border-amber-500/25 bg-amber-950/20 px-4 py-3 text-sm text-amber-100"
          data-testid="roster-cadence-banner"
        >
          Roster cadence is not configured.{" "}
          <Link
            href={`/fi-admin/${tenantId}/settings/clinic-setup`}
            className="font-medium text-amber-50 underline hover:text-white"
          >
            Configure in Clinic setup
          </Link>{" "}
          — defaulting to weekly planning until saved.
        </section>
      ) : null}

      <section className="rounded-2xl border border-white/[0.08] bg-[#0F1629]/60 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => shiftPeriod(-1)}
              className="rounded-lg border border-white/[0.08] px-2 py-2 text-sm text-slate-300 hover:bg-white/[0.04]"
              aria-label={`Previous ${periodLabel}`}
            >
              ←
            </button>
            <label className="block text-xs text-slate-400">
              {periodPickerLabel}
              {cadence === "monthly" ? (
                <input
                  type="month"
                  value={filters.periodStart.slice(0, 7)}
                  onChange={(e) => {
                    const month = e.target.value;
                    if (!month) return;
                    pushFilters({ periodStart: `${month}-01`, weekStart: `${month}-01` });
                  }}
                  className="mt-1 block rounded-lg border border-white/[0.08] bg-[#0B1220] px-3 py-2 text-sm text-slate-100"
                  data-testid="roster-month-picker"
                />
              ) : (
                <input
                  type="date"
                  value={filters.periodStart}
                  onChange={(e) =>
                    pushFilters({ periodStart: e.target.value, weekStart: e.target.value })
                  }
                  className="mt-1 block rounded-lg border border-white/[0.08] bg-[#0B1220] px-3 py-2 text-sm text-slate-100"
                  data-testid="roster-period-picker"
                />
              )}
            </label>
            <button
              type="button"
              onClick={() => shiftPeriod(1)}
              className="rounded-lg border border-white/[0.08] px-2 py-2 text-sm text-slate-300 hover:bg-white/[0.04]"
              aria-label={`Next ${periodLabel}`}
            >
              →
            </button>
          </div>

          <label className="block text-xs text-slate-400">
            Clinic
            <select
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
              value={filters.eventType}
              onChange={(e) => pushFilters({ eventType: e.target.value })}
              placeholder="e.g. surgery"
              className="mt-1 block rounded-lg border border-white/[0.08] bg-[#0B1220] px-3 py-2 text-sm text-slate-100"
            />
          </label>

          <label className="block text-xs text-slate-400">
            Staffing status
            <select
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
              onClick={() => handleGenerateRoster(false)}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
              data-testid="roster-generate-button"
            >
              {rosterGenerateActionLabel(cadence)}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => handleGenerateRoster(true)}
              className="rounded-lg border border-cyan-500/40 px-3 py-2 text-sm text-cyan-300 hover:bg-cyan-950/30 disabled:opacity-50"
            >
              Regenerate generated
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={handleCopyPreviousPeriod}
              className="rounded-lg border border-white/[0.12] px-3 py-2 text-sm text-slate-200 hover:bg-white/[0.04] disabled:opacity-50"
              data-testid="roster-copy-previous-button"
            >
              {rosterCopyPreviousActionLabel(cadence)}
            </button>
          </div>
        </div>

        {actionMessage ? <p className="mt-3 text-sm text-emerald-300">{actionMessage}</p> : null}
        {actionError ? <p className="mt-3 text-sm text-rose-300">{actionError}</p> : null}
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

      {staffMissingStandardHours.length > 0 ? (
        <section
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/25 bg-amber-950/20 px-4 py-3"
          data-testid="roster-standard-hours-banner"
        >
          <p className="text-sm text-amber-100">
            Some staff do not have standard hours. Patient allocation and roster generation may be
            incomplete.
          </p>
          <button
            type="button"
            onClick={openSetupPanel}
            className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500"
            data-testid="roster-standard-hours-banner-cta"
          >
            Set standard hours
          </button>
        </section>
      ) : null}

      <section className="space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">{rosterSectionTitle}</h2>
          <p className="mt-1 text-xs text-slate-500">
            Set standard hours per staff, generate the {periodLabel}, then adjust individual shifts
            only when needed.
          </p>
        </div>
        {gridSections.map((section) => (
          <div key={section.key} className="space-y-2">
            {section.title ? (
              <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {section.title}
              </h3>
            ) : null}
            <RosterWeekGrid
              weekDayDates={section.dates}
              staffOptions={payload.staffOptions}
              shifts={payload.shifts}
              availabilityCells={payload.availabilityCells}
              standardHoursByStaffId={payload.standardHoursByStaffId}
              rosterCadence={cadence}
              rosterCycleAnchorDate={payload.rosterPlanning.rosterCycleAnchorDate}
              selectedShiftId={drawerShift?.id ?? null}
              onCellClick={handleCellClick}
              onShiftClick={handleShiftClick}
              onEditStandardHours={openStandardHours}
            />
          </div>
        ))}
      </section>

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
          selectedShift={drawerShift}
          clinics={payload.clinics}
          onClose={closeDrawer}
          onRefresh={refresh}
          onEditStandardHours={openStandardHours}
        />
      ) : null}

      {drawerState.kind === "standard_hours" && drawerStaffName && drawerStaffMemberId ? (
        <RosterRightDrawer
          open
          wide
          title={formatStandardHoursDrawerTitle(drawerStaffName)}
          onClose={closeDrawer}
          testId="roster-standard-hours-drawer"
        >
          <StaffStandardHoursPanel
            tenantId={tenantId}
            staffId={drawerStaffMemberId}
            staffName={drawerStaffName}
            initialDays={standardHoursDays}
            clinics={payload.clinics}
            weekRange={periodRange}
            rosterCadence={cadence}
            defaultFullTimePattern={payload.rosterPlanning.defaultFullTimePattern}
            onSaved={() => {
              closeDrawer();
              refresh();
            }}
            onClose={closeDrawer}
          />
        </RosterRightDrawer>
      ) : null}

      {drawerState.kind === "standard_hours" && !drawerStaffName ? (
        <RosterRightDrawer
          open
          title="Standard hours"
          onClose={closeDrawer}
          testId="roster-standard-hours-drawer-error"
        >
          <p className="text-sm text-rose-300" data-testid="roster-standard-hours-open-error">
            Could not open standard hours for this staff member.
          </p>
        </RosterRightDrawer>
      ) : null}

      {drawerState.kind === "setup_missing_standard_hours" ? (
        <RosterRightDrawer
          open
          wide
          title="Set standard hours"
          subtitle="Staff missing a working-hours pattern for roster generation."
          onClose={closeDrawer}
          testId="roster-setup-panel"
        >
          <ul className="space-y-2">
            {staffMissingStandardHours.map((staff) => (
              <li
                key={staff.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2"
              >
                <span className="text-sm text-slate-100">{staff.name}</span>
                <button
                  type="button"
                  onClick={() => openStandardHours(staff.id)}
                  className="rounded-lg border border-cyan-500/35 bg-cyan-950/30 px-3 py-1.5 text-xs font-medium text-cyan-200 hover:bg-cyan-950/50"
                  data-testid={`roster-setup-panel-staff-${staff.id}`}
                >
                  Set standard hours
                </button>
              </li>
            ))}
          </ul>
        </RosterRightDrawer>
      ) : null}
    </div>
  );
}
