import { GlassCard, SectionHeading } from "@/components/marketing/FiMarketingPrimitives";
import { Section } from "@/components/layout/section";
import { FadeIn } from "@/components/ui/fade-in";
import { HOME_PAGE_CONTENT } from "@/lib/marketing/homePageContent";

const c = HOME_PAGE_CONTENT.intelligenceNetwork;

function IntelligenceCard({
  index,
  title,
  description,
}: {
  index: number;
  title: string;
  description: string;
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
      <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
    </GlassCard>
  );
}

export function FiMarketingIntelligenceNetworkSection() {
  return (
    <Section
      id={c.id}
      className="border-b border-border/50 bg-gradient-to-b from-muted/[0.04] via-background to-muted/[0.03] py-20 sm:py-24 md:py-28"
      aria-labelledby={`${c.id}-heading`}
    >
      <FadeIn>
        <SectionHeading
          id={`${c.id}-heading`}
          eyebrow={c.storyEyebrow}
          title={c.headline}
          description={c.subtext}
          tone="intelligence"
        />
        <ul className="mt-12 grid list-none gap-4 p-0 sm:mt-14 sm:grid-cols-2 lg:grid-cols-3">
          {c.cards.map((card, index) => (
            <li key={card.title}>
              <IntelligenceCard index={index} title={card.title} description={card.description} />
            </li>
          ))}
        </ul>
      </FadeIn>
    </Section>
  );
}
