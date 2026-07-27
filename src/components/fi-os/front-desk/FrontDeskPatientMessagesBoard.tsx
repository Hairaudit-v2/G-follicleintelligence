"use client";

/**
 * FI-PATIENT-APP-2F.3 — Front Desk Patient Messages board.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { FrontDeskPatientMessageAlert } from "@/src/components/fi-os/front-desk/FrontDeskPatientMessageAlert";
import { FrontDeskPatientMessageThreadPanel } from "@/src/components/fi-os/front-desk/FrontDeskPatientMessageThreadPanel";
import { useFrontDeskPatientMessagesRefresh } from "@/src/components/fi-os/front-desk/useFrontDeskPatientMessagesRefresh";
import {
  formatFrontDeskRelativeTime,
  type FrontDeskPatientMessageQueueItem,
  type FrontDeskPatientMessageQueuePayload,
} from "@/src/lib/fiOs/frontDesk/frontDeskPatientMessagesCore";

export type FrontDeskPatientMessagesBoardProps = {
  initialData: FrontDeskPatientMessageQueuePayload;
};

export function FrontDeskPatientMessagesBoard({
  initialData,
}: FrontDeskPatientMessagesBoardProps) {
  const [alertItem, setAlertItem] = useState<FrontDeskPatientMessageQueueItem | null>(null);
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const onNewIncoming = useCallback((item: FrontDeskPatientMessageQueueItem) => {
    setAlertItem((prev) => prev ?? item);
  }, []);

  const { data, isRefreshing, refreshError, refresh, setFilter } =
    useFrontDeskPatientMessagesRefresh({
      tenantId: initialData.tenantId,
      initialData,
      onNewIncoming,
    });

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const filter = data.filter;
  const unreadLabel =
    data.unreadCount === 1 ? "1 unread" : `${data.unreadCount} unread`;

  const openThread = useCallback((threadId: string) => {
    setOpenThreadId(threadId);
    setAlertItem((prev) => (prev?.threadId === threadId ? null : prev));
  }, []);

  const closeThread = useCallback(() => {
    setOpenThreadId(null);
    void refresh();
  }, [refresh]);

  const headerMeta = useMemo(() => {
    if (isRefreshing) return "Refreshing…";
    if (refreshError) return refreshError;
    return `Updates every ${Math.round(data.refreshIntervalMs / 1000)}s`;
  }, [isRefreshing, refreshError, data.refreshIntervalMs]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-100">
            Patient Messages
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            <span className="font-medium text-[#22C1FF]">{unreadLabel}</span>
            <span className="mx-2 text-slate-600">·</span>
            <span className="text-xs text-slate-500">{headerMeta}</span>
          </p>
        </div>
        <div
          className="inline-flex rounded-full border border-white/[0.08] bg-[#0F1629]/60 p-0.5"
          role="tablist"
          aria-label="Message filter"
        >
          {(["unread", "all"] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                filter === f
                  ? "bg-[#22C1FF]/15 text-[#22C1FF]"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </header>

      {data.items.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-[#0F1629]/40 px-4 py-10 text-center">
          <p className="text-sm text-slate-400">
            {filter === "unread"
              ? "No unread patient messages."
              : "No patient messages yet."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.08] bg-[#0F1629]/50">
          {data.items.map((item) => (
            <li key={item.threadId}>
              <button
                type="button"
                onClick={() => openThread(item.threadId)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {item.unreadCount > 0 ? (
                      <span
                        className="h-2 w-2 shrink-0 rounded-full bg-[#22C1FF]"
                        aria-label="Unread"
                      />
                    ) : null}
                    <span className="truncate text-sm font-medium text-slate-100">
                      {item.patientDisplayName}
                    </span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-500">
                      {item.workState}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {item.categoryLabel}
                    <span className="mx-1.5 text-slate-600">·</span>
                    {formatFrontDeskRelativeTime(item.lastMessageAt, nowMs)}
                  </p>
                  <p className="mt-1 truncate text-sm text-slate-300">
                    {item.previewPolicy === "generic_sensitive"
                      ? "New patient message — open to view"
                      : item.preview ?? "Open to view"}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-slate-500">
        Opens the patient message thread. Profile:{" "}
        <span className="text-slate-400">Patients → Activity</span>
      </p>

      {openThreadId ? (
        <FrontDeskPatientMessageThreadPanel
          tenantId={data.tenantId}
          threadId={openThreadId}
          onClose={closeThread}
          onChanged={() => void refresh()}
        />
      ) : null}

      {alertItem ? (
        <FrontDeskPatientMessageAlert
          item={alertItem}
          onView={() => openThread(alertItem.threadId)}
          onDismiss={() => setAlertItem(null)}
        />
      ) : null}

      {/* Quiet deep-link affordance for screen readers */}
      <div className="sr-only">
        {data.items.map((item) => (
          <Link key={`a11y-${item.threadId}`} href={item.patientHref}>
            {item.patientDisplayName} profile
          </Link>
        ))}
      </div>
    </div>
  );
}
