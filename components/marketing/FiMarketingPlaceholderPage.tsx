import Link from "next/link";

import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";
import {
  MARKETING_CTA_PRIMARY_CLASS,
  MARKETING_CTA_SECONDARY_CLASS,
} from "@/lib/marketing/marketingCtaClasses";
import { cn } from "@/lib/utils";
import { ArrowRight, ChevronRight } from "lucide-react";

export type FiMarketingComingNextCard = {
  title: string;
  body: string;
};

const DEFAULT_COMING_NEXT: FiMarketingComingNextCard[] = [
  {
    title: "Narrative & proof architecture",
    body: "Long-form story, diagrams, and diligence-ready proof points—shipping incrementally without breaking the URL you share today.",
  },
  {
    title: "Deeper module mapping",
    body: "How this audience plugs into LeadFlowOS through AnalyticsOS with governance, training, and audit posture made explicit.",
  },
  {
    title: "Deployment & procurement guidance",
    body: "What enterprise buyers ask first: data boundaries, integrations, review workflows, and how rollout risk is managed.",
  },
];

export interface FiMarketingPlaceholderPageProps {
  eyebrow?: string;
  headline: string;
  description?: string;
  /** When true, primary CTA is mailto; otherwise links to /contact with intent. */
  variant?: "default" | "demo";
  /** Three “coming next” cards; defaults to a generic enterprise-grade set. */
  comingNext?: readonly FiMarketingComingNextCard[];
  className?: string;
}

function ComingNextCard({ title, body }: FiMarketingComingNextCard) {
  return (
    <div className="group relative h-full overflow-hidden rounded-[1.25rem] border border-white/[0.08] bg-gradient-to-br from-white/[0.07] via-white/[0.02] to-transparent p-6 shadow-[0_16px_48px_rgb(0_0_0_/0.32),inset_0_1px_0_rgb(255_255_255_/0.05)] transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-amber-400/22">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/25 to-transparent opacity-80"
      />
      <p className="text-sm font-semibold tracking-tight text-foreground">{title}</p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

export function FiMarketingPlaceholderPage({
  eyebrow = "Follicle Intelligence",
  headline,
  description,
  variant = "default",
  comingNext,
  className,
}: FiMarketingPlaceholderPageProps) {
  const isDemo = variant === "demo";
  const cards = comingNext?.length ? comingNext.slice(0, 3) : DEFAULT_COMING_NEXT;

  return (
    <div className={cn(className)}>
      <section className="fi-grid relative overflow-hidden border-b border-border/50">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_12%_-5%,rgb(212_175_55_/0.14),transparent_48%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_92%_8%,hsl(var(--primary)/0.16),transparent_44%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgb(0_0_0_/0.45),transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgb(212_175_55_/0.05),transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-background/90" />

        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 md:py-28">
          <FadeIn>
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-amber-200/90 sm:text-[11px]">
              {eyebrow}
            </p>
            <div
              className="mt-3 h-px w-14 bg-gradient-to-r from-amber-300/70 via-amber-400/25 to-transparent"
              aria-hidden
            />
            <h1 className="mt-6 max-w-4xl font-display text-3xl font-semibold leading-[1.12] tracking-tight text-foreground text-balance sm:text-4xl md:text-5xl">
              {headline}
            </h1>
            {description ? (
              <p className="mt-6 max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                {description}
              </p>
            ) : null}

            <div className="mt-10 flex w-full max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:flex-wrap sm:gap-4">
              {isDemo ? (
                <>
                  <Button
                    asChild
                    size="lg"
                    className={cn(MARKETING_CTA_PRIMARY_CLASS, "min-w-[12rem]")}
                  >
                    <Link href="mailto:hello@follicleintelligence.ai?subject=Enterprise%20demo%20request">
                      Email hello@follicleintelligence.ai
                      <ArrowRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className={cn(MARKETING_CTA_SECONDARY_CLASS, "min-w-[12rem]")}
                  >
                    <Link href="/contact?intent=demo">
                      Contact form
                      <ChevronRight className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    asChild
                    size="lg"
                    className={cn(MARKETING_CTA_PRIMARY_CLASS, "min-w-[12rem]")}
                  >
                    <Link href="/platform">
                      Explore The Platform
                      <ArrowRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className={cn(MARKETING_CTA_SECONDARY_CLASS, "min-w-[12rem]")}
                  >
                    <Link href="/demo">
                      Book Enterprise Demo
                      <ChevronRight className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </FadeIn>
        </div>
      </section>

      <Section className="border-b border-border/50 bg-muted/[0.03] py-16 sm:py-20 md:py-24">
        <FadeIn>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-amber-200/75">
                Roadmap preview
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                Coming next on this page
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
                This route is intentional architecture for the rebuilt public story—so your link
                stays stable while the narrative deepens.
              </p>
            </div>
          </div>
          <ul className="mt-10 grid gap-5 md:grid-cols-3">
            {cards.map((card) => (
              <li key={card.title}>
                <ComingNextCard title={card.title} body={card.body} />
              </li>
            ))}
          </ul>
        </FadeIn>
      </Section>

      <Section className="py-16 sm:py-20 md:py-24">
        <FadeIn>
          <div className="relative overflow-hidden rounded-[1.5rem] border border-amber-400/15 bg-gradient-to-br from-[rgb(10_14_22_/0.9)] via-[rgb(7_11_18_/0.88)] to-[rgb(4_7_12_/0.95)] p-8 shadow-[0_24px_80px_rgb(0_0_0_/0.4),inset_0_1px_0_rgb(255_255_255_/0.05)] md:p-10">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgb(212_175_55_/0.1),transparent_50%)]"
            />
            <div className="relative flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-200/80">
                  Continue exploring
                </p>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
                  See how the full operating system connects commercial, clinical, surgical,
                  training, audit, and intelligence layers—or book a conversation scoped to your
                  organisation.
                </p>
              </div>
              <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row md:w-auto md:max-w-none">
                <Button asChild size="lg" className={MARKETING_CTA_PRIMARY_CLASS}>
                  <Link href="/platform">
                    Explore The Platform
                    <ArrowRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className={MARKETING_CTA_SECONDARY_CLASS}
                >
                  <Link href="/demo">
                    Book Enterprise Demo
                    <ChevronRight className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </FadeIn>
      </Section>
    </div>
  );
}
