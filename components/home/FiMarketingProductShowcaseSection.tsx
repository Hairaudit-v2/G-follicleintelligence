import Image from "next/image";

import { Section } from "@/components/layout/section";
import { FadeIn } from "@/components/ui/fade-in";
import type { HomeProductShowcaseCard } from "@/lib/marketing/homePageContent";
import { cn } from "@/lib/utils";

import { ProductShowcaseShell } from "@/components/home/productShowcaseShells";

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
      {description ? (
        <p className="mt-5 max-w-3xl text-base leading-[1.65] text-muted-foreground sm:text-lg md:leading-relaxed">{description}</p>
      ) : null}
    </header>
  );
}

function BrowserProductFrame({ card, urlSlug }: { card: HomeProductShowcaseCard; urlSlug: string }) {
  const hasShot = Boolean(card.screenshotSrc);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[1.05rem] border border-white/[0.09] bg-[linear-gradient(180deg,rgb(12_16_24_/0.95),rgb(6_9_14_/0.92))] shadow-[0_22px_64px_rgb(0_0_0_/0.42),0_0_0_1px_rgb(212_175_55_/0.06)_inset,inset_0_1px_0_rgb(255_255_255_/0.05)] ring-1 ring-black/40 transition-[transform,box-shadow,border-color] duration-500 ease-out will-change-transform",
        "group-hover:-translate-y-1 group-hover:border-amber-400/22 group-hover:shadow-[0_32px_88px_rgb(0_0_0_/0.48),0_0_0_1px_rgb(212_175_55_/0.12)_inset,0_0_48px_rgb(212_175_55_/0.06)]"
      )}
    >
      <div
        className="flex items-center gap-2 border-b border-white/[0.07] bg-[rgb(8_11_18_/0.95)] px-2.5 py-2 sm:px-3 sm:py-2.5"
        aria-hidden
      >
        <div className="flex gap-1">
          <span className="h-2 w-2 rounded-full bg-[rgb(255_95_87_/0.55)] shadow-[0_0_12px_rgb(255_95_87_/0.25)]" />
          <span className="h-2 w-2 rounded-full bg-[rgb(255_189_46_/0.5)] shadow-[0_0_12px_rgb(255_189_46_/0.2)]" />
          <span className="h-2 w-2 rounded-full bg-[rgb(52_199_89_/0.45)] shadow-[0_0_12px_rgb(52_199_89_/0.2)]" />
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/[0.06] bg-black/35 px-2 py-1 shadow-[inset_0_1px_0_rgb(255_255_255_/0.04)]">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/35" />
          <span className="truncate font-mono text-[8px] font-medium text-white/40 sm:text-[9px]">
            <span className="text-white/55">fi</span>
            <span className="text-white/35">.clinical</span>
            <span className="text-white/55"> / {urlSlug}</span>
          </span>
        </div>
      </div>

      <div className="relative aspect-[16/10] w-full">
        {hasShot && card.screenshotSrc ? (
          <Image
            src={card.screenshotSrc}
            alt={`${card.name} product preview`}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="object-cover object-top"
            priority={false}
          />
        ) : (
          <div className="absolute inset-0 p-1 sm:p-1.5">
            <ProductShowcaseShell variant={card.shell} />
          </div>
        )}
      </div>
    </div>
  );
}

export function FiMarketingProductShowcaseSection({
  section,
}: {
  section: {
    id: string;
    storyEyebrow: string;
    headline: string;
    subtext: string;
    cards: readonly HomeProductShowcaseCard[];
  };
}) {
  return (
    <Section
      id={section.id}
      className="border-b border-border/50 bg-gradient-to-b from-background via-[rgb(6_9_14_/0.35)] to-background py-20 sm:py-24 md:py-28"
      aria-labelledby={`${section.id}-heading`}
    >
      <FadeIn>
        <SectionHeading
          id={`${section.id}-heading`}
          eyebrow={section.storyEyebrow}
          title={section.headline}
          description={section.subtext}
        />
        <ul className="mt-12 grid list-none grid-cols-1 gap-8 sm:mt-14 sm:gap-9 md:grid-cols-2 xl:grid-cols-3 xl:gap-10">
          {section.cards.map((card) => (
            <li key={card.id} className="min-w-0">
              <article
                className={cn(
                  "group relative flex h-full flex-col rounded-[1.35rem] border border-white/[0.07] bg-gradient-to-br from-white/[0.07] via-white/[0.025] to-[rgb(4_7_12_/0.55)] p-4 shadow-[0_20px_56px_rgb(0_0_0_/0.38),inset_0_1px_0_rgb(255_255_255_/0.06)] backdrop-blur-md sm:p-5",
                  "transition-[transform,border-color,box-shadow] duration-500 ease-out will-change-transform",
                  "hover:-translate-y-0.5 hover:border-amber-400/20 hover:shadow-[0_28px_80px_rgb(0_0_0_/0.45),0_0_40px_rgb(212_175_55_/0.05),inset_0_1px_0_rgb(255_255_255_/0.08)]"
                )}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-[1.35rem] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  style={{
                    background:
                      "radial-gradient(800px 240px at 50% 0%, rgb(212 175 55 / 0.07), transparent 55%)",
                  }}
                />
                <div className="relative">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-lg font-semibold tracking-tight text-foreground sm:text-xl">{card.name}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">{card.description}</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.18em] text-amber-200/55 sm:text-[9px]">
                      Live
                    </span>
                  </div>

                  <div className="mt-5">
                    <BrowserProductFrame card={card} urlSlug={card.id} />
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </FadeIn>
    </Section>
  );
}
