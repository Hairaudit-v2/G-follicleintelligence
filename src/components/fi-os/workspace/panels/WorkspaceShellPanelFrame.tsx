"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { crmLeadCardClass } from "@/src/components/fi/crm/shared/crmSharedStyles";

type WorkspaceShellPanelFrameProps = {
  ariaLabel: string;
  title: string;
  fullPageHref?: string | null;
  fullPageLabel?: string;
  open: boolean;
  onClose: () => void;
  loading: boolean;
  loadError: string | null;
  children: ReactNode;
  actions?: ReactNode;
  /** D6D — subtle signal-sync feedback (non-PHI). */
  lastSignalReason?: string;
  lastSignalAt?: string;
  signalRefreshToken?: number;
};

export function WorkspaceSignalHeaderHint({
  lastSignalReason,
  lastSignalAt,
  signalRefreshToken = 0,
}: {
  lastSignalReason?: string;
  lastSignalAt?: string;
  signalRefreshToken?: number;
}) {
  if (!lastSignalReason || !lastSignalAt) return null;
  const showPulse = signalRefreshToken > 0;
  return (
    <p
      className={`truncate text-[11px] text-slate-500${showPulse ? " motion-safe:animate-pulse" : ""}`}
      title={lastSignalReason}
    >
      Updated just now · {lastSignalReason}
    </p>
  );
}

/** Shared right-hand workspace drawer chrome (D1/D4). */
export function WorkspaceShellPanelFrame({
  ariaLabel,
  title,
  fullPageHref,
  fullPageLabel = "Open full page →",
  open,
  onClose,
  loading,
  loadError,
  children,
  actions,
  lastSignalReason,
  lastSignalAt,
  signalRefreshToken = 0,
}: WorkspaceShellPanelFrameProps) {
  if (!open) return null;

  const showSignalPulse = signalRefreshToken > 0 && Boolean(lastSignalAt);

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/30 sm:items-stretch"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        className="flex h-full max-h-[100dvh] w-full flex-col overflow-hidden border-l border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md shadow-xl sm:max-w-lg"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-3">
          <div className="min-w-0">
            <h2
              className={`truncate text-sm font-semibold text-slate-100${
                showSignalPulse ? " motion-safe:animate-pulse" : ""
              }`}
            >
              {title}
            </h2>
            {lastSignalReason && lastSignalAt ? (
              <WorkspaceSignalHeaderHint
                lastSignalReason={lastSignalReason}
                lastSignalAt={lastSignalAt}
                signalRefreshToken={signalRefreshToken}
              />
            ) : null}
            {fullPageHref ? (
              <Link
                href={fullPageHref}
                className="text-xs text-blue-300 hover:underline"
                onClick={() => onClose()}
              >
                {fullPageLabel}
              </Link>
            ) : null}
          </div>
          <button
            type="button"
            className="shrink-0 text-sm text-slate-400 hover:text-slate-100"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm">
          {loading ? <p className="text-slate-400">Loading…</p> : null}
          {loadError ? (
            <div
              className="rounded border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-300"
              role="alert"
            >
              {loadError}
            </div>
          ) : null}
          {!loading && !loadError ? children : null}
        </div>

        {actions ? (
          <div className="shrink-0 border-t border-white/[0.08] p-4">{actions}</div>
        ) : null}
      </aside>
    </div>
  );
}

export function WorkspaceShellContextCard({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section className={crmLeadCardClass}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{heading}</h3>
      <div className="mt-2 text-sm text-slate-200">{children}</div>
    </section>
  );
}

export function workspacePanelActionClass(): string {
  return "inline-flex items-center justify-center rounded border border-white/[0.12] bg-white/[0.06] px-3 py-2 text-xs font-medium text-slate-100 hover:bg-white/[0.1]";
}
