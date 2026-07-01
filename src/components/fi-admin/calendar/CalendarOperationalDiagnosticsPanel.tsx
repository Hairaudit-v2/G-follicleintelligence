"use client";

import { useEffect, useRef, useState } from "react";

import { logCalendarClientPerf } from "@/src/lib/calendar/calendarPerfDev";

export type CalendarOperationalDiagnostics = {
  loaderDurationMs?: number;
  bookingCount: number;
  payloadApproxBytes?: number;
  renderCount: number;
  view: string;
  dateAnchor: string;
};

/** Dev-only calendar performance diagnostics — loader timing, payload size, render count. */
export function CalendarOperationalDiagnosticsPanel({
  diagnostics,
}: {
  diagnostics: CalendarOperationalDiagnostics;
}) {
  const [open, setOpen] = useState(false);
  const loggedRef = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (loggedRef.current) return;
    loggedRef.current = true;
    logCalendarClientPerf("calendar-diagnostics", diagnostics);
  }, [diagnostics]);

  if (process.env.NODE_ENV !== "development") return null;

  return (
    <div className="pointer-events-none fixed bottom-3 right-3 z-[60]">
      <button
        type="button"
        className="pointer-events-auto rounded-md border border-slate-600/50 bg-slate-950/90 px-2 py-1 text-[10px] font-medium text-slate-300 shadow-lg backdrop-blur"
        onClick={() => setOpen((v) => !v)}
      >
        Cal perf {diagnostics.renderCount}
      </button>
      {open ? (
        <div className="pointer-events-auto mt-1 w-56 rounded-md border border-slate-600/50 bg-slate-950/95 p-2 text-[10px] text-slate-300 shadow-xl">
          <p>view: {diagnostics.view}</p>
          <p>anchor: {diagnostics.dateAnchor}</p>
          <p>bookings: {diagnostics.bookingCount}</p>
          {diagnostics.loaderDurationMs != null ? (
            <p>loader: {diagnostics.loaderDurationMs}ms</p>
          ) : null}
          {diagnostics.payloadApproxBytes != null ? (
            <p>payload: {Math.round(diagnostics.payloadApproxBytes / 1024)}KB</p>
          ) : null}
          <p>renders: {diagnostics.renderCount}</p>
        </div>
      ) : null}
    </div>
  );
}