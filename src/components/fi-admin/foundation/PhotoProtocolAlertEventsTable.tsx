"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import {
  acknowledgePhotoProtocolAlertAction,
  dismissPhotoProtocolAlertAction,
  refreshPhotoProtocolAlertsAction,
  resolvePhotoProtocolAlertAction,
} from "@/src/lib/actions/fi-photo-protocol-alert-actions";
import {
  fiOsFoundationPhotoProtocolAnalyticsHref,
  fiOsPatientTwinPhotoProtocolHref,
} from "@/src/lib/hair-intelligence/photoProtocols/protocolDeepLinks";
import type { HliPhotoProtocolAlertEvent } from "@/src/lib/hair-intelligence/photoProtocols/types";

function severityClass(s: HliPhotoProtocolAlertEvent["severity"], dark = false): string {
  if (s === "high") return dark ? "text-rose-300" : "text-rose-300";
  if (s === "medium") return dark ? "text-amber-300" : "text-amber-200";
  return dark ? "text-slate-400" : "text-slate-300";
}

function statusBadge(s: HliPhotoProtocolAlertEvent["status"], dark = false): string {
  if (dark) {
    if (s === "open") return "bg-rose-950/50 text-rose-200 ring-rose-500/30";
    if (s === "acknowledged") return "bg-amber-950/40 text-amber-100 ring-amber-500/25";
    if (s === "resolved") return "bg-emerald-950/40 text-emerald-200 ring-emerald-500/25";
    return "bg-white/[0.06] text-slate-400 ring-white/[0.08]";
  }
  if (s === "open") return "bg-rose-500/10 text-rose-300 ring-rose-100";
  if (s === "acknowledged") return "bg-amber-400/10 text-amber-200 ring-amber-100";
  if (s === "resolved") return "bg-emerald-500/10 text-emerald-300 ring-emerald-100";
  return "bg-white/[0.06] text-slate-300 ring-white/[0.08]";
}

