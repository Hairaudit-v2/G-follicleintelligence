"use client";

import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export type FiOsPendingActionTone = "default" | "warn" | "danger";

const TONE_CLASS: Record<FiOsPendingActionTone, string> = {
  default: "border-white/10 text-[#CBD5E1] hover:bg-white/5",
  warn: "border-amber-500/30 text-amber-300 hover:bg-amber-500/10",
  danger: "border-rose-500/30 text-rose-300 hover:bg-rose-500/10",
};

export function fiOsPendingActionLabel(
  actionKey: string,
  idleLabel: string,
  pendingLabel?: string
): string {
  if (pendingLabel) return pendingLabel;
  if (actionKey.endsWith(":send")) return "Sending…";
  if (actionKey.endsWith(":resend")) return "Resending…";
  if (actionKey.endsWith(":resetPin")) return "Resetting…";
  if (actionKey.endsWith(":copy")) return "Copying…";
  if (actionKey.endsWith(":revoke")) return "Revoking…";
  if (actionKey.endsWith(":suspend")) return "Suspending…";
  if (actionKey.endsWith(":create")) return "Creating…";
  return "Loading…";
}

export function FiOsPendingActionButton({
  label,
  pendingLabel,
  actionKey,
  activeActionKey,
  anyPending,
  onClick,
  tone = "default",
  className,
}: {
  label: string;
  pendingLabel?: string;
  actionKey: string;
  activeActionKey: string | null;
  anyPending: boolean;
  onClick: () => void;
  tone?: FiOsPendingActionTone;
  className?: string;
}) {
  const isActive = activeActionKey === actionKey;
  const disabled = anyPending;
  const displayLabel = isActive
    ? fiOsPendingActionLabel(actionKey, label, pendingLabel)
    : label;

  return (
    <button
      type="button"
      disabled={disabled}
      aria-busy={isActive || undefined}
      onClick={onClick}
      data-testid={`fi-os-pending-action-${actionKey}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-50",
        TONE_CLASS[tone],
        className
      )}
    >
      {isActive ? (
        <Loader2 className="h-3 w-3 shrink-0 motion-safe:animate-spin motion-reduce:animate-none" aria-hidden />
      ) : null}
      <span>{displayLabel}</span>
    </button>
  );
}
