import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { NETWORK_BADGE_COPY } from "./ecosystem";
import { Hero, type HeroProps } from "./Hero";

export type NetworkHeroProps = Omit<HeroProps, "topSlot"> & {
  networkLabel?: ReactNode;
  labelClassName?: string;
};

export function NetworkHero({ networkLabel, labelClassName, ...hero }: NetworkHeroProps) {
  const top = (
    <p className={cn("text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground/90", labelClassName)}>
      {networkLabel ?? NETWORK_BADGE_COPY}
    </p>
  );
  return <Hero {...hero} topSlot={top} />;
}
