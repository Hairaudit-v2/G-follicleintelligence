import { Section } from "@/components/layout/section";
import { FadeIn } from "@/components/ui/fade-in";
import type { HomeAuthorityMetric } from "@/lib/marketing/homePageContent";
import { cn } from "@/lib/utils";

function SectionHeading({
  id,
  title,
  eyebrow,
}: {
  id: string;
  title: string;
  eyebrow?: string;
}) {
  return (
    <header className="max-w-4xl">
      {eyebrow ? (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-amber-200/75">{eyebrow}</p>
          <div className="mt-3 h-px w-14 bg-gradient-to-r from-amber-300/70 via-amber-400/25 to-transparent" aria-hidden />
        </div>
      ) : null}
      <h2
        id={id}
        className={cn(
          "max-w-[52rem] font-display font-semibold tracking-tight text-foreground text-balance",
          eyebrow ? "mt-5 text-3xl sm:text-4xl md:text-[2.75rem] md:leading-[1.12]" : "text-3xl sm:text-4xl md:text-[2.75rem] md:leading-[1.12]"
        )}
      >
        {title}
      </h2>
    </header>
  );
}

function AuthorityMetricCard({ metric, index }: { metric: HomeAuthorityMetric; index: number }) {
  return (
    <div
      className={cn(
        "group relative flex h-full min-h-[9.5rem] flex-col justify-between overflow-hidden rounded-[1.25rem] border border-white/[0.08] bg-gradient-to-br from-white/[0.07] via-[rgb(6_9_15_/0.72)] to-[rgb(4_7_12_/0.92)] p-5 shadow-[0_18px_52px_rgb(0_0_0_/0.38),inset_0_1px_0_rgb(255_255_255_/0.06)] backdrop-blur-md sm:min-h-[10rem] sm:p-6",
        "transition-[transform,border-color,box-shadow] duration-500 ease-out will-change-transform",
        "hover:-translate-y-0.5 hover:border-amber-400/22 hover:shadow-[0_26px_72px_rgb(0_0_0_/0.42),0_0_36px_rgb(212_175_55_/0.06),inset_0_1px_0_rgb(255_255_255_/0.09)]"
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: "radial-gradient(520px 180px at 20% 0%, rgb(212 175 55 / 0.09), transparent 60%)",
        }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <span className="font-mono text-[10px] font-semibold uppercase tabular-nums tracking-[0.22em] text-amber-200/45">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span
          className="h-px w-10 shrink-0 bg-gradient-to-r from-amber-400/40 to-transparent transition-opacity group-hover:opacity-100 sm:w-12"
          aria-hidden
        />
      </div>
      <div className="relative mt-5">
        <p className="font-display text-[1.65rem] font-semibold leading-none tracking-tight text-amber-50/95 sm:text-[1.85rem] md:text-[2rem]">
          <span className="bg-gradient-to-br from-amber-100 via-amber-200 to-amber-600/90 bg-clip-text text-transparent">
            {metric.emphasis}
          </span>
        </p>
        <p className="mt-3 text-sm font-medium leading-snug text-foreground/90 sm:text-[0.9375rem]">{metric.description}</p>
      </div>
    </div>
  );
}

export function FiMarketingAuthoritySection({
  section,
}: {
  section: {
    id: string;
    storyEyebrow: string;
    headline: string;
    metrics: readonly HomeAuthorityMetric[];
    founderAuthorityQuote: string;
  };
}) {
  return (
    <Section
      id={section.id}
      className="border-b border-border/50 bg-gradient-to-b from-[rgb(4_7_12_/0.55)] via-background to-background py-20 sm:py-24 md:py-28"
      aria-labelledby={`${section.id}-heading`}
    >
      <FadeIn>
        <SectionHeading id={`${section.id}-heading`} eyebrow={section.storyEyebrow} title={section.headline} />

        <ul className="mt-12 grid list-none grid-cols-1 gap-4 sm:mt-14 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 2xl:grid-cols-5 2xl:gap-4" role="list">
          {section.metrics.map((metric, index) => (
            <li key={metric.id} className="min-w-0">
              <AuthorityMetricCard metric={metric} index={index} />
            </li>
          ))}
        </ul>

        <div className="relative mt-12 sm:mt-14">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-px rounded-[1.75rem] bg-gradient-to-br from-amber-400/20 via-white/[0.06] to-transparent opacity-40 blur-sm sm:rounded-[2rem]"
          />
          <div className="relative overflow-hidden rounded-[1.75rem] border border-amber-400/20 bg-gradient-to-br from-[rgb(10_14_22_/0.96)] via-[rgb(7_10_16_/0.94)] to-[rgb(4_7_12_/0.98)] shadow-[0_28px_90px_rgb(0_0_0_/0.48),inset_0_1px_0_rgb(255_255_255_/0.06)] backdrop-blur-md sm:rounded-[2rem]">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_0%_0%,rgb(212_175_55_/0.12),transparent_55%)]" aria-hidden />
            <div className="relative p-7 sm:p-9 md:p-12">
              <div className="border-l-2 border-amber-400/35 pl-6 md:pl-10">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-200/75">Founder authority</p>
                <blockquote className="mt-6 font-display text-xl font-semibold leading-snug tracking-tight text-foreground text-balance sm:text-2xl md:text-[1.65rem] md:leading-snug lg:text-[1.85rem]">
                  <span className="text-foreground/95">{section.founderAuthorityQuote}</span>
                </blockquote>
              </div>
            </div>
          </div>
        </div>
      </FadeIn>
    </Section>
  );
}
