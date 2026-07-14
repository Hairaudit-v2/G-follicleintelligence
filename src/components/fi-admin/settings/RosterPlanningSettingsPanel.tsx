"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { saveWorkforceRosterPlanningPolicyAction } from "@/src/lib/actions/workforce-roster-cadence-actions";
import {
  isRosterCadenceConfigured,
  type DefaultFullTimePattern,
  type RosterCadence,
  type RosterGenerationMode,
  type RosterWeekStartDay,
  type WorkforceRosterPlanningPolicy,
} from "@/src/lib/workforce/rosterCadencePolicyCore";

const inputClass =
  "mt-1 block w-full rounded-lg border border-white/[0.1] bg-[#081020]/85 px-3 py-2 text-sm text-[#F8FAFC] shadow-inner outline-none transition focus:border-[#22C1FF]/45 focus:ring-2 focus:ring-[#22C1FF]/20";

const sectionClass =
  "rounded-2xl border border-white/[0.08] bg-[#0F1629]/75 p-4 shadow-lg shadow-black/25 backdrop-blur-md sm:p-5";

export function RosterPlanningSettingsPanel({
  tenantId,
  initialPolicy,
}: {
  tenantId: string;
  initialPolicy: WorkforceRosterPlanningPolicy;
}) {
  const router = useRouter();
  const [policy, setPolicy] = useState(initialPolicy);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const showAnchor = policy.rosterCadence === "fortnightly";

  function save() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await saveWorkforceRosterPlanningPolicyAction({
        tenantId,
        rosterCadence: policy.rosterCadence,
        rosterWeekStartDay: policy.rosterWeekStartDay,
        rosterPlanningHorizonWeeks: policy.rosterPlanningHorizonWeeks,
        rosterPublishRequired: policy.rosterPublishRequired,
        rosterGenerationMode: policy.rosterGenerationMode,
        defaultShiftLengthHours: policy.defaultShiftLengthHours,
        defaultFullTimePattern: policy.defaultFullTimePattern,
        rosterCycleAnchorDate: policy.rosterCycleAnchorDate,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPolicy(result.data);
      setMessage("Roster planning settings saved.");
      router.refresh();
    });
  }

  return (
    <section className={sectionClass} data-testid="roster-planning-settings">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-slate-50">Roster planning</h2>
        <p className="text-sm text-slate-400">
          Choose how this clinic plans staff rosters. Standard hours can still be adjusted per staff
          member.
        </p>
      </div>

      {!isRosterCadenceConfigured(policy) ? (
        <p
          className="mt-3 rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-sm text-amber-100"
          data-testid="roster-cadence-readiness-warning"
        >
          Roster cadence is not configured. Save a cadence below to complete workforce roster setup.
        </p>
      ) : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-xs text-slate-400">
          Roster cadence
          <select
            className={inputClass}
            value={policy.rosterCadence}
            disabled={pending}
            onChange={(e) =>
              setPolicy((p) => ({ ...p, rosterCadence: e.target.value as RosterCadence }))
            }
            data-testid="roster-cadence-select"
          >
            <option value="weekly">Weekly</option>
            <option value="fortnightly">Fortnightly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>

        <label className="block text-xs text-slate-400">
          Week starts on
          <select
            className={inputClass}
            value={policy.rosterWeekStartDay}
            disabled={pending}
            onChange={(e) =>
              setPolicy((p) => ({
                ...p,
                rosterWeekStartDay: e.target.value as RosterWeekStartDay,
              }))
            }
          >
            <option value="monday">Monday</option>
            <option value="sunday">Sunday</option>
          </select>
        </label>

        {showAnchor ? (
          <label className="block text-xs text-slate-400 sm:col-span-2">
            Fortnightly cycle anchor date
            <input
              type="date"
              className={inputClass}
              value={policy.rosterCycleAnchorDate}
              disabled={pending}
              onChange={(e) => setPolicy((p) => ({ ...p, rosterCycleAnchorDate: e.target.value }))}
              data-testid="roster-cycle-anchor-date"
            />
            <span className="mt-1 block text-[11px] text-slate-500">
              The anchor marks the start of Week A in your fortnightly cycle.
            </span>
          </label>
        ) : null}

        <label className="block text-xs text-slate-400">
          Default standard-hours template
          <select
            className={inputClass}
            value={policy.defaultFullTimePattern}
            disabled={pending}
            onChange={(e) =>
              setPolicy((p) => ({
                ...p,
                defaultFullTimePattern: e.target.value as DefaultFullTimePattern,
              }))
            }
          >
            <option value="five_eight">5 × 8-hour week</option>
            <option value="four_ten">4 × 10-hour week</option>
            <option value="custom">Custom</option>
          </select>
        </label>

        <label className="block text-xs text-slate-400">
          Planning horizon (weeks)
          <input
            type="number"
            min={1}
            max={52}
            className={inputClass}
            value={policy.rosterPlanningHorizonWeeks}
            disabled={pending}
            onChange={(e) =>
              setPolicy((p) => ({
                ...p,
                rosterPlanningHorizonWeeks: Number(e.target.value) || 4,
              }))
            }
          />
        </label>

        <label className="block text-xs text-slate-400">
          Generation mode
          <select
            className={inputClass}
            value={policy.rosterGenerationMode}
            disabled={pending}
            onChange={(e) =>
              setPolicy((p) => ({
                ...p,
                rosterGenerationMode: e.target.value as RosterGenerationMode,
              }))
            }
          >
            <option value="standard_hours_only">Standard hours only</option>
            <option value="copy_previous_period">Copy previous period</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </label>

        <label className="block text-xs text-slate-400">
          Default shift length (hours, optional)
          <input
            type="number"
            min={1}
            max={24}
            step={0.5}
            className={inputClass}
            value={policy.defaultShiftLengthHours ?? ""}
            disabled={pending}
            onChange={(e) =>
              setPolicy((p) => ({
                ...p,
                defaultShiftLengthHours: e.target.value ? Number(e.target.value) : null,
              }))
            }
          />
        </label>

        <label className="flex items-center gap-2 text-xs text-slate-300 sm:col-span-2">
          <input
            type="checkbox"
            checked={policy.rosterPublishRequired}
            disabled={pending}
            onChange={(e) => setPolicy((p) => ({ ...p, rosterPublishRequired: e.target.checked }))}
          />
          Require roster publish before staff can view final rosters
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
        >
          Save roster planning
        </button>
        {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      </div>
    </section>
  );
}
