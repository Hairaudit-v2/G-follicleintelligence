import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { networkSpacing } from "./tokens";

export type NetworkFeatureGridProps = {
  children: ReactNode;
  className?: string;
  columnsClassName?: string;
};

export function NetworkFeatureGrid({
  children,
  className,
  columnsClassName = "sm:grid-cols-2 lg:grid-cols-3",
}: NetworkFeatureGridProps) {
  return (
    <div className={cn("grid", networkSpacing.gridGap, columnsClassName, className)}>{children}</div>
  );
}
