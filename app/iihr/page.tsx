import Link from "next/link";

import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";
import { BadgeCheck, Landmark, ShieldCheck, Users } from "lucide-react";

export default function IIHRPage() {
  return (
    <>
      <PageHero
        eyebrow="IIHR / Standards / Advisory"
        title="Built with institutional trust in mind."
        subtitle="Follicle Intelligence is designed to align with standards-led clinical quality frameworks, including collaboration paths with IIHR advisory structures."
      />
      <Section>
        <div className="grid gap-6 md:grid-cols-2">
          {[
            {
              icon: Landmark,
              title: "Standards Alignment",
              desc: "Audit logic and intelligence outputs are structured for standards-informed interpretation.",
            },
            {
              icon: ShieldCheck,
              title: "Quality Assurance Framework",
              desc: "Confidence indicators and evidence traceability support independent quality review.",
            },
            {
              icon: Users,
              title: "Advisory Collaboration",
              desc: "Designed for participation with advisory panels and institutional partners.",
            },
            {
              icon: BadgeCheck,
              title: "Trust Positioning",
              desc: "Institutional-grade positioning beyond consumer health or generic software narratives.",
            },
          ].map((item, i) => (
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
        <FadeIn delay={0.16}>
          <div className="mt-10 rounded-xl border border-border/60 bg-card/55 p-6">
            <p className="fi-trust text-xs uppercase tracking-[0.22em]">Institutional Engagement</p>
            <p className="mt-3 text-muted-foreground">
              For advisory involvement, standards mapping discussions, and institutional implementation
              pathways, connect with the Follicle Intelligence institutional team.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <Button asChild>
                <Link href="/contact?intent=institution">Contact Institutional Team</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/methodology">Review Methodology</Link>
              </Button>
            </div>
          </div>
        </FadeIn>
      </Section>
    </>
  );
}
