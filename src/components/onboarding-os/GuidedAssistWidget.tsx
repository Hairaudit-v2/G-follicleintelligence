"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  ChevronDown,
  ChevronUp,
  Compass,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  dismissGuidedAssistTipAction,
  incrementGuidedAssistViewsAction,
  markGuidedAssistWhatsNewSeenAction,
  recordGuidedAssistClientEventAction,
  recordGuidedAssistTipFeedbackAction,
  setGuidedAssistForceShowAction,
  snoozeGuidedAssistTipAction,
  touchGuidedAssistEngagementAction,
} from "@/lib/actions/fi-onboarding-os-guided-assist-actions";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { isFiOsTenantCalendarPath } from "@/src/lib/fiAdmin/fiOsTenantCalendarRoute";
import {
  readGuidedAssistCollapsedPreference,
  resolveGuidedAssistInitialCollapsed,
  writeGuidedAssistCollapsedPreference,
} from "@/src/lib/onboarding-os/guidedAssistCollapse";
import { isGuidedAssistDebugQueryActive } from "@/src/lib/onboarding-os/guidedAssistForceShow";
import { guidedAssistDevLog } from "@/src/lib/onboarding-os/guidedAssistLog";
import {
  GUIDED_ASSIST_WHATS_NEW_ITEMS,
  GUIDED_ASSIST_WHATS_NEW_VERSION,
} from "@/src/lib/onboarding-os/guidedAssistWhatsNew";
import type {
  GuidedAssistDebugInfo,
  GuidedAssistEngagementSnapshot,
  GuidedAssistQuickActionView,
  GuidedAssistSessionPayload,
  GuidedAssistTipView,
} from "@/src/lib/onboarding-os/guidedAssistTypes";

import { GuidedAssistToggle } from "./GuidedAssistToggle";

function emptyEngagement(): GuidedAssistEngagementSnapshot {
  return {
    streakDays: 0,
    streakMessage: null,
    progress: {
      completedCount: 0,
      goalCount: 5,
      percent: 0,
      label: "0 of 5 tips explored this week",
      percentLabel: "Weekly progress: 0%",
      isComplete: false,
    },
    teamHighlight: null,
    feedbackByTipCode: {},
  };
}

function ProgressBar({ percent, label }: { percent: number; label?: string }) {
  const p = Math.max(0, Math.min(100, Math.floor(percent)));
  return (
    <div
      className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
      role="progressbar"
      aria-valuenow={p}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? `Weekly guide progress ${p} percent`}
      data-testid="guided-assist-progress-bar"
    >
      <div
        className="h-full rounded-full bg-cyan-400/70 transition-[width] duration-500 ease-out"
        style={{ width: `${p}%` }}
      />
    </div>
  );
}

function QuickActionsSkeleton() {
  return (
    <div
      className="space-y-2 rounded-lg border border-cyan-500/20 bg-cyan-950/20 p-2.5"
      aria-busy="true"
      aria-label="Loading quick actions"
      data-testid="guided-assist-qa-skeleton"
    >
      <div className="h-3 w-28 animate-pulse rounded bg-cyan-400/20" />
      <div className="h-11 animate-pulse rounded-xl bg-cyan-400/10" />
      <div className="h-11 animate-pulse rounded-xl bg-cyan-400/10" />
    </div>
  );
}

