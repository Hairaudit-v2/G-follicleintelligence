"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";

import { NETWORK_BADGE_COPY, NETWORK_PRODUCTS, type NetworkProductSlug } from "./ecosystem";
import { NetworkContainer } from "./Container";

export type NetworkPlatformNavProps = {
  currentPlatform: NetworkProductSlug;
  resolveProductHref: (slug: NetworkProductSlug) => string;
  /** Primary site title / lockup */
  brand: ReactNode;
  className?: string;
  cta?: ReactNode;
};

export function NetworkPlatformNav({ currentPlatform, resolveProductHref, brand, className, cta }: NetworkPlatformNavProps) {
  const [open, setOpen] = useState(false);

  const links = NETWORK_PRODUCTS.map((p) => ({
    ...p,
    href: resolveProductHref(p.slug),
    active: p.slug === currentPlatform,
  }));

  return (
    <header className={cn("sticky top-0 z-40 border-b border-border/40 bg-background/75 backdrop-blur-md", className)}>
      <NetworkContainer className="flex items-center justify-between gap-4 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link href={resolveProductHref(currentPlatform)} className="min-w-0 font-display text-base font-semibold tracking-tight">
            {brand}
          </Link>
          <span className="hidden text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground/80 lg:inline">
            {NETWORK_BADGE_COPY}
          </span>
        </div>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Follicle Intelligence Network products">
          {links.map((l) => (
            <Link
              key={l.slug}
              href={l.href}
              className={cn(
                "rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground",
                l.active && "bg-white/[0.06] text-foreground"
              )}
            >
              {l.name}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">{cta}</div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md border border-border/60 p-2 text-foreground lg:hidden"
          aria-expanded={open}
          aria-controls="fi-network-mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="sr-only">Toggle menu</span>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </NetworkContainer>

      {open ? (
        <div id="fi-network-mobile-nav" className="border-t border-border/40 bg-background/95 lg:hidden">
          <NetworkContainer className="flex flex-col gap-3 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">{NETWORK_BADGE_COPY}</p>
            {links.map((l) => (
              <Link
                key={l.slug}
                href={l.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-base font-medium text-muted-foreground hover:bg-muted/20",
                  l.active && "bg-muted/25 text-foreground"
                )}
                onClick={() => setOpen(false)}
              >
                {l.name}
              </Link>
            ))}
            {cta ? <div className="pt-2">{cta}</div> : null}
          </NetworkContainer>
        </div>
      ) : null}
    </header>
  );
}
