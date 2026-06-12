"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

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

function severityClass(s: HliPhotoProtocolAlertEvent["severity"]): string {
  if (s === "high") return "text-rose-800";
  if (s === "medium") return "text-amber-900";
  return "text-slate-700";
}

function statusBadge(s: HliPhotoProtocolAlertEvent["status"]): string {
  if (s === "open") return "bg-rose-50 text-rose-900 ring-rose-100";
  if (s === "acknowledged") return "bg-amber-50 text-amber-950 ring-amber-100";
  if (s === "resolved") return "bg-emerald-50 text-emerald-900 ring-emerald-100";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

export function PhotoProtocolAlertEventsTable({ tenantId, events }: { tenantId: string; events: HliPhotoProtocolAlertEvent[] }) {
  const tid = tenantId.trim();
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const foundationHref = useMemo(() => fiOsFoundationPhotoProtocolAnalyticsHref(tid), [tid]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Persisted protocol alerts</h2>
          <p className="mt-1 text-sm text-slate-600">
            Operational alert history (idempotent upserts from computed rules). Use refresh after clinical changes to sync state.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-40"
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
          <Link href={foundationHref} className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50">
            Analytics anchor
          </Link>
        </div>
      </div>

      {msg ? <p className="mt-3 text-xs text-rose-700">{msg}</p> : null}

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
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
                <td colSpan={9} className="py-6 text-center text-slate-500">
                  No persisted alerts yet — run <span className="font-medium">Refresh alerts</span> to materialise computed findings.
                </td>
              </tr>
            ) : (
              events.map((ev) => (
                <tr key={ev.id} className="border-b border-slate-100 align-top">
                  <td className={`py-2 pr-3 text-xs font-semibold uppercase ${severityClass(ev.severity)}`}>{ev.severity}</td>
                  <td className="py-2 pr-3 text-xs text-slate-600">{ev.alert_type.replace(/_/g, " ")}</td>
                  <td className="py-2 pr-3 text-slate-800">{ev.message}</td>
                  <td className="py-2 pr-3 text-xs text-slate-500">{ev.recommended_action ?? "—"}</td>
                  <td className="py-2 pr-3">
                    {ev.patient_id ? (
                      <Link
                        href={fiOsPatientTwinPhotoProtocolHref(tid, ev.patient_id)}
                        className="text-xs font-medium text-sky-700 hover:underline"
                      >
                        Open Twin
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ring-inset ${statusBadge(ev.status)}`}>
                      {ev.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-xs text-slate-600">{new Date(ev.first_detected_at).toLocaleString()}</td>
                  <td className="py-2 pr-3 text-xs text-slate-600">{new Date(ev.last_detected_at).toLocaleString()}</td>
                  <td className="py-2">
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        disabled={pending || ev.status !== "open"}
                        className="text-left text-[11px] font-medium text-sky-700 hover:underline disabled:text-slate-400"
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
                        className="text-left text-[11px] font-medium text-emerald-800 hover:underline disabled:text-slate-400"
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
                        className="text-left text-[11px] font-medium text-slate-600 hover:underline disabled:text-slate-400"
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
    </div>
  );
}
