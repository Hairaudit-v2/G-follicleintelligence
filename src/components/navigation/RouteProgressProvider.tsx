"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import {
  ROUTE_PROGRESS_MAX_MS,
  ROUTE_PROGRESS_MIN_VISIBLE_MS,
  ROUTE_PROGRESS_SOFT_FALLBACK_MS,
  routeProgressClearDelayMs,
  shouldHardNavigateSoftNavFallback,
  shouldStartRouteProgress,
  type RouteLocation,
} from "@/src/lib/navigation/routeProgressCore";
import {
  FI_OS_NAV_PENDING_ATTR,
  readFiOsNavIdFromAnchor,
} from "@/src/lib/fi-os/fiOsNavigationPendingCore";

type RouteProgressContextValue = {
  isPending: boolean;
  /** Optional nav id for FI OS sidebar pending highlight. */
  pendingNavId: string | null;
  /** Start progress for programmatic navigations (`router.push`). */
  startPending: (navId?: string | null) => void;
  /** Click-capture helper for scoped shells (optional; document listener also runs). */
  onInternalNavClick: (event: ReactMouseEvent<HTMLElement> | MouseEvent) => void;
};

const RouteProgressContext = createContext<RouteProgressContextValue | null>(null);

export function useRouteProgress(): RouteProgressContextValue {
  const ctx = useContext(RouteProgressContext);
  if (!ctx) {
    return {
      isPending: false,
      pendingNavId: null,
      startPending: () => {},
      onInternalNavClick: () => {},
    };
  }
  return ctx;
}

function RouteProgressBar({ active }: { active: boolean }) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-[9999] h-1 overflow-hidden transition-opacity duration-150",
        active ? "opacity-100" : "opacity-0"
      )}
      aria-hidden={!active}
      data-testid="route-navigation-progress"
      role="status"
      aria-live="polite"
      aria-busy={active || undefined}
    >
      <div
        className={cn(
          "h-full w-[38%] rounded-r-full bg-gradient-to-r from-cyan-400 via-sky-300 to-amber-300/90 shadow-[0_0_12px_rgb(34_211_238_/0.55)]",
          "motion-safe:animate-fi-os-nav-progress motion-reduce:w-full motion-reduce:animate-none"
        )}
        role="progressbar"
        aria-valuetext={active ? "Loading page" : undefined}
      />
      <span className="sr-only">{active ? "Loading page" : ""}</span>
    </div>
  );
}

