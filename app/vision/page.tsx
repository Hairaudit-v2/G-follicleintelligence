import type { Metadata } from "next";
import Link from "next/link";

import { PartnersInvestorsStrip } from "@/components/marketing/PartnersInvestorsStrip";
import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";
import { FadeIn } from "@/components/ui/fade-in";
import { VisionShowcaseSection } from "@/components/vision/VisionShowcaseSection";
import { PUBLIC_IMAGES } from "@/src/lib/brand/publicImages";
import { cn } from "@/lib/utils";

const OG_IMAGE = PUBLIC_IMAGES.appleTouchIcon;

export const metadata: Metadata = {
  title: "Vision | Follicle Intelligence",
  description:
    "Follicle Intelligence is building the connected intelligence infrastructure for the future of hair restoration medicine.",
  openGraph: {
    title: "Vision | Follicle Intelligence",
    description:
      "Follicle Intelligence is building the connected intelligence infrastructure for the future of hair restoration medicine.",
    type: "website",
    images: [
      {
        url: OG_IMAGE.src,
        width: OG_IMAGE.width,
        height: OG_IMAGE.height,
        alt: "Follicle Intelligence — vision for hair restoration infrastructure",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vision | Follicle Intelligence",
    description:
      "Follicle Intelligence is building the connected intelligence infrastructure for the future of hair restoration medicine.",
    images: [OG_IMAGE.src],
  },
};

const ECOSYSTEM = [
  {
    name: "HairAudit",
    line: "Independent outcome intelligence, surgical transparency, case review, and measurable patient results.",
    href: "https://hairaudit.com",
  },
  {
    name: "Hair Longevity Institute",
    line: "Advanced diagnostics, treatment planning, hair loss analysis, and patient longevity intelligence.",
    href: "https://hairlongevityinstitute.com",
  },
  {
    name: "International Institute of Hair Restoration",
    line: "Professional education, certification, competency development, and industry standards.",
    href: "https://iiohr.com",
  },
  {
    name: "FI OS",
    line: "The operating system connecting clinics, patients, workflows, surgical data, outcomes, training, and business intelligence.",
    href: "/platform",
  },
] as const;

export default function VisionPage() {
  return (
    <>
      <PageHero
        eyebrow="Vision"
        title="The Future of Hair Restoration Medicine"
        body={
          <div className="space-y-5">
            <p>
              Hair restoration medicine has evolved into a global healthcare category serving millions of patients every
              year.
            </p>
            <p>Yet the infrastructure supporting the industry has not evolved with it.</p>
            <p>
              There is no unified intelligence system connecting diagnostics, patient outcomes, clinical operations,
              professional training, and accountability.
            </p>
            <p className="font-medium text-foreground">
              We believe the future of this industry depends on building that infrastructure.
            </p>
            <p className="font-medium text-foreground">That is why Follicle Intelligence exists.</p>
            <p className="pt-1 text-muted-foreground">
              Follicle Intelligence is building the connected intelligence infrastructure for hair restoration medicine.
            </p>
          </div>
        }
      />

      <VisionShowcaseSection />

      <Section
        className="py-24 sm:py-28 md:py-32"
        aria-labelledby="vision-ecosystem-heading"
      >
        <div className="mx-auto max-w-4xl text-center">
          <FadeIn>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary/90">Ecosystem</p>
            <h2
              id="vision-ecosystem-heading"
              className="mt-5 font-display text-3xl font-semibold tracking-tight text-foreground text-balance sm:text-4xl md:text-[2.75rem] md:leading-[1.1]"
            >
              Building the Connected Intelligence Network
            </h2>
          </FadeIn>
        </div>

        <FadeIn delay={0.08} className="mt-14 sm:mt-16">
          <ul className="mx-auto grid max-w-6xl list-none grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-7 lg:gap-8">
            {ECOSYSTEM.map((item) => (
              <li key={item.name}>
                <article
                  className={cn(
                    "flex h-full flex-col rounded-[1.35rem] border border-border/60 bg-card/35 p-7 sm:p-8",
                    "shadow-[0_20px_56px_rgb(0_0_0_/0.35),inset_0_1px_0_rgb(255_255_255_/0.04)]",
                    "transition-[border-color,box-shadow,transform] duration-500 hover:-translate-y-0.5 hover:border-amber-400/18 hover:shadow-[0_28px_72px_rgb(0_0_0_/0.42)]"
                  )}
                >
                  <h3 className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                    {item.href.startsWith("http") ? (
                      <Link
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline decoration-primary/35 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary/55"
                      >
                        {item.name}
                      </Link>
                    ) : (
                      <Link
                        href={item.href}
                        className="underline decoration-primary/35 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary/55"
                      >
                        {item.name}
                      </Link>
                    )}
                  </h3>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base sm:leading-relaxed">
                    {item.line}
                  </p>
                </article>
              </li>
            ))}
          </ul>
        </FadeIn>
      </Section>

      <Section
        className={cn(
          "border-y border-white/[0.06] py-24 sm:py-28 md:py-32",
          "bg-[linear-gradient(180deg,rgb(4_6_11)_0%,rgb(6_9_15)_50%,rgb(4_6_11)_100%)]"
        )}
        aria-labelledby="vision-not-software-heading"
      >
        <div className="mx-auto max-w-3xl">
          <FadeIn>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-200/72">Position</p>
            <h2
              id="vision-not-software-heading"
              className="mt-5 font-display text-3xl font-semibold tracking-tight text-foreground text-balance sm:text-4xl md:text-[2.75rem] md:leading-[1.12]"
            >
              We Are Not Building Software
            </h2>
            <div className="mt-8 space-y-6 text-base leading-relaxed text-muted-foreground sm:text-lg md:leading-relaxed">
              <p>We are building the infrastructure layer for the future of hair restoration medicine.</p>
              <p>
                A connected intelligence system designed to improve clinical decision making, patient outcomes, surgical
                accountability, professional education, clinic operations, and long-term industry standards.
              </p>
              <p className="font-medium text-foreground/95">The future will belong to connected healthcare systems.</p>
              <p className="font-medium text-foreground/95">Hair restoration medicine deserves one of its own.</p>
            </div>
          </FadeIn>
        </div>
      </Section>

      <Section className="py-24 sm:py-28 md:py-32" aria-labelledby="vision-future-connected-heading">
        <div className="mx-auto max-w-3xl">
          <FadeIn>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary/90">Direction</p>
            <h2
              id="vision-future-connected-heading"
              className="mt-5 font-display text-3xl font-semibold tracking-tight text-foreground text-balance sm:text-4xl md:text-[2.75rem] md:leading-[1.12]"
            >
              The Future Is Connected Intelligence
            </h2>
            <div className="mt-10 space-y-5 text-base leading-relaxed text-muted-foreground sm:text-lg md:leading-relaxed">
              <p className="font-medium text-foreground/90">Imagine a world where every patient journey contributes to improving the next.</p>
              <ul className="space-y-4 border-l-2 border-primary/20 pl-6">
                <li>Where diagnostics improve treatment decisions.</li>
                <li>Where surgical performance becomes measurable.</li>
                <li>Where patient outcomes become transparent.</li>
                <li>Where education is connected directly to real-world competency.</li>
                <li>Where an entire medical industry learns from itself.</li>
              </ul>
              <p className="pt-4 font-medium text-foreground">This is the future we are building.</p>
            </div>
          </FadeIn>
        </div>
      </Section>

      <PartnersInvestorsStrip />
    </>
  );
}
