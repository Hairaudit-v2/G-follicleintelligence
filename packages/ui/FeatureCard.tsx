import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { NetworkCard, type NetworkCardVariant } from "./Card";

export type NetworkFeatureCardProps = {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  footer?: ReactNode;
  className?: string;
  cardVariant?: NetworkCardVariant;
};

export function NetworkFeatureCard({
  title,
  description,
  icon,
  footer,
  className,
  cardVariant = "glass",
}: NetworkFeatureCardProps) {
  return (
    <NetworkCard variant={cardVariant} className={cn("flex h-full flex-col", className)}>
      {icon ? <div className="mb-4 text-foreground/90 [&_svg]:h-9 [&_svg]:w-9">{icon}</div> : null}
      <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">{title}</h3>
      {description ? <div className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</div> : null}
      {footer ? <div className="mt-5 border-t border-white/[0.06] pt-4 text-sm text-muted-foreground">{footer}</div> : null}
    </NetworkCard>
  );
}
