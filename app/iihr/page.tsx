import Link from "next/link";

import {
  IiohrHorizontalLockup,
  IiohrSeal,
} from "@/components/brand/iiohr-logo";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BrainCircuit,
  ClipboardCheck,
  FlaskConical,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";

const STANDARDS_PILLARS: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: ClipboardCheck,
    title: "Define how procedures are assessed",
    description:
      "IIOHR sets structured assessment logic so outcomes can be evaluated consistently across clinics, teams, and regions.",
  },
  {
    icon: ShieldCheck,
    title: "Standardize improvement pathways",
    description:
      "Audit signals become repeatable training and governance actions, not one-off opinions or isolated feedback loops.",
  },
  {
    icon: GraduationCap,
    title: "Deliver audit-backed training",
    description:
      "Training is built from real audited cases and measured outcomes, creating practical learning grounded in clinical reality.",
  },
];

const ECOSYSTEM_LAYERS = [
  {
    title: "Follicle Intelligence",
    label: "Intelligence engine",
    description: "Cross-platform analysis, pattern recognition, and predictive insight.",
  },
  {
    title: "HairAudit",
    label: "Surgical audit layer",
    description: "Structured scoring, benchmarking, and evidence-led review.",
  },
  {
    title: "Hair Longevity Institute",
    label: "Biology layer",
    description: "Long-term diagnosis, treatment pathways, and biological monitoring.",
  },
  {
    title: "IIOHR",
    label: "Training and methodology layer",
    description: "Audit-backed training and standards-driven methodology for clinical execution.",
  },
];

const DELIVERY_AREAS = [
  {
    title: "Audit-backed training",
    description:
      "Case-based learning built on validated surgical audits, performance signals, and observed outcomes.",
  },
  {
    title: "Standards-driven methodology",
    description:
      "Clear procedure definitions, scoring criteria, and review frameworks for consistent quality improvement.",
  },
  {
    title: "Powered by Follicle Intelligence",
    description:
      "IIOHR operates as a layer in the ecosystem, continuously informed by system-wide intelligence from Follicle Intelligence.",
  },
];

