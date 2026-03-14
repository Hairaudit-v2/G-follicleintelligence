import { FadeIn } from "@/components/ui/fade-in";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";
import { Lock, Shield, FileCheck, Server } from "lucide-react";

const SECURITY_ITEMS = [
  {
    icon: Lock,
    title: "Encryption",
    desc: "Data at rest and in transit. AES-256. TLS 1.3. No plaintext storage of PHI.",
  },
  {
    icon: Shield,
    title: "Access control",
    desc: "Role-based access. Audit logs for all access. MFA support. Session management.",
  },
  {
    icon: FileCheck,
    title: "Compliance",
    desc: "HIPAA-aligned controls. SOC 2 Type II optional. BAA available for healthcare partners.",
  },
  {
    icon: Server,
    title: "Infrastructure",
    desc: "Isolated compute. Secure storage. Regular penetration testing. Incident response.",
  },
];

export default function SecurityPage() {
  return (
    <>
      <PageHero
        eyebrow="Security"
        title="Enterprise-grade protection"
        subtitle="Healthcare data requires the highest standards. We build for compliance and trust."
      />
      <Section>
        <div className="grid gap-8 md:grid-cols-2">
          {SECURITY_ITEMS.map((item, i) => (
            <FadeIn key={item.title} delay={i * 0.1}>
              <Card className="border-border/50 bg-card/50">
                <CardHeader>
                  <item.icon className="h-10 w-10 text-primary/80" />
                  <CardTitle className="text-xl">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">{item.desc}</CardDescription>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
      </Section>
    </>
  );
}
