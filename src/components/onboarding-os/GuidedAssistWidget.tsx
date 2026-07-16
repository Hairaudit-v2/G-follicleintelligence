"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Compass, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  dismissGuidedAssistTipAction,
  incrementGuidedAssistViewsAction,
  recordGuidedAssistClientEventAction,
  snoozeGuidedAssistTipAction,
} from "@/lib/actions/fi-onboarding-os-guided-assist-actions";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { isFiOsTenantCalendarPath } from "@/src/lib/fiAdmin/fiOsTenantCalendarRoute";
import type { GuidedAssistSessionPayload } from "@/src/lib/onboarding-os/guidedAssistTypes";

import { GuidedAssistToggle } from "./GuidedAssistToggle";

/** Prefer collapsed clinic guide on narrow phones so it does not compete with bottom nav. */
function usePrefersCollapsedAssistDefault(): boolean {
  const [prefersCollapsed, setPrefersCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(max-width: 639px)");
    const apply = () => setPrefersCollapsed(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return prefersCollapsed;
}

export function GuidedAssistWidget({
  tenantId,
  initialPayload,
  className,
}: {
  tenantId: string;
  initialPayload: GuidedAssistSessionPayload;
  className?: string;
}) {
  const [payload, setPayload] = useState(initialPayload);
  const pathname = usePathname() ?? "";
  const onCalendarSurface = isFiOsTenantCalendarPath(pathname);
  const prefersCollapsedDefault = usePrefersCollapsedAssistDefault();
  const [collapsed, setCollapsed] = useState(true);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  /** Index into emptyStateTour.steps; null = tour not active. */
  const [tourStepIndex, setTourStepIndex] = useState<number | null>(null);
  const shownTipCodesRef = useRef<Set<string>>(new Set());
  const hydratedCollapseRef = useRef(false);
  const tourActive = tourStepIndex != null && payload.emptyStateTour != null;

  useEffect(() => {
    setPayload(initialPayload);
    setTourStepIndex(null);
  }, [initialPayload]);

  // Initial collapse: calendar always; phones prefer collapsed; desktop can open after hydrate.
  useEffect(() => {
    if (hydratedCollapseRef.current && !onCalendarSurface) return;
    hydratedCollapseRef.current = true;
    if (onCalendarSurface || prefersCollapsedDefault) {
      setCollapsed(true);
    } else {
      setCollapsed(false);
    }
  }, [onCalendarSurface, prefersCollapsedDefault, pathname]);

  useEffect(() => {
    if (onCalendarSurface) setCollapsed(true);
  }, [onCalendarSurface, pathname]);

  useEffect(() => {
    if (!payload.assistEnabled || payload.tips.length === 0) return;
    for (const tip of payload.tips) {
      if (shownTipCodesRef.current.has(tip.code)) continue;
      shownTipCodesRef.current.add(tip.code);
      void recordGuidedAssistClientEventAction(tenantId, {
        eventKind: "tip_shown",
        guidanceArea: tip.area,
        guidanceCode: tip.code,
        pageKey: payload.pageKey,
      });
    }
  }, [payload.assistEnabled, payload.pageKey, payload.tips, tenantId]);

  /** Once per mount when role-first Today tips are active — advances the first-N window. */
  const roleFirstIncrementedRef = useRef(false);
  useEffect(() => {
    if (!payload.shouldIncrementTodayHomeViews || roleFirstIncrementedRef.current) return;
    roleFirstIncrementedRef.current = true;
    void incrementGuidedAssistViewsAction(tenantId).then((res) => {
      if (res.ok && typeof res.todayHomeViews === "number") {
        setPayload((prev) => ({
          ...prev,
          todayHomeViews: res.todayHomeViews!,
          shouldIncrementTodayHomeViews: false,
        }));
      }
    });
  }, [payload.shouldIncrementTodayHomeViews, tenantId]);

  const dismissTip = (tipCode: string) => {
    setMessage(null);
    startTransition(async () => {
      const res = await dismissGuidedAssistTipAction(tenantId, tipCode);
      if (!res.ok) {
        setMessage(res.error);
        return;
      }
      setPayload((prev) => ({
        ...prev,
        tips: prev.tips.filter((t) => t.code !== tipCode),
      }));
    });
  };

  const snoozeTip = (tipCode: string, snoozeHours: number | null) => {
    setMessage(null);
    startTransition(async () => {
      const res = await snoozeGuidedAssistTipAction(tenantId, tipCode, snoozeHours);
      if (!res.ok) {
        setMessage(res.error);
        return;
      }
      setPayload((prev) => ({
        ...prev,
        tips: prev.tips.filter((t) => t.code !== tipCode),
      }));
    });
  };

  const onNextActionClick = (code: string, area: string) => {
    void recordGuidedAssistClientEventAction(tenantId, {
      eventKind: "next_action_clicked",
      guidanceCode: code,
      guidanceArea: area,
      pageKey: payload.pageKey,
    });
  };

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    void recordGuidedAssistClientEventAction(tenantId, {
      eventKind: next ? "widget_collapsed" : "widget_expanded",
      pageKey: payload.pageKey,
    });
  };

  const startTour = () => {
    if (!payload.emptyStateTour?.steps.length) return;
    setCollapsed(false);
    setTourStepIndex(0);
    void recordGuidedAssistClientEventAction(tenantId, {
      eventKind: "next_action_clicked",
      guidanceCode: payload.emptyStateTour.rootTipCode,
      guidanceArea: "reception_os",
      pageKey: payload.pageKey,
      detail: { kind: "tour_start", emptyStateKey: payload.emptyStateTour.emptyStateKey },
    });
  };

  const skipTour = () => {
    const root = payload.emptyStateTour?.rootTipCode;
    setTourStepIndex(null);
    if (root) {
      void dismissTip(root);
    }
  };

  const completeTour = () => {
    const root = payload.emptyStateTour?.rootTipCode;
    setTourStepIndex(null);
    if (root) {
      void dismissTip(root);
    }
    void recordGuidedAssistClientEventAction(tenantId, {
      eventKind: "tip_dismissed",
      guidanceCode: root ?? "tour_complete",
      pageKey: payload.pageKey,
      detail: { kind: "tour_complete" },
    });
  };

  const tourStep =
    tourActive && payload.emptyStateTour
      ? payload.emptyStateTour.steps[tourStepIndex!] ?? null
      : null;
  const tourTotal = payload.emptyStateTour?.steps.length ?? 0;

  if (!payload.assistEnabled && !payload.isOnboardingPhase) {
    return null;
  }

  return (
    <aside
      className={cn(
        fiOsChromeClasses.guidedAssistDock,
        onCalendarSurface
          ? fiOsChromeClasses.guidedAssistDockCalendar
          : fiOsChromeClasses.guidedAssistDockDefault,
        collapsed
          ? "rounded-full border border-cyan-500/25 bg-[#071018]/95 px-1 py-1 shadow-lg backdrop-blur-md"
          : "rounded-xl border border-cyan-500/20 bg-[#071018]/95 shadow-2xl backdrop-blur-md",
        className
      )}
      aria-label="Clinic guide"
      data-testid="guided-assist-widget"
      data-guided-assist-collapsed={collapsed ? "true" : "false"}
      data-guided-assist-surface={onCalendarSurface ? "calendar" : "default"}
    >
      <div
        className={cn(
          "flex items-start justify-between gap-3",
          collapsed ? "px-2 py-1" : "border-b border-white/10 px-4 py-3"
        )}
      >
        <div className="min-w-0">
          {!collapsed ? (
            <p className={cn(fiOsChromeClasses.sectionEyebrow, "text-cyan-300/90")}>Clinic guide</p>
          ) : null}
          <h2
            className={cn("truncate font-medium text-slate-100", collapsed ? "text-xs" : "text-sm")}
          >
            {collapsed
              ? "Help"
              : tourActive
                ? "Tour"
                : payload.assistEnabled
                  ? "What to do next"
                  : "Clinic guide is off"}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <GuidedAssistToggle
            tenantId={tenantId}
            assistEnabled={payload.assistEnabled}
            compact
            onChanged={(enabled) => setPayload((prev) => ({ ...prev, assistEnabled: enabled }))}
          />
          <button
            type="button"
            onClick={toggleCollapsed}
            className="rounded-md p-1 text-slate-400 hover:bg-white/5 hover:text-slate-200"
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand clinic guide" : "Collapse clinic guide"}
          >
            {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {!collapsed ? (
        <div className={fiOsChromeClasses.guidedAssistBodyScroll}>
          <p className="text-xs leading-relaxed text-slate-400">{payload.safetyNotice}</p>

          {!payload.assistEnabled ? (
            <p className="text-sm text-slate-300">
              Turn the clinic guide on for short setup and day-of tips for your role and this page
              (Front desk, Pipeline, Money, Surgery, Team).
            </p>
          ) : null}

          {payload.roleFirstActive && !tourActive ? (
            <p className="text-[10px] font-medium uppercase tracking-wide text-cyan-400/90">
              Getting started · visit{" "}
              {Math.min(payload.todayHomeViews + 1, payload.roleFirstViewLimit)} of{" "}
              {payload.roleFirstViewLimit}
            </p>
          ) : null}

          {/* Empty-state tour offer */}
          {payload.assistEnabled && payload.emptyStateTour && !tourActive ? (
            <section
              className="rounded-lg border border-cyan-500/30 bg-cyan-950/40 p-3"
              data-testid="guided-assist-tour-offer"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-300/90">
                Empty screen
              </p>
              <h3 className="mt-1 text-sm font-medium text-slate-100">
                {payload.emptyStateTour.title}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                {payload.emptyStateTour.body}
              </p>
              <button
                type="button"
                onClick={startTour}
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-cyan-400/40 bg-cyan-500/20 px-3 text-sm font-semibold text-cyan-50 hover:bg-cyan-500/30"
              >
                Tour me
              </button>
            </section>
          ) : null}

          {/* Active tour steps (collapses other tips) */}
          {tourActive && tourStep ? (
            <section
              className="rounded-lg border border-cyan-500/25 bg-cyan-950/30 p-3"
              data-testid="guided-assist-tour-step"
              aria-live="polite"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-300/90">
                Step {tourStepIndex! + 1} of {tourTotal}
              </p>
              <h3 className="mt-1 text-sm font-medium text-slate-100">{tourStep.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{tourStep.body}</p>
              {tourStep.actionHref && tourStep.actionLabel ? (
                <Link
                  href={tourStep.actionHref}
                  className="mt-2 inline-flex text-xs font-medium text-cyan-300 hover:text-cyan-200"
                >
                  {tourStep.actionLabel} →
                </Link>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {tourStepIndex! > 0 ? (
                  <button
                    type="button"
                    onClick={() => setTourStepIndex((i) => Math.max(0, (i ?? 0) - 1))}
                    className="min-h-11 rounded-lg border border-white/15 px-3 text-xs font-medium text-slate-200 hover:bg-white/5"
                  >
                    Back
                  </button>
                ) : null}
                {tourStepIndex! < tourTotal - 1 ? (
                  <button
                    type="button"
                    onClick={() => setTourStepIndex((i) => (i ?? 0) + 1)}
                    className="min-h-11 flex-1 rounded-lg border border-cyan-400/40 bg-cyan-500/20 px-3 text-xs font-semibold text-cyan-50 hover:bg-cyan-500/30"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={completeTour}
                    className="min-h-11 flex-1 rounded-lg border border-cyan-400/40 bg-cyan-500/20 px-3 text-xs font-semibold text-cyan-50 hover:bg-cyan-500/30"
                  >
                    Mark complete
                  </button>
                )}
                <button
                  type="button"
                  onClick={skipTour}
                  className="min-h-11 rounded-lg px-3 text-xs text-slate-400 hover:text-slate-200"
                >
                  Skip tour
                </button>
              </div>
            </section>
          ) : null}

          {!tourActive && payload.assistEnabled && payload.nextAction ? (
            <section className="rounded-lg border border-cyan-500/25 bg-cyan-950/30 p-3">
              <div className="mb-2 flex items-center gap-2 text-cyan-200">
                <Compass className="h-4 w-4 shrink-0" aria-hidden />
                <h3 className="text-xs font-semibold uppercase tracking-wide">
                  What should I do next?
                </h3>
              </div>
              <p className="text-sm font-medium text-slate-100">{payload.nextAction.title}</p>
              <p className="mt-1 text-xs text-slate-400">{payload.nextAction.description}</p>
              <Link
                href={payload.nextAction.href}
                onClick={() =>
                  onNextActionClick(payload.nextAction!.code, payload.nextAction!.area)
                }
                className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-cyan-300 hover:text-cyan-200"
              >
                Continue →
              </Link>
            </section>
          ) : null}

          {!tourActive && payload.assistEnabled && payload.tips.length > 0 ? (
            <ul className="space-y-2">
              {payload.tips.map((tip) => (
                <li
                  key={tip.code}
                  className="rounded-lg border border-white/10 bg-white/[0.03] p-3"
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        {tip.areaLabel}
                      </p>
                      <h4 className="text-sm font-medium text-slate-100">{tip.title}</h4>
                    </div>
                    {tip.dismissible ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => dismissTip(tip.code)}
                        className="rounded p-0.5 text-slate-500 hover:bg-white/5 hover:text-slate-300"
                        aria-label={`Dismiss ${tip.title}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                  <p className="text-xs leading-relaxed text-slate-400">{tip.body}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {tip.actionHref && tip.actionLabel ? (
                      <Link
                        href={tip.actionHref}
                        className="text-xs font-medium text-cyan-300 hover:text-cyan-200"
                      >
                        {tip.actionLabel}
                      </Link>
                    ) : null}
                    {tip.snoozeHours ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => snoozeTip(tip.code, tip.snoozeHours)}
                        className="text-xs text-slate-500 hover:text-slate-300"
                      >
                        Snooze {tip.snoozeHours}h
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          {!tourActive &&
          payload.assistEnabled &&
          payload.tips.length === 0 &&
          !payload.nextAction &&
          !payload.emptyStateTour ? (
            <p className="text-sm text-slate-400">
              No tips for this screen right now. Try Today, Front desk, Pipeline, or Settings — or
              finish the next setup step above when shown.
            </p>
          ) : null}

          {message ? <p className="text-xs text-amber-300">{message}</p> : null}

          {payload.isOnboardingPhase ? (
            <p className="text-[10px] text-slate-500">
              The clinic guide defaults to on while setup is incomplete. You can turn it off anytime.
            </p>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
