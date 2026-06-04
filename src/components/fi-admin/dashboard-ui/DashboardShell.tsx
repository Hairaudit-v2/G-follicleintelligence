import { cn } from "@/lib/utils";

import { fiAdminAmbientBackgroundStyle } from "./dashboardTheme";

type DashboardShellProps = {
  children: React.ReactNode;
  /** Merged with default max-width and padding on the inner content wrapper. */
  className?: string;
};

/**
 * Full-viewport FI Admin shell: deep navy gradient, ambient cyan/purple radials (login-adjacent).
 */
export function DashboardShell({ children, className }: DashboardShellProps) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#081020] font-sans text-[#F8FAFC] antialiased">
      <div className="pointer-events-none absolute inset-0" style={fiAdminAmbientBackgroundStyle} aria-hidden />
      <div
        className={cn(
          "relative z-10 mx-auto min-h-screen w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
