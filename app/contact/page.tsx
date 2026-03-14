import { FadeIn } from "@/components/ui/fade-in";
import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Handshake, Mail, MessageSquare, ShieldCheck } from "lucide-react";

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Book a strategic conversation"
        subtitle="Enterprise demos, white-label consultations, strategic partnerships, and institutional engagement."
      />
      <Section>
        <div className="grid gap-8 md:grid-cols-2">
          <FadeIn>
            <Card className="border-border/50 bg-card/50">
              <CardContent className="pt-6">
                <Mail className="h-10 w-10 text-primary/80" />
                <h3 className="mt-4 text-lg font-semibold text-foreground">General enquiries</h3>
                <p className="mt-2 text-muted-foreground">
                  For platform access, enterprise demos, and technical onboarding.
                </p>
                <Button asChild variant="outline" className="mt-6">
                  <a href="mailto:hello@follicleintelligence.com">hello@follicleintelligence.com</a>
                </Button>
              </CardContent>
            </Card>
          </FadeIn>
          <FadeIn delay={0.1}>
            <Card className="border-border/50 bg-card/50">
              <CardContent className="pt-6">
                <MessageSquare className="h-10 w-10 text-primary/80" />
                <h3 className="mt-4 text-lg font-semibold text-foreground">Sales and partnerships</h3>
                <p className="mt-2 text-muted-foreground">
                  Discuss white-label deployments, volume licensing, and strategic partnerships.
                </p>
                <Button asChild variant="outline" className="mt-6">
                  <a href="mailto:sales@follicleintelligence.com">sales@follicleintelligence.com</a>
                </Button>
              </CardContent>
            </Card>
          </FadeIn>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {[
            {
              icon: Building2,
              title: "Enterprise Demo",
              copy: "Evaluate full platform intelligence and deployment pathways.",
              email: "sales@follicleintelligence.com?subject=Enterprise%20Demo%20Request",
            },
            {
              icon: ShieldCheck,
              title: "White-Label Consultation",
              copy: "Plan branded deployments for clinics, groups, or institutions.",
              email: "sales@follicleintelligence.com?subject=White-Label%20Consultation",
            },
            {
              icon: Handshake,
              title: "Strategic Partnership",
              copy: "Explore co-development and future specialty collaboration.",
              email: "sales@follicleintelligence.com?subject=Strategic%20Partnership",
            },
            {
              icon: MessageSquare,
              title: "Institutional Interest",
              copy: "Discuss IIHR-aligned standards and advisory pathways.",
              email: "hello@follicleintelligence.com?subject=Institutional%20Interest",
            },
          ].map((item) => (
            <FadeIn key={item.title}>
              <Card className="border-border/50 bg-card/50">
                <CardContent className="pt-6">
                  <item.icon className="h-5 w-5 text-primary/85" />
                  <h3 className="mt-3 text-base font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{item.copy}</p>
                  <Button asChild variant="ghost" className="mt-3 px-0 text-primary hover:text-primary">
                    <a href={`mailto:${item.email}`}>Start conversation</a>
                  </Button>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
      </Section>
    </>
  );
}
