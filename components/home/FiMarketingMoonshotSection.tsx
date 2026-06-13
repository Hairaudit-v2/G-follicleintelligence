import { FadeIn } from "@/components/ui/fade-in";
import type {
  HomeMoonshotClosingBlock,
  HomeMoonshotPredictionCard,
  HomePageContent,
} from "@/lib/marketing/homePageContent";
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
    <header className="relative max-w-4xl">
      {eyebrow ? (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-amber-200/85">{eyebrow}</p>
          <div className="mt-3 h-px w-14 bg-gradient-to-r from-amber-300/80 via-amber-400/35 to-transparent" aria-hidden />
        </div>
      ) : null}
      <h2
        id={id}
        className={cn(
          "relative max-w-[52rem] bg-gradient-to-br from-foreground via-foreground to-amber-100/90 bg-clip-text font-display font-semibold tracking-tight text-transparent text-balance",
          eyebrow ? "mt-5 text-3xl sm:text-4xl md:text-[2.85rem] md:leading-[1.1]" : "text-3xl sm:text-4xl md:text-[2.85rem] md:leading-[1.1]"
        )}
      >
        {title}
      </h2>
      {description ? (
        <p className="relative mt-5 max-w-3xl text-base leading-[1.7] text-amber-50/75 sm:text-lg md:leading-relaxed">
          {description}
        </p>
      ) : null}
    </header>
  );
}

function OrbitalNetworkVisual({ className }: { className?: string }) {
  return (
    <svg
      className={cn("text-amber-400/25", className)}
      viewBox="0 0 900 520"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="moonshot-orbit-a" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgb(212 175 55 / 0.45)" />
          <stop offset="55%" stopColor="rgb(212 175 55 / 0.08)" />
          <stop offset="100%" stopColor="rgb(212 175 55 / 0)" />
        </linearGradient>
        <linearGradient id="moonshot-orbit-b" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgb(250 230 180 / 0.2)" />
          <stop offset="100%" stopColor="rgb(212 175 55 / 0)" />
        </linearGradient>
      </defs>
      <ellipse cx="450" cy="280" rx="380" ry="200" stroke="currentColor" strokeWidth="0.75" strokeDasharray="4 10" opacity="0.9" />
      <ellipse cx="450" cy="260" rx="300" ry="150" stroke="url(#moonshot-orbit-a)" strokeWidth="1" strokeDasharray="2 14" opacity="0.85" />
      <ellipse cx="450" cy="270" rx="220" ry="110" stroke="currentColor" strokeWidth="0.5" strokeDasharray="1 12" opacity="0.55" />
      <path d="M 80 120 Q 450 40 820 140" stroke="url(#moonshot-orbit-b)" strokeWidth="0.9" strokeDasharray="3 12" opacity="0.7" />
      <path d="M 120 400 Q 450 480 780 380" stroke="currentColor" strokeWidth="0.6" strokeDasharray="2 10" opacity="0.45" />
      <circle cx="450" cy="140" r="4" fill="rgb(212 175 55 / 0.55)" />
      <circle cx="180" cy="200" r="3" fill="rgb(250 230 180 / 0.35)" />
      <circle cx="720" cy="220" r="3" fill="rgb(212 175 55 / 0.4)" />
      <circle cx="320" cy="380" r="3.5" fill="rgb(212 175 55 / 0.35)" />
      <circle cx="600" cy="360" r="3" fill="rgb(250 230 180 / 0.28)" />
    </svg>
  );
}