export function PhotoProtocolAlertEventsTable({
  tenantId,
  events,
  variant = "light",
}: {
  tenantId: string;
  events: HliPhotoProtocolAlertEvent[];
  variant?: "light" | "darkGlass";
}) {
  const tid = tenantId.trim();
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dark = variant === "darkGlass";

  const foundationHref = useMemo(() => fiOsFoundationPhotoProtocolAnalyticsHref(tid), [tid]);

  const header = (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <SectionHeader
        title="Persisted protocol alerts"
        description="Operational alert history from computed rules. Refresh after clinical changes to sync state."
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          className={cn(
            dark
              ? cn(fiOsChromeClasses.toolbarControlSurface, "px-3 py-1.5 text-xs font-semibold text-cyan-100/95 disabled:opacity-40")
              : "rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-40",
          )}
          onClick={() => {
            setMsg(null);
            start(async () => {
              const res = await refreshPhotoProtocolAlertsAction({ tenantId: tid });
              if (!res.ok) setMsg(res.error);
              else router.refresh();
            });
          }}
        >
          Refresh alerts
        </button>
        <Link
          href={foundationHref}
          className={cn(
            dark
              ? cn(fiOsChromeClasses.toolbarControlSurface, "inline-flex items-center px-3 py-1.5 text-xs font-semibold text-slate-200")
              : "inline-flex items-center rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/[0.03]",
          )}
        >
          Analytics anchor
        </Link>
      </div>
    </div>
  );

  const table = (
    <>
      {msg ? <p className={`mt-3 text-xs ${dark ? "text-rose-300" : "text-rose-300"}`}>{msg}</p> : null}
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr
              className={
                dark
                  ? "border-b border-white/[0.08] text-xs font-semibold uppercase tracking-wide text-slate-500"
                  : "border-b border-white/[0.08] text-xs font-semibold uppercase tracking-wide text-slate-500"
              }
            >
              <th className="py-2 pr-3">Severity</th>
              <th className="py-2 pr-3">Type</th>
              <th className="py-2 pr-3">Message</th>
              <th className="py-2 pr-3">Recommended</th>
              <th className="py-2 pr-3">Patient</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">First seen</th>
              <th className="py-2 pr-3">Last seen</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={9} className={`py-6 text-center ${dark ? "text-slate-500" : "text-slate-500"}`}>
                  No persisted alerts yet — run <span className="font-medium">Refresh alerts</span> to materialise computed findings.
                </td>
              </tr>
            ) : (
              events.map((ev) => (
                <tr key={ev.id} className={`align-top ${dark ? "border-b border-white/[0.06]" : "border-b border-white/[0.06]"}`}>
                  <td className={`py-2 pr-3 text-xs font-semibold uppercase ${severityClass(ev.severity, dark)}`}>{ev.severity}</td>
                  <td className={`py-2 pr-3 text-xs ${dark ? "text-slate-500" : "text-slate-400"}`}>{ev.alert_type.replace(/_/g, " ")}</td>
                  <td className={`py-2 pr-3 ${dark ? "text-slate-200" : "text-slate-200"}`}>{ev.message}</td>
                  <td className={`py-2 pr-3 text-xs ${dark ? "text-slate-500" : "text-slate-500"}`}>{ev.recommended_action ?? "—"}</td>
                  <td className="py-2 pr-3">
                    {ev.patient_id ? (
                      <Link
                        href={fiOsPatientTwinPhotoProtocolHref(tid, ev.patient_id)}
                        className={`text-xs font-medium hover:underline ${dark ? "text-cyan-300 hover:text-cyan-200" : "text-cyan-300"}`}
                      >
                        Open Twin
                      </Link>
                    ) : (
                      <span className={`text-xs ${dark ? "text-slate-400" : "text-slate-400"}`}>—</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ring-inset ${statusBadge(ev.status, dark)}`}
                    >
                      {ev.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className={`py-2 pr-3 text-xs ${dark ? "text-slate-500" : "text-slate-400"}`}>
                    {new Date(ev.first_detected_at).toLocaleString()}
                  </td>
                  <td className={`py-2 pr-3 text-xs ${dark ? "text-slate-500" : "text-slate-400"}`}>
                    {new Date(ev.last_detected_at).toLocaleString()}
                  </td>
                  <td className="py-2">
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        disabled={pending || ev.status !== "open"}
                        className={`text-left text-[11px] font-medium hover:underline disabled:opacity-40 ${dark ? "text-cyan-300" : "text-cyan-300 disabled:text-slate-400"}`}
                        onClick={() => {
                          setMsg(null);
                          start(async () => {
                            const res = await acknowledgePhotoProtocolAlertAction({ tenantId: tid, alertEventId: ev.id });
                            if (!res.ok) setMsg(res.error);
                            else router.refresh();
                          });
                        }}
                      >
                        Acknowledge
                      </button>
                      <button
                        type="button"
                        disabled={pending || (ev.status !== "open" && ev.status !== "acknowledged")}
                        className={`text-left text-[11px] font-medium hover:underline disabled:opacity-40 ${dark ? "text-emerald-300" : "text-emerald-300 disabled:text-slate-400"}`}
                        onClick={() => {
                          setMsg(null);
                          start(async () => {
                            const res = await resolvePhotoProtocolAlertAction({ tenantId: tid, alertEventId: ev.id });
                            if (!res.ok) setMsg(res.error);
                            else router.refresh();
                          });
                        }}
                      >
                        Resolve
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        className={`text-left text-[11px] font-medium hover:underline disabled:opacity-40 ${dark ? "text-slate-400" : "text-slate-400 disabled:text-slate-400"}`}
                        onClick={() => {
                          setMsg(null);
                          start(async () => {
                            const res = await dismissPhotoProtocolAlertAction({ tenantId: tid, alertEventId: ev.id });
                            if (!res.ok) setMsg(res.error);
                            else router.refresh();
                          });
                        }}
                      >
                        Dismiss
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );

  if (dark) {
    return (
      <DashboardCard className="p-4 sm:p-5">
        {header}
        {table}
      </DashboardCard>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40">
      {header}
      {table}
    </div>
  );
}
