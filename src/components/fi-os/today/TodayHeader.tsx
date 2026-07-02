import { greetingForHour } from "@/src/lib/fiOs/todayFeedDerive";

export function TodayHeader(props: {
  tenantName: string;
  dateLine: string;
  viewerFirstName?: string | null;
  rightNowCount: number;
  patientsBooked: number;
  surgeriesScheduled: number;
  tasksOverdue: number;
  workspaceBadge?: string | null;
  /** Hour in clinic timezone for greeting (0–23). */
  hourOfDay?: number;
}) {
  const {
    tenantName,
    dateLine,
    viewerFirstName,
    rightNowCount,
    patientsBooked,
    surgeriesScheduled,
    tasksOverdue,
    workspaceBadge,
    hourOfDay = new Date().getHours(),
  } = props;

  const greeting = greetingForHour(hourOfDay);
  const headline = viewerFirstName ? `${greeting}, ${viewerFirstName}` : greeting;

  const attentionLine =
    rightNowCount === 0
      ? "You're all caught up for now."
      : rightNowCount === 1
        ? "1 thing needs your attention right now."
        : `${rightNowCount} things need your attention right now.`;

  const statParts: string[] = [];
  if (patientsBooked > 0) {
    statParts.push(`${patientsBooked} patient${patientsBooked === 1 ? "" : "s"} booked`);
  }
  if (surgeriesScheduled > 0) {
    statParts.push(`${surgeriesScheduled} surger${surgeriesScheduled === 1 ? "y" : "ies"} scheduled`);
  }
  if (tasksOverdue > 0) {
    statParts.push(`${tasksOverdue} task${tasksOverdue === 1 ? "" : "s"} overdue`);
  }

  return (
    <header className="space-y-4 border-b border-white/[0.07] pb-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">{headline}</h1>
        <p className="text-base text-slate-300">{attentionLine}</p>
      </div>

      <div className="space-y-0.5">
        <p className="text-sm font-medium text-slate-200">Today at {tenantName}</p>
        <p className="text-sm text-slate-500">{dateLine}</p>
        {statParts.length > 0 ? (
          <p className="pt-1 text-sm text-slate-400">{statParts.join(" · ")}</p>
        ) : (
          <p className="pt-1 text-sm text-slate-500">Clinic day is loading — check back shortly.</p>
        )}
      </div>

      {workspaceBadge ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          <span className="text-cyan-400/90">{workspaceBadge}</span>
        </p>
      ) : null}
    </header>
  );
}
