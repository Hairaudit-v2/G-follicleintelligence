"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  enableGuidedAssistForAllStaffAction,
  setGuidedAssistEnabledAction,
  setGuidedAssistTenantDefaultsAction,
} from "@/lib/actions/fi-onboarding-os-guided-assist-actions";
import { cn } from "@/lib/utils";
import { GuidedAssistToggle } from "@/src/components/onboarding-os/GuidedAssistToggle";
import type { GuidedAssistSettingsState } from "@/src/lib/onboarding-os/guidedAssistTypes";

const sectionClass =
  "rounded-2xl border border-white/[0.08] bg-[#0F1629]/75 p-4 shadow-lg shadow-black/25 backdrop-blur-md sm:p-5";

/**
 * Settings → Clinic Guide: personal on/off + optional admin enable-for-all.
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

  const onPersonalChanged = (enabled: boolean) => {
    setState((prev) => ({
      ...prev,
      assistEnabled: enabled,
      userAssistOverride: enabled,
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
            state.assistEnabled
              ? "bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/30"
              : "bg-slate-800/80 text-slate-400 ring-1 ring-white/10"
          )}
        >
          {state.assistEnabled ? "On for you" : "Off for you"}
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
