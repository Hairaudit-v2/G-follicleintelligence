import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { fiSurfaceVariantClassNames, type FiSurfaceVariant } from "./fiDesignTokens";

export type FiCardProps = {
  children: ReactNode;
  className?: string;
  /** Adds hover / focus affordances for clickable shells (parent should still be Link or button). */
  interactive?: boolean;
  /** Surface family; default matches historical Clinic OS white card. */
  surfaceVariant?: FiSurfaceVariant;
};

const SURFACE_WITH_BUILTIN_PADDING = new Set<FiSurfaceVariant>(["clinicLight", "auditDark"]);

/**
 * Base surface card — white panel, slate border, Clinic OS rhythm.
 */
export function FiCard({ children, className, interactive, surfaceVariant = "darkGlass" }: FiCardProps) {
  const surface = fiSurfaceVariantClassNames[surfaceVariant];
  const padWhenNeeded =
    !SURFACE_WITH_BUILTIN_PADDING.has(surfaceVariant) ? "p-4 sm:p-5" : undefined;
  const interactiveClasses =
    interactive && (surfaceVariant === "clinicLight" || surfaceVariant === "crmLight")
      ? "transition hover:border-cyan-400/30 hover:shadow-md"
      : interactive && surfaceVariant === "darkGlass"
        ? "transition hover:border-white/[0.12] hover:bg-[#141C33]/85"
        : undefined;

  return (
    <div className={cn(surface, padWhenNeeded, interactiveClasses, className)}>
      {children}
    </div>
  );
}
