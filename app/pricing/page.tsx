import { EcosystemMention } from "@/components/ecosystem/EcosystemMention";
import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";
import { JsonLd } from "@/components/seo/json-ld";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";
import { SITE_URL } from "@/lib/seo/constants";
import { buildPageMetadata } from "@/lib/seo/page-metadata";
import { buildFAQPageSchema, PRICING_PAGE_FAQS } from "@/lib/structured-data";
import { Building2, CheckCircle2, Globe2, Stethoscope } from "lucide-react";

export const metadata = buildPageMetadata({
  title: "Enterprise Pricing | Follicle Intelligence",
  description:
    "Modular enterprise pricing for hair restoration clinics—scoped to clinic size, modules, integrations, and deployment pathway. No fixed tiers; request a tailored quote.",
  path: "/pricing",
});

function SectionIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/90">{eyebrow}</p>
      <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{title}</h2>
      {description ? (
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">{description}</p>
      ) : null}
    </div>
  );
}

const PRICING_REQUEST_HREF = "mailto:sales@follicleintelligence.ai?subject=Enterprise%20Pricing%20Request";
const BOOK_DEMO_HREF = "mailto:sales@follicleintelligence.ai?subject=Enterprise%20Demo%20Request";

const PLAN_CARDS = [
  {
    icon: Building2,
    title: "Core Clinic Platform",
    description: "For clinics ready to centralise CRM, scheduling, patient records and consultations.",
  },
  {
    icon: Stethoscope,
    title: "Surgical Intelligence",
    description:
      "For clinics that want structured surgery planning, imaging, outcome tracking and audit-ready workflows.",
  },
  {
    icon: Globe2,
    title: "Enterprise Network",
    description:
      "For multi-location clinics, training groups, white-label deployments and strategic partners.",
  },
] as const;

const PRICING_FACTORS = [
  "Number of clinics",
  "Number of users",
  "Modules selected",
  "Data migration",
  "CRM/booking integrations",
  "Imaging and AI requirements",
  "Training and onboarding",
  "White-label or partner requirements",
] as const;

export default function PricingPage() {
  return (
    <>
      <JsonLd data={buildFAQPageSchema(`${SITE_URL}/pricing`, PRICING_PAGE_FAQS)} />
      <PageHero
        eyebrow="Pricing"
        title="Enterprise Pricing"
        subtitle="Built around your clinic, your workflows and your growth stage."
        body="Follicle Intelligence is modular infrastructure for hair restoration clinics. Pricing depends on the systems you need, the number of users and clinics, integration requirements, and deployment support."
      />

      <Section>
        <FadeIn>
          <SectionIntro
            eyebrow="Pricing philosophy"
            title="Modular by design."
            description="Clinics can begin with core operating modules and expand into surgical intelligence, outcome tracking, training, analytics and global intelligence participation over time."
          />
        </FadeIn>
      </Section>

      <Section className="border-t border-border/50 pt-8 md:pt-10">
        <div className="grid gap-8 md:grid-cols-3">
          {PLAN_CARDS.map((plan, i) => (
            <FadeIn key={plan.title} delay={i * 0.08}>
              <Card className="flex h-full flex-col border-border/50 bg-card/50">
                <CardHeader>
                  <plan.icon className="h-9 w-9 text-primary/85" aria-hidden />
                  <CardTitle className="mt-4 text-xl">{plan.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col">
                  <p className="text-sm leading-relaxed text-muted-foreground md:text-base">{plan.description}</p>
                  <div className="mt-auto pt-8">
                    <Button asChild className="w-full">
                      <a href={PRICING_REQUEST_HREF}>Request Pricing</a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
      </Section>

      <Section className="border-t border-border/50">
        <FadeIn>
          <SectionIntro eyebrow="Factors" title="What affects pricing." />
        </FadeIn>
        <div className="mt-10 rounded-[1.25rem] border border-border/70 bg-card/40 px-5 py-6 md:px-7 md:py-7">
          <ul className="space-y-3">
            {PRICING_FACTORS.map((item, i) => (
              <FadeIn key={item} delay={0.04 * i}>
                <li className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground md:text-base">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary/65" aria-hidden />
                  <span>{item}</span>
                </li>
              </FadeIn>
            ))}
          </ul>
        </div>
      </Section>

      <Section className="border-t border-border/50">
        <FadeIn>
          <SectionIntro
            eyebrow="Deployment"
            title="Designed to integrate first, then scale."
            description="Follicle Intelligence can be deployed alongside existing systems before becoming the primary operating system."
          />
        </FadeIn>
      </Section>

      <Section className="border-t border-border/50 pb-2">
        <FadeIn>
          <div className="rounded-[1.35rem] border border-border/60 bg-card/35 px-6 py-10 md:px-10 md:py-12">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Let&apos;s design the right deployment pathway.
            </h2>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <a href={PRICING_REQUEST_HREF}>Request Pricing</a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href={BOOK_DEMO_HREF}>Book Demo</a>
              </Button>
            </div>
          </div>
        </FadeIn>
        <EcosystemMention className="mt-10 border-t border-border/50 pt-6" />
      </Section>
    </>
  );
}
