import Link from "next/link";

import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";
import { Building2, Landmark, Network, UserCog } from "lucide-react";

export default function SolutionsPage() {
  return (
    <>
      <PageHero
        eyebrow="Solutions"
        title="Solutions aligned to operational and institutional needs."
        subtitle="From independent clinics to enterprise operators, Follicle Intelligence adapts to each governance and quality strategy."
      />
      <Section>
        <div className="grid gap-6 md:grid-cols-2">
          {[
            {
              icon: UserCog,
              title: "Doctor-Led Practices",
              desc: "Structured practitioner insights with confidence indicators and training intelligence.",
            },
            {
              icon: Building2,
              title: "Clinic Groups",
              desc: "Network-wide benchmarking and quality standardization across locations.",
            },
            {
              icon: Network,
              title: "Enterprise Operators",
              desc: "Portfolio-level intelligence with deployment controls and governance layers.",
            },
            {
              icon: Landmark,
              title: "Institutional Bodies",
              desc: "Standards-aligned audit frameworks for quality assurance programs.",
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
        <FadeIn delay={0.2}>
          <div className="mt-10 flex flex-wrap gap-4">
            <Button asChild>
              <Link href="/contact?intent=demo">Book Enterprise Demo</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/contact?intent=white-label">Discuss White Label</Link>
            </Button>
          </div>
        </FadeIn>
      </Section>
    </>
  );
}
