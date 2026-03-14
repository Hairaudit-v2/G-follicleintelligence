import Link from "next/link";

import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";
import { BadgeCheck, Building2, Hospital, Shield, UserRound } from "lucide-react";

const WHITE_LABEL_MODELS = [
  {
    icon: UserRound,
    title: "Doctor-Branded Deployments",
    desc: "Individual practitioner analytics surfaces with custom benchmark groups and private reporting.",
  },
  {
    icon: Building2,
    title: "Clinic and Group Rollouts",
    desc: "Multi-site brand systems with shared governance and cross-location benchmarking intelligence.",
  },
  {
    icon: Hospital,
    title: "Institutional Implementations",
    desc: "Standards-led audit environments for advisory panels, programs, and quality oversight teams.",
  },
  {
    icon: Shield,
    title: "Enterprise Governance Controls",
    desc: "Role architecture, regional partitioning, and deployment control for global operators.",
  },
];

export default function WhiteLabelPage() {
  return (
    <>
      <PageHero
        eyebrow="White Label"
        title="White-label intelligence software built for clinical organizations."
        subtitle="Deploy Follicle Intelligence under your brand, governance model, and operating structure without compromising analytical depth."
      />
      <Section>
        <FadeIn>
          <p className="text-xs uppercase tracking-[0.24em] text-primary/85">Deployment Models</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Configurable from practitioner-level to enterprise-level.
          </h2>
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
            <p className="text-xs uppercase tracking-[0.24em] text-primary/85">White-Label Stack</p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {[
                "Brand identity controls: logos, nomenclature, and report templates",
                "Deployment scope controls: clinic-only, group-wide, or institution-wide",
                "Governance overlays: reviewer paths, approvals, and quality escalation",
                "Security overlays: region-specific hosting, permissions, and data boundaries",
                "Analytics overlays: cohort definitions and benchmark rule sets",
                "Commercial overlays: private tenant operation with contractual SLA support",
              ].map((item) => (
                <div key={item} className="rounded-lg border border-border/70 bg-background/60 p-4">
                  <div className="flex items-start gap-3">
                    <BadgeCheck className="mt-0.5 h-4 w-4 text-primary/85" />
                    <p className="text-sm text-muted-foreground">{item}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button asChild>
                <Link href="/contact?intent=white-label">Book White-Label Consultation</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/platform">Review Platform Architecture</Link>
              </Button>
            </div>
          </div>
        </FadeIn>
      </Section>
    </>
  );
}
