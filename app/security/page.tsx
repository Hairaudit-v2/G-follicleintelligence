import type { Metadata } from "next";
import Link from "next/link";

import { EcosystemMention } from "@/components/ecosystem/EcosystemMention";
import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";
import { FileCheck, Lock, Server, Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "Security & Trust for Clinical Audit Data | Follicle Intelligence",
  description:
    "Security posture for sensitive procedural and health-related data: encryption, access control, logging, and infrastructure practices. Enterprise terms agreed per deployment.",
};

const SECURITY_ITEMS = [
  {
    icon: Lock,
    title: "Encryption",
    desc: "Data encrypted in transit (TLS) and at rest using industry-standard algorithms. Sensitive values are not stored in plaintext.",
  },
  {
    icon: Shield,
    title: "Access control",
    desc: "Role-based access, authenticated sessions, and audit logging designed for least-privilege operation in multi-tenant and enterprise deployments.",
  },
  {
    icon: FileCheck,
    title: "Compliance and contracting",
    desc: "We work with healthcare and enterprise customers on contractual requirements—including BAA and regional expectations where applicable. Current certifications and attestations are shared under NDA during procurement.",
  },
  {
    icon: Server,
    title: "Infrastructure and operations",
    desc: "Isolated environments, secure storage, monitoring, and incident response practices appropriate for sensitive clinical audit workloads.",
  },
];

export default function SecurityPage() {
  return (
    <>
      <PageHero
        eyebrow="Security"
        title="Trust is not a footer badge—it is how the system runs."
        subtitle="Audit and benchmark infrastructure handles sensitive evidence. Our posture emphasizes encryption, strict access boundaries, operational discipline, and clear contracting—so institutions can evaluate risk the same way they evaluate quality."
      />
      <Section>
        <FadeIn>
          <p className="mb-8 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            We do not claim certifications on this page that change by customer and region. For HIPAA, SOC 2,
            or other specific frameworks, request the latest documentation through your procurement or security
            review process—we provide evidence appropriate to the deployment model.
          </p>
        </FadeIn>
        <div className="grid gap-8 md:grid-cols-2">
          {SECURITY_ITEMS.map((item, i) => (
            <FadeIn key={item.title} delay={i * 0.1}>
              <Card className="border-border/50 bg-card/50">
                <CardHeader>
                  <item.icon className="h-10 w-10 text-primary/80" />
                  <CardTitle className="text-xl">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">{item.desc}</CardDescription>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
        <FadeIn delay={0.15}>
          <p className="mt-10 text-sm text-muted-foreground">
            Questions:{" "}
            <Link
              href="mailto:hello@follicleintelligence.ai?subject=Security%20review"
              className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
            >
              hello@follicleintelligence.ai
            </Link>
          </p>
        </FadeIn>
        <EcosystemMention className="mt-10 border-t border-border/50 pt-6" />
      </Section>
    </>
  );
}
