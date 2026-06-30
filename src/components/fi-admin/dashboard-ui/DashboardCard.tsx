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
        "rounded-xl border backdrop-blur-md",
        elevated
          ? "border-white/[0.1] bg-[#0f1629]/88 shadow-lg shadow-black/45"
          : "border-white/[0.07] bg-[#0c1426]/80 shadow-md shadow-black/35",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
