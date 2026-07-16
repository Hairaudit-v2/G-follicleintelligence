import { FiOsScreenshot } from "@/components/marketing/FiOsScreenshot";
import { Section } from "@/components/layout/section";
import { FadeIn } from "@/components/ui/fade-in";
import {
  FIOS_DEMO_DATA_NOTE,
  FIOS_SCREENSHOTS,
  FIOS_VISION_SHOWCASE,
} from "@/lib/marketing/fiosScreenshots";
import { cn } from "@/lib/utils";

export function VisionShowcaseSection() {
  const items = FIOS_VISION_SHOWCASE.map((id) => FIOS_SCREENSHOTS[id]);

  return (
    <Section
      id="vision-product-proof"
      className={cn(
        "border-y border-white/[0.06] py-24 sm:py-28 md:py-32",
        "bg-[radial-gradient(ellipse_at_50%_0%,rgb(212_175_55_/0.06),transparent_45%),radial-gradient(ellipse_at_100%_30%,rgb(42_168_220_/0.05),transparent_40%),linear-gradient(180deg,rgb(3_5_10)_0%,rgb(5_8_14)_45%,rgb(2_4_8)_100%)]"
      )}
      aria-labelledby="vision-product-proof-heading"
    >
      <FadeIn>
        <header className="mx-auto max-w-4xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-200/70">
            Product depth
          </p>
          <div
            className="mx-auto mt-3 h-px w-14 bg-gradient-to-r from-transparent via-amber-400/35 to-transparent"
            aria-hidden
          />
          <h2
            id="vision-product-proof-heading"
            className="mt-6 font-display text-3xl font-semibold tracking-tight text-foreground text-balance sm:text-4xl md:text-[2.75rem] md:leading-[1.1]"
          >
            This Is Not a Concept
          </h2>
          <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg md:leading-relaxed">
            FI OS is operating across real clinic workflows — connecting acquisition, patients,
            teams, procedures and outcomes through one purpose-built environment.
          </p>
        </header>

        <ul className="mx-auto mt-16 grid max-w-6xl list-none grid-cols-1 gap-10 p-0 sm:mt-20 sm:gap-12 lg:grid-cols-2">
          {items.map((asset, index) => (
            <li key={asset.id} className="min-w-0">
              <FiOsScreenshot
                asset={asset}
                variant="vision"
                priority={index < 2}
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </li>
          ))}
        </ul>

        <p className="mx-auto mt-10 max-w-3xl text-center text-xs text-muted-foreground/80 sm:text-sm">
          {FIOS_DEMO_DATA_NOTE}
        </p>
      </FadeIn>
    </Section>
  );
}
