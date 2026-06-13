"use client";

import Link from "next/link";

import {
  Badge,
  Button,
  Card,
  CTASection,
  EcosystemFooter,
  FAQAccordion,
  FeatureCard,
  FeatureGrid,
  Hero,
  LogoCloud,
  MetricCard,
  NetworkHero,
  PlatformNav,
  PricingCard,
  ProductPill,
  StatBlock,
  TestimonialCard,
  Timeline,
  platformSurfaceClasses,
  type NetworkProductSlug,
} from "@/packages/ui";

const resolveDemoHref = (slug: NetworkProductSlug) => `#${slug}`;

export function DesignSystemShowcase() {
  return (
    <div className="space-y-16 pb-24">
      <div className="border-b border-border/40">
        <PlatformNav
          currentPlatform="follicle-intelligence"
          resolveProductHref={resolveDemoHref}
          brand={<span>Follicle Intelligence</span>}
          cta={
            <Button asChild size="md" variant="primary" platform="fi">
              <Link href="#cta">Book a briefing</Link>
            </Button>
          }
        />
      </div>

      <div className="space-y-6 px-4 sm:px-6">
        <h2 className="font-display text-xl font-semibold">Hero</h2>
        <Hero
          platform="fi"
          eyebrow="Operating system"
          title="Evidence-grade intelligence for hair restoration."
          subtitle="Compose verification, diagnostics, and education on one network fabric—without fragmenting clinical truth."
          actions={
            <>
              <Button platform="fi" variant="primary" size="lg">
                Primary
              </Button>
              <Button platform="fi" variant="outline" size="lg">
                Secondary
              </Button>
            </>
          }
        />
      </div>

      <div className="space-y-6 px-4 sm:px-6">
        <h2 className="font-display text-xl font-semibold">Network hero</h2>
        <NetworkHero
          platform="hairaudit"
          eyebrow="Outcome verification"
          title="HairAudit surfaces what actually happened in surgery."
          subtitle="Pair photographic evidence with governed scoring so outcomes are reviewable—not rhetorical."
          actions={<Button platform="hairaudit">Explore HairAudit</Button>}
        />
      </div>

      <div className="space-y-6 px-4 sm:px-6">
        <h2 className="font-display text-xl font-semibold">Buttons and badges</h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" platform="fi">
            FI primary
          </Button>
          <Button variant="secondary" platform="hli">
            HLI secondary
          </Button>
          <Button variant="outline" platform="iiohr">
            IIOHR outline
          </Button>
          <Badge tone="accent">Accent</Badge>
          <Badge tone="success">Validated</Badge>
        </div>
      </div>

      <div className="space-y-6 px-4 sm:px-6">
        <h2 className="font-display text-xl font-semibold">Cards and metrics</h2>
        <FeatureGrid>
          <FeatureCard title="Glass surface" description="Default marketing card with controlled translucency." />
          <MetricCard label="Signal depth" value="Stage 9+" hint="Hair intelligence engines online" />
          <Card variant="elevated" className="p-5">
            <p className="text-sm text-muted-foreground">Elevated panel for dense operational summaries.</p>
          </Card>
        </FeatureGrid>
      </div>

      <div className="space-y-6 px-4 sm:px-6">
        <h2 className="font-display text-xl font-semibold">Product pills</h2>
        <div className="flex flex-wrap gap-3">
          <ProductPill slug="follicle-intelligence" name="Follicle Intelligence" category="Operating System" href="#fi" active />
          <ProductPill slug="hairaudit" name="HairAudit" category="Outcome Verification" href="#hairaudit" />
          <ProductPill slug="hli" name="Hair Longevity Institute" category="Diagnostics" href="#hli" />
          <ProductPill slug="iiohr" name="IIOHR" category="Education" href="#iiohr" />
        </div>
      </div>

      <div className="space-y-6 px-4 sm:px-6">
        <h2 className="font-display text-xl font-semibold">Platform shells</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {(["fi", "hairaudit", "hli", "iiohr"] as const).map((p) => (
            <div key={p} className={`rounded-2xl border border-border/40 p-5 ${platformSurfaceClasses(p)}`}>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{p}</p>
              <p className="mt-3 text-sm">Sample body copy for {p} theme tokens.</p>
            </div>
          ))}
        </div>
        <div className={`rounded-2xl border border-emerald-500/20 p-5 ${platformSurfaceClasses("hli", "light")}`}>
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-800">HLI light</p>
          <p className="mt-3 text-sm text-slate-700">Clinical light shell for longevity diagnostics.</p>
        </div>
      </div>

      <div className="space-y-6 px-4 sm:px-6">
        <h2 className="font-display text-xl font-semibold">Testimonial, pricing, stats, timeline</h2>
        <FeatureGrid columnsClassName="lg:grid-cols-3">
          <TestimonialCard
            quote="The network finally gives us comparable outcomes across surgeons and sites."
            attribution="Clinical lead"
            role="Multi-site restoration group"
          />
          <PricingCard
            name="Enterprise"
            price="$—"
            cadence="/ month"
            description="Host-supplied copy only."
            features={["Dedicated review workspace", "Outcome intelligence hooks", "Governed reporting"]}
            highlighted
            cta={<Button variant="secondary">Talk to us</Button>}
          />
          <div className="space-y-4">
            <StatBlock label="Cases under review" value="128" detail="Rolling 30 days" />
            <Timeline
              items={[
                { title: "Intake normalised", description: "Signals mapped to FI schema.", meta: "T+0" },
                { title: "Verification layer", description: "HairAudit scoring engaged.", meta: "T+7d" },
              ]}
            />
          </div>
        </FeatureGrid>
      </div>

      <div className="space-y-6 px-4 sm:px-6">
        <h2 className="font-display text-xl font-semibold">Logo cloud</h2>
        <LogoCloud
          title="Trusted by host-defined partners"
          logos={[
            { src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='40'%3E%3Crect fill='%231e293b' width='160' height='40' rx='6'/%3E%3Ctext x='50%25' y='52%25' dominant-baseline='middle' text-anchor='middle' fill='%2394a3b8' font-family='sans-serif' font-size='12'%3EClinic%3C/text%3E%3C/svg%3E", alt: "Clinic A" },
            { src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='40'%3E%3Crect fill='%230f172a' width='160' height='40' rx='6'/%3E%3Ctext x='50%25' y='52%25' dominant-baseline='middle' text-anchor='middle' fill='%23cbd5e1' font-family='sans-serif' font-size='12'%3ELab%3C/text%3E%3C/svg%3E", alt: "Lab partner" },
          ]}
        />
      </div>

      <div className="space-y-6 px-4 sm:px-6">
        <h2 className="font-display text-xl font-semibold">FAQ</h2>
        <FAQAccordion
          items={[
            { question: "Is this route indexed?", answer: "No. Metadata sets robots to noindex." },
            { question: "How do other sites consume the library?", answer: "Import from `@/packages/ui` and supply href resolvers plus copy from each brand." },
          ]}
        />
      </div>

      <CTASection
        id="cta"
        eyebrow="Next step"
        title="Wire your product to the shared network layer."
        description="Use data props for copy, resolveProductHref for cross-links, and platform tokens for accents."
        actions={
          <>
            <Button platform="fi">Primary CTA</Button>
            <Button variant="outline">Secondary</Button>
          </>
        }
      />

      <EcosystemFooter
        resolveProductHref={resolveDemoHref}
        legalLinks={[
          { label: "Privacy", href: "/privacy" },
          { label: "Terms", href: "/terms" },
        ]}
        newsletterSlot={<p className="text-sm text-muted-foreground">Optional newsletter slot from the host layout.</p>}
      />
    </div>
  );
}
