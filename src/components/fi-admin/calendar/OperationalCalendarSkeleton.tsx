import { CalendarSkeleton } from "@/components/calendar/CalendarSkeleton";

export function OperationalCalendarSkeleton() {
  return (
    <div className="-mx-3 flex min-h-[calc(100dvh-8rem)] flex-col sm:-mx-4 lg:-mx-6">
      <div className="border-b border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md px-4 py-3">
        <div className="flex flex-wrap gap-2">
          <div className="h-9 w-36 animate-pulse rounded-xl bg-white/[0.06]" />
          <div className="h-9 w-32 animate-pulse rounded-xl bg-white/[0.06]" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4 lg:p-0 lg:pt-0">
        <CalendarSkeleton />
      </div>
    </div>
  );
}
