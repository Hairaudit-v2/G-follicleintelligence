import Link from "next/link";
import type { Metadata } from "next";

import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";
import {
  ArrowRight,
  BarChart3,
  Heart,
  Megaphone,
  Microscope,
  Scale,
  ScanSearch,
  Shield,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

export const metadata: Metadata = {
  title: "HairAudit & Hair Restoration: Why Hair Is the Category Wedge | Follicle Intelligence",
  description:
    "Hair restoration is the ideal launch category for benchmarked audit intelligence: high stakes, uneven quality, and narrative-heavy markets. HairAudit is the first live FI application—proof in production, deepened by HLI and IIOHR.",
};

function SectionIntro({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/90">{eyebrow}</p>
      <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground md:text-4xl">{title}</h2>
      {description ? (
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">{description}</p>
      ) : null}
    </div>
  );
}

const WHY_HAIR_FIRST = [
  {
    icon: Heart,
    title: "High emotional and financial stakes",
    text: "Patients commit money, time, and identity to outcomes that are visible and permanent. When quality is uneven, harm is not only clinical—it is reputational and psychological. Markets this consequential demand accountability mechanisms stronger than testimonials.",
  },
  {
    icon: BarChart3,
    title: "Variable technique quality under a single label",
    text: "“Hair transplant” hides enormous technical variation. Without structured evidence and cohort context, excellence and mediocrity can sit behind the same marketing vocabulary. That gap is exactly what audit intelligence and benchmarks are built to expose.",
  },
  {
    icon: Users,
    title: "Patients cannot compare what clinics will not make comparable",
    text: "Before-and-after galleries and star ratings do not substitute for comparable technical assessment. When comparison is hard, narratives fill the void—precisely why transparency needs a shared yardstick, not louder claims.",
  },
  {
    icon: Megaphone,
    title: "Heavy reliance on marketing narratives",
    text: "The category is crowded with promises that outrun verifiable evidence. Institutions and serious operators need a path to truth that survives scrutiny: scored where evidence allows, benchmarked where cohorts exist, governed where claims attach to review.",
  },
  {
    icon: Scale,
    title: "Fragmented standards visibility",
    text: "Professional standards exist, but public visibility of who meets them is weak. Connecting surgical evidence (HairAudit), methodology (IIOHR), and longitudinal biology (HLI) in one architecture makes standards-led improvement operational—not a poster on a wall.",
  },
];

const CAPABILITIES = [
  {
    icon: ScanSearch,
    title: "Surgical evidence, structured",
    desc: "Case-level review with domain scoring and confidence—so technical quality is comparable across operators, not only narrated.",
  },
  {
    icon: TrendingUp,
    title: "Benchmark standing",
    desc: "Visibility against configured cohorts and baselines: where you lead, where you match peers, and where governance should intervene.",
  },
  {
    icon: Target,
    title: "Training-aligned signals",
    desc: "Improvement tied to weak domains and recurring patterns—aligned with standards-led development, not generic coaching tips.",
  },
  {
    icon: Microscope,
    title: "Review-ready outputs",
    desc: "Structured intelligence for internal quality, leadership review, and selective external disclosure—appropriate to a high-stakes category.",
  },
];

const PRODUCTION_PROOF = [
  {
    title: "Real case evidence, not synthetic demos",
    body: "HairAudit ingests the artefacts of live transplant workflows. FI scores against evidence that actually exists in practice—incomplete charts, uneven photography, real-world variance—so the engine is tested where marketing claims are not.",
  },
  {
    title: "Cohort and benchmark depth that only production traffic builds",
    body: "Standing relative to peers requires denominators and definitions that accumulate over time. Every serious operator that runs on HairAudit increases the defensibility of the benchmark layer—not a one-off model score.",
  },
  {
    title: "Governance paths that match how quality is actually reviewed",
    body: "Queues, escalation, and separation between internal and cleared reporting are exercised under real liability pressure. That is how FI proves it is infrastructure, not a slide deck.",
  },
];

const ECOSYSTEM_DEEPEN = [
  {
    title: "Hair Longevity Institute (HLI)",
    body: "Restoration is not only a single procedure—biology, medication, and longitudinal response matter. HLI connects longitudinal treatment intelligence into the same FI substrate so “quality” is not frozen at discharge. It deepens the hair story for integrated clinics and networks that sell outcomes over years, not a single surgery date.",
  },
  {
    title: "IIOHR",
    body: "Methodology, training, and governance alignment turn scores into professional credibility. IIOHR is the institutional frame that makes remediation and credentialing legitimate—so HairAudit’s audit signal can route into training and standards programs that institutions will run, not just read.",
  },
];

export default function HairIntelligencePage() {
  return (
    <>
      <PageHero
        eyebrow="HairAudit · Follicle Intelligence"
        title="Hair restoration is the right category to prove benchmarked audit intelligence."
        subtitle="Follicle Intelligence is the central intelligence layer. HairAudit is the first live application—where transplant evidence becomes scored, benchmarked, and reviewable. It is not an arbitrary first market: hair restoration combines high stakes, uneven technical quality, and narrative-heavy competition, which makes the need for transparency, accountability, and standards unusually acute. That is why hair is the wedge."
      />

      <Section>
        <FadeIn>
          <SectionIntro
            eyebrow="Strategic case"
            title="Why hair first—not a placeholder vertical."
            description="A launch category should stress-test the engine: evidence complexity, buyer urgency, and willingness to pay for credibility. Hair restoration clears that bar. It is global, cash-pay, reputation-sensitive, and plagued by incomparable marketing—exactly where audit intelligence and benchmarks earn their keep."
          />
        </FadeIn>
      </Section>

      <Section className="border-t border-border/50 pt-12 md:pt-14">
        <FadeIn>
          <SectionIntro
            eyebrow="Why hair restoration"
            title="Why this specialty is especially suited to audit intelligence."
            description="The same dynamics that frustrate patients and serious operators are the conditions under which FI adds structural value: when stories outrun evidence, and when standards are hard to see in public."
          />
        </FadeIn>
        <div className="mt-10 space-y-6">
          {WHY_HAIR_FIRST.map((item, i) => (
            <FadeIn key={item.title} delay={0.05 * i}>
              <div className="rounded-[1.35rem] border border-border/70 bg-card/45 p-6 md:flex md:gap-6 md:p-8">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                  <item.icon className="h-6 w-6 text-primary/85" aria-hidden />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </Section>

      <Section className="border-t border-border/50 pt-12 md:pt-14">
        <FadeIn>
          <SectionIntro
            eyebrow="HairAudit"
            title="What the application delivers."
            description="HairAudit is the surgical audit surface: domain-level evidence, scoring, and benchmarking—powered by Follicle Intelligence. It is the front door for transplant quality; FI is what learns across the network."
          />
        </FadeIn>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {CAPABILITIES.map((item, i) => (
            <FadeIn key={item.title} delay={0.08 * i}>
              <Card className="h-full border-border/70 bg-card/60">
                <CardHeader>
                  <item.icon className="h-6 w-6 text-primary/85" />
                  <CardTitle>{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">{item.desc}</CardDescription>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
      </Section>

      <Section className="border-t border-border/50 pt-12 md:pt-14">
        <FadeIn>
          <SectionIntro
            eyebrow="Production proof"
            title="How HairAudit proves the Follicle Intelligence engine in the real world."
            description="A benchmark that only works on curated data is not category infrastructure. HairAudit exists to run under production conditions—messy evidence, real cohorts, and governance pressure—so FI’s value is demonstrated where it matters."
          />
        </FadeIn>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {PRODUCTION_PROOF.map((item, i) => (
            <FadeIn key={item.title} delay={0.06 * i}>
              <div className="h-full rounded-[1.35rem] border border-border/70 bg-card/40 p-6 md:p-7">
                <Shield className="h-5 w-5 text-primary/85" aria-hidden />
                <h3 className="mt-4 text-base font-semibold text-foreground">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </Section>

      <Section className="border-t border-border/50 pt-12 md:pt-14">
        <FadeIn>
          <SectionIntro
            eyebrow="Ecosystem depth"
            title="How HLI and IIOHR deepen the hair advantage."
            description="HairAudit alone addresses surgical evidence. The full hair ecosystem adds biology over time and professional methodology—both feed Follicle Intelligence and make the category harder to copy from a single-surface competitor."
          />
        </FadeIn>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {ECOSYSTEM_DEEPEN.map((item, i) => (
            <FadeIn key={item.title} delay={0.06 * i}>
              <div className="h-full rounded-[1.35rem] border border-border/70 bg-background/55 p-6 md:p-8">
                <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            </FadeIn>
          ))}
        </div>
        <FadeIn delay={0.12} className="mt-8">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Positioning:</span> HairAudit = surgical evidence and audit
            surface. Follicle Intelligence = central intelligence layer.{" "}
            <Link
              href="https://hairlongevityinstitute.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
            >
              HLI
            </Link>{" "}
            and{" "}
            <Link
              href="https://iiohr.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
            >
              IIOHR
            </Link>{" "}
            are the surfaces that connect biology and standards into the same learning system—without replacing
            your operational tools of record.
          </p>
        </FadeIn>
      </Section>

      <Section className="border-t border-border/50 pt-12 md:pt-14">
        <FadeIn>
          <div className="fi-panel rounded-[1.75rem] p-8 md:p-10">
            <SectionIntro
              eyebrow="Beyond hair"
              title="Disciplined expansion—when the evidence pattern matches."
              description="The FI architecture is built for procedural categories where structured evidence, cohort benchmarks, and governance matter. Hair is the live wedge because the need is acute and the proof surface is in production. Expansion is not a land grab: new verticals are added when methodology and evidence models justify the same discipline—not when a slide deck needs a new TAM."
            />
            <div className="mt-8 flex flex-wrap gap-4">
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/future-verticals">
                  How expansion is gated
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="ghost" className="rounded-xl">
                <Link href="/platform">Platform architecture</Link>
              </Button>
            </div>
          </div>
        </FadeIn>
      </Section>

      <Section className="pb-16 md:pb-20">
        <FadeIn>
          <div className="rounded-[1.5rem] border border-border/70 bg-card/40 p-8 md:p-10">
            <h2 className="text-xl font-semibold text-foreground md:text-2xl">Next steps</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              See the command layer in the{" "}
              <Link href="/dashboard-demo" className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary">
                dashboard walkthrough
              </Link>
              , or read the{" "}
              <Link href="/ai-hair-transplant-analysis" className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary">
                clinical evaluation pillar
              </Link>{" "}
              for a longer treatment of audit and evidence in hair transplant care.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button asChild className="rounded-xl">
                <Link href="/contact?intent=demo">Request HairAudit demo</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/contact?intent=demo">Talk to FI about enterprise deployment</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/dashboard-demo">View intelligence layer</Link>
              </Button>
            </div>
          </div>
        </FadeIn>
      </Section>
    </>
  );
}
