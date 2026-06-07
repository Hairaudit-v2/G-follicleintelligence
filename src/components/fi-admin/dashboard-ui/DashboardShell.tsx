import { cn } from "@/lib/utils";

import { fiAdminAmbientBackgroundStyle } from "./dashboardTheme";

type DashboardShellProps = {
  children: React.ReactNode;
  /** Merged with default max-width and padding on the inner content wrapper. */
  className?: string;
};

/**
 * Full-viewport FI OS root: deep navy, ambient radials (login-adjacent). Children control inner padding
 * (tenant shell is edge-to-edge; workspace picker adds its own gutters).
 */
export function DashboardShell({ children, className }: DashboardShellProps) {
  return (
    <div className="relative min-h-screen min-h-dvh overflow-x-hidden bg-[#081020] font-sans text-[#F8FAFC] antialiased">
      <div className="pointer-events-none absolute inset-0" style={fiAdminAmbientBackgroundStyle} aria-hidden />
      <div className={cn("relative z-10 min-h-screen min-h-dvh w-full", className)}>{children}</div>
    </div>
  );
}
