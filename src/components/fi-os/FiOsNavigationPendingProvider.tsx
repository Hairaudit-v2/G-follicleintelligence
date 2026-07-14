"use client";

import {
  createContext,
  useContext,
  useMemo,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";
import { FI_OS_NAV_PENDING_ATTR } from "@/src/lib/fi-os/fiOsNavigationPendingCore";
import { useRouteProgress } from "@/src/components/navigation/RouteProgressProvider";

type FiOsNavigationPendingContextValue = {
  isNavigationPending: boolean;
  pendingNavId: string | null;
  onInternalNavClick: (event: ReactMouseEvent<HTMLElement>) => void;
};

const FiOsNavigationPendingContext = createContext<FiOsNavigationPendingContextValue | null>(null);

export function useFiOsNavigationPending(): FiOsNavigationPendingContextValue {
  const ctx = useContext(FiOsNavigationPendingContext);
  if (!ctx) {
    return {
      isNavigationPending: false,
      pendingNavId: null,
      onInternalNavClick: () => {},
    };
  }
  return ctx;
}

function FiOsNavigationProgressBar({ active }: { active: boolean }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 z-[60] h-0.5 overflow-hidden transition-opacity duration-150",
        active ? "opacity-100" : "opacity-0"
      )}
      aria-hidden={!active}
      data-testid="fi-os-navigation-progress"
    >
      <div
        className={cn(
          "h-full w-[40%] bg-cyan-400/90 motion-safe:animate-fi-os-nav-progress motion-reduce:w-full motion-reduce:animate-none"
        )}
        role="progressbar"
        aria-valuetext={active ? "Loading page" : undefined}
      />
    </div>
  );
}

/**
 * FI OS pending state is backed by the site-wide RouteProgressProvider so the top bar
 * always shows. This layer exposes pendingNavId for sidebar highlights without a second
 * startPending (which would clear the soft-nav hard-fallback timer).
 */
function FiOsNavigationPendingInner({ children }: { children: ReactNode }) {
  const { isPending, pendingNavId, onInternalNavClick } = useRouteProgress();

  const value = useMemo(
    () => ({
      isNavigationPending: isPending,
      pendingNavId,
      // Document capture already arms soft-nav fallback; shell capture reuses same helper.
      onInternalNavClick,
    }),
    [isPending, pendingNavId, onInternalNavClick]
  );

  return (
    <FiOsNavigationPendingContext.Provider value={value}>
      {children}
    </FiOsNavigationPendingContext.Provider>
  );
}

export function FiOsNavigationPendingProvider({ children }: { children: ReactNode }) {
  return <FiOsNavigationPendingInner>{children}</FiOsNavigationPendingInner>;
}

export function FiOsNavigationProgressStrip({ active }: { active: boolean }) {
  // Prefer the global fixed bar; keep a shell-local strip as a secondary cue in the top bar.
  return <FiOsNavigationProgressBar active={active} />;
}

export { FI_OS_NAV_PENDING_ATTR };
