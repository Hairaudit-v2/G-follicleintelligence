import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { NetworkCard } from "../Card";
import { NetworkFeatureGrid } from "../FeatureGrid";
import { NetworkSection } from "../Section";

export type AudienceSegment = {
  title: ReactNode;
  description?: ReactNode;
  bullets?: readonly ReactNode[];
};

export type NetworkAudienceSectionProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  segments: readonly AudienceSegment[];
  className?: string;
};

export function NetworkAudienceSection({ eyebrow, title, description, segments, className }: NetworkAudienceSectionProps) {
  return (
    <NetworkSection className={cn(className)}>
      <div className="space-y-10">
        {eyebrow ? <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">{eyebrow}</div> : null}
        <div className="max-w-3xl space-y-4">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{title}</h2>
          {description ? <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">{description}</p> : null}
        </div>
        <NetworkFeatureGrid columnsClassName="md:grid-cols-2">
          {segments.map((seg, idx) => (
            <NetworkCard key={idx} variant="glass">
              <h3 className="font-display text-lg font-semibold text-foreground">{seg.title}</h3>
              {seg.description ? <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{seg.description}</p> : null}
              {seg.bullets?.length ? (
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {seg.bullets.map((b, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-violet-300/60" aria-hidden />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </NetworkCard>
          ))}
        </NetworkFeatureGrid>
      </div>
    </NetworkSection>
  );
}
