import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { platformAccentRuleClasses, platformColorTokens, type NetworkPlatform } from "./tokens";

export type HeroProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
  /** Rendered above eyebrow/title inside the hero container */
  topSlot?: ReactNode;
  className?: string;
  innerClassName?: string;
  platform?: NetworkPlatform;
  appearance?: "dark" | "light";
};

export function Hero({
  eyebrow,
  title,
  subtitle,
  actions,
  aside,
  topSlot,
  className,
  innerClassName,
  platform = "fi",
  appearance = "dark",
}: HeroProps) {
  const accent = platformColorTokens[platform];
  const rule = platformAccentRuleClasses(platform);
  const isLight = appearance === "light";

  return (
    <section className={cn("relative overflow-hidden border-b border-border/50", className)}>
      <div className={cn("relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 md:py-24", innerClassName)}>
        {topSlot ? <div className="mb-8">{topSlot}</div> : null}
        <div className={cn("grid gap-12", aside ? "lg:grid-cols-[1.05fr_0.95fr] lg:items-center" : "")}>
          <div>
            {eyebrow ? (
              <div className="space-y-3">
                <div className={cn(accent.accentText, isLight && platform === "hli" && "text-emerald-800")}>
                  {typeof eyebrow === "string" ? (
                    <p className="text-[10px] font-semibold uppercase tracking-[0.32em] sm:text-[11px]">{eyebrow}</p>
                  ) : (
                    eyebrow
                  )}
                </div>
                <div className={cn("h-px w-14 bg-gradient-to-r to-transparent", rule)} aria-hidden />
              </div>
            ) : null}
            <div className={eyebrow ? "mt-6" : ""}>
              <div
                className={cn(
                  "font-display text-[2.05rem] font-semibold leading-[1.08] tracking-tight text-balance sm:text-4xl md:text-5xl md:leading-[1.06]",
                  isLight && platform === "hli" ? "text-slate-900" : "text-foreground"
                )}
              >
                {title}
              </div>
              {subtitle ? (
                <div
                  className={cn(
                    "mt-6 max-w-3xl text-base font-medium leading-relaxed sm:text-lg md:text-xl md:leading-relaxed",
                    isLight && platform === "hli" ? "text-slate-700" : "text-foreground/85"
                  )}
                >
                  {subtitle}
                </div>
              ) : null}
              {actions ? <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:mt-10 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">{actions}</div> : null}
            </div>
          </div>
          {aside ? <div className="relative">{aside}</div> : null}
        </div>
      </div>
    </section>
  );
}
