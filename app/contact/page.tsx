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
    "Reach the Follicle Intelligence team for enterprise demos, white-label programs, security review, and standards-aligned institutional conversations.",
};

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Start with the problem you are trying to solve."
        subtitle="Whether you operate clinics, deploy platforms, set professional standards, or invest in healthcare infrastructure—we route conversations to the right team. Follicle Intelligence is the central layer for benchmarked quality across HairAudit, HLI, and IIOHR-connected programs; tell us your governance and integration context."
      />
      <Section>
        <div className="grid gap-8 md:grid-cols-2">
          <FadeIn>
            <Card className="border-border/50 bg-card/50">
              <CardContent className="pt-6">
                <Mail className="h-10 w-10 text-primary/80" />
                <h3 className="mt-4 text-lg font-semibold text-foreground">General and product</h3>
                <p className="mt-2 text-muted-foreground">
                  Platform access, onboarding, methodology questions, and non-commercial enquiries.
                </p>
                <Button asChild variant="outline" className="mt-6">
                  <a href="mailto:hello@follicleintelligence.ai">hello@follicleintelligence.ai</a>
                </Button>
              </CardContent>
            </Card>
          </FadeIn>
          <FadeIn delay={0.1}>
            <Card className="border-border/50 bg-card/50">
              <CardContent className="pt-6">
                <MessageSquare className="h-10 w-10 text-primary/80" />
                <h3 className="mt-4 text-lg font-semibold text-foreground">Commercial and partnerships</h3>
                <p className="mt-2 text-muted-foreground">
                  Licensing, volume programs, white-label, co-development, and strategic alignment.
                </p>
                <Button asChild variant="outline" className="mt-6">
                  <a href="mailto:sales@follicleintelligence.ai">sales@follicleintelligence.ai</a>
                </Button>
              </CardContent>
            </Card>
          </FadeIn>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {[
            {
              icon: Building2,
              title: "Enterprise demo",
              copy: "Walk through the platform: benchmarks, governance queues, and deployment options for your scale.",
              email: "sales@follicleintelligence.ai?subject=Enterprise%20Demo%20Request",
            },
            {
              icon: ShieldCheck,
              title: "White-label program",
              copy: "Scope branded audit and benchmark infrastructure for groups, institutions, or platforms.",
              email: "sales@follicleintelligence.ai?subject=White-Label%20Consultation",
            },
            {
              icon: Handshake,
              title: "Strategic partnership",
              copy: "Discuss data flywheel depth, specialty expansion, and long-term infrastructure alignment.",
              email: "sales@follicleintelligence.ai?subject=Strategic%20Partnership",
            },
            {
              icon: MessageSquare,
              title: "Institutional and standards",
              copy: "IIOHR-aligned methodology, advisory engagement, and quality programs at association scale.",
              email: "hello@follicleintelligence.ai?subject=Institutional%20Interest",
            },
          ].map((item) => (
            <FadeIn key={item.title}>
              <Card className="border-border/50 bg-card/50">
                <CardContent className="pt-6">
                  <item.icon className="h-5 w-5 text-primary/85" />
                  <h3 className="mt-3 text-base font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{item.copy}</p>
                  <Button asChild variant="ghost" className="mt-3 px-0 text-primary hover:text-primary">
                    <a href={`mailto:${item.email}`}>Email this thread</a>
                  </Button>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
        <FadeIn delay={0.1}>
          <p className="mt-10 text-sm text-muted-foreground">
            Security and procurement: start with{" "}
            <Link href="/security" className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary">
              security overview
            </Link>
            , then request detailed materials through your review channel.
          </p>
        </FadeIn>
        <EcosystemMention className="mt-10 border-t border-border/50 pt-6" />
      </Section>
    </>
  );
}
