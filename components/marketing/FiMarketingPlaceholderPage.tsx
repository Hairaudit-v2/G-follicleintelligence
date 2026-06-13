import Link from "next/link";

import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";
import { cn } from "@/lib/utils";
import { ArrowRight, ChevronRight } from "lucide-react";

const ctaPrimaryClass =
  "h-12 min-h-[48px] w-full justify-center gap-2 rounded-xl border border-amber-300/35 bg-gradient-to-b from-amber-200/[0.18] to-amber-200/[0.07] px-5 text-sm font-semibold text-foreground shadow-[0_14px_44px_rgb(212_175_55_/0.14),inset_0_1px_0_rgb(255_255_255_/0.12)] hover:from-amber-200/25 hover:to-amber-200/10 sm:h-11 sm:min-h-0 sm:w-auto sm:justify-between";

const ctaSecondaryClass =
  "h-12 min-h-[48px] w-full justify-center gap-2 rounded-xl border border-white/12 bg-background/35 px-5 text-sm font-semibold text-foreground shadow-[inset_0_1px_0_rgb(255_255_255_/0.06)] backdrop-blur-sm hover:border-amber-300/30 hover:bg-white/[0.04] sm:h-11 sm:min-h-0 sm:w-auto sm:justify-between";

export interface FiMarketingPlaceholderPageProps {
  eyebrow?: string;
  headline: string;
  description?: string;
  /** When true, primary CTA is mailto; otherwise links to /contact with intent. */
  variant?: "default" | "demo";
  className?: string;
}

export function FiMarketingPlaceholderPage({
  eyebrow = "Follicle Intelligence",
  headline,
  description,
  variant = "default",
  className,
}: FiMarketingPlaceholderPageProps) {
  const isDemo = variant === "demo";

  return (
    <div className={cn(className)}>
      <section className="fi-grid relative overflow-hidden border-b border-border/50">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_12%_-5%,rgb(212_175_55_/0.12),transparent_48%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_92%_8%,hsl(var(--primary)/0.14),transparent_44%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgb(0_0_0_/0.4),transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-background/90" />

        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 md:py-24">
          <FadeIn>
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-amber-200/90 sm:text-[11px]">
              {eyebrow}
            </p>
            <div className="mt-3 h-px w-14 bg-gradient-to-r from-amber-300/70 via-amber-400/25 to-transparent" aria-hidden />
            <h1 className="mt-6 max-w-4xl font-display text-3xl font-semibold leading-[1.12] tracking-tight text-foreground text-balance sm:text-4xl md:text-5xl">
              {headline}
            </h1>
            {description ? (
              <p className="mt-6 max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">{description}</p>
            ) : null}

            <div className="mt-10 flex w-full max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:flex-wrap">
              {isDemo ? (
                <>
                  <Button asChild size="lg" className={ctaPrimaryClass}>
                    <Link href="mailto:hello@follicleintelligence.ai?subject=Enterprise%20demo%20request">
                      Email hello@follicleintelligence.ai
                      <ArrowRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className={ctaSecondaryClass}>
                    <Link href="/contact?intent=demo">
                      Contact form
                      <ChevronRight className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild size="lg" className={ctaPrimaryClass}>
                    <Link href="/platform">
                      Explore the platform
                      <ArrowRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className={ctaSecondaryClass}>
                    <Link href="/demo">
                      Book enterprise demo
                      <ChevronRight className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </FadeIn>
        </div>
      </section>

      <Section className="border-b border-border/50 py-12 sm:py-16 md:py-20">
        <FadeIn>
          <div className="rounded-[1.35rem] border border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-6 shadow-[0_20px_56px_rgb(0_0_0_/0.35)] backdrop-blur-md md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Coming next</p>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground md:text-base">
              This route is wired into the public architecture for the rebuilt Follicle Intelligence story. Deeper
              narrative, diagrams, and proof points will ship here incrementally—without changing the URL you share
              today.
            </p>
          </div>
        </FadeIn>
      </Section>
    </div>
  );
}