export default function IIOHRPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-amber-200/10 bg-[linear-gradient(180deg,rgba(10,15,22,0.98),rgba(9,13,20,0.98))]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(184,154,82,0.18),transparent_34%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_12%,rgba(244,238,226,0.08),transparent_28%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(184,154,82,0.06),transparent)]" />
        <div className="relative mx-auto grid max-w-6xl gap-14 px-6 py-20 md:grid-cols-12 md:py-24">
          <FadeIn className="md:col-span-6">
            <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[#d4bf8d]">
              International Institute of Hair Restoration (IIOHR)
            </p>
            <h1 className="mt-6 max-w-3xl font-serif text-4xl leading-tight tracking-[0.02em] text-[#f4eee2] md:text-6xl">
              Training, Standards, and Methodology for Modern Hair Restoration
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">
              IIOHR (International Institute of Hair Restoration) provides structured education,
              audit-backed methodology, and clinical standards—built on real data from Follicle
              Intelligence.
            </p>
            <p className="mt-4 max-w-2xl text-sm uppercase tracking-[0.22em] text-[#d4bf8d]">
              Not theory. Real cases. Real outcomes. System-wide learning.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Button
                asChild
                size="lg"
                className="border border-[#b89a52] bg-[#b89a52] text-[#101821] hover:bg-[#c5ab69]"
              >
                <Link href="/contact?intent=training">Contact IIOHR Team</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="border-amber-100/20 bg-transparent text-[#f4eee2] hover:bg-white/5 hover:text-[#f4eee2]"
              >
                <Link href="/methodology">Review Methodology</Link>
              </Button>
            </div>
          </FadeIn>

          <FadeIn delay={0.08} className="md:col-span-6">
            <div className="rounded-[28px] border border-amber-100/12 bg-[linear-gradient(180deg,rgba(19,28,39,0.94),rgba(12,18,26,0.94))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
              <div className="rounded-[22px] border border-amber-100/10 bg-[radial-gradient(circle_at_top,rgba(184,154,82,0.12),transparent_38%),linear-gradient(180deg,rgba(13,19,27,0.92),rgba(9,14,22,0.92))] p-6">
                <IiohrHorizontalLockup tone="dark" className="w-full" aria-label="IIOHR horizontal lockup" />
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {[
                  ["Training", "Audit-backed training"],
                  ["Methodology", "Standards-driven methodology"],
                  ["Integration", "Powered by Follicle Intelligence"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-amber-100/10 bg-black/15 px-4 py-4"
                  >
                    <p className="text-[11px] uppercase tracking-[0.28em] text-[#d4bf8d]">{label}</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-300">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      <Section>
        <FadeIn>
          <p className="text-xs uppercase tracking-[0.26em] text-[#d4bf8d]">Positioning</p>
          <h2 className="mt-4 max-w-4xl font-serif text-3xl tracking-[0.02em] text-foreground md:text-5xl">
            A Standards Layer, Not Just a Course
          </h2>
          <p className="mt-6 max-w-3xl text-base leading-7 text-muted-foreground">
            IIOHR defines how hair restoration procedures are assessed, improved, and standardized.
            It is a standards layer and methodology system, not a standalone education product.
            Every framework is built for applied clinical quality, not abstract theory.
          </p>
        </FadeIn>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {STANDARDS_PILLARS.map((item, i) => (
            <FadeIn key={item.title} delay={0.08 * i}>
              <Card className="h-full border-amber-100/10 bg-[linear-gradient(180deg,rgba(17,24,34,0.92),rgba(11,16,24,0.92))]">
                <CardHeader>
                  <item.icon className="h-6 w-6 text-[#d4bf8d]" />
                  <CardTitle className="font-serif text-xl text-[#f4eee2]">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed text-slate-400">
                    {item.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
      </Section>

      <Section className="border-y border-border/40">
        <FadeIn>
          <p className="text-xs uppercase tracking-[0.26em] text-[#d4bf8d]">Ecosystem Integration</p>
          <h2 className="mt-4 max-w-4xl font-serif text-3xl tracking-[0.02em] text-foreground md:text-5xl">
            IIOHR operates as a layer within one connected system.
          </h2>
          <p className="mt-6 max-w-3xl text-base leading-7 text-muted-foreground">
            IIOHR does not compete with the platform layer. It extends it through audit-backed
            training and standards-driven methodology powered by Follicle Intelligence.
          </p>
        </FadeIn>

        <div className="mt-10 grid gap-4 xl:grid-cols-4">
          {ECOSYSTEM_LAYERS.map((item, i) => (
            <FadeIn key={item.title} delay={0.06 * i}>
              <Card className="h-full border-amber-100/10 bg-[linear-gradient(180deg,rgba(17,24,34,0.88),rgba(10,15,22,0.92))]">
                <CardHeader className="space-y-3">
                  <CardDescription className="text-xs uppercase tracking-[0.22em] text-[#d4bf8d]">
                    {item.label}
                  </CardDescription>
                  <CardTitle className="font-serif text-2xl text-[#f4eee2]">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed text-slate-400">
                    {item.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-center text-xs uppercase tracking-[0.22em] text-slate-400">
          <span>Intelligence engine</span>
          <ArrowRight className="h-4 w-4" />
          <span>Audit layer</span>
          <ArrowRight className="h-4 w-4" />
          <span>Biology layer</span>
          <ArrowRight className="h-4 w-4" />
          <span>Training and methodology layer</span>
        </div>
      </Section>

      <Section>
        <FadeIn>
          <p className="text-xs uppercase tracking-[0.26em] text-[#d4bf8d]">IIOHR Delivery</p>
          <h2 className="mt-4 max-w-4xl font-serif text-3xl tracking-[0.02em] text-foreground md:text-5xl">
            Clinical education and standards, aligned to the ecosystem.
          </h2>
        </FadeIn>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {DELIVERY_AREAS.map((item, i) => (
            <FadeIn key={item.title} delay={0.06 * i}>
              <Card className="h-full border-amber-100/10 bg-[linear-gradient(180deg,rgba(17,24,34,0.88),rgba(10,15,22,0.92))]">
                <CardHeader>
                  {i === 0 ? (
                    <GraduationCap className="h-6 w-6 text-[#d4bf8d]" />
                  ) : i === 1 ? (
                    <ShieldCheck className="h-6 w-6 text-[#d4bf8d]" />
                  ) : (
                    <BrainCircuit className="h-6 w-6 text-[#d4bf8d]" />
                  )}
                  <CardTitle className="font-serif text-xl text-[#f4eee2]">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed text-slate-400">
                    {item.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.18}>
          <div className="mt-10 rounded-[28px] border border-amber-100/10 bg-[linear-gradient(180deg,rgba(17,24,34,0.92),rgba(10,15,22,0.96))] p-8">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl border border-amber-100/10 bg-black/15 p-3">
                <IiohrSeal tone="dark" className="h-12 w-12" aria-hidden />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-[#d4bf8d]">Institutional Engagement</p>
                <p className="mt-2 text-lg font-semibold text-[#f4eee2]">
                  International Institute of Hair Restoration (IIOHR)
                </p>
              </div>
            </div>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-300">
              For standards mapping, methodology rollout, and audit-backed training implementation,
              connect with the team. IIOHR remains powered by Follicle Intelligence and aligned to
              system-wide intelligence across the ecosystem.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <Button
                asChild
                className="border border-[#b89a52] bg-[#b89a52] text-[#101821] hover:bg-[#c5ab69]"
              >
                <Link href="/contact?intent=institution">Contact IIOHR Team</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-amber-100/20 bg-transparent text-[#f4eee2] hover:bg-white/5 hover:text-[#f4eee2]"
              >
                <Link href="/platform">See Ecosystem Context</Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                className="text-[#f4eee2] hover:bg-white/5 hover:text-[#f4eee2]"
              >
                <Link href="/methodology">
                  Review Methodology
                  <FlaskConical className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </FadeIn>
      </Section>
    </>
  );
}
