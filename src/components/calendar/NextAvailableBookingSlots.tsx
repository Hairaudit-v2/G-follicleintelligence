"use client";

import { useEffect, useMemo, useState } from "react";

import { findNextAvailableBookingSlotsAction } from "@/lib/actions/fi-next-available-booking-slots-actions";
import { cn } from "@/lib/utils";
import { formatTimeRangeInTimezone } from "@/src/lib/calendar/calendarTimezone";
import type { NextAvailableBookingSlot } from "@/src/lib/calendar/findNextAvailableBookingSlots.server";

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export type NextAvailableBookingSlotsVariant = "dark" | "light";

export type NextAvailableBookingSlotsRequest = {
  clinicId: string;
  serviceId?: string | null;
  bookingType?: string | null;
  staffId?: string | null;
  roomId?: string | null;
  bookingId?: string | null;
  preferredStartAt: string;
  durationMinutes: number;
};

/**
 * When conflict preview is blocked, loads alternative bookable slots and offers one-click apply.
 */
export function NextAvailableBookingSlots({
  tenantId,
  calendarTimezone,
  request,
  show,
  onApplySlot,
  variant = "dark",
  className,
}: {
  tenantId: string;
  calendarTimezone: string;
  request: NextAvailableBookingSlotsRequest | null;
  show: boolean;
  onApplySlot: (slot: NextAvailableBookingSlot) => void;
  variant?: NextAvailableBookingSlotsVariant;
  className?: string;
}) {
  const tz = calendarTimezone.trim();
  const key = useMemo(() => (request && show ? JSON.stringify(request) : ""), [request, show]);
  const debouncedKey = useDebouncedValue(key, 400);

  const [slots, setSlots] = useState<NextAvailableBookingSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!show || !debouncedKey) {
      setSlots([]);
      setErr(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErr(null);
    void (async () => {
      const parsed = JSON.parse(debouncedKey) as NextAvailableBookingSlotsRequest;
      const r = await findNextAvailableBookingSlotsAction(tenantId.trim(), {
        clinicId: parsed.clinicId,
        serviceId: parsed.serviceId ?? null,
        bookingType: parsed.bookingType ?? null,
        staffId: parsed.staffId ?? null,
        roomId: parsed.roomId ?? null,
        bookingId: parsed.bookingId ?? null,
        preferredStartAt: parsed.preferredStartAt,
        durationMinutes: parsed.durationMinutes,
        limit: 5,
      });
      if (cancelled) return;
      if (!r.ok) {
        setSlots([]);
        setErr(r.error);
      } else {
        setSlots(r.slots);
        setErr(null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId, debouncedKey, show]);

  if (!show || !request) return null;

  const isDark = variant === "dark";

  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5 text-xs",
        isDark
          ? "border-white/[0.1] bg-slate-950/35 text-slate-200"
          : "border-white/[0.08] bg-white/[0.03] text-slate-200",
        className
      )}
    >
      <p
        className={cn(
          "font-semibold uppercase tracking-wide",
          isDark ? "text-slate-300" : "text-slate-300"
        )}
      >
        Suggested available times
      </p>
      {loading ? (
        <p className={cn("mt-2", isDark ? "text-slate-500" : "text-gray-500")}>
          Searching nearby slots…
        </p>
      ) : err ? (
        <p className={cn("mt-2", isDark ? "text-rose-300" : "text-rose-300")}>{err}</p>
      ) : slots.length === 0 ? (
        <p className={cn("mt-2", isDark ? "text-slate-500" : "text-slate-400")}>
          No alternative slots found in the next two weeks with these constraints.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {slots.map((s) => (
            <li
              key={`${s.startAt}-${s.roomId}-${s.staffId ?? ""}`}
              className={cn(
                "flex flex-col gap-1.5 rounded-lg border px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between",
                isDark
                  ? "border-white/[0.08] bg-slate-950/40"
                  : "border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md"
              )}
            >
              <div className="min-w-0 space-y-0.5">
                <p className="font-medium tabular-nums text-[13px]">
                  {formatTimeRangeInTimezone(s.startAt, s.endAt, tz)}
                </p>
                <p
                  className={cn(
                    "text-[11px] leading-snug",
                    isDark ? "text-slate-400" : "text-slate-400"
                  )}
                >
                  <span className={cn("font-medium", isDark ? "text-slate-100" : "text-slate-100")}>
                    {s.roomLabel}
                  </span>
                  {s.staffLabel ? (
                    <>
                      {" · "}
                      {s.staffLabel}
                    </>
                  ) : null}
                </p>
                <p
                  className={cn("text-[11px] italic", isDark ? "text-slate-500" : "text-gray-500")}
                >
                  {s.reason}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onApplySlot(s)}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                  isDark
                    ? "border border-cyan-500/40 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25"
                    : "border border-slate-700 bg-gray-900 text-white hover:bg-gray-800"
                )}
              >
                Use this time
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
