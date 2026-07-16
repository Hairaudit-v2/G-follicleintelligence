"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import {
  enableGuidedAssistForAllStaffAction,
  setGuidedAssistEnabledAction,
  setGuidedAssistForceShowAction,
  setGuidedAssistTenantDefaultsAction,
} from "@/lib/actions/fi-onboarding-os-guided-assist-actions";
import { cn } from "@/lib/utils";
import { GuidedAssistToggle } from "@/src/components/onboarding-os/GuidedAssistToggle";
import type {
  GuidedAssistDebugInfo,
  GuidedAssistSettingsState,
} from "@/src/lib/onboarding-os/guidedAssistTypes";

const sectionClass =
  "rounded-2xl border border-white/[0.08] bg-[#0F1629]/75 p-4 shadow-lg shadow-black/25 backdrop-blur-md sm:p-5";

function DebugInfoTable({ info }: { info: GuidedAssistDebugInfo }) {
  const rows: { k: string; v: string }[] = [
    { k: "enabled", v: String(info.enabled) },
    { k: "forceShowActive", v: String(info.forceShowActive) },
    { k: "guideVisible", v: String(info.guideVisible) },
    { k: "userAssistOverride", v: String(info.userAssistOverride) },
    { k: "today_home_views", v: String(info.todayHomeViews) },
    { k: "role", v: info.role },
    { k: "roleGroup", v: info.roleGroup },
    { k: "roleMode", v: info.roleMode ?? "—" },
    { k: "experienceLevel", v: info.experienceLevel },
    { k: "clinicSetupComplete", v: String(info.clinicSetupComplete) },
    { k: "isOnboardingPhase", v: String(info.isOnboardingPhase) },
    { k: "pageKey", v: info.pageKey || "(today)" },
    { k: "workspaceProfileKey", v: info.workspaceProfileKey || "—" },
    { k: "tenantAdminRole", v: info.tenantAdminRole ?? "—" },
    { k: "roleFirstActive", v: String(info.roleFirstActive) },
    { k: "tipCount", v: String(info.tipCount) },
    { k: "nextBestActionCount", v: String(info.nextBestActionCount) },
  ];
  return (
    <dl className="mt-2 space-y-1.5 font-mono text-[11px]" data-testid="clinic-guide-debug-rows">
      {rows.map((row) => (
        <div
          key={row.k}
          className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-white/[0.04] pb-1 last:border-0"
        >
          <dt className="text-slate-500">{row.k}</dt>
          <dd className="text-right text-slate-200">{row.v}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Settings → Clinic Guide: personal on/off, status, admin force-show, debug info.
 * Operational help only — no clinical features.
 */
export function ClinicGuideSettingsSection({
  tenantId,
  initialState,
}: {
  tenantId: string;
  initialState: GuidedAssistSettingsState;
}) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);

  const statusOn = state.assistEnabled || state.forceShowActive;

  const onPersonalChanged = (enabled: boolean) => {
    setState((prev) => ({
      ...prev,
      assistEnabled: enabled,
      userAssistOverride: enabled,
      debugInfo: {
        ...prev.debugInfo,
        enabled,
        userAssistOverride: enabled,
        guideVisible: enabled || prev.forceShowActive,
      },
    }));
    setMessage(enabled ? "Clinic guide is on for you." : "Clinic guide is off for you.");
    setError(null);
    router.refresh();
  };

  const setPersonal = (enabled: boolean) => {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await setGuidedAssistEnabledAction(tenantId, enabled);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onPersonalChanged(enabled);
    });
  };

  const setForceShow = (force: boolean) => {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await setGuidedAssistForceShowAction(tenantId, force);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setState((prev) => ({
        ...prev,
        forceShowActive: force,
        debugInfo: {
          ...prev.debugInfo,
          forceShowActive: force,
          guideVisible: prev.assistEnabled || force,
        },
      }));
      setMessage(
        force
          ? "Force show is on for this browser session (up to 8 hours). Tips load even if preference is off."
          : "Force show cleared."
      );
      router.refresh();
    });
  };

  const setPostSetupDefault = (enabled: boolean) => {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await setGuidedAssistTenantDefaultsAction(tenantId, {
        defaultAssistEnabled: enabled,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setState((prev) => ({
        ...prev,
        tenantDefaults: { ...prev.tenantDefaults, defaultAssistEnabled: enabled },
      }));
      setMessage(
        enabled
          ? "New staff (and anyone still on defaults) will get the guide after setup."
          : "Post-setup default is off — staff can still turn the guide on themselves."
      );
      router.refresh();
    });
  };

  const enableForAll = () => {
    if (!confirmAll) {
      setConfirmAll(true);
      setMessage(null);
      setError(null);
      return;
    }
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await enableGuidedAssistForAllStaffAction(tenantId);
      if (!res.ok) {
        setError(res.error);
        setConfirmAll(false);
        return;
      }
      setConfirmAll(false);
      setState((prev) => ({
        ...prev,
        assistEnabled: true,
        userAssistOverride: true,
        tenantDefaults: {
          ...prev.tenantDefaults,
          defaultAssistEnabled: true,
          defaultEnabledDuringOnboarding: true,
        },
        staffWithExplicitOff: 0,
        staffWithExplicitOn: Math.max(prev.staffWithExplicitOn, res.updatedUserRows ?? 0),
        debugInfo: {
          ...prev.debugInfo,
          enabled: true,
          userAssistOverride: true,
          guideVisible: true,
        },
      }));
      setMessage(
        `Clinic guide enabled for all staff (${res.updatedUserRows ?? 0} preference row(s) updated).`
      );
      router.refresh();
    });
  };

  return (
    <section className={sectionClass} data-testid="clinic-guide-settings">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-300/90">
            Help &amp; onboarding
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-50">Clinic guide</h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-400">
            Shows daily tips and tours to help staff work faster. Operational steps only — never
            clinical advice.
          </p>
        </div>
        <div
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-semibold",
            statusOn
              ? "bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/30"
              : "bg-slate-800/80 text-slate-400 ring-1 ring-white/10"
          )}
          data-testid="clinic-guide-status-badge"
        >
          {state.forceShowActive
            ? "Force show ON"
            : state.assistEnabled
              ? "Currently ON for you"
              : "Currently OFF for you"}
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-white/[0.08] bg-[#081020]/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-100">Show Clinic guide for me</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {state.userAssistOverride === null
                ? state.isOnboardingPhase
                  ? "Currently following the clinic default while setup is incomplete."
                  : "Currently following the clinic post-setup default."
                : "You set a personal preference (overrides clinic defaults)."}
            </p>
          </div>
          <GuidedAssistToggle
            tenantId={tenantId}
            assistEnabled={state.assistEnabled}
            onChanged={onPersonalChanged}
          />
        </div>
        {!state.assistEnabled ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => setPersonal(true)}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-cyan-400/40 bg-cyan-500/20 px-4 text-sm font-semibold text-cyan-50 hover:bg-cyan-500/30 disabled:opacity-50 sm:w-auto"
            data-testid="clinic-guide-settings-turn-on"
          >
            Turn on Clinic guide
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => setPersonal(false)}
            className="mt-4 text-xs font-medium text-slate-500 hover:text-slate-300"
          >
            Turn off for me
          </button>
        )}
      </div>

      {/* Status summary for troubleshooting (all staff) */}
      <div
        className="mt-4 rounded-xl border border-white/[0.08] bg-[#081020]/40 p-4"
        data-testid="clinic-guide-status-summary"
      >
        <p className="text-sm font-medium text-slate-100">Guide status</p>
        <ul className="mt-2 space-y-1 text-xs text-slate-400">
          <li>
            Preference:{" "}
            <span className="text-slate-200">
              {state.assistEnabled ? "ON" : "OFF"}
              {state.userAssistOverride === null ? " (clinic default)" : " (personal override)"}
            </span>
          </li>
          <li>
            Role:{" "}
            <span className="text-slate-200">
              {state.debugInfo.role} · {state.debugInfo.roleGroup}
            </span>
          </li>
          <li>
            Setup complete:{" "}
            <span className="text-slate-200">
              {state.debugInfo.clinicSetupComplete ? "yes" : "no (onboarding phase)"}
            </span>
          </li>
          <li>
            Today home views:{" "}
            <span className="text-slate-200">{state.debugInfo.todayHomeViews}</span>
          </li>
        </ul>
      </div>

      {state.canManageTenantDefaults ? (
        <div className="mt-4 space-y-4 rounded-xl border border-amber-400/20 bg-amber-950/20 p-4">
          <div>
            <p className="text-sm font-medium text-amber-50">Admin · clinic-wide</p>
            <p className="mt-0.5 text-xs text-slate-400">
              Staff with an explicit off preference stay off until they turn it on or you enable for
              all. Staff on defaults: {state.staffWithExplicitOn} explicit on ·{" "}
              {state.staffWithExplicitOff} explicit off.
            </p>
          </div>

          <div className="rounded-lg border border-white/[0.08] bg-black/20 p-3">
            <p className="text-sm font-medium text-slate-100">Force show for this user</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Temporary browser session override (up to 8 hours). Loads tips even if preference is
              off. Does not change stored preferences. Also: append{" "}
              <code className="rounded bg-white/5 px-1 text-[10px] text-cyan-200">
                ?debug=guide
              </code>{" "}
              to any FI URL to enable force show while testing.
            </p>
            <button
              type="button"
              disabled={pending}
              onClick={() => setForceShow(!state.forceShowActive)}
              className={cn(
                "mt-3 min-h-11 rounded-xl border px-4 text-sm font-semibold disabled:opacity-50",
                state.forceShowActive
                  ? "border-amber-400/50 bg-amber-500/20 text-amber-50 hover:bg-amber-500/30"
                  : "border-white/15 text-slate-100 hover:bg-white/5"
              )}
              data-testid="clinic-guide-force-show"
            >
              {state.forceShowActive ? "Turn off force show" : "Force show for this user"}
            </button>
          </div>

          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2.5">
            <span className="text-sm text-slate-200">
              Default on after clinic setup (new staff / no personal choice)
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={state.tenantDefaults.defaultAssistEnabled}
              disabled={pending}
              onClick={() => setPostSetupDefault(!state.tenantDefaults.defaultAssistEnabled)}
              className={cn(
                "relative h-6 w-11 shrink-0 rounded-full border transition-colors",
                state.tenantDefaults.defaultAssistEnabled
                  ? "border-cyan-500/60 bg-cyan-600/30"
                  : "border-slate-600 bg-slate-800/80"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-[#0F1629]/80 shadow transition-transform",
                  state.tenantDefaults.defaultAssistEnabled
                    ? "translate-x-5"
                    : "translate-x-0.5"
                )}
              />
            </button>
          </label>

          <div className="rounded-lg border border-white/[0.08] bg-black/20 p-3">
            <p className="text-sm font-medium text-slate-100">
              Enable for all staff in this clinic
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Turns the guide on for every staff preference in this tenant and sets the clinic
              default to on. Does not change clinical workflows.
            </p>
            {confirmAll ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <p className="w-full text-xs text-amber-200/90">
                  Confirm: enable Clinic guide for all staff preference rows?
                </p>
                <button
                  type="button"
                  disabled={pending}
                  onClick={enableForAll}
                  className="min-h-11 rounded-xl border border-amber-400/40 bg-amber-500/20 px-4 text-sm font-semibold text-amber-50 hover:bg-amber-500/30 disabled:opacity-50"
                  data-testid="clinic-guide-enable-all-confirm"
                >
                  Yes, enable for all
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirmAll(false)}
                  className="min-h-11 rounded-xl px-3 text-sm text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={enableForAll}
                className="mt-3 min-h-11 rounded-xl border border-white/15 px-4 text-sm font-medium text-slate-100 hover:bg-white/5 disabled:opacity-50"
                data-testid="clinic-guide-enable-all"
              >
                Enable for all staff…
              </button>
            )}
          </div>

          <div className="rounded-lg border border-white/[0.08] bg-black/25 p-3">
            <button
              type="button"
              onClick={() => setDebugOpen((o) => !o)}
              className="flex w-full items-center justify-between gap-2 text-left text-sm font-medium text-slate-100"
              aria-expanded={debugOpen}
              data-testid="clinic-guide-debug-toggle"
            >
              Debug info
              {debugOpen ? (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              )}
            </button>
            {debugOpen ? <DebugInfoTable info={state.debugInfo} /> : null}
          </div>
        </div>
      ) : null}

      {message ? (
        <p className="mt-3 text-xs text-cyan-200/90" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 text-xs text-amber-300" role="alert">
          {error}
        </p>
      ) : null}

      <p className="mt-4 text-[10px] leading-relaxed text-slate-500">
        Tip: when the floating guide is off, use the dock “Turn on Clinic Guide” chip or this page
        anytime. Preference is stored per user in this clinic (tenant-isolated). Thumbs on tips help
        improve operational guidance — never used for clinical decisions.
      </p>
    </section>
  );
}
