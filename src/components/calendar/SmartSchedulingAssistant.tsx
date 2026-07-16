"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Lightbulb, ListChecks } from "lucide-react";

import { evaluateSmartSchedulingAction } from "@/lib/actions/fi-smart-scheduling-actions";
import { cn } from "@/lib/utils";
import type { SmartSchedulingSnapshot } from "@/src/lib/calendar/smart-scheduling/smartSchedulingTypes";
import type { SmartSuggestedSlot } from "@/src/lib/calendar/smart-scheduling/smartSchedulingTypes";

export type SmartSchedulingRequest = {
  clinicId?: string | null;
  bookingType?: string | null;
  roomId?: string | null;
  roomRequired?: boolean;
  staffId?: string | null;
  staffLabel?: string | null;
  roomLabel?: string | null;
  patientId?: string | null;
  bookingId?: string | null;
  startAt: string;
  endAt: string;
  includeSuggestions?: boolean;
};

function formatSlot(iso: string, timeZone?: string | null): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timeZone || undefined,
    });
  } catch {
    return iso.slice(0, 16);
  }
}

/**
 * Live scheduling assistant: conflicts, prep reminders, smart slot suggestions.
 * Non-intrusive — updates as the booker changes times.
 */
export function SmartSchedulingAssistant({
  tenantId,
  request,
  calendarTimezone,
  onApplySlot,
  variant = "dark",
  className,
  debounceMs = 400,
}: {
  tenantId: string;
  request: SmartSchedulingRequest | null;
  calendarTimezone?: string | null;
  onApplySlot?: (slot: SmartSuggestedSlot) => void;
  variant?: "dark" | "light";
  className?: string;
  debounceMs?: number;
}) {
  const [snapshot, setSnapshot] = useState<SmartSchedulingSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestKey = useMemo(
    () => (request ? JSON.stringify(request) : ""),
    [request]
  );

  useEffect(() => {
    if (!request?.startAt || !request?.endAt) {
      setSnapshot(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const t = window.setTimeout(() => {
      void evaluateSmartSchedulingAction(tenantId, request).then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          setError(res.error);
          setSnapshot(null);
          setLoading(false);
          return;
        }
        setSnapshot(res.snapshot);
        setLoading(false);
      });
    }, debounceMs);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [tenantId, requestKey, debounceMs, request]);

  if (!request) return null;

  const dark = variant === "dark";
  const status = snapshot?.status ?? "clear";

  return (
    <section
      className={cn(
        "rounded-xl border p-3 text-sm",
        dark
          ? "border-white/[0.08] bg-white/[0.03] text-slate-200"
          : "border-gray-200 bg-white text-gray-800",
        className
      )}
      data-testid="smart-scheduling-assistant"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p
            className={cn(
              "text-[10px] font-semibold uppercase tracking-wide",
              dark ? "text-cyan-300/90" : "text-cyan-700"
            )}
          >
            Smart scheduling
          </p>
          <p className={cn("mt-0.5 text-xs", dark ? "text-slate-400" : "text-gray-500")}>
            Conflicts, prep reminders, and gentler slot ideas — as you book.
          </p>
        </div>
        {loading ? (
          <span className={cn("text-[10px]", dark ? "text-slate-500" : "text-gray-400")}>
            Checking…
          </span>
        ) : null}
      </div>

      {error ? (
        <p className={cn("mt-2 text-xs", dark ? "text-amber-300" : "text-amber-700")} role="alert">
          {error}
        </p>
      ) : null}

      {snapshot ? (
        <div className="mt-3 space-y-3">
          <div
            className={cn(
              "flex items-start gap-2 rounded-lg border px-2.5 py-2 text-xs leading-relaxed",
              status === "blocked"
                ? dark
                  ? "border-rose-400/30 bg-rose-950/30 text-rose-100"
                  : "border-rose-200 bg-rose-50 text-rose-900"
                : status === "warning"
                  ? dark
                    ? "border-amber-400/30 bg-amber-950/25 text-amber-50"
                    : "border-amber-200 bg-amber-50 text-amber-900"
                  : dark
                    ? "border-emerald-400/25 bg-emerald-950/20 text-emerald-50"
                    : "border-emerald-200 bg-emerald-50 text-emerald-900"
            )}
          >
            {status === "clear" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            )}
            <p>{snapshot.summary}</p>
          </div>

          {snapshot.conflicts.length > 0 ? (
            <div>
              <p
                className={cn(
                  "mb-1.5 text-[10px] font-semibold uppercase tracking-wide",
                  dark ? "text-slate-500" : "text-gray-500"
                )}
              >
                Conflicts
              </p>
              <ul className="space-y-1.5">
                {snapshot.conflicts.map((c, i) => (
                  <li
                    key={`${c.kind}-${c.conflictingBookingId ?? i}`}
                    className={cn(
                      "rounded-lg border px-2.5 py-2 text-xs leading-snug",
                      c.severity === "error"
                        ? dark
                          ? "border-rose-400/25 bg-rose-950/20"
                          : "border-rose-200 bg-rose-50"
                        : dark
                          ? "border-amber-400/20 bg-amber-950/15"
                          : "border-amber-200 bg-amber-50"
                    )}
                  >
                    {c.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {snapshot.prepReminders.length > 0 ? (
            <div>
              <p
                className={cn(
                  "mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide",
                  dark ? "text-slate-500" : "text-gray-500"
                )}
              >
                <ListChecks className="h-3 w-3" aria-hidden />
                Prep reminders
                <span className="font-normal normal-case">
                  · ~{snapshot.prepBufferMinutes}m buffer typical
                </span>
              </p>
              <ul className="space-y-1.5">
                {snapshot.prepReminders.map((p) => (
                  <li
                    key={p.code}
                    className={cn(
                      "rounded-lg border px-2.5 py-2",
                      dark ? "border-white/[0.06] bg-white/[0.02]" : "border-gray-100 bg-gray-50"
                    )}
                  >
                    <p className="text-xs font-medium">{p.label}</p>
                    <p className={cn("mt-0.5 text-[11px]", dark ? "text-slate-500" : "text-gray-500")}>
                      {p.detail}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {snapshot.suggestions.length > 0 && onApplySlot ? (
            <div>
              <p
                className={cn(
                  "mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide",
                  dark ? "text-slate-500" : "text-gray-500"
                )}
              >
                <Lightbulb className="h-3 w-3" aria-hidden />
                Suggested times
              </p>
              <ul className="space-y-1.5">
                {snapshot.suggestions.map((s) => (
                  <li key={`${s.startAt}-${s.roomId ?? ""}-${s.staffId ?? ""}`}>
                    <button
                      type="button"
                      onClick={() => onApplySlot(s)}
                      className={cn(
                        "flex w-full min-h-11 flex-col items-start rounded-xl border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50",
                        dark
                          ? "border-cyan-400/30 bg-cyan-500/10 hover:bg-cyan-500/20"
                          : "border-cyan-200 bg-cyan-50 hover:bg-cyan-100"
                      )}
                    >
                      <span className="flex items-center gap-1.5 text-xs font-semibold">
                        <Clock className="h-3.5 w-3.5" aria-hidden />
                        {formatSlot(s.startAt, calendarTimezone)}
                        <span className="font-normal opacity-70">
                          – {formatSlot(s.endAt, calendarTimezone).split(",").pop()?.trim()}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "mt-0.5 text-[11px]",
                          dark ? "text-cyan-100/70" : "text-cyan-900/70"
                        )}
                      >
                        {[s.staffLabel, s.roomLabel].filter(Boolean).join(" · ") || s.reason}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : !loading && !error ? (
        <p className={cn("mt-2 text-xs", dark ? "text-slate-500" : "text-gray-500")}>
          Choose a clinic, time, and provider — we’ll keep an eye on the diary for you.
        </p>
      ) : null}
    </section>
  );
}
