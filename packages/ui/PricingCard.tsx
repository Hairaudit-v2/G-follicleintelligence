import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { NetworkBadge } from "./Badge";
import { NetworkCard } from "./Card";

export type NetworkPricingTier = {
  name: ReactNode;
  price: ReactNode;
  cadence?: ReactNode;
  description?: ReactNode;
  features: readonly ReactNode[];
  cta?: ReactNode;
  highlighted?: boolean;
};

export type NetworkPricingCardProps = NetworkPricingTier & { className?: string };

export function NetworkPricingCard({
  name,
  price,
  cadence,
  description,
  features,
  cta,
  highlighted,
  className,
}: NetworkPricingCardProps) {
  return (
    <NetworkCard
      variant={highlighted ? "elevated" : "glass"}
      className={cn("flex h-full flex-col", highlighted && "ring-1 ring-amber-400/25", className)}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-lg font-semibold text-foreground">{name}</h3>
        {highlighted ? <NetworkBadge tone="accent">Featured</NetworkBadge> : null}
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="font-display text-4xl font-semibold tracking-tight text-foreground">{price}</span>
        {cadence ? <span className="text-sm text-muted-foreground">{cadence}</span> : null}
      </div>
      {description ? <p className="mt-3 text-sm text-muted-foreground">{description}</p> : null}
      <ul className="mt-6 flex-1 space-y-3 text-sm text-muted-foreground">
        {features.map((f, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/70" aria-hidden />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      {cta ? <div className="mt-8">{cta}</div> : null}
    </NetworkCard>
  );
}
