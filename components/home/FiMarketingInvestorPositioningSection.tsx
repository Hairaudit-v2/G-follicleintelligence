import { Section } from "@/components/layout/section";
import { FadeIn } from "@/components/ui/fade-in";
import { HOME_PAGE_CONTENT } from "@/lib/marketing/homePageContent";

const c = HOME_PAGE_CONTENT.investorPositioning;

export function FiMarketingInvestorPositioningSection() {
  return (
    <Section
      id={c.id}
      className="border-b border-border/50 bg-gradient-to-b from-muted/[0.03] via-background to-muted/[0.04] py-24 sm:py-28 md:py-32"
      aria-labelledby={`${c.id}-heading`}
    >
      <FadeIn>
        <div className="mx-auto max-w-4xl px-2 text-center sm:px-4">
          <h2
            id={`${c.id}-heading`}
            className="font-display text-3xl font-semibold tracking-tight text-foreground text-balance sm:text-4xl md:text-[2.875rem] md:leading-[1.1] lg:text-5xl"
          >
            {c.headline}
          </h2>
          <p className="mx-auto mt-8 max-w-3xl text-base leading-relaxed text-muted-foreground sm:mt-10 sm:text-lg md:leading-relaxed">
            {c.subheadline}
          </p>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-relaxed text-foreground/85 sm:mt-6 sm:text-lg md:leading-relaxed">
            {c.subheadline2}
          </p>
        </div>
      </FadeIn>
    </Section>
  );
}
