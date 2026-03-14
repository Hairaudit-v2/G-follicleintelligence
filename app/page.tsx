import Link from "next/link";

import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";
import {
  Activity,
  Building2,
  ChartColumnIncreasing,
  Cpu,
  Landmark,
  Layers,
  Microscope,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";

const PLATFORM_PILLARS = [
  {
    icon: Layers,
    title: "Clinical Evidence Structuring",
    desc: "Convert operative photos, case documentation, and follow-up data into auditable structured records.",
  },
  {
    icon: ChartColumnIncreasing,
    title: "Benchmark Intelligence",
    desc: "Compare practitioner, clinic, and group-level outcomes against configurable benchmark bands.",
  },
  {
    icon: Activity,
    title: "Quality Improvement Signals",
    desc: "Identify blind spots, weak points, and training opportunities from longitudinal case cohorts.",
  },
  {
    icon: ShieldCheck,
    title: "Governance and Trust Layers",
    desc: "Role controls, confidence indicators, and traceable evidence chains support institutional review.",
  },
];

const DEPLOYMENT_CARDS = [
  {
    title: "Enterprise Demo",
    desc: "Explore executive and clinical intelligence dashboards configured for enterprise workflows.",
    cta: "Book Enterprise Demo",
    href: "/contact?intent=demo",
  },
  {
    title: "White-Label Consultation",
    desc: "Design clinic, doctor, group, or institution-branded deployments with custom governance models.",
    cta: "Discuss White Label",
    href: "/contact?intent=white-label",
  },
  {
    title: "Strategic Partnership",
    desc: "Collaborate on specialty expansion, standards collaboration, and ecosystem integrations.",
    cta: "Start Partnership Conversation",
    href: "/contact?intent=partnership",
  },
  {
    title: "Institutional Interest",
    desc: "Assess implementation pathways for advisory boards, societies, and standards bodies.",
    cta: "Connect With Institutional Team",
    href: "/contact?intent=institution",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="fi-grid relative overflow-hidden border-b border-border/40">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_0%,hsl(var(--primary)/0.2),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_90%_30%,rgb(171_178_186_/_12%),transparent_45%)]" />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-20 md:grid-cols-12 md:py-24">
          <FadeIn className="md:col-span-7">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/90">
              Clinical Intelligence Infrastructure
            </p>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
              The intelligence layer for clinical auditing, benchmarking, and procedural quality
              improvement.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Follicle Intelligence transforms surgical evidence and case data into structured
              intelligence for clinics, groups, and institutions.
            </p>
            <p className="fi-trust mt-4 text-sm font-medium">
              HairAudit is the first application. Follicle Intelligence is the engine.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Button asChild size="lg">
                <Link href="/platform">Explore Platform</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/dashboard-demo">View Intelligence Layer</Link>
              </Button>
              <Button asChild variant="ghost" size="lg">
                <Link href="/hair-intelligence">Explore HairAudit</Link>
              </Button>
            </div>
          </FadeIn>

          <FadeIn delay={0.1} className="md:col-span-5">
            <div className="fi-panel rounded-2xl p-6">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                Intelligence Snapshot
              </p>
              <div className="mt-6 grid gap-4">
                {[
                  ["Audits Processed", "4,280"],
                  ["Benchmark Cohorts", "42"],
                  ["Confidence Index", "98.4%"],
                  ["Deployment Modes", "Private + Public"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded-lg border border-border/70 bg-background/60 px-4 py-3"
                  >
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <span className="text-sm font-semibold text-foreground">{value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-lg border border-primary/30 bg-primary/10 p-4">
                <p className="text-sm text-foreground">
                  White-label ready for clinics, groups, institutions, and multi-specialty enterprise
                  rollouts.
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      <Section>
        <FadeIn>
          <p className="text-xs uppercase tracking-[0.24em] text-primary/85">Core Platform</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
            Purpose-built for clinical auditing and benchmark intelligence.
          </h2>
        </FadeIn>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {PLATFORM_PILLARS.map((item, i) => (
            <FadeIn key={item.title} delay={0.08 * i}>
              <Card className="h-full border-border/70 bg-card/60 backdrop-blur-sm">
                <CardHeader>
                  <item.icon className="h-7 w-7 text-primary/85" />
                  <CardTitle className="text-xl">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">{item.desc}</CardDescription>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
      </Section>

      <Section className="border-y border-border/40 py-20">
        <div className="grid gap-12 md:grid-cols-12">
          <FadeIn className="md:col-span-5">
            <p className="text-xs uppercase tracking-[0.24em] text-primary/85">Architecture Layering</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              One engine. Multiple application surfaces.
            </h2>
            <p className="mt-5 text-muted-foreground">
              HairAudit is live first in hair restoration. The same intelligence architecture extends
              into cosmetic surgery, plastic surgery, regenerative medicine, dermatology, and dental
              aesthetics.
            </p>
          </FadeIn>
          <FadeIn delay={0.08} className="md:col-span-7">
            <div className="fi-panel rounded-2xl p-6">
              <div className="grid gap-4">
                {[
                  {
                    icon: Cpu,
                    label: "Follicle Intelligence Engine",
                    detail: "Data structuring, scoring, confidence modeling, benchmark computation",
                  },
                  {
                    icon: Microscope,
                    label: "HairAudit Application",
                    detail: "Live clinical auditing workflow for hair restoration outcomes",
                  },
                  {
                    icon: Workflow,
                    label: "White-Label Intelligence Surfaces",
                    detail: "Clinic, doctor, institution, and enterprise deployment templates",
                  },
                  {
                    icon: Sparkles,
                    label: "Future Specialty Expansion",
                    detail: "Modular specialty adapters for broader procedural medicine",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg border border-border/70 bg-background/65 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="h-5 w-5 text-primary/85" />
                      <h3 className="text-sm font-semibold text-foreground">{item.label}</h3>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </Section>

      <Section>
        <FadeIn>
          <p className="text-xs uppercase tracking-[0.24em] text-primary/85">Who It Serves</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Built for practitioners, groups, and standards-led institutions.
          </h2>
        </FadeIn>
        <div className="mt-10 grid gap-6 md:grid-cols-4">
          {[
            { icon: Building2, title: "Clinic Networks", desc: "Cross-site benchmark visibility." },
            { icon: Landmark, title: "Institutions", desc: "Standards-aligned governance and trust." },
            {
              icon: ChartColumnIncreasing,
              title: "Enterprise Operators",
              desc: "Portfolio-level quality intelligence.",
            },
            { icon: Microscope, title: "Hair Specialists", desc: "Evidence-based audit feedback loops." },
          ].map((item, i) => (
            <FadeIn key={item.title} delay={0.06 * i}>
              <Card className="border-border/70 bg-card/60">
                <CardHeader>
                  <item.icon className="h-6 w-6 text-primary/85" />
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{item.desc}</CardDescription>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
      </Section>

      <section className="border-t border-border/40 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <div className="fi-panel rounded-2xl p-8 md:p-12">
              <p className="text-xs uppercase tracking-[0.24em] text-primary/85">Conversion Paths</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                Engage by objective.
              </h2>
              <div className="mt-8 grid gap-5 md:grid-cols-2">
                {DEPLOYMENT_CARDS.map((item) => (
                  <div key={item.title} className="rounded-lg border border-border/70 bg-background/60 p-5">
                    <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{item.desc}</p>
                    <Button asChild variant="outline" className="mt-4">
                      <Link href={item.href}>{item.cta}</Link>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      <section className="pb-20">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <div className="rounded-2xl border border-border/50 bg-card/55 p-8 md:p-10">
              <p className="fi-trust text-xs uppercase tracking-[0.24em]">Institutional Credibility</p>
              <p className="mt-3 max-w-4xl text-lg text-muted-foreground">
                Designed with standards-led governance and aligned with IIHR clinical quality
                frameworks to support trust at practitioner, clinic, and institutional scale.
              </p>
              <div className="mt-6 flex flex-wrap gap-4">
                <Button asChild>
                  <Link href="/iihr">View Standards Alignment</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/contact?intent=institution">Speak With Advisory Team</Link>
                </Button>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>
    </>
  );
}
