import { Section } from "@/components/layout/section";
import { FadeIn } from "@/components/ui/fade-in";
import { HOME_PAGE_CONTENT } from "@/lib/marketing/homePageContent";

const c = HOME_PAGE_CONTENT.investorPositioning;

export function FiMarketingInvestorPositioningSection() {
  return (
    <Section
      id={c.id}
      className="border-b border-border/50 py-20 sm:py-24 md:py-28"
      aria-labelledby={`${c.id}-heading`}
    >
      <FadeIn>
        <div className="mx-auto max-w-4xl text-center">
          <h2
            id={`${c.id}-heading`}
            className="font-display text-3xl font-semibold tracking-tight text-foreground text-balance sm:text-4xl md:text-[2.75rem] md:leading-[1.12]"
          >
            {c.headline}
          </h2>
          <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed text-muted-foreground sm:mt-8 sm:text-lg md:leading-relaxed">
            {c.subtext}
          </p>
        </div>
      </FadeIn>
    </Section>
  );
}
