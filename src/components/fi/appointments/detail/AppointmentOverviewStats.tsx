import { appointmentCardClass } from "../shared";

export function AppointmentOverviewStats({
  pendingReminderCount,
  openTaskCount,
  procedureLabel,
  nextScheduledLabel,
}: {
  pendingReminderCount: number;
  openTaskCount: number;
  procedureLabel: string;
  nextScheduledLabel: string | null;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className={appointmentCardClass}>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Procedure</p>
        <p className="mt-1 text-lg font-semibold text-slate-100">{procedureLabel}</p>
      </div>
      <div className={appointmentCardClass}>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Schedule</p>
        <p className="mt-1 text-sm font-medium text-slate-100">{nextScheduledLabel ?? "—"}</p>
      </div>
      <div className={appointmentCardClass}>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Open tasks</p>
        <p className="mt-1 text-lg font-semibold text-slate-100">
          {openTaskCount} <span className="text-sm font-normal text-slate-400">on linked lead</span>
        </p>
      </div>
      <div className={appointmentCardClass}>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Reminders</p>
        <p className="mt-1 text-lg font-semibold text-slate-100">{pendingReminderCount} pending</p>
      </div>
    </div>
  );
}
