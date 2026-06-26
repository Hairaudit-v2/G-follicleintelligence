import { PlatformProgressStatusBadge } from "@/components/platform/PlatformProgressPrimitives";
import {
  ProgressChecklist,
  ProgressChecklistItem,
} from "@/src/components/fi-admin/dashboard-ui";
import { GOOGLE_CALENDAR_INTEGRATION_PROGRESS } from "@/src/lib/googleCalendar/googleCalendarIntegrationProgress";

export function GoogleCalendarIntegrationProgressSection() {
  const { name, status, progressPercent, completed, remaining } = GOOGLE_CALENDAR_INTEGRATION_PROGRESS;

  return (
    <div className="mt-4 rounded-lg border border-white/[0.06] bg-[#060d18]/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#F8FAFC]">{name}</p>
          <p className="mt-0.5 text-xs text-[#64748B]">CalendarOS native connector delivery tracker</p>
        </div>
        <PlatformProgressStatusBadge status={status} />
      </div>

      <ProgressChecklist
        className="mt-3"
        percentComplete={progressPercent}
        progressLabel={`${progressPercent}% complete — ${completed.length} shipped, ${remaining.length} remaining`}
      >
        {completed.map((item) => (
          <ProgressChecklistItem key={item} done label={item} />
        ))}
        {remaining.map((item) => (
          <ProgressChecklistItem key={item} done={false} label={item} />
        ))}
      </ProgressChecklist>
    </div>
  );
}
