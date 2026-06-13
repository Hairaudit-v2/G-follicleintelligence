import type { ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export type NetworkLogoItem = {
  src: string;
  alt: string;
  href?: string;
};

export type NetworkLogoCloudProps = {
  title?: ReactNode;
  logos: readonly NetworkLogoItem[];
  className?: string;
};

export function NetworkLogoCloud({ title, logos, className }: NetworkLogoCloudProps) {
  return (
    <div className={cn("space-y-8", className)}>
      {title ? <div className="max-w-2xl text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">{title}</div> : null}
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {logos.map((logo) => {
          const img = (
            // eslint-disable-next-line @next/next/no-img-element -- shared package; hosts may swap for `next/image`
            <img
              src={logo.src}
              alt={logo.alt}
              className="mx-auto h-8 w-auto max-w-[140px] object-contain opacity-80 grayscale transition hover:opacity-100 hover:grayscale-0"
              loading="lazy"
            />
          );
          const inner = (
            <div className="flex items-center justify-center rounded-xl border border-border/40 bg-background/30 px-4 py-3">{img}</div>
          );
          if (logo.href) {
            return (
              <Link key={`${logo.src}-${logo.alt}`} href={logo.href} className="block">
                {inner}
              </Link>
            );
          }
          return <div key={`${logo.src}-${logo.alt}`}>{inner}</div>;
        })}
      </div>
    </div>
  );
}
