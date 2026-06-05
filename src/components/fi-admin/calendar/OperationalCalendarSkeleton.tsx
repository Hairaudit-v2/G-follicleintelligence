import { FiCard } from "@/src/components/fi-design/FiCard";

export function OperationalCalendarSkeleton() {
  return (
    <div className="space-y-4">
      <FiCard className="p-4 sm:p-5">
        <div className="h-8 w-48 animate-pulse rounded-md bg-slate-200 dark:bg-slate-800" />
        <div className="mt-2 h-4 w-72 max-w-full animate-pulse rounded-md bg-slate-100 dark:bg-slate-800/80" />
      </FiCard>
      <div className="h-12 w-full animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800/80" />
      <div className="hidden min-h-[420px] w-full animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800/80 lg:block" />
      <div className="space-y-3 lg:hidden">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800/80" />
        ))}
      </div>
    </div>
  );
}
