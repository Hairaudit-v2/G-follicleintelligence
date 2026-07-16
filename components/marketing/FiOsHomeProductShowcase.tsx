import Link from "next/link";

import { FiOsScreenshot } from "@/components/marketing/FiOsScreenshot";
import { Section } from "@/components/layout/section";
import { FadeIn } from "@/components/ui/fade-in";
import { Button } from "@/components/ui/button";
import {
  FIOS_DEMO_DATA_NOTE,
  FIOS_HOME_FEATURED,
  FIOS_HOME_SUPPORTING,
  FIOS_SCREENSHOTS,
} from "@/lib/marketing/fiosScreenshots";
import {
  MARKETING_CTA_SECONDARY_CLASS,
} from "@/lib/marketing/marketingCtaClasses";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

export function FiOsHomeProductShowcase() {
  const featured = FIOS_SCREENSHOTS[FIOS_HOME_FEATURED];
  const supporting = FIOS_HOME_SUPPORTING.map((id) => FIOS_SCREENSHOTS[id]);

  return (
    <Section
      id="product-showcase"
      className="scroll-mt-24 border-b border-border/40 bg-[radial-gradient(ellipse_at_50%_0%,rgb(42_168_220_/0.07),transparent_45%),linear-gradient(180deg,rgb(3_5_10)_0%,rgb(5_8_14)_50%,rgb(2_4_8)_100%)] py-24 sm:py-28 md:py-32"
      aria-labelledby="product-showcase-heading"
    >
      <FadeIn>
        <header className="mx-auto max-w-4xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-200/70">
            Product proof
          </p>
          <div
            className="mx-auto mt-3 h-px w-14 bg-gradient-to-r from-transparent via-cyan-400/35 to-transparent"
            aria-hidden
          />
          <h2
            id="product-showcase-heading"
            className="mt-6 font-display text-3xl font-semibold tracking-tight text-foreground text-balance sm:text-4xl md:text-[2.75rem] md:leading-[1.1]"
          >
            See the operating system behind the clinic.
          </h2>
          <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            From enquiries and scheduling to surgery, workforce and outcomes, FI brings the
            clinic&apos;s essential workflows into one connected operating environment.
          </p>
        </header>

        <div className="mx-auto mt-14 max-w-6xl sm:mt-16">
          <FiOsScreenshot asset={featured} featured priority sizes="(max-width: 1024px) 100vw, 900px" />
        </div>

        <ul className="mx-auto mt-8 grid max-w-6xl list-none grid-cols-1 gap-6 p-0 sm:mt-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {supporting.map((asset, index) => (
            <li key={asset.id} className="min-w-0">
              <FadeIn delay={0.04 * (index % 4)}>
                <FiOsScreenshot
                  asset={asset}
                  sizes="(max-width: 1024px) 100vw, 25vw"
                />
              </FadeIn>
            </li>
          ))}
        </ul>

        <p className="mx-auto mt-8 max-w-3xl text-center text-xs text-muted-foreground/80 sm:text-sm">
          {FIOS_DEMO_DATA_NOTE}
        </p>

        <div className="mt-10 flex justify-center">
          <Button
            asChild
            variant="outline"
            size="lg"
            className={cn(MARKETING_CTA_SECONDARY_CLASS, "min-w-[14rem]")}
          >
            <Link href="/vision#vision-product-proof">
              Explore the full FI OS gallery
              <ArrowRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            </Link>
          </Button>
        </div>
      </FadeIn>
    </Section>
  );
}
