import type { ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

import { NETWORK_PRODUCTS, type NetworkProductSlug } from "../ecosystem";
import { NetworkFeatureGrid } from "../FeatureGrid";
import { NetworkSection } from "../Section";

export type NetworkEcosystemMapSectionProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  resolveProductHref: (slug: NetworkProductSlug) => string;
  footer?: ReactNode;
  className?: string;
};

export function NetworkEcosystemMapSection({
  eyebrow,
  title,
  description,
  resolveProductHref,
  footer,
  className,
}: NetworkEcosystemMapSectionProps) {
  return (
    <NetworkSection className={cn(className)}>
      <div className="space-y-10">
        {eyebrow ? <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">{eyebrow}</div> : null}
        <div className="max-w-3xl space-y-4">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{title}</h2>
          {description ? <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">{description}</p> : null}
        </div>
        <NetworkFeatureGrid columnsClassName="sm:grid-cols-2">
          {NETWORK_PRODUCTS.map((p) => (
            <article
              key={p.slug}
              className="rounded-[1.35rem] border border-white/[0.08] bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-transparent p-5 shadow-[0_16px_48px_rgb(0_0_0_/0.35)] backdrop-blur-md sm:p-6"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{p.category}</p>
              <h3 className="mt-3 font-display text-lg font-semibold text-foreground">
                <Link href={resolveProductHref(p.slug)} className="hover:underline">
                  {p.name}
                </Link>
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.description}</p>
            </article>
          ))}
        </NetworkFeatureGrid>
        {footer}
      </div>
    </NetworkSection>
  );
}