/** Collapsible one-tap clinical co-pilot actions (operational only). */
function ClinicalQuickActionsSection({
  actions,
  onActionClick,
  loading,
}: {
  actions: GuidedAssistQuickActionView[];
  onActionClick: (action: GuidedAssistQuickActionView) => void;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const listId = "guided-assist-qa-list";

  if (loading) return <QuickActionsSkeleton />;
  if (actions.length === 0) return null;

  return (
    <section
      className="rounded-lg border border-cyan-500/25 bg-cyan-950/25 p-2.5 sm:p-3"
      data-testid="guided-assist-clinical-quick-actions"
      aria-label="Quick actions for today"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
        aria-expanded={open}
        aria-controls={listId}
      >
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-300/90">
            Quick actions for today
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500">
            Operational shortcuts — not clinical advice
          </p>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        )}
      </button>
      {open ? (
        <ul id={listId} className="mt-2.5 space-y-2" role="list">
          {actions.map((action) => {
            const showChecklist =
              expandedCode === action.code && (action.checklist?.length ?? 0) > 0;
            return (
              <li key={action.code}>
                <Link
                  href={action.href}
                  onClick={() => onActionClick(action)}
                  className="flex min-h-11 w-full flex-col justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/15 px-3 py-2.5 text-left transition hover:bg-cyan-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 active:scale-[0.99]"
                  data-testid={`guided-assist-qa-${action.code}`}
                  aria-label={`${action.label}. ${action.description}`}
                >
                  <span className="text-sm font-semibold text-cyan-50">{action.label}</span>
                  <span className="text-[11px] leading-snug text-cyan-100/70">
                    {action.description}
                  </span>
                </Link>
                {action.checklist?.length ? (
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedCode((c) => (c === action.code ? null : action.code))
                    }
                    className="mt-1 min-h-9 rounded-md px-1 text-[10px] font-medium text-slate-500 hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
                    aria-expanded={showChecklist}
                  >
                    {showChecklist ? "Hide checklist" : "Show checklist"}
                  </button>
                ) : null}
                {showChecklist ? (
                  <ul className="mt-1 list-inside list-disc space-y-0.5 text-[10px] text-slate-400">
                    {action.checklist!.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

function WhatsNewCard({
  onDismiss,
  pending,
}: {
  onDismiss: () => void;
  pending?: boolean;
}) {
  return (
    <section
      className="rounded-lg border border-amber-400/30 bg-amber-950/30 p-3"
      data-testid="guided-assist-whats-new"
      aria-label="What’s new in Clinic guide"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/90">
        What’s new
      </p>
      <p className="mt-1 text-xs leading-relaxed text-slate-300">
        A few gentle upgrades to keep the guide helpful on busy clinic days:
      </p>
      <ul className="mt-2 space-y-1.5">
        {GUIDED_ASSIST_WHATS_NEW_ITEMS.map((item) => (
          <li key={item.title} className="text-xs leading-snug text-slate-400">
            <span className="font-medium text-slate-200">{item.title}.</span> {item.body}
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={pending}
        onClick={onDismiss}
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-amber-400/35 bg-amber-500/15 px-3 text-sm font-semibold text-amber-50 transition hover:bg-amber-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 disabled:opacity-50"
        data-testid="guided-assist-whats-new-dismiss"
      >
        Got it — thanks
      </button>
    </section>
  );
}

function withSessionDefaults(payload: GuidedAssistSessionPayload): GuidedAssistSessionPayload {
  const tid = payload.settingsHref?.match(/\/fi-admin\/([^/]+)/)?.[1];
  const forceShowActive = Boolean(payload.forceShowActive);
  const guideVisible = payload.guideVisible ?? (payload.assistEnabled || forceShowActive);
  return {
    ...payload,
    nextBestActions: payload.nextBestActions ?? [],
    clinicalQuickActions: payload.clinicalQuickActions ?? [],
    experienceLevel: payload.experienceLevel ?? "intermediate",
    showReenableChrome:
      payload.showReenableChrome ?? (!payload.assistEnabled && !forceShowActive),
    settingsHref:
      payload.settingsHref ??
      (tid ? `/fi-admin/${tid}/settings/clinic-guide` : "/fi-admin"),
    userAssistOverride: payload.userAssistOverride ?? null,
    canManageTenantDefaults: payload.canManageTenantDefaults ?? false,
    engagement: payload.engagement ?? emptyEngagement(),
    roleModeLabel: payload.roleModeLabel ?? null,
    todayRole: payload.todayRole ?? null,
    forceShowActive,
    guideVisible,
    debugInfo: payload.debugInfo ?? null,
    showWhatsNew: Boolean(payload.showWhatsNew),
    whatsNewVersion: payload.whatsNewVersion ?? GUIDED_ASSIST_WHATS_NEW_VERSION,
  };
}

function GuideDebugPanel({
  debugInfo,
  forceShowActive,
}: {
  debugInfo: GuidedAssistDebugInfo;
  forceShowActive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rows: { label: string; value: string }[] = [
    { label: "enabled", value: String(debugInfo.enabled) },
    { label: "forceShow", value: String(forceShowActive || debugInfo.forceShowActive) },
    { label: "guideVisible", value: String(debugInfo.guideVisible) },
    { label: "userOverride", value: String(debugInfo.userAssistOverride) },
    { label: "today_home_views", value: String(debugInfo.todayHomeViews) },
    { label: "role", value: debugInfo.role },
    { label: "roleGroup", value: debugInfo.roleGroup },
    { label: "roleMode", value: debugInfo.roleMode ?? "—" },
    { label: "experienceLevel", value: debugInfo.experienceLevel },
    { label: "clinicSetupComplete", value: String(debugInfo.clinicSetupComplete) },
    { label: "isOnboardingPhase", value: String(debugInfo.isOnboardingPhase) },
    { label: "pageKey", value: debugInfo.pageKey || "(today)" },
    { label: "workspaceProfile", value: debugInfo.workspaceProfileKey || "—" },
    { label: "tenantAdminRole", value: debugInfo.tenantAdminRole ?? "—" },
    { label: "roleFirstActive", value: String(debugInfo.roleFirstActive) },
    { label: "tipCount", value: String(debugInfo.tipCount) },
    { label: "nbaCount", value: String(debugInfo.nextBestActionCount) },
  ];
  return (
    <section
      className="rounded-lg border border-white/10 bg-black/30 p-2"
      data-testid="guided-assist-debug-panel"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-300"
        aria-expanded={open}
      >
        Debug info
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {open ? (
        <dl className="mt-2 max-h-40 space-y-1 overflow-y-auto font-mono text-[10px] text-slate-400">
          {rows.map((row) => (
            <div key={row.label} className="flex justify-between gap-2">
              <dt className="shrink-0 text-slate-500">{row.label}</dt>
              <dd className="truncate text-right text-slate-300">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}

function TipFeedbackButtons({
  tipCode,
  value,
  disabled,
  onFeedback,
}: {
  tipCode: string;
  value: boolean | null | undefined;
  disabled?: boolean;
  onFeedback: (tipCode: string, helpful: boolean, comment?: string | null) => void;
}) {
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState("");
  const [thanks, setThanks] = useState(false);

  const vote = (helpful: boolean) => {
    if (helpful) {
      setShowComment(false);
      setThanks(true);
      onFeedback(tipCode, true, null);
      return;
    }
    setShowComment(true);
    onFeedback(tipCode, false, null);
  };

  const sendComment = () => {
    onFeedback(tipCode, false, comment.trim() || null);
    setShowComment(false);
    setThanks(true);
  };

  return (
    <div className="mt-2" data-testid="guided-assist-feedback" data-tip-code={tipCode}>
      <div className="flex items-center gap-1">
        <span className="mr-1 text-[10px] text-slate-500">Was this helpful?</span>
        <button
          type="button"
          disabled={disabled || value === true}
          onClick={() => vote(true)}
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-md border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50",
            value === true
              ? "border-cyan-400/50 bg-cyan-500/20 text-cyan-100"
              : "border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200"
          )}
          aria-label="Mark tip helpful"
          aria-pressed={value === true}
          data-testid="guided-assist-feedback-up"
        >
          <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          type="button"
          disabled={disabled || value === false}
          onClick={() => vote(false)}
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-md border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50",
            value === false
              ? "border-slate-400/40 bg-slate-700/40 text-slate-200"
              : "border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200"
          )}
          aria-label="Mark tip not helpful"
          aria-pressed={value === false}
          data-testid="guided-assist-feedback-down"
        >
          <ThumbsDown className="h-3.5 w-3.5" aria-hidden />
        </button>
        {thanks || value != null ? (
          <span className="ml-1 text-[10px] text-cyan-300/80">Thanks — that helps the team</span>
        ) : null}
      </div>
      {showComment ? (
        <div className="mt-2 space-y-1.5">
          <label className="block text-[10px] text-slate-500" htmlFor={`fb-${tipCode}`}>
            Optional note (what would help more?)
          </label>
          <textarea
            id={`fb-${tipCode}`}
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 500))}
            rows={2}
            className="w-full resize-none rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-cyan-400/40 focus:outline-none"
            placeholder="A short note is enough…"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={sendComment}
              className="rounded-md border border-cyan-400/30 bg-cyan-500/15 px-2 py-1 text-[10px] font-medium text-cyan-100 hover:bg-cyan-500/25"
            >
              Send note
            </button>
            <button
              type="button"
              onClick={() => setShowComment(false)}
              className="rounded-md px-2 py-1 text-[10px] text-slate-500 hover:text-slate-300"
            >
              Skip
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SuggestionSourceBadge({ tip }: { tip: GuidedAssistTipView }) {
  if (tip.suggestionSource === "ai_nba") {
    return (
      <span
        className="inline-flex items-center gap-0.5 rounded-full border border-violet-400/35 bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-200"
        data-testid="guided-assist-ai-badge"
        title="AI-assisted operational suggestion only — not medical advice"
      >
        <Sparkles className="h-2.5 w-2.5" aria-hidden />
        AI suggestion
      </span>
    );
  }
  if (tip.isNextBestAction || tip.suggestionSource === "rule_nba") {
    return (
      <span
        className="inline-flex items-center gap-0.5 rounded-full border border-amber-400/35 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-100"
        data-testid="guided-assist-nba-badge"
        title="Rule-based next best action — operational only"
      >
        <Zap className="h-2.5 w-2.5" aria-hidden />
        Next best action
      </span>
    );
  }
  return null;
}

/** Prefer collapsed clinic guide on narrow phones so it does not compete with bottom nav. */
function usePrefersCollapsedAssistDefault(): boolean {
  // Initialize from matchMedia on the client so the first hydrate does not briefly treat phones as desktop.
  const [prefersCollapsed, setPrefersCollapsed] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(max-width: 639px)").matches;
  });

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [payload, setPayload] = useState(() => withSessionDefaults(initialPayload));
  const pathname = usePathname() ?? "";
  const onCalendarSurface = isFiOsTenantCalendarPath(pathname);
  const debugQueryActive = isGuidedAssistDebugQueryActive(searchParams?.toString() ?? "");
  const showDebugPanel =
    Boolean(payload.debugInfo) &&
    (payload.canManageTenantDefaults || debugQueryActive || payload.forceShowActive);
  const prefersCollapsedDefault = usePrefersCollapsedAssistDefault();
  const [collapsed, setCollapsed] = useState(true);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  /** Index into emptyStateTour.steps; null = tour not active. */
  const [tourStepIndex, setTourStepIndex] = useState<number | null>(null);
  const shownTipCodesRef = useRef<Set<string>>(new Set());
  const hydratedCollapseRef = useRef(false);
  const tourActive = tourStepIndex != null && payload.emptyStateTour != null;
  const settingsHref =
    payload.settingsHref || `/fi-admin/${tenantId.trim()}/settings/clinic-guide`;

  useEffect(() => {
    setPayload(withSessionDefaults(initialPayload));
    setTourStepIndex(null);
  }, [initialPayload]);

  const guideVisible =
    payload.guideVisible ?? (payload.assistEnabled || Boolean(payload.forceShowActive));

  // Initial collapse: calendar / guide-off / stored pref / narrow viewport; never auto-pop when off.
  useEffect(() => {
    if (hydratedCollapseRef.current && !onCalendarSurface) return;
    hydratedCollapseRef.current = true;
    const stored =
      typeof window !== "undefined"
        ? readGuidedAssistCollapsedPreference(window.localStorage, tenantId)
        : null;
    setCollapsed(
      resolveGuidedAssistInitialCollapsed({
        storedCollapsed: stored,
        guideVisible,
        onCalendarSurface,
        prefersNarrowViewport: prefersCollapsedDefault,
      })
    );
  }, [onCalendarSurface, prefersCollapsedDefault, pathname, tenantId, guideVisible]);

  // Turning the guide off should put the dock away immediately (do not leave the re-enable panel open).
  useEffect(() => {
    if (!guideVisible) setCollapsed(true);
  }, [guideVisible]);

  useEffect(() => {
    if (onCalendarSurface) setCollapsed(true);
  }, [onCalendarSurface, pathname]);

  useEffect(() => {
    if (!guideVisible) return;
    const shownTips = [
      ...payload.tips,
      ...(payload.nextBestActions ?? []),
    ];
    if (shownTips.length === 0) return;
    for (const tip of shownTips) {
      if (shownTipCodesRef.current.has(tip.code)) continue;
      shownTipCodesRef.current.add(tip.code);
      void recordGuidedAssistClientEventAction(tenantId, {
        eventKind: "tip_shown",
        guidanceArea: tip.area,
        guidanceCode: tip.code,
        pageKey: payload.pageKey,
        detail: {
          suggestionSource: tip.suggestionSource ?? "catalog",
          isNextBestAction: Boolean(tip.isNextBestAction),
          experienceLevel: payload.experienceLevel,
          todayRole: payload.todayRole ?? null,
          operationalOnly: true,
          forceShow: Boolean(payload.forceShowActive),
        },
      });
    }
  }, [
    guideVisible,
    payload.pageKey,
    payload.tips,
    payload.nextBestActions,
    payload.experienceLevel,
    payload.forceShowActive,
    payload.todayRole,
    tenantId,
  ]);

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

  /** Once per session while guide is on — consecutive-day engagement streak. */
  const engagementTouchedRef = useRef(false);
  useEffect(() => {
    if (!payload.assistEnabled || engagementTouchedRef.current) return;
    engagementTouchedRef.current = true;
    void touchGuidedAssistEngagementAction(tenantId).then((res) => {
      if (!res.ok) return;
      setPayload((prev) => ({
        ...prev,
        engagement: {
          ...(prev.engagement ?? emptyEngagement()),
          streakDays: res.streakDays ?? prev.engagement?.streakDays ?? 0,
          streakMessage:
            res.streakMessage !== undefined
              ? res.streakMessage
              : prev.engagement?.streakMessage ?? null,
        },
      }));
    });
  }, [payload.assistEnabled, tenantId]);

  /** Admin + `?debug=guide`: enable session force-show so tips load for troubleshooting. */
  const debugForceAppliedRef = useRef(false);
  useEffect(() => {
    if (!debugQueryActive || !payload.canManageTenantDefaults) return;
    if (payload.forceShowActive || debugForceAppliedRef.current) return;
    debugForceAppliedRef.current = true;
    void setGuidedAssistForceShowAction(tenantId, true).then((res) => {
      if (res.ok) router.refresh();
    });
  }, [
    debugQueryActive,
    payload.canManageTenantDefaults,
    payload.forceShowActive,
    tenantId,
    router,
  ]);

  const submitFeedback = (tipCode: string, helpful: boolean, comment?: string | null) => {
    startTransition(async () => {
      const res = await recordGuidedAssistTipFeedbackAction(
        tenantId,
        tipCode,
        helpful,
        payload.pageKey,
        comment
      );
      if (!res.ok) {
        setMessage(res.error);
        return;
      }
      setPayload((prev) => {
        const eng = prev.engagement ?? emptyEngagement();
        return {
          ...prev,
          engagement: {
            ...eng,
            feedbackByTipCode: {
              ...eng.feedbackByTipCode,
              [tipCode]: helpful,
            },
          },
        };
      });
    });
  };

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
        nextBestActions: (prev.nextBestActions ?? []).filter((t) => t.code !== tipCode),
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
        nextBestActions: (prev.nextBestActions ?? []).filter((t) => t.code !== tipCode),
      }));
    });
  };

  const feedbackFor = (code: string): boolean | null => {
    const map = payload.engagement?.feedbackByTipCode ?? {};
    return code in map ? map[code] ?? null : null;
  };

  const renderTipCard = (tip: GuidedAssistTipView, opts?: { emphasize?: boolean }) => (
    <li
      key={tip.code}
      className={cn(
        "rounded-lg border p-3",
        opts?.emphasize
          ? "border-amber-400/30 bg-amber-950/25"
          : "border-white/10 bg-white/[0.03]"
      )}
      data-suggestion-source={tip.suggestionSource ?? "catalog"}
      data-next-best-action={tip.isNextBestAction ? "true" : "false"}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {tip.areaLabel}
            </p>
            <SuggestionSourceBadge tip={tip} />
          </div>
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
            onClick={() => {
              if (tip.isNextBestAction) {
                onNextActionClick(tip.code, tip.area);
              }
            }}
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
      <TipFeedbackButtons
        tipCode={tip.code}
        value={feedbackFor(tip.code)}
        disabled={pending}
        onFeedback={submitFeedback}
      />
    </li>
  );

  const engagement = payload.engagement ?? emptyEngagement();

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
    if (typeof window !== "undefined") {
      writeGuidedAssistCollapsedPreference(window.localStorage, tenantId, next);
    }
    void recordGuidedAssistClientEventAction(tenantId, {
      eventKind: next ? "widget_collapsed" : "widget_expanded",
      pageKey: payload.pageKey,
    });
  };

  const startTour = () => {
    if (!payload.emptyStateTour?.steps.length) return;
    setCollapsed(false);
    setTourStepIndex(0);
    guidedAssistDevLog("tour", "start", {
      emptyStateKey: payload.emptyStateTour.emptyStateKey,
      steps: payload.emptyStateTour.steps.length,
    });
    void recordGuidedAssistClientEventAction(tenantId, {
      eventKind: "next_action_clicked",
      guidanceCode: payload.emptyStateTour.rootTipCode,
      guidanceArea: "reception_os",
      pageKey: payload.pageKey,
      detail: { kind: "tour_start", emptyStateKey: payload.emptyStateTour.emptyStateKey },
    });
  };

  const advanceTour = (direction: "next" | "back") => {
    const steps = payload.emptyStateTour?.steps ?? [];
    if (!steps.length || tourStepIndex == null) return;
    const from = tourStepIndex;
    const to =
      direction === "next"
        ? Math.min(steps.length - 1, from + 1)
        : Math.max(0, from - 1);
    if (to === from) return;
    setTourStepIndex(to);
    if (direction === "next") {
      const completed = steps[from];
      guidedAssistDevLog("tour", "step_completed", { code: completed?.code, step: from + 1 });
      void recordGuidedAssistClientEventAction(tenantId, {
        eventKind: "tour_step_completed",
        guidanceCode: completed?.code ?? `tour_step_${from + 1}`,
        pageKey: payload.pageKey,
        detail: {
          stepIndex: from,
          stepNumber: from + 1,
          nextStepIndex: to,
          totalSteps: steps.length,
        },
      });
    }
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
    const steps = payload.emptyStateTour?.steps ?? [];
    const last = tourStepIndex != null ? steps[tourStepIndex] : null;
    if (last) {
      void recordGuidedAssistClientEventAction(tenantId, {
        eventKind: "tour_step_completed",
        guidanceCode: last.code,
        pageKey: payload.pageKey,
        detail: {
          stepIndex: tourStepIndex,
          stepNumber: (tourStepIndex ?? 0) + 1,
          totalSteps: steps.length,
          final: true,
        },
      });
    }
    setTourStepIndex(null);
    if (root) {
      void dismissTip(root);
    }
    void recordGuidedAssistClientEventAction(tenantId, {
      eventKind: "tour_completed",
      guidanceCode: root ?? "tour_complete",
      pageKey: payload.pageKey,
      detail: { kind: "tour_complete" },
    });
    void touchGuidedAssistEngagementAction(tenantId);
  };

  const dismissWhatsNew = () => {
    startTransition(async () => {
      const res = await markGuidedAssistWhatsNewSeenAction(tenantId);
      if (!res.ok) {
        setMessage(res.error);
        return;
      }
      setPayload((prev) => ({ ...prev, showWhatsNew: false }));
      guidedAssistDevLog("whats-new", "dismissed", { version: res.version });
    });
  };

  const tourStep =
    tourActive && payload.emptyStateTour
      ? payload.emptyStateTour.steps[tourStepIndex!] ?? null
      : null;
  const tourTotal = payload.emptyStateTour?.steps.length ?? 0;

  // When off (and not force-shown), hide completely — re-enable via Settings → Clinic guide.
  if (!guideVisible) {
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
      data-guided-assist-enabled="true"
      data-guided-assist-force={payload.forceShowActive ? "true" : "false"}
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
            <p className={cn(fiOsChromeClasses.sectionEyebrow, "text-cyan-300/90")}>
              Clinic guide
              {payload.forceShowActive ? (
                <span className="ml-1.5 rounded bg-amber-500/20 px-1 py-0.5 text-[9px] font-semibold text-amber-100">
                  Force show
                </span>
              ) : null}
            </p>
          ) : null}
          <h2
            className={cn("truncate font-medium text-slate-100", collapsed ? "text-xs" : "text-sm")}
          >
            {collapsed
              ? "Help"
              : tourActive
                ? "Tour — one step at a time"
                : "Here to help next"}
          </h2>
          {!collapsed && payload.roleModeLabel ? (
            <p
              className="mt-0.5 text-[10px] font-medium leading-snug text-cyan-300/85"
              data-testid="guided-assist-role-mode"
            >
              {payload.roleModeLabel}
            </p>
          ) : null}
          {collapsed && engagement.progress ? (
            <p
              className="truncate text-[10px] text-slate-500"
              data-testid="guided-assist-progress-collapsed"
              aria-label={`${engagement.progress.label}${
                engagement.streakDays >= 2
                  ? `. ${engagement.streakDays} day guide streak`
                  : ""
              }`}
            >
              {engagement.progress.label}
              {engagement.streakDays >= 2 ? ` · ${engagement.streakDays}d` : ""}
            </p>
          ) : null}
          {!collapsed && engagement.streakMessage ? (
            <p
              className="mt-0.5 text-[10px] font-medium text-cyan-300/80"
              data-testid="guided-assist-streak"
              role="status"
              aria-live="polite"
            >
              {engagement.streakMessage}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <GuidedAssistToggle
            tenantId={tenantId}
            assistEnabled={Boolean(payload.assistEnabled)}
            compact
            onChanged={(enabled) => {
              const nextVisible = enabled || Boolean(payload.forceShowActive);
              setPayload((prev) => ({
                ...prev,
                assistEnabled: enabled,
                guideVisible: nextVisible,
                showReenableChrome: !enabled && !prev.forceShowActive,
                userAssistOverride: enabled,
              }));
              // Hide dock immediately when turned off (settings is the re-enable path).
              if (!nextVisible && typeof window !== "undefined") {
                writeGuidedAssistCollapsedPreference(window.localStorage, tenantId, true);
              }
            }}
          />
          <button
            type="button"
            onClick={toggleCollapsed}
            className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
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

          <p className="text-[11px] leading-relaxed text-slate-400" data-testid="guided-assist-warm-intro">
            {payload.isOnboardingPhase
              ? "No worries if this is new — we’ll point you to the next operational step only."
              : "Think of this as a helpful colleague beside you while you learn the system."}
          </p>

          <div
            className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 sm:p-3"
            data-testid="guided-assist-engagement-summary"
          >
            <p
              className="text-[10px] text-slate-400"
              data-testid="guided-assist-progress"
              role="status"
            >
              {engagement.progress.label}
            </p>
            <p className="mt-0.5 text-[10px] font-medium text-cyan-300/80">
              {engagement.progress.percentLabel}
            </p>
            <ProgressBar
              percent={engagement.progress.percent}
              label={engagement.progress.percentLabel}
            />
            {engagement.teamHighlight ? (
              <p
                className="mt-1.5 text-[10px] text-slate-500"
                data-testid="guided-assist-team-highlight"
                title="Anonymized clinic-wide usage this week"
              >
                {engagement.teamHighlight.label}
              </p>
            ) : null}
          </div>

          {payload.showWhatsNew ? (
            <WhatsNewCard onDismiss={dismissWhatsNew} pending={pending} />
          ) : null}

          {(payload.clinicalQuickActions?.length ?? 0) > 0 ? (
            <ClinicalQuickActionsSection
              actions={payload.clinicalQuickActions}
              onActionClick={(action) => {
                guidedAssistDevLog("quick-action", "clicked", { code: action.code });
                void recordGuidedAssistClientEventAction(tenantId, {
                  eventKind: "quick_action_clicked",
                  guidanceCode: action.code,
                  guidanceArea: action.area,
                  pageKey: payload.pageKey,
                  detail: {
                    kind: "clinical_quick_action",
                    operationalOnly: true,
                    label: action.label,
                  },
                });
              }}
            />
          ) : null}

          {payload.roleFirstActive && !tourActive ? (
            <p className="text-[10px] font-medium uppercase tracking-wide text-cyan-400/90">
              Getting started · visit{" "}
              {Math.min(payload.todayHomeViews + 1, payload.roleFirstViewLimit)} of{" "}
              {payload.roleFirstViewLimit}
            </p>
          ) : null}

          {/* Empty-state tour offer */}
          {payload.emptyStateTour && !tourActive ? (
            <section
              className="rounded-lg border border-cyan-500/30 bg-cyan-950/40 p-3"
              data-testid="guided-assist-tour-offer"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-300/90">
                Let’s explore this screen
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
                Show me around
              </button>
            </section>
          ) : null}

          {/* Active tour steps (collapses other tips) */}
          {tourActive && tourStep ? (
            <section
              className="rounded-lg border border-cyan-500/25 bg-cyan-950/30 p-3 transition-opacity duration-300 ease-out"
              data-testid="guided-assist-tour-step"
              aria-live="polite"
              aria-atomic="true"
              aria-label={`Tour step ${tourStepIndex! + 1} of ${tourTotal}: ${tourStep.title}`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-300/90">
                Step {tourStepIndex! + 1} of {tourTotal} — you’re doing great
              </p>
              <div key={tourStep.code} className="mt-1 transition-opacity duration-300 ease-out">
                <h3 className="text-sm font-medium text-slate-100">{tourStep.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{tourStep.body}</p>
              </div>
              {tourStep.actionHref && tourStep.actionLabel ? (
                <Link
                  href={tourStep.actionHref}
                  className="mt-2 inline-flex min-h-10 items-center text-xs font-medium text-cyan-300 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
                >
                  {tourStep.actionLabel} →
                </Link>
              ) : null}
              <TipFeedbackButtons
                tipCode={tourStep.code}
                value={feedbackFor(tourStep.code)}
                disabled={pending}
                onFeedback={submitFeedback}
              />
              <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Tour controls">
                {tourStepIndex! > 0 ? (
                  <button
                    type="button"
                    onClick={() => advanceTour("back")}
                    className="min-h-11 min-w-[4.5rem] rounded-xl border border-white/15 px-3 text-xs font-medium text-slate-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
                  >
                    Back
                  </button>
                ) : null}
                {tourStepIndex! < tourTotal - 1 ? (
                  <button
                    type="button"
                    onClick={() => advanceTour("next")}
                    className="min-h-11 min-w-[5.5rem] flex-1 rounded-xl border border-cyan-400/40 bg-cyan-500/20 px-3 text-xs font-semibold text-cyan-50 hover:bg-cyan-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={completeTour}
                    className="min-h-11 min-w-[5.5rem] flex-1 rounded-xl border border-cyan-400/40 bg-cyan-500/20 px-3 text-xs font-semibold text-cyan-50 hover:bg-cyan-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
                  >
                    Mark complete
                  </button>
                )}
                <button
                  type="button"
                  onClick={skipTour}
                  className="min-h-11 rounded-xl px-3 text-xs text-slate-400 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
                >
                  Skip tour
                </button>
              </div>
            </section>
          ) : null}

          {!tourActive && payload.nextAction ? (
            <section className="rounded-lg border border-cyan-500/25 bg-cyan-950/30 p-3">
              <div className="mb-2 flex items-center gap-2 text-cyan-200">
                <Compass className="h-4 w-4 shrink-0" aria-hidden />
                <h3 className="text-xs font-semibold uppercase tracking-wide">
                  Suggested next step
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

          {!tourActive && (payload.nextBestActions?.length ?? 0) > 0 ? (
            <section data-testid="guided-assist-next-best-actions">
              <div className="mb-1.5 flex items-center gap-1.5 text-amber-100/90">
                <Zap className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <p className="text-[10px] font-semibold uppercase tracking-wide">
                  Next best action
                </p>
              </div>
              <p className="mb-2 text-[10px] leading-relaxed text-slate-500">
                Operational suggestion only — not clinical advice.
              </p>
              <ul className="space-y-2">
                {(payload.nextBestActions ?? []).map((tip) =>
                  renderTipCard(tip, { emphasize: true })
                )}
              </ul>
            </section>
          ) : null}

          {!tourActive && payload.tips.length > 0 ? (
            <ul className="space-y-2" data-testid="guided-assist-tips">
              {payload.tips.map((tip) => renderTipCard(tip))}
            </ul>
          ) : null}

          {!tourActive &&
          payload.tips.length === 0 &&
          (payload.nextBestActions?.length ?? 0) === 0 &&
          !payload.nextAction &&
          !payload.emptyStateTour ? (
            <p className="text-sm text-slate-400">
              No tips for this screen right now. Try Today, Front desk, Pipeline, or Settings — or
              finish the next setup step above when shown.
            </p>
          ) : null}

          {showDebugPanel && payload.debugInfo ? (
            <GuideDebugPanel
              debugInfo={payload.debugInfo}
              forceShowActive={Boolean(payload.forceShowActive)}
            />
          ) : null}

          {message ? <p className="text-xs text-amber-300">{message}</p> : null}

          <p className="text-[10px] text-slate-500">
            <Link href={settingsHref} className="text-cyan-400/80 hover:text-cyan-300">
              Clinic guide settings
            </Link>
            {payload.forceShowActive
              ? " · force show is on (admin session)"
              : " · turn off to hide completely; re-enable anytime in settings"}
          </p>

          {payload.isOnboardingPhase && payload.assistEnabled ? (
            <p className="text-[10px] text-slate-500">
              The clinic guide defaults to on while setup is incomplete. You can turn it off anytime
              — it stays hidden until you turn it back on in settings.
            </p>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
