"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Compass, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  dismissGuidedAssistTipAction,
  recordGuidedAssistClientEventAction,
  snoozeGuidedAssistTipAction,
} from "@/lib/actions/fi-onboarding-os-guided-assist-actions";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import type { GuidedAssistSessionPayload } from "@/src/lib/onboarding-os/guidedAssistTypes";

import { GuidedAssistToggle } from "./GuidedAssistToggle";

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
  const [collapsed, setCollapsed] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const shownTipCodesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setPayload(initialPayload);
  }, [initialPayload]);

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

  if (!payload.assistEnabled && !payload.isOnboardingPhase) {
    return null;
  }

  return (
    <aside
      className={cn(
        "pointer-events-auto fixed bottom-4 right-4 z-40 w-[min(100vw-2rem,24rem)]",
        "rounded-xl border border-cyan-500/20 bg-[#071018]/95 shadow-2xl backdrop-blur-md",
        className
      )}
      aria-label="Guided Assist"
    >
      <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className={cn(fiOsChromeClasses.sectionEyebrow, "text-cyan-300/90")}>
            OnboardingOS · Guided Assist
          </p>
          <h2 className="truncate text-sm font-medium text-slate-100">
            {payload.assistEnabled ? "Operational guidance" : "Guided Assist is off"}
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
            aria-label={collapsed ? "Expand guided assist" : "Collapse guided assist"}
          >
            {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {!collapsed ? (
        <div className="max-h-[min(60vh,28rem)] space-y-3 overflow-y-auto px-4 py-3">
          <p className="text-xs leading-relaxed text-slate-400">{payload.safetyNotice}</p>

          {!payload.assistEnabled ? (
            <p className="text-sm text-slate-300">
              Turn Guided Assist on for deterministic setup steps tailored to your role and current page.
            </p>
          ) : null}

          {payload.assistEnabled && payload.nextAction ? (
            <section className="rounded-lg border border-cyan-500/25 bg-cyan-950/30 p-3">
              <div className="mb-2 flex items-center gap-2 text-cyan-200">
                <Compass className="h-4 w-4 shrink-0" aria-hidden />
                <h3 className="text-xs font-semibold uppercase tracking-wide">What should I do next?</h3>
              </div>
              <p className="text-sm font-medium text-slate-100">{payload.nextAction.title}</p>
              <p className="mt-1 text-xs text-slate-400">{payload.nextAction.description}</p>
              <Link
                href={payload.nextAction.href}
                onClick={() => onNextActionClick(payload.nextAction!.code, payload.nextAction!.area)}
                className="mt-3 inline-flex text-sm font-medium text-cyan-300 hover:text-cyan-200"
              >
                Continue →
              </Link>
            </section>
          ) : null}

          {payload.assistEnabled && payload.tips.length > 0 ? (
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

          {payload.assistEnabled && payload.tips.length === 0 && !payload.nextAction ? (
            <p className="text-sm text-slate-400">
              No tips for this page right now. Navigate to another module or check back after setup tasks
              progress.
            </p>
          ) : null}

          {message ? <p className="text-xs text-amber-300">{message}</p> : null}

          {payload.isOnboardingPhase ? (
            <p className="text-[10px] text-slate-500">
              Guided Assist defaults to on during clinic onboarding. You can turn it off anytime.
            </p>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
