import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type DashboardCardProps = HTMLAttributes<HTMLDivElement> & {
  /** Slightly stronger lift / border for nested hierarchy */
  elevated?: boolean;
};

/**
 * Glassmorphism panel: soft border, blur, OS surface tint.
 */
export function DashboardCard({ className, elevated, children, ...rest }: DashboardCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border backdrop-blur-md",
        elevated
          ? "border-white/[0.1] bg-[#141C33]/85 shadow-2xl shadow-black/50"
          : "border-white/[0.08] bg-[#0F1629]/75 shadow-xl shadow-black/40",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