function PredictionCard({ card, index }: { card: HomeMoonshotPredictionCard; index: number }) {
  return (
    <li className="min-w-0">
      <div
        className={cn(
          "group relative flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-amber-400/15 bg-gradient-to-br from-white/[0.07] via-[rgb(6_10_18_/0.55)] to-[rgb(3_6_12_/0.92)] p-5 shadow-[0_22px_64px_rgb(0_0_0_/0.45),inset_0_1px_0_rgb(255_255_255_/0.06)] backdrop-blur-md transition-[transform,border-color,box-shadow] duration-300 sm:p-6",
          "ring-1 ring-inset ring-amber-400/[0.06] hover:-translate-y-0.5 hover:border-amber-400/28 hover:shadow-[0_28px_80px_rgb(0_0_0_/0.5),0_0_48px_rgb(212_175_55_/0.07),inset_0_1px_0_rgb(255_255_255_/0.08)]"
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/50 to-transparent opacity-80"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[radial-gradient(circle_at_center,rgb(212_175_55_/0.12),transparent_68%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        />
        <div className="relative flex items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
          <span className="font-mono text-[10px] font-semibold uppercase tabular-nums tracking-[0.22em] text-amber-200/50">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="h-px flex-1 max-w-[4.5rem] bg-gradient-to-r from-amber-400/40 to-transparent" aria-hidden />
        </div>
        <h3 className="relative mt-4 font-display text-lg font-semibold leading-snug tracking-tight text-foreground/95 sm:text-xl">
          {card.headline}
        </h3>
        <p className="relative mt-3 flex-1 text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">{card.copy}</p>
      </div>
    </li>
  );
}

function ClosingStatementBlock({ closing }: { closing: HomeMoonshotClosingBlock }) {
  return (
    <div className="relative mt-16 sm:mt-20 md:mt-24">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-1 rounded-[1.85rem] bg-gradient-to-br from-amber-400/25 via-amber-400/8 to-transparent opacity-40 blur-md sm:rounded-[2.15rem]"
      />
      <div className="relative overflow-hidden rounded-[1.75rem] border border-amber-400/22 bg-gradient-to-br from-[rgb(12_16_26_/0.97)] via-[rgb(6_9_16_/0.96)] to-[rgb(2_4_10_/0.99)] shadow-[0_36px_120px_rgb(0_0_0_/0.55),inset_0_1px_0_rgb(255_255_255_/0.07)] backdrop-blur-md sm:rounded-[2rem]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgb(212_175_55_/0.18),transparent_50%)]" aria-hidden />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_95%_85%,rgb(212_175_55_/0.08),transparent_45%)]" aria-hidden />
        <div className="relative px-6 py-10 sm:px-10 sm:py-12 md:px-14 md:py-16">
          <div className="mx-auto max-w-4xl text-center">
            <h3 className="font-display text-2xl font-semibold leading-[1.15] tracking-tight text-balance text-foreground sm:text-3xl md:text-[2.35rem] md:leading-[1.12]">
              {closing.headline}
            </h3>
            <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed text-amber-50/78 sm:text-lg md:text-xl md:leading-relaxed">
              {closing.body}
            </p>
            <p className="mx-auto mt-8 max-w-2xl border-t border-amber-400/15 pt-8 text-sm font-medium leading-relaxed text-amber-200/80 sm:text-base">
              {closing.finalLine}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FiMarketingMoonshotSection({ section }: { section: HomePageContent["moonshot"] }) {
  return (
    <section
      id={section.id}
      aria-labelledby={`${section.id}-heading`}
      className="relative overflow-hidden border-y border-amber-950/30 bg-[rgb(2_4_9)]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,rgb(212_175_55_/0.22),transparent_55%)]" aria-hidden />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_0%_50%,rgb(212_175_55_/0.08),transparent_42%)]" aria-hidden />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_100%_40%,rgb(30_58_95_/0.35),transparent_50%)]" aria-hidden />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgb(0_0_0_/0.75),transparent_55%)]" aria-hidden />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-amber-950/[0.06] to-[rgb(0_0_0_/0.35)]" aria-hidden />

      <OrbitalNetworkVisual className="pointer-events-none absolute left-1/2 top-[8%] w-[min(120%,1100px)] -translate-x-1/2 opacity-[0.85] sm:top-[6%]" />

      <div className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32 md:py-40">
        <FadeIn>
          <SectionHeading
            id={`${section.id}-heading`}
            eyebrow={section.storyEyebrow}
            title={section.headline}
            description={section.subtext}
          />

          <ul className="relative mt-14 grid list-none grid-cols-1 gap-4 sm:mt-16 sm:grid-cols-2 sm:gap-5 lg:mt-20 xl:grid-cols-3" role="list">
            {section.predictions.map((card, index) => (
              <PredictionCard key={card.headline} card={card} index={index} />
            ))}
          </ul>

          <ClosingStatementBlock closing={section.closing} />
        </FadeIn>
      </div>
    </section>
  );
}
