"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ChangeEvent } from "react";

import { saveCalendarSettingsAction } from "@/lib/actions/fi-calendar-settings-actions";
import { buildConfigurationCalendarScopeHref } from "@/src/lib/calendar/configurationCalendarScopeHref";
import type { FiCalendarSettingsDocument } from "@/src/lib/calendar/calendarSettingsCore";

const inputClass =
  "w-full rounded-lg border border-white/[0.1] bg-[#081020]/85 px-2 py-1.5 text-sm text-[#F8FAFC] shadow-inner outline-none transition placeholder:text-[#475569] focus:border-[#22C1FF]/45 focus:ring-2 focus:ring-[#22C1FF]/20";

const labelClass = "grid gap-1 text-xs font-medium text-[#CBD5E1]";

const sectionTitle = "text-sm font-semibold text-[#F8FAFC]";

type ClinicOption = { id: string; displayName: string };

export function CalendarSettingsSection(props: {
  tenantId: string;
  clinicId: string | null;
  clinics: ClinicOption[];
  initialSettings: FiCalendarSettingsDocument;
  canEdit: boolean;
  /** When set, clinic scope changes navigate to the configuration calendar tab. */
  configurationOrganisationId?: string | null;
}) {
  const { tenantId, clinics, canEdit, configurationOrganisationId } = props;
  const router = useRouter();
  const [settings, setSettings] = useState(props.initialSettings);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const clinicId = props.clinicId;

  function onClinicScopeChange(nextClinicId: string) {
    if (configurationOrganisationId !== undefined) {
      router.push(
        buildConfigurationCalendarScopeHref(
          tenantId,
          configurationOrganisationId,
          nextClinicId.trim() ? nextClinicId.trim() : null
        )
      );
      return;
    }
    const q = nextClinicId === "" ? "" : `?clinicId=${encodeURIComponent(nextClinicId)}`;
    router.push(`/fi-admin/${tenantId}/settings/calendar${q}`);
  }

  function save() {
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      const res = await saveCalendarSettingsAction({ tenantId, clinicId, settings });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setMsg("Saved.");
      router.refresh();
    });
  }

  const disabled = !canEdit || pending;

  return (
    <div className="space-y-6">
      {!canEdit ? (
        <div
          className="rounded-lg border border-amber-600/35 bg-amber-950/30 px-3 py-2 text-xs text-amber-100/95"
          role="status"
        >
          View only — your role can review calendar settings but cannot save changes.
        </div>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <span className={labelClass}>Scope</span>
          <select
            className={`${inputClass} max-w-md`}
            value={clinicId ?? ""}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => onClinicScopeChange(e.target.value)}
            disabled={clinics.length === 0}
          >
            <option value="">Tenant default</option>
            {clinics.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={save}
            disabled={disabled}
            className="rounded-lg bg-[#22C1FF] px-4 py-2 text-sm font-semibold text-[#0B1220] transition hover:bg-[#5dd4ff] disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save settings"}
          </button>
        ) : null}
      </div>

      {msg ? (
        <p className="text-sm text-emerald-400" role="status">
          {msg}
        </p>
      ) : null}
      {err ? (
        <p className="text-sm text-red-400" role="alert">
          {err}
        </p>
      ) : null}

      <section className="rounded-xl border border-white/[0.08] bg-[#0a1424]/80 p-4 space-y-4">
        <h2 className={sectionTitle}>Visible hours</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className={labelClass}>
            Day start (hour)
            <input
              type="number"
              min={0}
              max={23}
              className={inputClass}
              value={settings.dayStartHour}
              disabled={disabled}
              onChange={(e) => setSettings((s) => ({ ...s, dayStartHour: Number(e.target.value) }))}
            />
          </label>
          <label className={labelClass}>
            Day end (hour, exclusive)
            <input
              type="number"
              min={1}
              max={24}
              className={inputClass}
              value={settings.dayEndHour}
              disabled={disabled}
              onChange={(e) => setSettings((s) => ({ ...s, dayEndHour: Number(e.target.value) }))}
            />
          </label>
          <label className={labelClass}>
            Slot duration (minutes)
            <select
              className={inputClass}
              value={settings.slotMinutes}
              disabled={disabled}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  slotMinutes: Number(e.target.value) as FiCalendarSettingsDocument["slotMinutes"],
                }))
              }
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>60 minutes</option>
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-[#0a1424]/80 p-4 space-y-4">
        <h2 className={sectionTitle}>Default view &amp; columns</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Default calendar view
            <select
              className={inputClass}
              value={settings.defaultView}
              disabled={disabled}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  defaultView: e.target.value as FiCalendarSettingsDocument["defaultView"],
                }))
              }
            >
              <option value="day">Day</option>
              <option value="3day">3-day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
          </label>
          <label className={labelClass}>
            Resource column mode
            <select
              className={inputClass}
              value={settings.resourceColumnMode}
              disabled={disabled}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  resourceColumnMode: e.target
                    .value as FiCalendarSettingsDocument["resourceColumnMode"],
                }))
              }
            >
              <option value="staff">Staff</option>
              <option value="room">Room</option>
              <option value="clinic">Clinic</option>
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-[#0a1424]/80 p-4 space-y-3">
        <h2 className={sectionTitle}>Display options</h2>
        <label className="flex items-center gap-2 text-sm text-[#CBD5E1]">
          <input
            type="checkbox"
            checked={settings.showWeekends}
            disabled={disabled}
            onChange={(e) => setSettings((s) => ({ ...s, showWeekends: e.target.checked }))}
            className="rounded border-white/20"
          />
          Show weekends in week and month views
        </label>
        <label className="flex items-center gap-2 text-sm text-[#CBD5E1]">
          <input
            type="checkbox"
            checked={settings.showCancelledBookings}
            disabled={disabled}
            onChange={(e) =>
              setSettings((s) => ({ ...s, showCancelledBookings: e.target.checked }))
            }
            className="rounded border-white/20"
          />
          Show cancelled bookings by default
        </label>
        <label className={labelClass}>
          Booking buffer (minutes between appointments)
          <input
            type="number"
            min={0}
            max={120}
            className={`${inputClass} max-w-xs`}
            value={settings.bufferMinutes}
            disabled={disabled}
            onChange={(e) => setSettings((s) => ({ ...s, bufferMinutes: Number(e.target.value) }))}
          />
        </label>
      </section>
    </div>
  );
}
