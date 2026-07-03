"use client";

import { useId, type ReactNode } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";

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

  if (!open) return null;

  return (
    <div
      className={cn(fiOsChromeClasses.rightDrawerOverlay, "z-[120]")}
      role="presentation"
      data-testid={testId}
    >
      <button
        type="button"
        className={fiOsChromeClasses.rightDrawerBackdrop}
        aria-label="Close drawer"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          fiOsChromeClasses.rightDrawerPanel,
          "border border-white/[0.08] bg-[#0B1220]/98 shadow-2xl backdrop-blur-xl",
          wide ? "sm:max-w-2xl" : "sm:max-w-md"
        )}
      >
        <div
          className={cn(
            fiOsChromeClasses.rightDrawerHeader,
            "flex items-start justify-between gap-3 border-b border-white/[0.08] px-4 py-4 sm:px-5"
          )}
        >
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

        <div className={cn(fiOsChromeClasses.rightDrawerBodyScroll, "px-4 py-4 sm:px-5")}>
          {children}
        </div>

        {footer ? (
          <div
            className={cn(
              fiOsChromeClasses.rightDrawerFooter,
              "border-t border-white/[0.08] px-4 py-3 sm:px-5"
            )}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
