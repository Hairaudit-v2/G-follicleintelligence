"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import { StatCard } from "@/src/components/fi-admin/dashboard-ui";
import {
  dismissGoogleCalendarSyncReviewItemAction,
  ignoreGoogleCalendarSyncReviewItemAction,
  importGoogleCalendarSyncReviewItemAction,
  linkGoogleCalendarSyncReviewItemAction,
} from "@/src/lib/actions/fi-google-calendar-sync-review-actions";
import {
  formatConflictTypeLabel,
  type GoogleCalendarSyncReviewPageModel,
} from "@/src/lib/googleCalendar/googleCalendarSyncReviewCore";

function formatIso(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "—";
  return new Date(ms).toLocaleString();
}

function severityClass(severity: string): string {
  if (severity === "warning") return "text-amber-300";
  if (severity === "block") return "text-red-300";
  return "text-[#CBD5E1]";
}

export function GoogleCalendarSyncReviewCard({
  tenantId,
  pageModel,
}: {
  tenantId: string;
  pageModel: GoogleCalendarSyncReviewPageModel;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const runAction = useCallback(
    (
      reviewItemId: string,
      fn: () => Promise<{ ok: boolean; error?: string; message?: string }>
    ) => {
      if (!pageModel.canManage) return;
      setError(null);
      setActionMessage(null);
      setActingId(reviewItemId);
      startTransition(async () => {
        const result = await fn();
        setActingId(null);
        if (!result.ok) {
          setError(result.error ?? "Action failed.");
          return;
        }
        setActionMessage(result.message ?? "Done.");
        router.refresh();
      });
    },
    [pageModel.canManage, router]
  );

  return (
    <section className="rounded-xl border border-white/[0.08] bg-[#0a1424]/80 p-4 sm:p-5">
      <div>
        <h2 className="text-base font-semibold text-[#F8FAFC]">Sync review &amp; conflict queue</h2>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[#94A3B8]">
          Ambiguous inbound Google events are staged here instead of auto-creating duplicates or
          overwriting FI-owned appointments. Clear matches still sync automatically.
        </p>
      </div>

      {!pageModel.connected ? (
        <p className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Connect Google Calendar above to view sync review items.
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Open review items" value={pageModel.openCount} />
          </div>

          {pageModel.items.length === 0 ? (
            <p className="mt-4 text-sm text-[#64748B]">No open review items — inbound sync is clear.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] uppercase tracking-wide text-[#64748B]">
                    <th className="px-2 py-1.5 font-medium">Severity</th>
                    <th className="px-2 py-1.5 font-medium">Conflict</th>
                    <th className="px-2 py-1.5 font-medium">Calendar</th>
                    <th className="px-2 py-1.5 font-medium">Event</th>
                    <th className="px-2 py-1.5 font-medium">Start / end</th>
                    <th className="px-2 py-1.5 font-medium">Reason</th>
                    <th className="px-2 py-1.5 font-medium">Suggested match</th>
                    <th className="px-2 py-1.5 font-medium">Created</th>
                    <th className="px-2 py-1.5 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageModel.items.map((item) => {
                    const busy = pending && actingId === item.id;
                    return (
                      <tr key={item.id} className="border-b border-white/[0.04] text-[#CBD5E1]">
                        <td className={`px-2 py-2 capitalize ${severityClass(item.severity)}`}>
                          {item.severity}
                        </td>
                        <td className="px-2 py-2">{formatConflictTypeLabel(item.conflictType)}</td>
                        <td className="px-2 py-2">
                          <div>{item.googleCalendarSummary ?? "—"}</div>
                          {item.googleCalendarId ? (
                            <div className="font-mono text-[10px] text-[#64748B]">
                              {item.googleCalendarId}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-2 py-2">
                          <div>{item.eventSummary ?? "—"}</div>
                          <div className="font-mono text-[10px] text-[#64748B]">
                            {item.externalEventId}
                          </div>
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap">
                          <div>{formatIso(item.eventStartAt)}</div>
                          <div className="text-[#64748B]">{formatIso(item.eventEndAt)}</div>
                        </td>
                        <td className="max-w-[200px] px-2 py-2 text-[#94A3B8]">{item.conflictReason}</td>
                        <td className="px-2 py-2">
                          {item.matchedLocalEventId ? (
                            <span className="font-mono text-[10px] text-[#22C1FF]">
                              {item.matchedLocalEventId.slice(0, 8)}…
                              {item.matchedLocalEventType ? ` (${item.matchedLocalEventType})` : ""}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap">{formatIso(item.createdAt)}</td>
                        <td className="px-2 py-2">
                          {pageModel.canManage ? (
                            <div className="flex flex-wrap gap-1">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  runAction(item.id, () =>
                                    dismissGoogleCalendarSyncReviewItemAction(tenantId, {
                                      reviewItemId: item.id,
                                    })
                                  )
                                }
                                className="rounded border border-white/10 px-2 py-1 text-[10px] hover:border-white/20 disabled:opacity-50"
                              >
                                Dismiss
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  runAction(item.id, () =>
                                    ignoreGoogleCalendarSyncReviewItemAction(tenantId, {
                                      reviewItemId: item.id,
                                    })
                                  )
                                }
                                className="rounded border border-white/10 px-2 py-1 text-[10px] hover:border-white/20 disabled:opacity-50"
                              >
                                Ignore
                              </button>
                              {item.matchedLocalEventId ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    runAction(item.id, () =>
                                      linkGoogleCalendarSyncReviewItemAction(tenantId, {
                                        reviewItemId: item.id,
                                      })
                                    )
                                  }
                                  className="rounded border border-[#22C1FF]/30 px-2 py-1 text-[10px] text-[#22C1FF] hover:bg-[#22C1FF]/10 disabled:opacity-50"
                                >
                                  Link
                                </button>
                              ) : null}
                              <button
                                type="button"
                                disabled={busy || !item.eventStartAt || !item.eventEndAt}
                                onClick={() =>
                                  runAction(item.id, () =>
                                    importGoogleCalendarSyncReviewItemAction(tenantId, {
                                      reviewItemId: item.id,
                                    })
                                  )
                                }
                                className="rounded border border-emerald-500/30 px-2 py-1 text-[10px] text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
                              >
                                Import
                              </button>
                            </div>
                          ) : (
                            <span className="text-[#64748B]">{item.status}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!pageModel.canManage ? (
            <p className="mt-3 text-xs text-[#64748B]">
              Tenant admin access is required to resolve review items.
            </p>
          ) : null}
        </>
      )}

      {error ? (
        <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      {actionMessage ? (
        <p className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {actionMessage}
        </p>
      ) : null}
    </section>
  );
}
