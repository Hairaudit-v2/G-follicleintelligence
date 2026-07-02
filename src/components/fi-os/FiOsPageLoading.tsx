import { DashboardCard } from "@/src/components/fi-admin/dashboard-ui";

/**
 * Shared FI OS tenant route loading skeleton — preserves shell layout, avoids blank main.
 */
export function FiOsPageLoading({
  label = "Loading workspace…",
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  return (
    <div
      className="space-y-6 pb-10 motion-safe:animate-pulse sm:space-y-8 sm:pb-12"
      aria-busy="true"
      aria-live="polite"
      data-testid="fi-os-page-loading"
    >
      <p className="sr-only">{label}</p>
      <div className="space-y-2">
        <div className="h-4 w-28 rounded bg-white/[0.08]" aria-hidden />
        <div className="h-7 w-full max-w-md rounded bg-white/[0.1]" aria-hidden />
        {!compact ? (
          <div className="h-4 w-full max-w-2xl rounded bg-white/[0.06]" aria-hidden />
        ) : null}
      </div>
      <DashboardCard elevated className={compact ? "h-40 p-6" : "h-48 p-6 sm:h-52 sm:p-8"} />
      {!compact ? (
        <>
          <DashboardCard className="h-64 p-6" />
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <DashboardCard className="h-56 p-6" />
            <DashboardCard className="h-56 p-6" />
          </div>
        </>
      ) : null}
    </div>
  );
}
