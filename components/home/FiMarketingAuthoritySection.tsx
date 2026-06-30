import { Section } from "@/components/layout/section";
import { FadeIn } from "@/components/ui/fade-in";
import type { HomeAuthorityCard, HomeAuthorityFounderPanel } from "@/lib/marketing/homePageContent";
import { cn } from "@/lib/utils";

function SectionHeading({
  id,
  title,
  description,
  eyebrow,
}: {
  id: string;
  title: string;
  description?: string;
  eyebrow?: string;
}) {
  return (
    <header className="max-w-4xl">
      {eyebrow ? (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-amber-200/75">
            {eyebrow}
          </p>
          <div
            className="mt-3 h-px w-14 bg-gradient-to-r from-amber-300/70 via-amber-400/25 to-transparent"
            aria-hidden
          />
        </div>
      ) : null}
      <h2
        id={id}
        className={cn(
          "max-w-[52rem] font-display font-semibold tracking-tight text-foreground text-balance",
          eyebrow
            ? "mt-5 text-3xl sm:text-4xl md:text-[2.75rem] md:leading-[1.12]"
            : "text-3xl sm:text-4xl md:text-[2.75rem] md:leading-[1.12]"
        )}
      >
        {title}
      </h2>
      {description ? (
        <p className="mt-5 max-w-3xl text-base leading-[1.65] text-muted-foreground sm:text-lg md:leading-relaxed">
          {description}
        </p>
      ) : null}
    </header>
  );
}

const glassCardBase =
  "group relative flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-white/[0.08] bg-gradient-to-br from-white/[0.07] via-[rgb(6_9_15_/0.72)] to-[rgb(4_7_12_/0.92)] p-5 shadow-[0_18px_52px_rgb(0_0_0_/0.38),inset_0_1px_0_rgb(255_255_255_/0.06)] backdrop-blur-md ring-1 ring-inset ring-amber-400/[0.04] sm:p-6";

function AuthorityProofCard({ card, index }: { card: HomeAuthorityCard; index: number }) {
  const isStat = Boolean(card.statSuffix);

  return (
    <div
      className={cn(
        glassCardBase,
        "transition-[transform,border-color,box-shadow] duration-300 ease-out",
        "hover:-translate-y-0.5 hover:border-amber-400/22 hover:shadow-[0_22px_64px_rgb(0_0_0_/0.42),0_0_40px_rgb(212_175_55_/0.06),inset_0_1px_0_rgb(255_255_255_/0.09)]"
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(480px 160px at 15% 0%, rgb(212 175 55 / 0.08), transparent 58%)",
        }}
      />
      <div className="relative flex items-start justify-between gap-3 border-b border-white/[0.06] pb-3">
        <span className="font-mono text-[10px] font-semibold uppercase tabular-nums tracking-[0.22em] text-amber-200/45">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span
          className="h-px w-12 shrink-0 bg-gradient-to-r from-amber-400/45 to-transparent"
          aria-hidden
        />
      </div>

      <div className="relative mt-4 flex-1">
        {isStat ? (
          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
            <p className="font-display text-[2rem] font-semibold leading-none tracking-tight sm:text-[2.25rem]">
              <span className="bg-gradient-to-br from-amber-100 via-amber-200 to-amber-600/90 bg-clip-text text-transparent">
                {card.headline}
              </span>
            </p>
            {card.statSuffix ? (
              <span className="font-display text-lg font-semibold tracking-tight text-amber-100/80 sm:text-xl">
                {card.statSuffix}
              </span>
            ) : null}
          </div>
        ) : (
          <p className="font-display text-lg font-semibold leading-snug tracking-tight text-foreground/95 sm:text-xl">
            {card.headline}
          </p>
        )}
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200/80">
          {card.label}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
          {card.copy}
        </p>
      </div>
    </div>
  );
}

function FounderAuthorityPanel({ panel }: { panel: HomeAuthorityFounderPanel }) {
  return (
    <div className="relative mt-12 sm:mt-14">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-px rounded-[1.75rem] bg-gradient-to-br from-amber-400/18 via-white/[0.05] to-transparent opacity-50 blur-sm sm:rounded-[2rem]"
      />
      <div className="relative overflow-hidden rounded-[1.75rem] border border-amber-400/20 bg-gradient-to-br from-[rgb(10_14_22_/0.96)] via-[rgb(7_10_16_/0.94)] to-[rgb(4_7_12_/0.98)] shadow-[0_28px_90px_rgb(0_0_0_/0.48),inset_0_1px_0_rgb(255_255_255_/0.06)] backdrop-blur-md sm:rounded-[2rem]">
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_0%_0%,rgb(212_175_55_/0.11),transparent_55%)]"
          aria-hidden
        />
        <div className="relative p-7 sm:p-9 md:p-12">
          <div className="max-w-3xl border-l-2 border-amber-400/35 pl-6 md:pl-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-200/70">
              {panel.eyebrow}
            </p>
            <h3 className="mt-5 font-display text-xl font-semibold leading-snug tracking-tight text-foreground text-balance sm:text-2xl md:text-[1.65rem] md:leading-snug">
              {panel.headline}
            </h3>
            <p className="mt-6 text-base leading-relaxed text-muted-foreground md:text-lg">
              {panel.body}
            </p>
            <p className="mt-6 border-t border-white/[0.08] pt-6 text-sm font-medium leading-relaxed text-amber-100/90 sm:text-base">
              {panel.closingLine}
            </p>
          </div>
        </div>
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
    subtext: string;
    cards: readonly HomeAuthorityCard[];
    founderPanel: HomeAuthorityFounderPanel;
  };
}) {
  return (
    <Section
      id={section.id}
      className="border-t border-b border-border/50 bg-gradient-to-b from-[rgb(4_7_12_/0.45)] via-background to-background py-20 sm:py-24 md:py-28"
      aria-labelledby={`${section.id}-heading`}
    >
      <FadeIn>
        <SectionHeading
          id={`${section.id}-heading`}
          eyebrow={section.storyEyebrow}
          title={section.headline}
          description={section.subtext}
        />

        <ul
          className="mt-12 grid list-none grid-cols-1 gap-4 sm:mt-14 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3"
          role="list"
        >
          {section.cards.map((card, index) => (
            <li key={card.id} className="min-w-0">
              <AuthorityProofCard card={card} index={index} />
            </li>
          ))}
        </ul>

        <FounderAuthorityPanel panel={section.founderPanel} />
      </FadeIn>
    </Section>
  );
}
