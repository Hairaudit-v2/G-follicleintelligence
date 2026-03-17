import Link from "next/link";

import type { Metadata } from "next";

import { EcosystemMention } from "@/components/ecosystem/EcosystemMention";
import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";
import {
  BarChart3,
  Eye,
  Gauge,
  Layers3,
  LineChart,
  ScanSearch,
  ShieldCheck,
  Target,
} from "lucide-react";

export const metadata: Metadata = {
  title: "AI Hair Transplant Analysis: The Future of Surgical Evaluation | Follicle Intelligence",
  description:
    "How AI hair transplant analysis improves consistency, transparency, and outcomes. Density, donor management, graft survival, design logic. Structured surgical evaluation for clinics and institutions.",
};

export default function AIHairTransplantAnalysisPage() {
  return (
    <>
      <PageHero
        eyebrow="Pillar"
        title="AI Hair Transplant Analysis: The Future of Surgical Evaluation"
        subtitle="Structured, evidence-based evaluation of hair restoration outcomes is becoming the standard. Here is how AI-driven analysis supports consistency, transparency, and continuous improvement in surgical practice."
      />

      <Section>
        <FadeIn>
          <p className="text-xs uppercase tracking-[0.22em] text-primary/85">Overview</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            What is hair transplant analysis?
          </h2>
          <p className="mt-6 max-w-4xl text-lg leading-relaxed text-muted-foreground">
            Hair transplant analysis is the systematic assessment of procedural evidence and outcomes
            in hair restoration surgery. It covers the full arc of a case: pre-operative planning,
            intra-operative technique (extraction, handling, implantation), and post-operative
            results over time. The goal is to turn raw evidence—images, notes, follow-up
            documentation—into structured, comparable insights that support quality assurance,
            training, and patient-centred care.
          </p>
          <p className="mt-4 max-w-4xl leading-relaxed text-muted-foreground">
            In practice, analysis has historically relied on expert review: experienced
            clinicians or panels assess cases using implicit criteria and narrative feedback. That
            approach has value but does not scale, and it rarely produces consistent, benchmarkable
            scores across reviewers or institutions. Today, AI-supported analysis does not
            replace clinical judgment; it structures evidence, normalises dimensions (density,
            donor management, design, survival signals), and attaches confidence levels so that
            human reviewers and quality programmes can focus on what matters.
          </p>
        </FadeIn>
      </Section>

      <Section className="border-y border-border/40">
        <FadeIn>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Why traditional evaluation is inconsistent
          </h2>
          <p className="mt-6 max-w-4xl leading-relaxed text-muted-foreground">
            Conventional evaluation of hair transplant outcomes suffers from three main issues:
            subjectivity, lack of standardised dimensions, and limited visibility across time and
            cohorts. Different reviewers may emphasise different aspects—donor appearance, hairline
            design, density in the recipient zone—without a shared taxonomy. Scoring, when it
            exists, is often ad hoc or confined to a single clinic, making it hard to compare
            performance across practitioners or to track improvement over time.
          </p>
          <p className="mt-4 max-w-4xl leading-relaxed text-muted-foreground">
            In addition, evidence is frequently unstructured. Photographs and notes are stored in
            silos; follow-up intervals and documentation quality vary. Without a consistent
            evidence model, even well-intentioned audits struggle to produce defensible,
            repeatable assessments. That inconsistency undermines trust—among peers, institutions,
            and patients—and makes it difficult to use evaluation as a lever for training and
            quality improvement.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Gauge,
                title: "Subjectivity",
                desc: "Reviewer-dependent criteria and narrative feedback that do not map to a common scale or taxonomy.",
              },
              {
                icon: Layers3,
                title: "Fragmented evidence",
                desc: "Images, notes, and follow-up data in disparate formats and systems, with no standardised structure.",
              },
              {
                icon: LineChart,
                title: "Limited comparability",
                desc: "Little ability to benchmark across practitioners, clinics, or time without shared definitions.",
              },
            ].map((item, i) => (
              <FadeIn key={item.title} delay={0.06 * i}>
                <Card className="h-full border-border/70 bg-card/60">
                  <CardHeader>
                    <item.icon className="h-6 w-6 text-primary/85" />
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm leading-relaxed">{item.desc}</CardDescription>
                  </CardContent>
                </Card>
              </FadeIn>
            ))}
          </div>
        </FadeIn>
      </Section>

      <Section>
        <FadeIn>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            How AI-based analysis improves consistency and visibility
          </h2>
          <p className="mt-6 max-w-4xl leading-relaxed text-muted-foreground">
            AI-supported hair transplant analysis does two things: it structures evidence into
            machine-readable dimensions, and it applies consistent scoring and confidence logic
            across cases. Images and associated metadata are ingested into a pipeline that
            extracts signals—density proxies, donor patterns, design alignment, quality
            indicators—and normalises them against defined schemas. Those signals feed into
            domain-level scores (e.g. donor management, extraction quality, implantation quality,
            design, post-operative protocol) that can be compared across cases and over time.
          </p>
          <p className="mt-4 max-w-4xl leading-relaxed text-muted-foreground">
            Consistency comes from fixed rules and weights: the same evidence type produces the
            same structural output, and scores are computed the same way for every case. Visibility
            comes from dashboards and reports that surface domain scores, benchmarks (e.g. against
            peer cohorts or internal baselines), and confidence indicators so that clinicians and
            quality leads can see where performance sits and where improvement opportunities lie.
            The result is not autonomous decision-making—it is a structured intelligence layer that
            supports human review, training, and governance.
          </p>
          <div className="mt-10 rounded-2xl border border-border/60 bg-card/60 p-8 md:p-10">
            <p className="text-xs uppercase tracking-[0.22em] text-primary/85">
              Evidence in, intelligence out
            </p>
            <p className="mt-4 max-w-4xl text-muted-foreground">
              Systems built on this approach—such as{" "}
              <Link
                href="https://hairaudit.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
              >
                HairAudit
              </Link>
              , which runs on the Follicle Intelligence engine—deliver audit scorecards, benchmark
              positioning, and training-oriented signals so that clinics and institutions can
              improve outcomes without sacrificing clinical judgment.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <Button asChild>
                <Link href="/hair-intelligence">Explore Hair Intelligence</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/methodology">View Methodology</Link>
              </Button>
            </div>
          </div>
        </FadeIn>
      </Section>

      <Section className="border-y border-border/40">
        <FadeIn>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Metrics that matter
          </h2>
          <p className="mt-6 max-w-4xl leading-relaxed text-muted-foreground">
            Effective hair transplant analysis rests on a clear set of dimensions that reflect
            what clinicians and quality programmes care about. These are not invented for the sake
            of automation; they align with established concepts in hair restoration—donor
            management, extraction and implantation quality, design logic, and follow-up
            outcomes—expressed in a way that can be consistently measured and scored.
          </p>
          <div className="mt-10 space-y-8">
            {[
              {
                icon: ScanSearch,
                title: "Density and distribution",
                desc: "Recipient-zone density, coverage uniformity, and alignment with planned design. Signals can be derived from imagery and structured for comparison across cases and time.",
              },
              {
                icon: ShieldCheck,
                title: "Donor management",
                desc: "Donor area preservation, extraction pattern, and long-term sustainability. Poor donor management is a leading cause of avoidable complications; structured assessment helps identify risk and improvement opportunities.",
              },
              {
                icon: BarChart3,
                title: "Graft survival and growth patterns",
                desc: "Follow-up evidence analysed for survival rates, growth consistency, and alignment with expectations. Longitudinal analysis supports outcome transparency and training feedback.",
              },
              {
                icon: Target,
                title: "Design logic",
                desc: "Hairline design, temporal peaks, and overall aesthetic coherence relative to plan and best practice. Design logic is often assessed subjectively; structuring it allows comparison and clearer feedback.",
              },
              {
                icon: Eye,
                title: "Extraction and implantation quality",
                desc: "Graft handling, transection proxies, and implantation technique indicators where evidence allows. These dimensions feed into overall case quality and risk stratification.",
              },
            ].map((item, i) => (
              <FadeIn key={item.title} delay={0.05 * i}>
                <div className="flex gap-4 rounded-xl border border-border/60 bg-card/50 p-6">
                  <item.icon className="h-8 w-8 shrink-0 text-primary/85" />
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </FadeIn>
      </Section>

      <Section>
        <FadeIn>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            How this connects to surgical transparency
          </h2>
          <p className="mt-6 max-w-4xl leading-relaxed text-muted-foreground">
            Transparency in hair restoration means that outcomes and quality can be understood,
            compared, and improved in a structured way. AI-based analysis supports that by making
            evaluation consistent and visible: domain-level scores, benchmarks, and confidence
            indicators give clinicians and institutions a shared language. When scores are tied to
            evidence and methodology—and when the methodology is aligned with standards such as
            those promoted by{" "}
            <Link
              href="https://iiohr.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
            >
              IIOHR
            </Link>
            —evaluation becomes defensible and usable for training, governance, and patient
            communication.
          </p>
          <p className="mt-4 max-w-4xl leading-relaxed text-muted-foreground">
            Transparency does not mean publishing raw case data; it means having a clear, repeatable
            way to assess quality and to demonstrate improvement. Practices that adopt structured
            analysis can show trajectory over time, compare themselves to peer cohorts where
            appropriate, and use outlier detection to prioritise review and learning. That
            posture supports both internal quality programmes and the broader move toward
            outcome-focused, evidence-based care in procedural medicine.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Button asChild variant="outline">
              <Link
                href="https://iiohr.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                Learn about IIOHR standards
              </Link>
            </Button>
          </div>
        </FadeIn>
      </Section>

      <Section className="border-y border-border/40">
        <FadeIn>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Connection to the wider ecosystem
          </h2>
          <p className="mt-6 max-w-4xl leading-relaxed text-muted-foreground">
            AI hair transplant analysis does not sit in isolation. It fits into a broader
            surgical intelligence ecosystem that spans audit and scoring, biological and
            treatment-pathway insight, and training and certification. Follicle Intelligence
            provides the core engine—the methodology, scoring logic, and infrastructure—that powers
            applications and partners across that ecosystem.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <Card className="border-border/70 bg-card/60">
              <CardHeader>
                <CardTitle className="text-base">Surgical audit and scoring</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-relaxed">
                  <Link
                    href="https://hairaudit.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
                  >
                    HairAudit
                  </Link>{" "}
                  is the first production application built on this engine. It delivers
                  case-level audit scorecards, benchmark positioning, and quality signals for hair
                  restoration—exactly the kind of structured evaluation this page describes.
                </CardDescription>
                <Button asChild variant="outline" size="sm" className="mt-4">
                  <Link
                    href="https://hairaudit.com"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Visit HairAudit
                  </Link>
                </Button>
              </CardContent>
            </Card>
            <Card className="border-border/70 bg-card/60">
              <CardHeader>
                <CardTitle className="text-base">Biology and treatment pathways</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-relaxed">
                  <Link
                    href="https://hairlongevityinstitute.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
                  >
                    Hair Longevity Institute
                  </Link>{" "}
                  focuses on diagnosis, biology, and treatment pathways. Analysis of surgical
                  outcomes can complement biological and medical insights to support
                  patient-centred care across the full pathway.
                </CardDescription>
                <Button asChild variant="outline" size="sm" className="mt-4">
                  <Link
                    href="https://hairlongevityinstitute.com"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Visit Hair Longevity Institute
                  </Link>
                </Button>
              </CardContent>
            </Card>
            <Card className="border-border/70 bg-card/60">
              <CardHeader>
                <CardTitle className="text-base">Training and certification</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-relaxed">
                  <Link
                    href="https://iiohr.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
                  >
                    IIOHR
                  </Link>{" "}
                  provides training and certification frameworks. The methodology underlying
                  AI-based analysis is aligned with IIOHR advisory and standards, so that audit
                  outputs support institutional and training use cases.
                </CardDescription>
                <Button asChild variant="outline" size="sm" className="mt-4">
                  <Link
                    href="https://iiohr.com"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Visit IIOHR
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </FadeIn>
      </Section>

      <Section>
        <FadeIn>
          <div className="fi-panel rounded-2xl p-8 md:p-10">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Next steps
            </h2>
            <p className="mt-4 max-w-3xl text-muted-foreground">
              If you are a clinic, group, or institution interested in structured hair transplant
              analysis and audit intelligence, we can walk you through the platform, methodology, and
              how it connects to HairAudit, Hair Longevity Institute, and IIOHR.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button asChild>
                <Link href="/contact?intent=demo">Request a demo</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/platform">View platform overview</Link>
              </Button>
            </div>
            <EcosystemMention className="mt-8 pt-6 border-t border-border/50" />
          </div>
        </FadeIn>
      </Section>
    </>
  );
}
