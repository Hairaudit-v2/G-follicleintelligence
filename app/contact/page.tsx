import type { Metadata } from "next";
import Link from "next/link";

import { EcosystemMention } from "@/components/ecosystem/EcosystemMention";
import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";
import { Building2, Handshake, Mail, MessageSquare, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact: Demos, Partnership & Institutional Engagement | Follicle Intelligence",
  description:
    "Who should contact Follicle Intelligence, what happens next, and how to reach the team—demos, partnerships, institutional programs, security review, and standards-aligned conversations.",
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

const WHO_SHOULD = [
  {
    title: "Clinics and clinical groups",
    body: "You run or oversee HairAudit-aligned audit programs, quality rhythms, or governance workflows and need a clear view of benchmarks, deployment fit, and onboarding—not a generic product tour.",
  },
  {
    title: "Institutions and standards bodies",
    body: "You represent associations, training programs, or multi-site quality initiatives where methodology, credibility, and IIOHR-aligned framing matter as much as software.",
  },
  {
    title: "Platforms and strategic partners",
    body: "You embed intelligence in an existing stack, pursue white-label or volume licensing, or want to align roadmap and data flywheel depth before committing integration work.",
  },
];

const WHAT_NEXT = [
  {
    step: "1",
    title: "Your message is received",
    body: "We read context—role, organization, region, and what you are trying to decide—so the first reply is useful, not a form letter.",
  },
  {
    step: "2",
    title: "Routing to the right conversation",
    body: "General and methodological questions stay with product-aligned correspondence; commercial, demo, and partnership requests go to the path that can scope deployment, licensing, and timelines.",
  },
  {
    step: "3",
    title: "A purposeful next step",
    body: "That may be a short discovery call, answers in writing, or—when appropriate—introduction to security and procurement materials. We do not push volume; we align depth to your stage.",
  },
];

const PRIMARY_PATHS = [
  {
    icon: Mail,
    title: "General and product",
    value:
      "Best when you need orientation on the platform, methodology, or onboarding—and want a direct line without a commercial thread unless you ask for one.",
    body: "Platform access, onboarding, methodology questions, and non-commercial enquiries.",
    href: "mailto:hello@follicleintelligence.ai",
    cta: "Write to hello@follicleintelligence.ai",
  },
  {
    icon: MessageSquare,
    title: "Commercial and partnerships",
    value:
      "Best when licensing, volume, white-label, or partnership economics are already on the table—or you know you need a scoped commercial conversation.",
    body: "Licensing, volume programs, white-label, co-development, and strategic alignment.",
    href: "mailto:sales@follicleintelligence.ai",
    cta: "Write to sales@follicleintelligence.ai",
  },
];

const INTENT_PATHS = [
  {
    icon: Building2,
    title: "Enterprise demo",
    value: "See how benchmarks, governance queues, and tenant configuration behave at a scale that matches your organization—not a scripted walkthrough.",
    copy: "Walk through the platform: benchmarks, governance queues, and deployment options for your scale.",
    email: "sales@follicleintelligence.ai?subject=Enterprise%20Demo%20Request",
  },
  {
    icon: ShieldCheck,
    title: "White-label program",
    value: "Understand how FI sits behind your brand, what you own in UX, and how integration and support align before you commit build time.",
    copy: "Scope branded audit and benchmark infrastructure for groups, institutions, or platforms.",
    email: "sales@follicleintelligence.ai?subject=White-Label%20Consultation",
  },
  {
    icon: Handshake,
    title: "Strategic partnership",
    value: "Explore long-term alignment—category expansion, co-development, and how the intelligence layer fits your roadmap beyond a single integration.",
    copy: "Discuss data flywheel depth, specialty expansion, and long-term infrastructure alignment.",
    email: "sales@follicleintelligence.ai?subject=Strategic%20Partnership",
  },
  {
    icon: MessageSquare,
    title: "Institutional and standards",
    value: "Connect methodology, advisory, and quality programs when the question is institutional credibility and standards scale, not only a software seat.",
    copy: "IIOHR-aligned methodology, advisory engagement, and quality programs at association scale.",
    email: "hello@follicleintelligence.ai?subject=Institutional%20Interest",
  },
];

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="A clear next step—matched to how you work."
        subtitle="Follicle Intelligence serves clinics, institutions, and partners who need benchmarked quality infrastructure, not a generic inbox. Choose the channel that fits your question; we route with context so the reply moves you forward."
      />

      <Section>
        <FadeIn>
          <SectionIntro
            eyebrow="Fit"
            title="Who should contact Follicle Intelligence."
            description="If your work touches audit depth, professional standards, or platform-level integration, you are in the right place. If you are unsure, start with general correspondence—we will steer you without making you guess the org chart."
          />
        </FadeIn>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {WHO_SHOULD.map((item, i) => (
            <FadeIn key={item.title} delay={0.06 * i}>
              <div className="h-full rounded-[1.25rem] border border-border/70 bg-card/40 p-6">
                <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </Section>

      <Section className="border-t border-border/50 pt-8 md:pt-10">
        <FadeIn>
          <SectionIntro
            eyebrow="Channels"
            title="Primary correspondence."
            description="Two addresses cover most inbound: product-aligned questions versus commercial and partnership. The value line under each card clarifies when to use it."
          />
        </FadeIn>
        <div className="mt-10 grid gap-8 md:grid-cols-2">
          {PRIMARY_PATHS.map((path, i) => (
            <FadeIn key={path.title} delay={i * 0.08}>
              <Card className="border-border/50 bg-card/50">
                <CardContent className="pt-6">
                  <path.icon className="h-10 w-10 text-primary/80" />
                  <h3 className="mt-4 text-lg font-semibold text-foreground">{path.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{path.body}</p>
                  <p className="mt-4 border-l-2 border-primary/25 pl-4 text-sm leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foreground/90">Why this path: </span>
                    {path.value}
                  </p>
                  <Button asChild variant="outline" className="mt-6 rounded-xl">
                    <a href={path.href}>{path.cta}</a>
                  </Button>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
      </Section>

      <Section className="border-t border-border/50">
        <FadeIn>
          <SectionIntro
            eyebrow="Intent"
            title="Topic-specific routes."
            description="Each option opens email with a subject line that helps us respond in kind. Use the one closest to your decision—overlap is fine; we will consolidate."
          />
        </FadeIn>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {INTENT_PATHS.map((item, i) => (
            <FadeIn key={item.title} delay={0.05 * i}>
              <Card className="border-border/50 bg-card/50">
                <CardContent className="pt-6">
                  <item.icon className="h-5 w-5 text-primary/85" />
                  <h3 className="mt-3 text-base font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{item.copy}</p>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foreground/90">What you get: </span>
                    {item.value}
                  </p>
                  <Button asChild variant="ghost" className="mt-4 h-auto px-0 py-2 text-primary hover:text-primary">
                    <a href={`mailto:${item.email}`}>Open email — subject prefilled for routing</a>
                  </Button>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
      </Section>

      <Section className="border-t border-border/50">
        <FadeIn>
          <SectionIntro
            eyebrow="Process"
            title="What happens next."
            description="We optimize for clarity, not volume. Expect a response that respects the seriousness of clinical and institutional work—without a hard sell."
          />
        </FadeIn>
        <div className="mt-10 space-y-6">
          {WHAT_NEXT.map((item, i) => (
            <FadeIn key={item.step} delay={0.06 * i}>
              <div className="flex gap-5 rounded-[1.25rem] border border-border/60 bg-background/40 px-5 py-5 md:px-6 md:py-6">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 font-mono text-sm font-semibold text-primary"
                  aria-hidden
                >
                  {item.step}
                </span>
                <div>
                  <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </Section>

      <Section className="border-t border-border/50 pb-2">
        <FadeIn>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Security and procurement: </span>
            start with the{" "}
            <Link
              href="/security"
              className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
            >
              security overview
            </Link>
            , then request detailed materials through your vendor process—we respond in line with your review cycle.
          </p>
        </FadeIn>
        <EcosystemMention className="mt-10 border-t border-border/50 pt-6" />
      </Section>
    </>
  );
}
