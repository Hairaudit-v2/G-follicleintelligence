"use client";

import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  saveStaffStandardHoursAction,
  generateRosterFromStandardHoursAction,
} from "@/src/lib/actions/workforce-roster-actions";
import type { DefaultFullTimePattern, RosterCadence } from "@/src/lib/workforce/rosterCadencePolicyCore";
import {
  applyStandardHoursTemplate,
  computeStandardHoursWeeklyTotal,
  emptyStandardHoursWeek,
  flattenFortnightlyStandardHours,
  formatHmToDisplay,
  groupStandardHoursByCycleWeek,
  STANDARD_HOURS_TEMPLATE_LABELS,
  STANDARD_HOURS_WEEKDAY_LABELS,
  validateStandardHoursPattern,
  type StaffStandardHoursDayInput,
  type StandardHoursTemplateId,
} from "@/src/lib/workforce-os/staffStandardHoursCore";
import { formatStandardHoursDrawerTitle } from "@/src/lib/workforce-os/rosterCommandCentreUxCore";

export type StaffStandardHoursPanelProps = {
  tenantId: string;
  staffId: string;
  staffName: string;
  initialDays: StaffStandardHoursDayInput[];
  clinics: Array<{ id: string; displayName: string }>;
  weekRange?: { startsAt: string; endsAt: string };
  rosterCadence?: RosterCadence;
  defaultFullTimePattern?: DefaultFullTimePattern;
  onSaved?: () => void;
  onClose?: () => void;
};

function templateIdFromPattern(
  pattern: DefaultFullTimePattern | undefined
): StandardHoursTemplateId {
  if (pattern === "four_ten") return "four_ten";
  if (pattern === "five_eight") return "five_eight";
  return "custom";
}

