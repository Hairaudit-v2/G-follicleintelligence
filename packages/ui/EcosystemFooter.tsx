import type { ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

import { NETWORK_BADGE_COPY, NETWORK_ECOSYSTEM_STATEMENT, NETWORK_PRODUCTS, type NetworkProductSlug } from "./ecosystem";
import { NetworkContainer } from "./Container";

export type LegalLink = { label: string; href: string };

export type NetworkEcosystemFooterProps = {
  resolveProductHref: (slug: NetworkProductSlug) => string;
  legalLinks: readonly LegalLink[];
  statement?: string;
  newsletterSlot?: ReactNode;
  className?: string;
};

export function NetworkEcosystemFooter({
  resolveProductHref,
  legalLinks,
  statement = NETWORK_ECOSYSTEM_STATEMENT,
  newsletterSlot,
  className,
}: NetworkEcosystemFooterProps) {
  return (
    <footer className={cn("border-t border-border/40 bg-background/80", className)}>
      <NetworkContainer className="py-14">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-muted-foreground">{NETWORK_BADGE_COPY}</p>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">{statement}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
              {NETWORK_PRODUCTS.map((p) => (
                <Link key={p.slug} href={resolveProductHref(p.slug)} className="text-foreground/90 underline-offset-4 hover:underline">
                  {p.name}
                </Link>
              ))}
            </div>
          </div>
          {newsletterSlot ? <div className="rounded-2xl border border-border/50 bg-muted/10 p-5">{newsletterSlot}</div> : null}
        </div>
        <div className="mt-10 flex flex-col gap-3 border-t border-border/30 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {legalLinks.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-foreground">
                {l.label}
              </Link>
            ))}
          </div>
          <p className="text-[11px] uppercase tracking-[0.18em]">{NETWORK_BADGE_COPY}</p>
        </div>
      </NetworkContainer>
    </footer>
  );
}
