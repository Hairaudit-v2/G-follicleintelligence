import Link from "next/link";
import type { Metadata } from "next";

import { EcosystemMention } from "@/components/ecosystem/EcosystemMention";
import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";
import { BadgeCheck, Building2, Hospital, Shield, UserRound } from "lucide-react";

export const metadata: Metadata = {
  title: "White-Label: Branded Audit & Benchmark Infrastructure | Follicle Intelligence",
  description:
    "Deploy the central intelligence layer under your brand: governance, benchmarks, and reporting—with HairAudit, HLI, and IIOHR ecosystem depth behind the scenes.",
};

const WHITE_LABEL_MODELS = [
  {
    icon: UserRound,
    title: "Surgeon- and brand-led deployments",
    desc: "Benchmark and audit surfaces that carry your identity—with cohort logic and review workflows appropriate to individual or small-team practice.",
  },
  {
    icon: Building2,
    title: "Clinic and group rollouts",
    desc: "Multi-site systems with shared governance, cross-location standing, and portfolio visibility for operators who must show quality at scale.",
  },
  {
    icon: Hospital,
    title: "Institutional programs",
    desc: "Standards-aligned environments for advisory panels, training organizations, and quality oversight—methodology and review depth institutions expect.",
  },
  {
    icon: Shield,
    title: "Enterprise policy envelope",
    desc: "Roles, regional partitioning, and deployment boundaries so global operators can run one engine under differentiated governance.",
  },
];

export default function WhiteLabelPage() {
  return (
    <>
      <PageHero
        eyebrow="White-label"
        title="Your brand. Our intelligence backbone."
        subtitle="White-label is not cosmetic skinning—it is how serious operators deploy category infrastructure under their governance model. You keep brand and policy; Follicle Intelligence supplies scoring depth, benchmark logic, and ecosystem connectivity across HairAudit, HLI, and IIOHR-aligned standards."
      />
      <Section>
        <FadeIn>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/85">Deployment models</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            From single brand to global portfolio.
          </h2>
          <p className="mt-4 max-w-3xl text-muted-foreground leading-relaxed">
            Buyers get credible quality programs without building scoring science from scratch. Strategically,
            white-label deepens integration into customer workflows—the same compounding signal and
            defensibility story as direct FI adoption, embedded where enterprises already operate.
          </p>
        </FadeIn>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {WHITE_LABEL_MODELS.map((item, i) => (
            <FadeIn key={item.title} delay={0.08 * i}>
              <Card className="h-full border-border/70 bg-card/60">
                <CardHeader>
                  <item.icon className="h-6 w-6 text-primary/85" />
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

      <Section className="border-y border-border/40">
        <FadeIn>
          <div className="fi-panel rounded-2xl p-8 md:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/85">Configurable stack</p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {[
                "Brand identity: logos, nomenclature, report templates",
                "Scope: clinic-only, group-wide, or institution-wide programs",
                "Governance: reviewer paths, approvals, escalation",
                "Security and data boundaries: permissions and regional deployment options",
                "Analytics: cohort definitions and benchmark rule sets",
                "Commercial: tenant operation with contractual support as agreed",
              ].map((item) => (
                <div key={item} className="rounded-lg border border-border/70 bg-background/60 p-4">
                  <div className="flex items-start gap-3">
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary/85" />
                    <p className="text-sm text-muted-foreground">{item}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-8 text-sm leading-relaxed text-muted-foreground">
              Specific security, compliance, and hosting terms are agreed with enterprise customers; see{" "}
              <Link href="/security" className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary">
                security
              </Link>{" "}
              for our posture overview and{" "}
              <Link href="/licensing" className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary">
                licensing
              </Link>{" "}
              for deployment tiers.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button asChild>
                <Link href="/contact?intent=white-label">Book white-label consultation</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/platform">Platform architecture</Link>
              </Button>
            </div>
            <EcosystemMention className="mt-8 border-t border-border/50 pt-6" />
          </div>
        </FadeIn>
      </Section>
    </>
  );
}
