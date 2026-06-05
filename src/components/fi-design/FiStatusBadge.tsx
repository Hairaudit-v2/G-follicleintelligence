import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import {
  fiBadgeIntentClassNames,
  fiStatusBadgeChipToneClassNames,
  type FiBadgeIntent,
  type FiDensity,
} from "./fiDesignTokens";

export type FiStatusBadgeTone = keyof typeof fiStatusBadgeChipToneClassNames;

export type FiStatusBadgeProps = {
  tone: FiStatusBadgeTone;
  children: ReactNode;
  className?: string;
  /**
   * `chip` — bordered rounded-md (default, historical).
   * `pill` — ring-based semantic pill from `fiBadgeIntentClassNames`.
   */
  appearance?: "chip" | "pill";
  /** Section padding / gap preset when paired with layout wrappers (pill density). */
  density?: FiDensity;
};

const toneToIntent: Record<FiStatusBadgeTone, FiBadgeIntent> = {
  neutral: "neutral",
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "info",
};

const chipLayout =
  "inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-xs font-medium tabular-nums";

const pillLayout = "inline-flex shrink-0 items-center rounded-full font-medium tabular-nums";

const pillPaddingByDensity: Record<FiDensity, string> = {
  compact: "px-2 py-0.5 text-[10px]",
  default: "px-2.5 py-0.5 text-xs",
  spacious: "px-3 py-1 text-sm",
};

export function FiStatusBadge({
  tone,
  children,
  className,
  appearance = "chip",
  density = "default",
}: FiStatusBadgeProps) {
  if (appearance === "pill") {
    return (
      <span
        className={cn(
          pillLayout,
          pillPaddingByDensity[density],
          fiBadgeIntentClassNames[toneToIntent[tone]],
          className
        )}
      >
        {children}
      </span>
    );
  }

  return (
    <span className={cn(chipLayout, fiStatusBadgeChipToneClassNames[tone], className)}>
      {children}
    </span>
  );
}
