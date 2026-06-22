import { GlassCard, SectionHeading } from "@/components/marketing/FiMarketingPrimitives";
import { Section } from "@/components/layout/section";
import { FadeIn } from "@/components/ui/fade-in";
import { HOME_PAGE_CONTENT } from "@/lib/marketing/homePageContent";

const c = HOME_PAGE_CONTENT.globalIntelligenceNetwork;

function IntelligenceNetworkColumn({
  index,
  title,
  tracks,
}: {
  index: number;
  title: string;
  tracks: readonly string[];
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
        <span className="ml-auto h-px w-12 bg-gradient-to-r from-amber-400/45 to-transparent" aria-hidden />
      </div>
      <h3 className="mt-4 text-sm font-semibold uppercase tracking-[0.12em] text-amber-100/95 transition-colors group-hover:text-amber-50">
        {title}
      </h3>
      <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Track</p>
      <ul className="mt-5 flex-1 space-y-2 border-t border-white/[0.06] pt-4">
        {tracks.map((item) => (
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

export function FiMarketingGlobalIntelligenceNetworkSection() {
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
          tone="intelligence"
        />

        <ul className="mt-12 grid list-none gap-4 p-0 sm:mt-14 sm:grid-cols-2 lg:grid-cols-3">
          {c.columns.map((column, index) => (
            <li key={column.title}>
              <IntelligenceNetworkColumn index={index} title={column.title} tracks={column.tracks} />
            </li>
          ))}
        </ul>

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
