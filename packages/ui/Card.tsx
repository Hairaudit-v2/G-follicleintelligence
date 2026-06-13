import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const cardVariants = {
  glass:
    "border border-white/[0.08] bg-gradient-to-br from-white/[0.08] via-white/[0.03] to-white/[0.015] shadow-[0_20px_56px_rgb(0_0_0_/0.4),inset_0_1px_0_rgb(255_255_255_/0.06)] backdrop-blur-md hover:border-white/[0.12]",
  elevated:
    "border border-border/60 bg-card/60 text-card-foreground shadow-fi-panel backdrop-blur-sm",
  outline: "border border-border/50 bg-background/30 backdrop-blur-sm",
  muted: "border border-border/40 bg-muted/15",
} as const;

export type NetworkCardVariant = keyof typeof cardVariants;

export type NetworkCardProps = {
  children: ReactNode;
  className?: string;
  variant?: NetworkCardVariant;
  padding?: "sm" | "md" | "lg";
};

const paddingMap = {
  sm: "p-4 sm:p-5",
  md: "p-5 sm:p-6",
  lg: "p-6 sm:p-8",
} as const;

export function NetworkCard({ children, className, variant = "glass", padding = "md" }: NetworkCardProps) {
  return (
    <div className={cn("rounded-[1.35rem]", cardVariants[variant], paddingMap[padding], className)}>{children}</div>
  );
}
