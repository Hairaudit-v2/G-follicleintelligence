import { greetingForHour, todayClinicDaySubline } from "@/src/lib/fiOs/todayFeedDerive";
import type { PresenceOperationalStatus } from "@/src/lib/fiOs/presence/presenceTypes";

export function TodayHeader(props: {
  tenantName: string;
  dateLine: string;
  viewerFirstName?: string | null;
  rightNowCount: number;
  patientsBooked: number;
  surgeriesScheduled: number;
  tasksOverdue: number;
  workspaceBadge?: string | null;
  /** When false, clinic day stats are still loading from the server. */
  clinicDayContextReady?: boolean;
  /** Hide clinic-day subline when the feed already has actionable items. */
  hasActionableFeedItems?: boolean;
  /** Hour in clinic timezone for greeting (0–23). */
  hourOfDay?: number;
  /** D6E — subtle operational presence status. */
  presenceStatus?: PresenceOperationalStatus | null;
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
    clinicDayContextReady = true,
    hasActionableFeedItems = false,
    hourOfDay = new Date().getHours(),
    presenceStatus,
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

  const clinicDaySubline = todayClinicDaySubline({
    statParts,
    hasActionableFeedItems,
    clinicDayContextReady,
  });

  return (
    <header className="space-y-4 border-b border-white/[0.07] pb-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">{headline}</h1>
        <p className="text-base text-slate-300">{attentionLine}</p>
      </div>

      <div className="space-y-0.5">
        <p className="text-sm font-medium text-slate-200">Today at {tenantName}</p>
        <p className="text-sm text-slate-500">{dateLine}</p>
        {clinicDaySubline ? (
          <p className="pt-1 text-sm text-slate-400">{clinicDaySubline}</p>
        ) : null}
      </div>

      {workspaceBadge ? (
        <p className="text-xs font-medium text-slate-500">
          <span className="text-cyan-400/90">{workspaceBadge}</span>
        </p>
      ) : null}

      {presenceStatus ? (
        <div className="space-y-2 pt-1">
          <p
            className={
              presenceStatus.tone === "attention"
                ? "text-sm font-medium text-amber-200/90"
                : presenceStatus.tone === "active"
                  ? "text-sm font-medium text-emerald-300/90"
                  : "text-sm font-medium text-slate-400"
            }
          >
            {presenceStatus.headline}
            {presenceStatus.subline ? (
              <span className="font-normal text-slate-500"> — {presenceStatus.subline}</span>
            ) : null}
          </p>
          {presenceStatus.chips.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {presenceStatus.chips.map((chip) => (
                <span
                  key={chip.id}
                  className={
                    chip.tone === "attention"
                      ? "rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-100/90"
                      : chip.tone === "watch"
                        ? "rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-medium text-cyan-100/80"
                        : "rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 text-[11px] font-medium text-slate-400"
                  }
                >
                  {chip.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
