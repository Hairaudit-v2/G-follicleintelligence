import Link from "next/link";

import type { DashboardReminderItem } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function DashboardUpcomingReminders(props: {
  tenantId: string;
  agendaRange: { startIso: string; endIso: string };
  items: DashboardReminderItem[];
}) {
  const { tenantId, agendaRange, items } = props;

  return (
    <DashboardCard className="p-5 sm:p-6" role="region" aria-labelledby="dash-reminders-heading">
      <SectionHeader
        id="dash-reminders-heading"
        kicker="Engagement"
        title="Upcoming reminders"
        description={`Queued SMS/email jobs with status pending or processing, scheduled between your agenda window (${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(agendaRange.startIso))} – ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(agendaRange.endIso))} UTC range).`}
        className="mb-4"
      />
      {items.length === 0 ? (
        <p className="text-sm leading-relaxed text-[#94A3B8]">
          No reminder jobs in this window. Enable{" "}
          <Link href={`/fi-admin/${tenantId}/settings/reminders`} className="font-medium text-[#22C1FF] underline-offset-2 hover:underline">
            templates
          </Link>{" "}
          and patient consent on the patient profile.
        </p>
      ) : (
        <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-[#081020]/40">
          {items.map((row) => (
            <li key={row.jobId} className="flex flex-col gap-1 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[#F8FAFC]">
                  {row.templateName}
                  <span className="ml-2 text-xs font-normal text-[#64748B]">
                    ({row.templateType}) · {row.status}
                  </span>
                </p>
                <p className="text-xs text-[#94A3B8]">
                  Send {formatWhen(row.scheduled_at)}
                  {row.bookingStartAt ? (
                    <>
                      {" "}
                      · Booking {formatWhen(row.bookingStartAt)}
                      {row.bookingTitle ? ` — ${row.bookingTitle}` : ""}
                    </>
                  ) : null}
                </p>
              </div>
              {row.bookingId ? (
                <Link
                  href={`/fi-admin/${tenantId}/bookings`}
                  className="shrink-0 text-xs font-semibold text-[#22C1FF] underline-offset-2 hover:underline sm:text-sm"
                >
                  Bookings list
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}
