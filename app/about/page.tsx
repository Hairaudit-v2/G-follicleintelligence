import type { Metadata } from "next";
import Link from "next/link";

import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";

export const metadata: Metadata = {
  title: "About Follicle Intelligence | Mission, Intent & Infrastructure",
  description:
    "Why Follicle Intelligence exists: accountable quality infrastructure for hair restoration—transparency, benchmarks, governance, and standards across HairAudit, HLI, and IIOHR. Mission, ecosystem intent, and long-term direction.",
};

function SectionIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/90">{eyebrow}</p>
      <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{title}</h2>
      {description ? (
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">{description}</p>
      ) : null}
    </div>
  );
}

const PRINCIPLES = [
  "Quality that cannot be compared cannot be improved at industry scale.",
  "Transparency without structure becomes noise; accountability without benchmarks becomes politics.",
  "Serious operators deserve infrastructure that survives diligence—not dashboards that collapse under review.",
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title="We build the layer that makes quality legible."
        subtitle="Follicle Intelligence exists to raise the standard of evidence in global hair restoration: what was done, how it compares, and how improvement is governed—not what a campaign claims. We are not a clinic brand chasing volume; we are builders of infrastructure for transparency, accountability, and professional standards—so the best operators can be recognized for the right reasons."
      />

      <Section>
        <div className="max-w-3xl space-y-14 md:space-y-16">
          <FadeIn>
            <SectionIntro
              eyebrow="Why we exist"
              title="Because reputation and reality have been too easy to confuse."
              description="Patients, payers, and peers are asked to judge hair restoration quality without shared, defensible measures. Marketing fills the gap. Follicle Intelligence exists to narrow that gap: structured audit intelligence, cohort-relative standing, and governance-grade reporting—so accountability attaches to evidence, not to whoever tells the loudest story."
            />
          </FadeIn>

          <FadeIn delay={0.06}>
            <SectionIntro
              eyebrow="The problem we started from"
              title="Fragmented excellence in a global, narrative-driven market."
              description="The trigger was not a single product idea—it was a structural failure: surgical outcomes, biological follow-up, and professional standards lived in disconnected workflows. Without a shared intelligence layer, institutions could not align training, benchmarks, and public trust. Point tools score cases; they do not coordinate how an industry proves quality. FI was conceived to solve that coordination problem at infrastructure depth."
            />
            <ul className="mt-6 space-y-3 border-l-2 border-primary/25 pl-5 text-sm leading-relaxed text-muted-foreground md:text-base">
              <li>Technical quality varies widely under the same commercial language.</li>
              <li>Comparison is difficult for patients and painful for serious operators competing on merit.</li>
              <li>Standards exist, but visibility of who meets them—consistently and reviewably—is weak.</li>
            </ul>
          </FadeIn>

          <FadeIn delay={0.12}>
            <SectionIntro
              eyebrow="Why the ecosystem had to be connected"
              title="One architecture for surgery, biology, and standards."
              description="Hair restoration is not only a procedure snapshot. Longitudinal biology and professional methodology are part of the full quality story—yet they rarely sat in one technical system. A connected ecosystem was necessary so Follicle Intelligence could learn across:"
            />
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                {
                  name: "HairAudit",
                  line: "Surgical evidence and audit surface—where transplant work becomes scored and comparable.",
                },
                {
                  name: "Hair Longevity Institute",
                  line: "Biology and longitudinal treatment intelligence—where response over time matters as much as day-one photos.",
                },
                {
                  name: "IIOHR",
                  line: "Methodology, training, and governance alignment—where improvement becomes legitimate inside the profession.",
                },
              ].map((item) => (
                <div
                  key={item.name}
                  className="rounded-[1.25rem] border border-border/70 bg-card/45 p-5"
                >
                  <p className="text-sm font-semibold text-foreground">{item.name}</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.line}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
              Siloed tools would recreate the same fragmentation. FI is the central layer where those streams compound—benchmarks sharpen, review depth grows, and institutional programs become implementable.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="https://hairaudit.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
              >
                HairAudit
              </Link>
              <span className="text-muted-foreground">·</span>
              <Link
                href="https://hairlongevityinstitute.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
              >
                Hair Longevity Institute
              </Link>
              <span className="text-muted-foreground">·</span>
              <Link
                href="https://iiohr.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
              >
                IIOHR
              </Link>
            </div>
          </FadeIn>

          <FadeIn delay={0.18}>
            <div className="fi-panel rounded-[1.5rem] p-7 md:p-9">
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-primary/90">Long-term mission</p>
              <p className="mt-5 text-lg font-medium leading-relaxed text-foreground md:text-xl">
                Make accountable quality the default expectation in hair restoration—and extend the same
                disciplined infrastructure to adjacent procedural medicine only when evidence and methodology
                justify it.
              </p>
              <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
                We measure success by whether operators, institutions, and partners can run quality programs
                that hold up to scrutiny: benchmarks that deepen over time, governance that leaves a trace, and
                standards that translate into training—not slogans. Hair is the live wedge; the mission is
                broader, but the expansion bar stays high.
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={0.22}>
            <SectionIntro
              eyebrow="What we believe"
              title="Principles that guide product and partnership."
            />
            <ul className="mt-6 space-y-4">
              {PRINCIPLES.map((p) => (
                <li
                  key={p}
                  className="flex gap-3 text-sm leading-relaxed text-muted-foreground md:text-base"
                >
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" aria-hidden />
                  {p}
                </li>
              ))}
            </ul>
          </FadeIn>

          <FadeIn delay={0.26}>
            <SectionIntro
              eyebrow="What we build"
              title="Infrastructure partners run—not a side business with a dashboard."
              description="Structured scoring, cohort benchmarks, governance queues, and reporting surfaces for enterprise deployment, white-label programs, and institutional adoption. We do not compete with our customers for patients; we equip them to prove and improve quality at scale."
            />
          </FadeIn>

          <FadeIn delay={0.3}>
            <div className="rounded-[1.35rem] border border-border/60 bg-card/40 p-6 md:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Intent & diligence
              </p>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Follicle Intelligence was organized around a specific market failure and a specific class of
                solution—infrastructure for evidence-led quality, not opportunistic software. We are deliberate
                about scope, methodology alignment, and how we engage institutions and strategic partners.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                We do not use this page as a biography. Investors, boards, and enterprise buyers who need
                background on leadership, governance, and company history can obtain appropriate materials
                through procurement and partnership channels—we treat that conversation with the same rigor we
                ask of clinical quality.
              </p>
              <div className="mt-6 flex flex-wrap gap-4">
                <Button asChild variant="outline" className="rounded-xl">
                  <Link href="/contact?intent=partnership">Strategic & investor conversations</Link>
                </Button>
                <Button asChild variant="ghost" className="rounded-xl">
                  <Link href="/security">Security & trust</Link>
                </Button>
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={0.34}>
            <SectionIntro
              eyebrow="Roadmap"
              title="Discipline over expansion noise."
              description="Hair restoration remains the focus that builds proprietary depth. Adjacent categories enter the roadmap only when audit-shaped workflows and methodology alignment match—never to chase a slide-deck TAM."
            />
            <div className="mt-8 flex flex-wrap gap-4">
              <Button asChild className="rounded-xl">
                <Link href="/future-verticals">Future verticals</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/platform">Platform</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/contact?intent=demo">Talk to us</Link>
              </Button>
            </div>
          </FadeIn>
        </div>
      </Section>
    </>
  );
}
