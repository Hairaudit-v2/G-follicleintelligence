import { GlassCard, SectionHeading } from "@/components/marketing/FiMarketingPrimitives";
import { Section } from "@/components/layout/section";
import { FadeIn } from "@/components/ui/fade-in";
import { HOME_PAGE_CONTENT } from "@/lib/marketing/homePageContent";

const c = HOME_PAGE_CONTENT.industrySoftwareGap;

function InfrastructureColumn({
  headline,
  items,
  variant,
}: {
  headline: string;
  items: readonly string[];
  variant: "problem" | "default";
}) {
  return (
    <GlassCard variant={variant === "problem" ? "problem" : "default"} className="h-full border-white/[0.07]">
      <h3 className="font-display text-xl font-semibold tracking-tight text-foreground md:text-2xl">{headline}</h3>
      <ul className="mt-6 space-y-2.5">
        {items.map((item) => (
          <li
            key={item}
            className="rounded-xl border border-white/[0.06] border-l-2 border-l-amber-400/45 bg-gradient-to-r from-amber-400/[0.07] via-transparent to-transparent px-4 py-3 text-sm leading-snug text-foreground/95 shadow-[inset_0_1px_0_rgb(255_255_255_/0.04)] transition-[border-color,background-color,box-shadow] duration-200 hover:border-amber-400/30 hover:bg-amber-400/[0.06] hover:shadow-[inset_0_1px_0_rgb(255_255_255_/0.06)]"
          >
            {item}
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}

export function FiMarketingIndustrySoftwareGapSection() {
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

        <div className="mt-12 grid gap-6 md:grid-cols-2 md:gap-8 lg:mt-14">
          <InfrastructureColumn
            headline={c.currentProblems.headline}
            items={c.currentProblems.items}
            variant="problem"
          />
          <InfrastructureColumn headline={c.modernNeeds.headline} items={c.modernNeeds.items} variant="default" />
        </div>

        <div className="mx-auto mt-14 max-w-4xl text-center sm:mt-16 md:mt-20">
          <p className="font-display text-2xl font-semibold leading-snug tracking-tight text-foreground text-balance sm:text-3xl md:text-[2.125rem] md:leading-[1.2]">
            {c.closingStatement.line1}
          </p>
          <p className="mt-4 font-display text-2xl font-semibold tracking-tight text-amber-100/95 sm:mt-5 sm:text-3xl md:text-[2.125rem]">
            {c.closingStatement.line2}
          </p>
        </div>
      </FadeIn>
    </Section>
  );
}