function StandardHoursWeekEditor({
  days,
  cycleWeek,
  clinics,
  onPatchDay,
}: {
  days: StaffStandardHoursDayInput[];
  cycleWeek: 1 | 2;
  clinics: Array<{ id: string; displayName: string }>;
  onPatchDay: (weekday: number, patch: Partial<StaffStandardHoursDayInput>) => void;
}) {
  return (
    <table className="min-w-full text-xs">
      <thead className="bg-white/[0.03] text-left text-[10px] font-medium uppercase tracking-wide text-slate-500">
        <tr>
          <th className="px-2 py-1.5">Day</th>
          <th className="px-2 py-1.5">Working</th>
          <th className="px-2 py-1.5">Start</th>
          <th className="px-2 py-1.5">End</th>
          <th className="px-2 py-1.5">Break (min)</th>
          <th className="px-2 py-1.5">Clinic</th>
          <th className="px-2 py-1.5">Role / label</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-white/[0.06]">
        {days.map((day) => (
          <tr key={`${cycleWeek}-${day.weekday}`}>
            <td className="whitespace-nowrap px-2 py-1.5 text-slate-200">
              {STANDARD_HOURS_WEEKDAY_LABELS[day.weekday]}
            </td>
            <td className="px-2 py-1.5">
              <input
                type="checkbox"
                checked={day.is_working_day}
                onChange={(e) =>
                  onPatchDay(day.weekday, {
                    is_working_day: e.target.checked,
                    shift_label: e.target.checked ? day.shift_label : "RDO",
                  })
                }
                aria-label={`${STANDARD_HOURS_WEEKDAY_LABELS[day.weekday]} working`}
              />
            </td>
            <td className="px-2 py-1.5">
              <input
                type="time"
                className="w-full min-w-[5.5rem] rounded border border-white/[0.08] bg-[#0B1220] px-1 py-0.5 font-mono"
                value={day.start_time ?? "09:00"}
                disabled={!day.is_working_day}
                onChange={(e) => onPatchDay(day.weekday, { start_time: e.target.value })}
              />
            </td>
            <td className="px-2 py-1.5">
              <input
                type="time"
                className="w-full min-w-[5.5rem] rounded border border-white/[0.08] bg-[#0B1220] px-1 py-0.5 font-mono"
                value={day.end_time ?? "17:00"}
                disabled={!day.is_working_day}
                onChange={(e) => onPatchDay(day.weekday, { end_time: e.target.value })}
              />
            </td>
            <td className="px-2 py-1.5">
              <input
                type="number"
                min={0}
                max={480}
                className="w-16 rounded border border-white/[0.08] bg-[#0B1220] px-1 py-0.5"
                value={day.break_minutes ?? 0}
                disabled={!day.is_working_day}
                onChange={(e) =>
                  onPatchDay(day.weekday, { break_minutes: Number(e.target.value) || 0 })
                }
              />
            </td>
            <td className="px-2 py-1.5">
              <select
                className="w-full min-w-[6rem] rounded border border-white/[0.08] bg-[#0B1220] px-1 py-0.5"
                value={day.clinic_id ?? ""}
                disabled={!day.is_working_day}
                onChange={(e) => onPatchDay(day.weekday, { clinic_id: e.target.value || null })}
              >
                <option value="">Any clinic</option>
                {clinics.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.displayName}
                  </option>
                ))}
              </select>
            </td>
            <td className="px-2 py-1.5">
              <input
                className="w-full min-w-[5rem] rounded border border-white/[0.08] bg-[#0B1220] px-1 py-0.5"
                value={day.is_working_day ? (day.shift_label ?? "") : "RDO"}
                disabled={!day.is_working_day}
                placeholder="Shift type"
                onChange={(e) => onPatchDay(day.weekday, { shift_label: e.target.value || null })}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function StaffStandardHoursPanel({
  tenantId,
  staffId,
  staffName,
  initialDays,
  clinics,
  weekRange,
  rosterCadence = "weekly",
  defaultFullTimePattern = "five_eight",
  onSaved,
  onClose,
}: StaffStandardHoursPanelProps) {
  const groupedInitial = useMemo(() => groupStandardHoursByCycleWeek(initialDays), [initialDays]);
  const [weekA, setWeekA] = useState(() => groupedInitial.get(1) ?? emptyStandardHoursWeek(1));
  const [weekB, setWeekB] = useState(() => groupedInitial.get(2) ?? emptyStandardHoursWeek(2));
  const [activeCycleTab, setActiveCycleTab] = useState<1 | 2>(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const days = useMemo(() => {
    if (rosterCadence === "fortnightly") {
      return flattenFortnightlyStandardHours(weekA, weekB);
    }
    return weekA;
  }, [rosterCadence, weekA, weekB]);

  const validation = useMemo(() => validateStandardHoursPattern(days), [days]);
  const weekATotal = (computeStandardHoursWeeklyTotal(weekA) / 60).toFixed(1);
  const weekBTotal = (computeStandardHoursWeeklyTotal(weekB) / 60).toFixed(1);
  const fortnightTotal = (computeStandardHoursWeeklyTotal(days) / 60).toFixed(1);

  function patchWeek(
    cycleWeek: 1 | 2,
    weekday: number,
    patch: Partial<StaffStandardHoursDayInput>
  ) {
    const setter = cycleWeek === 1 ? setWeekA : setWeekB;
    setter((prev) =>
      prev.map((d) =>
        d.weekday === weekday ? { ...d, ...patch, cycle_week: cycleWeek } : d
      )
    );
  }

  function applyTemplateToCycle(templateId: StandardHoursTemplateId, cycleWeek: 1 | 2) {
    const template = applyStandardHoursTemplate(templateId).map((d) => ({
      ...d,
      cycle_week: cycleWeek,
    }));
    if (cycleWeek === 1) setWeekA(template);
    else setWeekB(template);
  }

  function copyCycle(from: 1 | 2, to: 1 | 2) {
    const source = from === 1 ? weekA : weekB;
    const copied = source.map((d) => ({ ...d, cycle_week: to }));
    if (to === 1) setWeekA(copied);
    else setWeekB(copied);
  }

  function handleSave(andGenerate: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await saveStaffStandardHoursAction({ tenantId, staffId, days });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (andGenerate && weekRange) {
        const gen = await generateRosterFromStandardHoursAction({
          tenantId,
          rangeStartIso: weekRange.startsAt,
          rangeEndIso: weekRange.endsAt,
          staffIds: [staffId],
          overwriteGeneratedOnly: false,
        });
        if (!gen.ok) {
          setError(gen.error);
          return;
        }
      }
      onSaved?.();
    });
  }

  const defaultTemplate = templateIdFromPattern(defaultFullTimePattern);

  return (
    <div
      className="space-y-4"
      data-testid="staff-standard-hours-panel"
      data-roster-cadence={rosterCadence}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">
            {formatStandardHoursDrawerTitle(staffName)}
          </h3>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            Close
          </button>
        ) : null}
      </div>

      {rosterCadence === "monthly" ? (
        <p className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-slate-400">
          Monthly roster generation repeats this standard week across the selected month. Use
          leave/unavailability or manual adjustments for exceptions.
        </p>
      ) : null}

      {rosterCadence === "fortnightly" ? (
        <div className="flex flex-wrap gap-2" data-testid="fortnight-cycle-tabs">
          <Button
            type="button"
            size="sm"
            variant={activeCycleTab === 1 ? "default" : "outline"}
            onClick={() => setActiveCycleTab(1)}
          >
            Week A
          </Button>
          <Button
            type="button"
            size="sm"
            variant={activeCycleTab === 2 ? "default" : "outline"}
            onClick={() => setActiveCycleTab(2)}
          >
            Week B
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {rosterCadence === "fortnightly" ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => applyTemplateToCycle(defaultTemplate, activeCycleTab)}
            >
              Apply to {activeCycleTab === 1 ? "Week A" : "Week B"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => copyCycle(1, 2)}
            >
              Copy Week A to Week B
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => copyCycle(2, 1)}
            >
              Copy Week B to Week A
            </Button>
          </>
        ) : (
          (Object.keys(STANDARD_HOURS_TEMPLATE_LABELS) as StandardHoursTemplateId[])
            .filter((id) => id !== "custom")
            .map((id) => (
              <Button
                key={id}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => applyTemplateToCycle(id, 1)}
              >
                {STANDARD_HOURS_TEMPLATE_LABELS[id]}
              </Button>
            ))
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-white/[0.08]">
        {rosterCadence === "fortnightly" ? (
          activeCycleTab === 1 ? (
            <StandardHoursWeekEditor
              days={weekA}
              cycleWeek={1}
              clinics={clinics}
              onPatchDay={(weekday, patch) => patchWeek(1, weekday, patch)}
            />
          ) : (
            <StandardHoursWeekEditor
              days={weekB}
              cycleWeek={2}
              clinics={clinics}
              onPatchDay={(weekday, patch) => patchWeek(2, weekday, patch)}
            />
          )
        ) : (
          <StandardHoursWeekEditor
            days={weekA}
            cycleWeek={1}
            clinics={clinics}
            onPatchDay={(weekday, patch) => patchWeek(1, weekday, patch)}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="text-slate-400">
          {rosterCadence === "fortnightly" ? (
            <>
              <p>
                Week A total: <span className="font-medium text-slate-200">{weekATotal} h</span>
              </p>
              <p>
                Week B total: <span className="font-medium text-slate-200">{weekBTotal} h</span>
              </p>
              <p>
                Fortnight total:{" "}
                <span className="font-medium text-slate-200">{fortnightTotal} h</span>
              </p>
            </>
          ) : (
            <p>
              Weekly total: <span className="font-medium text-slate-200">{weekATotal} h</span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending || !validation.valid}
            onClick={() => handleSave(false)}
          >
            {pending ? "Saving…" : "Save"}
          </Button>
          {weekRange ? (
            <Button
              type="button"
              size="sm"
              disabled={pending || !validation.valid}
              onClick={() => handleSave(true)}
              data-testid="save-and-generate-roster"
            >
              {pending ? "Saving…" : "Save and generate roster"}
            </Button>
          ) : null}
        </div>
      </div>

      {validation.warnings.length > 0 ? (
        <ul className="space-y-1 text-xs text-amber-300">
          {validation.warnings.map((w, i) => (
            <li key={`${w.code}-${i}`}>{w.message}</li>
          ))}
        </ul>
      ) : null}

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <p className="text-[11px] text-slate-500">
        Sample: {formatHmToDisplay("07:30")}–{formatHmToDisplay("17:30")} Mon/Tue/Thu/Fri with Wed RDO
        = 4 × 10-hour shifts.
      </p>
    </div>
  );
}
