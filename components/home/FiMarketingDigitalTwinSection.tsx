import { GlassCard, SectionHeading } from "@/components/marketing/FiMarketingPrimitives";
import { Section } from "@/components/layout/section";
import { FadeIn } from "@/components/ui/fade-in";
import { HOME_PAGE_CONTENT } from "@/lib/marketing/homePageContent";

const c = HOME_PAGE_CONTENT.hairRestorationDigitalTwin;

function DigitalTwinJourneyFlow({ stages }: { stages: readonly string[] }) {
  return (
    <div className="mx-auto mt-12 max-w-xl sm:mt-14">
      <ol className="relative space-y-0">
        {stages.map((stage, index) => (
          <li key={stage} className="flex flex-col items-center">
            <GlassCard
              variant="default"
              className="w-full border-amber-400/10 text-center !shadow-[0_12px_40px_rgb(0_0_0_/0.28)]"
            >
              <span className="font-mono text-[9px] font-semibold uppercase tabular-nums tracking-[0.18em] text-amber-200/55">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="mt-2 text-base font-medium leading-snug text-foreground sm:text-lg">
                {stage}
              </p>
            </GlassCard>
            {index < stages.length - 1 ? (
              <span className="py-3 text-xl font-light text-amber-400/55 sm:py-4" aria-hidden>
                ↓
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function FiMarketingDigitalTwinSection() {
  return (
    <Section
      id={c.id}
      className="border-b border-border/50 bg-gradient-to-b from-background via-muted/[0.05] to-background py-20 sm:py-24 md:py-28"
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

        <DigitalTwinJourneyFlow stages={c.stages} />

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
