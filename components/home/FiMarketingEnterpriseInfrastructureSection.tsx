import { GlassCard, SectionHeading } from "@/components/marketing/FiMarketingPrimitives";
import { Section } from "@/components/layout/section";
import { FadeIn } from "@/components/ui/fade-in";
import { HOME_PAGE_CONTENT } from "@/lib/marketing/homePageContent";

const c = HOME_PAGE_CONTENT.enterpriseInfrastructure;

function EnterpriseInfrastructureCard({
  index,
  title,
  description,
  bullets,
}: {
  index: number;
  title: string;
  description: string;
  bullets: readonly string[];
}) {
  return (
    <GlassCard
      variant="os"
      className="group flex h-full flex-col border-white/[0.07] transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-amber-400/22"
    >
      <div className="flex items-center border-b border-white/[0.07] pb-3">
        <span className="font-mono text-[10px] font-semibold uppercase tabular-nums tracking-[0.22em] text-amber-200/55">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span
          className="ml-auto h-px w-12 bg-gradient-to-r from-amber-400/45 to-transparent"
          aria-hidden
        />
      </div>
      <h3 className="mt-4 text-sm font-semibold uppercase tracking-[0.12em] text-amber-100/95 transition-colors group-hover:text-amber-50">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>
      <ul className="mt-5 flex-1 space-y-2 border-t border-white/[0.06] pt-4">
        {bullets.map((item) => (
          <li
            key={item}
            className="flex gap-2.5 text-sm leading-snug text-foreground/90 before:mt-[0.45rem] before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-amber-400/55"
          >
            {item}
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}

export function FiMarketingEnterpriseInfrastructureSection() {
  return (
    <Section
      id={c.id}
      className="border-b border-border/50 bg-gradient-to-b from-background via-muted/[0.06] to-background py-20 sm:py-24 md:py-28"
      aria-labelledby={`${c.id}-heading`}
    >
      <FadeIn>
        <SectionHeading
          id={`${c.id}-heading`}
          eyebrow={c.storyEyebrow}
          title={c.headline}
          description={c.subtext}
        />
        <ul className="mt-12 grid list-none gap-4 p-0 sm:mt-14 sm:grid-cols-2 lg:grid-cols-3">
          {c.cards.map((card, index) => (
            <li key={card.title}>
              <EnterpriseInfrastructureCard
                index={index}
                title={card.title}
                description={card.description}
                bullets={card.bullets}
              />
            </li>
          ))}
        </ul>
      </FadeIn>
    </Section>
  );
}
