import { FadeIn } from "@/components/ui/fade-in";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";
import { Building2, FlaskConical, Stethoscope, Users } from "lucide-react";

const USE_CASES = [
  {
    icon: Building2,
    title: "Trichology clinics",
    desc: "Structured diagnostic workflows. Pre-consult scoring. Standardised reports for specialists.",
  },
  {
    icon: FlaskConical,
    title: "Labs and diagnostics",
    desc: "Automated lab report parsing. Marker normalisation. Integration with LIS and reporting systems.",
  },
  {
    icon: Stethoscope,
    title: "Telehealth providers",
    desc: "Remote assessment support. Image + blood combined scoring. Patient-facing report generation.",
  },
  {
    icon: Users,
    title: "Clinical research",
    desc: "Cohort analysis. Score aggregation. De-identified data exports for studies.",
  },
];

export default function UseCasesPage() {
  return (
    <>
      <PageHero
        eyebrow="Use cases"
        title="Where Follicle Intelligence fits"
        subtitle="Clinics, labs, telehealth, and research. Scalable infrastructure for precision trichology."
      />
      <Section>
        <div className="grid gap-8 md:grid-cols-2">
          {USE_CASES.map((item, i) => (
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
