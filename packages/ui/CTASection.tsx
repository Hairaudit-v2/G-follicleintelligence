import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { NetworkCard } from "./Card";
import { NetworkSection } from "./Section";

export type NetworkCTASectionProps = {
  id?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  align?: "left" | "center";
};

export function NetworkCTASection({ id, eyebrow, title, description, actions, className, align = "left" }: NetworkCTASectionProps) {
  return (
    <NetworkSection id={id} className={cn("border-t border-border/40", className)}>
      <NetworkCard variant="glass" className={cn(align === "center" && "text-center")}>
        <div className={cn("flex flex-col gap-6", align === "center" && "items-center")}>
          {eyebrow ? <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">{eyebrow}</div> : null}
          <div className={cn("space-y-3", align === "center" && "max-w-3xl")}>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{title}</h2>
            {description ? <div className="text-base leading-relaxed text-muted-foreground sm:text-lg">{description}</div> : null}
          </div>
          {actions ? (
            <div className={cn("flex flex-wrap gap-3", align === "center" && "justify-center")}>{actions}</div>
          ) : null}
        </div>
      </NetworkCard>
    </NetworkSection>
  );
}
