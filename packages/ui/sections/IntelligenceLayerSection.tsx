import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { NetworkFeatureCard } from "../FeatureCard";
import { NetworkFeatureGrid } from "../FeatureGrid";
import { NetworkSection } from "../Section";

export type IntelligenceLayerItem = {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  footer?: ReactNode;
};

export type NetworkIntelligenceLayerSectionProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  layers: readonly IntelligenceLayerItem[];
  className?: string;
};

export function NetworkIntelligenceLayerSection({
  eyebrow,
  title,
  description,
  layers,
  className,
}: NetworkIntelligenceLayerSectionProps) {
  return (
    <NetworkSection className={cn(className)}>
      <div className="space-y-10">
        {eyebrow ? <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">{eyebrow}</div> : null}
        <div className="max-w-3xl space-y-4">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{title}</h2>
          {description ? <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">{description}</p> : null}
        </div>
        <NetworkFeatureGrid>
          {layers.map((layer, idx) => (
            <NetworkFeatureCard
              key={idx}
              title={layer.title}
              description={layer.description}
              icon={layer.icon}
              footer={layer.footer}
              cardVariant="glass"
            />
          ))}
        </NetworkFeatureGrid>
      </div>
    </NetworkSection>
  );
}
