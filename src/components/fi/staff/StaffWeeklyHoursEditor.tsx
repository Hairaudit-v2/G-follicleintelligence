"use client";

import { Button } from "@/components/ui/button";
import {
  defaultPerthClinicWeeklyHours,
  type StaffDayHours,
  type StaffWeeklyHoursMap,
  STAFF_WEEKDAY_KEYS,
} from "@/src/lib/staff/staffWeeklyHours";

const DAY_LABEL: Record<(typeof STAFF_WEEKDAY_KEYS)[number], string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

function emptyDay(): StaffDayHours {
  return { enabled: false, start: "09:00", end: "17:00" };
}

function normaliseDay(d: StaffDayHours | undefined): StaffDayHours {
  if (!d) return emptyDay();
  return {
    enabled: d.enabled !== false && Boolean(d.start?.trim() && d.end?.trim()),
    start: d.start?.trim() || "09:00",
    end: d.end?.trim() || "17:00",
  };
}

export function StaffWeeklyHoursEditor({
  value,
  onChange,
}: {
  value: StaffWeeklyHoursMap;
  onChange: (next: StaffWeeklyHoursMap) => void;
}) {
  function patchDay(key: (typeof STAFF_WEEKDAY_KEYS)[number], patch: Partial<StaffDayHours>) {
    const cur = normaliseDay(value[key]);
    onChange({ ...value, [key]: { ...cur, ...patch } });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-gray-700">Weekly schedule (local wall times)</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => onChange(defaultPerthClinicWeeklyHours())}
        >
          Mon–Fri 8:30–17:30 (Perth-style)
        </Button>
      </div>
      <p className="text-[11px] leading-snug text-gray-500">
        Interpreted in this staff member&apos;s <strong>default timezone</strong> (below); if blank,{" "}
        <code className="rounded bg-gray-100 px-0.5">Australia/Perth</code> is used for hints in booking forms.
      </p>
      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 text-left text-[11px] font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-2 py-1.5">Day</th>
              <th className="px-2 py-1.5">Open</th>
              <th className="px-2 py-1.5">Start</th>
              <th className="px-2 py-1.5">End</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {STAFF_WEEKDAY_KEYS.map((key) => {
              const d = normaliseDay(value[key]);
              return (
                <tr key={key}>
                  <td className="whitespace-nowrap px-2 py-1.5 text-gray-800">{DAY_LABEL[key]}</td>
                  <td className="px-2 py-1.5">
                    <input
                      type="checkbox"
                      checked={d.enabled}
                      onChange={(e) => patchDay(key, { enabled: e.target.checked })}
                      aria-label={`${DAY_LABEL[key]} open`}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="time"
                      className="w-full min-w-[6.5rem] rounded border border-gray-200 px-1 py-0.5 font-mono text-xs"
                      value={d.start ?? "09:00"}
                      disabled={!d.enabled}
                      onChange={(e) => patchDay(key, { start: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="time"
                      className="w-full min-w-[6.5rem] rounded border border-gray-200 px-1 py-0.5 font-mono text-xs"
                      value={d.end ?? "17:00"}
                      disabled={!d.enabled}
                      onChange={(e) => patchDay(key, { end: e.target.value })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
