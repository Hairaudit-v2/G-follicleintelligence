import { GlassCard, SectionHeading } from "@/components/marketing/FiMarketingPrimitives";
import { Section } from "@/components/layout/section";
import { FadeIn } from "@/components/ui/fade-in";
import { HOME_PAGE_CONTENT } from "@/lib/marketing/homePageContent";

const c = HOME_PAGE_CONTENT.clinicsAtEveryStage;

export function FiMarketingClinicsAtEveryStageSection() {
  return (
    <Section
      id={c.id}
      className="border-b border-border/50 bg-muted/[0.04] py-20 sm:py-24 md:py-28"
      aria-labelledby={`${c.id}-heading`}
    >
      <FadeIn>
        <SectionHeading
          id={`${c.id}-heading`}
          eyebrow={c.storyEyebrow}
          title={c.headline}
          description={c.subtext}
        />
        <ul className="mt-10 grid list-none gap-5 p-0 sm:mt-12 sm:gap-6 md:grid-cols-3">
          {c.cards.map((card) => (
            <li key={card.title}>
              <GlassCard className="group flex h-full flex-col border-white/[0.07] transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-amber-400/22">
                <h3 className="font-display text-xl font-semibold tracking-tight text-foreground md:text-2xl">
                  {card.title}
                </h3>
                <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground md:text-base">
                  {card.description}
                </p>
              </GlassCard>
            </li>
          ))}
        </ul>
      </FadeIn>
    </Section>
  );
}