function RouteProgressInner({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ? `?${searchParams.toString()}` : "";
  const [isPending, setIsPending] = useState(false);
  const [pendingNavId, setPendingNavId] = useState<string | null>(null);
  const routeRef = useRef<RouteLocation>({ pathname, search });
  const startedAtRef = useRef(0);
  const intendedHrefRef = useRef<string | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const softFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (clearTimerRef.current != null) {
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
    if (maxTimerRef.current != null) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    if (softFallbackTimerRef.current != null) {
      clearTimeout(softFallbackTimerRef.current);
      softFallbackTimerRef.current = null;
    }
  }, []);

  const finishPending = useCallback(() => {
    clearTimers();
    intendedHrefRef.current = null;
    const delay = routeProgressClearDelayMs(
      startedAtRef.current,
      Date.now(),
      ROUTE_PROGRESS_MIN_VISIBLE_MS
    );
    clearTimerRef.current = setTimeout(() => {
      setIsPending(false);
      setPendingNavId(null);
      startedAtRef.current = 0;
      clearTimerRef.current = null;
    }, delay);
  }, [clearTimers]);

  const armSoftNavFallback = useCallback((href: string) => {
    if (softFallbackTimerRef.current != null) {
      clearTimeout(softFallbackTimerRef.current);
      softFallbackTimerRef.current = null;
    }
    intendedHrefRef.current = href;
    softFallbackTimerRef.current = setTimeout(() => {
      softFallbackTimerRef.current = null;
      const intended = intendedHrefRef.current;
      if (!intended || typeof window === "undefined") return;
      let intendedPathname = "";
      try {
        intendedPathname = new URL(intended, window.location.origin).pathname;
      } catch {
        return;
      }
      const shouldHard = shouldHardNavigateSoftNavFallback({
        intendedPathname,
        currentPathname: window.location.pathname,
        startedAtMs: startedAtRef.current,
        nowMs: Date.now(),
        fallbackMs: ROUTE_PROGRESS_SOFT_FALLBACK_MS,
      });
      if (!shouldHard) return;
      // Soft click showed busy but App Router never updated the URL — hard recover.
      window.location.assign(intended);
    }, ROUTE_PROGRESS_SOFT_FALLBACK_MS);
  }, []);

  const startPending = useCallback(
    (navId?: string | null) => {
      clearTimers();
      intendedHrefRef.current = null;
      startedAtRef.current = Date.now();
      setIsPending(true);
      setPendingNavId(navId?.trim() || null);
      maxTimerRef.current = setTimeout(() => {
        setIsPending(false);
        setPendingNavId(null);
        startedAtRef.current = 0;
        intendedHrefRef.current = null;
        maxTimerRef.current = null;
      }, ROUTE_PROGRESS_MAX_MS);
    },
    [clearTimers]
  );

  const tryStartFromAnchor = useCallback(
    (
      anchor: HTMLAnchorElement,
      event: {
        metaKey: boolean;
        ctrlKey: boolean;
        shiftKey: boolean;
        altKey: boolean;
        button: number;
      }
    ) => {
      const current = routeRef.current;
      const shouldPending = shouldStartRouteProgress({
        href: anchor.href,
        current,
        target: anchor.target,
        download: anchor.getAttribute("download"),
        disabled:
          anchor.getAttribute("aria-disabled") === "true" || anchor.hasAttribute("disabled"),
        modifiedClick:
          event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0,
        origin: typeof window !== "undefined" ? window.location.origin : undefined,
      });
      if (!shouldPending) return false;
      startPending(readFiOsNavIdFromAnchor(anchor));
      armSoftNavFallback(anchor.href);
      return true;
    },
    [startPending, armSoftNavFallback]
  );

  const onInternalNavClick = useCallback(
    (event: ReactMouseEvent<HTMLElement> | MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      tryStartFromAnchor(anchor, event);
    },
    [tryStartFromAnchor]
  );

  // Document-level capture so marketing header links, cards, and FOSlinks all trigger the bar.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      onInternalNavClick(event);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [onInternalNavClick]);

  // Browser back/forward.
  useEffect(() => {
    function onPopState() {
      startPending(null);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [startPending]);

  useEffect(() => {
    const next: RouteLocation = { pathname, search };
    const prev = routeRef.current;
    routeRef.current = next;

    // Complete when the URL actually changes (soft nav finished routing).
    if (prev.pathname !== next.pathname || prev.search !== next.search) {
      if (isPending || startedAtRef.current > 0) {
        finishPending();
      }
    }
  }, [pathname, search, isPending, finishPending]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const value = useMemo(
    () => ({
      isPending,
      pendingNavId,
      startPending,
      onInternalNavClick,
    }),
    [isPending, pendingNavId, startPending, onInternalNavClick]
  );

  return (
    <RouteProgressContext.Provider value={value}>
      <RouteProgressBar active={isPending} />
      {children}
    </RouteProgressContext.Provider>
  );
}

/**
 * Site-wide top progress bar + pending state for soft navigations.
 * Wrap app root (requires Suspense for useSearchParams).
 */
export function RouteProgressProvider({ children }: { children: ReactNode }) {
  return <RouteProgressInner>{children}</RouteProgressInner>;
}

/** Alias used by FI OS tests / older imports. */
export function RouteProgressStrip({ active }: { active: boolean }) {
  return <RouteProgressBar active={active} />;
}

export { FI_OS_NAV_PENDING_ATTR };
