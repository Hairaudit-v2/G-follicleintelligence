"use client";

import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { saveStaffStandardHoursAction } from "@/src/lib/actions/workforce-roster-actions";
import {
  applyStandardHoursTemplate,
  computeStandardHoursWeeklyTotal,
  emptyStandardHoursWeek,
  formatHmToDisplay,
  STANDARD_HOURS_TEMPLATE_LABELS,
  STANDARD_HOURS_WEEKDAY_LABELS,
  validateStandardHoursPattern,
  type StaffStandardHoursDayInput,
  type StandardHoursTemplateId,
} from "@/src/lib/workforce-os/staffStandardHoursCore";

export type StaffStandardHoursPanelProps = {
  tenantId: string;
  staffId: string;
  staffName: string;
  initialDays: StaffStandardHoursDayInput[];
  clinics: Array<{ id: string; displayName: string }>;
  onSaved?: () => void;
  onClose?: () => void;
};

function normaliseDays(days: StaffStandardHoursDayInput[]): StaffStandardHoursDayInput[] {
  const byWeekday = new Map(days.map((d) => [d.weekday, d]));
  return emptyStandardHoursWeek().map((empty) => {
    const existing = byWeekday.get(empty.weekday);
    return existing ?? empty;
  });
}

export function StaffStandardHoursPanel({
  tenantId,
  staffId,
  staffName,
  initialDays,
  clinics,
  onSaved,
  onClose,
}: StaffStandardHoursPanelProps) {
  const [days, setDays] = useState(() => normaliseDays(initialDays));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const validation = useMemo(() => validateStandardHoursPattern(days), [days]);
  const weeklyHours = (computeStandardHoursWeeklyTotal(days) / 60).toFixed(1);

  function patchDay(weekday: number, patch: Partial<StaffStandardHoursDayInput>) {
    setDays((prev) =>
      prev.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d))
    );
  }

  function applyTemplate(templateId: StandardHoursTemplateId) {
    setDays(applyStandardHoursTemplate(templateId));
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await saveStaffStandardHoursAction({ tenantId, staffId, days });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved?.();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Standard hours</h3>
          <p className="mt-0.5 text-xs text-slate-400">{staffName}</p>
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

      <div className="flex flex-wrap gap-2">
        {(Object.keys(STANDARD_HOURS_TEMPLATE_LABELS) as StandardHoursTemplateId[])
          .filter((id) => id !== "custom")
          .map((id) => (
            <Button
              key={id}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => applyTemplate(id)}
            >
              {STANDARD_HOURS_TEMPLATE_LABELS[id]}
            </Button>
          ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-white/[0.08]">
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
              <tr key={day.weekday}>
                <td className="whitespace-nowrap px-2 py-1.5 text-slate-200">
                  {STANDARD_HOURS_WEEKDAY_LABELS[day.weekday]}
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={day.is_working_day}
                    onChange={(e) =>
                      patchDay(day.weekday, {
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
                    onChange={(e) => patchDay(day.weekday, { start_time: e.target.value })}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="time"
                    className="w-full min-w-[5.5rem] rounded border border-white/[0.08] bg-[#0B1220] px-1 py-0.5 font-mono"
                    value={day.end_time ?? "17:00"}
                    disabled={!day.is_working_day}
                    onChange={(e) => patchDay(day.weekday, { end_time: e.target.value })}
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
                      patchDay(day.weekday, { break_minutes: Number(e.target.value) || 0 })
                    }
                  />
                </td>
                <td className="px-2 py-1.5">
                  <select
                    className="w-full min-w-[6rem] rounded border border-white/[0.08] bg-[#0B1220] px-1 py-0.5"
                    value={day.clinic_id ?? ""}
                    disabled={!day.is_working_day}
                    onChange={(e) =>
                      patchDay(day.weekday, { clinic_id: e.target.value || null })
                    }
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
                    onChange={(e) => patchDay(day.weekday, { shift_label: e.target.value || null })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <p className="text-slate-400">
          Weekly total: <span className="font-medium text-slate-200">{weeklyHours} h</span>
          {days.some((d) => !d.is_working_day) ? (
            <span className="ml-2 text-slate-500">· RDO days excluded</span>
          ) : null}
        </p>
        <Button type="button" size="sm" disabled={pending || !validation.valid} onClick={handleSave}>
          {pending ? "Saving…" : "Save standard hours"}
        </Button>
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
