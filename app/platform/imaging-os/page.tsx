import Link from "next/link";

import { Section } from "@/components/layout/section";
import { buildPageMetadata } from "@/lib/seo/page-metadata";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";
import { Archive, ArrowRight, Camera, Layers2, LineChart, MapPinned, Sparkles } from "lucide-react";

export const metadata = buildPageMetadata({
  title: "ImagingOS: Clinical Imaging Infrastructure for Hair Restoration | Follicle Intelligence",
  description:
    "ImagingOS is clinical imaging infrastructure for hair restoration medicine—standardised photography, scalp mapping, image protocols, AI image classification, and longitudinal progression in one unified system, built for the Patient Twin™.",
  path: "/platform/imaging-os",
});

function SectionIntro({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/90">{eyebrow}</p>
      <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground md:text-4xl">{title}</h2>
      {description ? (
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">{description}</p>
      ) : null}
    </div>
  );
}

const CAPABILITY_CARDS = [
  {
    icon: Camera,
    title: "Photography Protocols",
    desc: "Standardised capture workflows.",
  },
  {
    icon: MapPinned,
    title: "Scalp Mapping",
    desc: "Region-based scalp documentation.",
  },
  {
    icon: Layers2,
    title: "Annotation Layers",
    desc: "Visual notes and treatment overlays.",
  },
  {
    icon: Sparkles,
    title: "AI Image Classification",
    desc: "Intelligent image recognition and categorisation.",
  },
  {
    icon: LineChart,
    title: "Progress Tracking",
    desc: "Longitudinal image comparison over time.",
  },
  {
    icon: Archive,
    title: "Clinical Evidence Archive",
    desc: "Store every consultation, surgery and follow-up image permanently.",
  },
] as const;

export default function ImagingOsPage() {
  return (
    <>
      <section className="fi-grid relative overflow-hidden border-b border-border/50">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_14%_0%,hsl(var(--primary)/0.2),transparent_46%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_96%_12%,rgb(110_150_200_/0.11),transparent_40%)]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/70" />

        <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-28">
          <FadeIn>
            <h1 className="max-w-3xl font-display text-4xl font-semibold tracking-tight text-foreground md:text-5xl md:leading-[1.08] lg:text-[3.15rem]">
              ImagingOS
            </h1>
            <p className="mt-6 max-w-2xl text-lg font-medium leading-relaxed text-foreground/92 md:text-xl md:leading-relaxed">
              Clinical imaging intelligence built for modern hair restoration clinics.
            </p>
            <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base md:leading-relaxed">
              Standardise photography, scalp mapping, image protocols, AI image classification and longitudinal image
              progression from one unified imaging system.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Button
                asChild
                size="lg"
                className="h-11 rounded-xl px-6 shadow-[0_10px_36px_hsl(var(--primary)/0.2)]"
              >
                <Link href="/contact?intent=demo">Book Demo</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-11 rounded-xl border-white/10 bg-background/25 px-6 backdrop-blur-sm"
              >
                <Link href="/platform" className="inline-flex items-center gap-2">
                  View Platform
                  <ArrowRight className="h-4 w-4 opacity-80" aria-hidden />
                </Link>
              </Button>
            </div>
          </FadeIn>
        </div>
      </section>

      <Section className="border-b border-border/50">
        <FadeIn>
          <SectionIntro
            eyebrow="Clinical reality"
            title="Clinical imaging is too important to remain unstructured."
            description="Hair restoration clinics depend on photography for diagnosis, planning, documentation, follow-up and outcome measurement. Generic image storage systems create inconsistency."
          />
        </FadeIn>
      </Section>

      <Section className="border-b border-border/50">
        <FadeIn>
          <SectionIntro eyebrow="Capabilities" title="Core capabilities" />
        </FadeIn>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {CAPABILITY_CARDS.map((item, i) => (
            <FadeIn key={item.title} delay={0.06 * i}>
              <Card className="h-full border-border/70 bg-card/60">
                <CardHeader>
                  <item.icon className="h-6 w-6 text-primary/85" aria-hidden />
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">{item.desc}</CardDescription>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
      </Section>

      <Section className="border-b border-border/50">
        <FadeIn>
          <SectionIntro
            eyebrow="Integration"
            title="Built for the Patient Twin™"
            description="Every image becomes part of the patient’s lifelong intelligence record and directly supports SurgeryOS and AuditOS."
          />
        </FadeIn>
      </Section>

      <Section>
        <FadeIn>
          <div className="fi-panel rounded-2xl p-8 md:p-10">
            <h2 className="max-w-3xl text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Turn every image into structured clinical intelligence.
            </h2>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button asChild className="rounded-xl">
                <Link href="/contact?intent=demo">Book Demo</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/platform" className="inline-flex items-center gap-2">
                  View Platform
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </div>
          </div>
        </FadeIn>
      </Section>
    </>
  );
}
