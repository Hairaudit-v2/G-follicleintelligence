"use client";

import { useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { useBodyScrollLock } from "@/src/lib/dom/useBodyScrollLock";

export type RosterRightDrawerProps = {
  open: boolean;
  title: string;
  subtitle?: string | null;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  testId?: string;
  wide?: boolean;
};

/**
 * Full-viewport portal drawer.
 *
 * IMPORTANT: Do not use chrome-offset top/bottom vars on body portals — measured
 * shell offsets can collapse the overlay to zero height (click appears to do nothing).
 */
export function RosterRightDrawer({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  testId = "roster-right-drawer",
  wide = false,
}: RosterRightDrawerProps) {
  const titleId = useId();

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[400] flex justify-end bg-black/60 backdrop-blur-[2px]"
      role="presentation"
      data-testid={testId}
      data-roster-drawer-viewport="full"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-transparent"
        aria-label="Close drawer"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative z-[1] flex h-full max-h-[100dvh] w-full flex-col overflow-hidden border border-white/[0.08] bg-[#0B1220] shadow-2xl sm:mr-2 sm:mt-2 sm:mb-2 sm:max-h-[calc(100dvh-1rem)] sm:max-w-md sm:rounded-2xl",
          wide ? "sm:max-w-2xl" : "sm:max-w-md"
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/[0.08] px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-slate-50 sm:text-lg">
              {title}
            </h2>
            {subtitle ? <p className="mt-1 text-xs text-slate-400">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          className={cn(
            fiOsChromeClasses.rightDrawerBodyScroll,
            "min-h-0 flex-1 px-4 py-4 sm:px-5"
          )}
        >
          {children}
        </div>

        {footer ? (
          <div className="shrink-0 border-t border-white/[0.08] px-4 py-3 sm:px-5">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
