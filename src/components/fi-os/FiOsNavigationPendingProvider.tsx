"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";
import {
  FI_OS_NAV_PENDING_ATTR,
  readFiOsNavIdFromAnchor,
  shouldStartFiOsNavigationPending,
  type FiOsRouteLocation,
} from "@/src/lib/fi-os/fiOsNavigationPendingCore";
import { useRouteProgress } from "@/src/components/navigation/RouteProgressProvider";
import { usePathname, useSearchParams } from "next/navigation";

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
 * always shows. This layer adds fi-admin-only pendingNavId for sidebar highlights.
 */
function FiOsNavigationPendingInner({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ? `?${searchParams.toString()}` : "";
  const { isPending, pendingNavId, startPending } = useRouteProgress();

  const onInternalNavClick = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;

      const current: FiOsRouteLocation = { pathname, search };
      const shouldPending = shouldStartFiOsNavigationPending({
        href: anchor.href,
        current,
        target: anchor.target,
        download: anchor.getAttribute("download"),
        disabled: anchor.getAttribute("aria-disabled") === "true" || anchor.hasAttribute("disabled"),
        modifiedClick:
          event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0,
        origin: typeof window !== "undefined" ? window.location.origin : undefined,
      });

      if (!shouldPending) return;

      // Site-wide bar is already started by RouteProgress document listener; ensure nav id.
      startPending(readFiOsNavIdFromAnchor(anchor));
    },
    [pathname, search, startPending]
  );

  const value = useMemo(
    () => ({
      isNavigationPending: isPending,
      pendingNavId,
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
