import Link from "next/link";

import {
  IiohrAcronymLockup,
  IiohrFullLockup,
  IiohrHorizontalLockup,
  IiohrSeal,
} from "@/components/brand/iiohr-logo";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";
import { Globe2, GraduationCap, ShieldCheck, Stamp } from "lucide-react";

const LOCKUPS = [
  {
    title: "Crest + full institute name",
    description:
      "The primary signature gives the full name precedence and lets the seal function as an academic authority mark rather than a decorative badge.",
    preview: <IiohrFullLockup tone="dark" className="mx-auto max-w-[22rem]" aria-hidden />,
  },
  {
    title: "Crest + IIOHR + formal subtitle",
    description:
      "The acronym is elevated only after the institute name is structurally established, making it feel institutional instead of startup-first.",
    preview: <IiohrAcronymLockup tone="dark" className="mx-auto max-w-[24rem]" aria-hidden />,
  },
  {
    title: "Horizontal seal + wordmark system",
    description:
      "The horizontal lockup is tuned for headers, documents, and faculty-style web surfaces where authority needs to arrive immediately.",
    preview: <IiohrHorizontalLockup tone="dark" className="w-full" aria-hidden />,
  },
];

const PRINCIPLES = [
  {
    icon: Stamp,
    title: "Stamp-ready seal",
    description:
      "A heavier outer ring and reduced interior detail make the crest feel embossable, seal-like, and credible in institutional settings.",
  },
  {
    icon: ShieldCheck,
    title: "Geometric follicle emblem",
    description:
      "The follicle and dermal papilla idea is distilled into a symmetric medical emblem instead of a delicate illustration.",
  },
  {
    icon: GraduationCap,
    title: "Faculty serif hierarchy",
    description:
      "The name uses a classical serif cadence and a clearer hierarchy so the institute reads like an academy, not a boutique clinic.",
  },
  {
    icon: Globe2,
    title: "International posture",
    description:
      "The circular structure, ring text, and measured spacing push the identity toward global standards body and surgical faculty territory.",
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
              IIOHR / Identity System
            </p>
            <h1 className="mt-6 max-w-3xl font-serif text-4xl leading-tight tracking-[0.02em] text-[#f4eee2] md:text-6xl">
              A crest and wordmark system designed to feel like a global medical faculty.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">
              This redesign replaces the previous boutique-style treatment with a circular seal,
              a disciplined serif hierarchy, and lockups built for standards, training, advisory,
              and institutional trust.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Button
                asChild
                size="lg"
                className="border border-[#b89a52] bg-[#b89a52] text-[#101821] hover:bg-[#c5ab69]"
              >
                <Link href="/contact?intent=institution">Contact Institutional Team</Link>
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
                  ["Seal", "Circular authority mark"],
                  ["Wordmark", "Serif-led institutional hierarchy"],
                  ["Scale", "Legible from website header to favicon"],
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
          <p className="text-xs uppercase tracking-[0.26em] text-[#d4bf8d]">Lockup System</p>
          <h2 className="mt-4 max-w-4xl font-serif text-3xl tracking-[0.02em] text-foreground md:text-5xl">
            Three premium lockups built to carry an institute, not a temporary brand exercise.
          </h2>
        </FadeIn>

        <div className="mt-10 grid gap-6">
          {LOCKUPS.map((item, i) => (
            <FadeIn key={item.title} delay={0.08 * i}>
              <Card className="overflow-hidden border-amber-100/10 bg-[linear-gradient(180deg,rgba(17,24,34,0.92),rgba(11,16,24,0.92))] shadow-[0_18px_56px_rgba(0,0,0,0.28)]">
                <CardHeader className="border-b border-amber-100/8">
                  <CardTitle className="font-serif text-2xl text-[#f4eee2]">{item.title}</CardTitle>
                  <CardDescription className="max-w-3xl text-sm leading-relaxed text-slate-400">
                    {item.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="bg-[radial-gradient(circle_at_top,rgba(184,154,82,0.1),transparent_34%),linear-gradient(180deg,rgba(12,18,25,0.96),rgba(9,14,21,0.98))] p-6 md:p-8">
                    {item.preview}
                  </div>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
      </Section>

      <Section className="border-y border-border/40">
        <FadeIn>
          <p className="text-xs uppercase tracking-[0.26em] text-[#d4bf8d]">Why It Holds Authority</p>
          <h2 className="mt-4 max-w-4xl font-serif text-3xl tracking-[0.02em] text-foreground md:text-5xl">
            The system is intentionally heavier, calmer, and more institutional.
          </h2>
        </FadeIn>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {PRINCIPLES.map((item, i) => (
            <FadeIn key={item.title} delay={0.08 * i}>
              <Card className="h-full border-amber-100/10 bg-[linear-gradient(180deg,rgba(17,24,34,0.84),rgba(11,16,24,0.84))]">
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

      <Section>
        <FadeIn>
          <p className="text-xs uppercase tracking-[0.26em] text-[#d4bf8d]">Favicon Readiness</p>
          <h2 className="mt-4 max-w-4xl font-serif text-3xl tracking-[0.02em] text-foreground md:text-5xl">
            The crest keeps its posture even when reduced to utility sizes.
          </h2>
        </FadeIn>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.35fr_0.95fr]">
          <FadeIn delay={0.08}>
            <Card className="border-amber-100/10 bg-[linear-gradient(180deg,rgba(17,24,34,0.92),rgba(11,16,24,0.92))]">
              <CardHeader>
                <CardTitle className="font-serif text-2xl text-[#f4eee2]">Seal at working sizes</CardTitle>
                <CardDescription className="text-slate-400">
                  The outer ring, shield, and papilla dot stay intact because the internal drawing has
                  been reduced to decisive, high-contrast forms.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-end gap-6 rounded-[24px] border border-amber-100/8 bg-black/15 p-6">
                  {[112, 72, 40, 24].map((size) => (
                    <div key={size} className="flex flex-col items-center gap-3">
                      <IiohrSeal tone="dark" className="shrink-0" style={{ width: size, height: size }} aria-hidden />
                      <span className="text-xs uppercase tracking-[0.22em] text-slate-500">{size}px</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </FadeIn>

          <FadeIn delay={0.14}>
            <Card className="border-amber-100/10 bg-[linear-gradient(180deg,rgba(244,238,226,0.96),rgba(235,228,214,0.96))] text-slate-900">
              <CardHeader>
                <CardTitle className="font-serif text-2xl text-slate-900">Light-surface variant</CardTitle>
                <CardDescription className="text-slate-600">
                  The same geometry also supports print-style or documentation use without losing its
                  faculty character.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-[24px] border border-slate-900/8 bg-white/50 p-6">
                  <IiohrFullLockup tone="light" className="mx-auto max-w-[19rem]" aria-label="IIOHR light full lockup" />
                </div>
              </CardContent>
            </Card>
          </FadeIn>
        </div>

        <FadeIn delay={0.18}>
          <div className="mt-10 rounded-[28px] border border-amber-100/10 bg-[linear-gradient(180deg,rgba(17,24,34,0.92),rgba(10,15,22,0.96))] p-8">
            <p className="text-xs uppercase tracking-[0.28em] text-[#d4bf8d]">Institutional Engagement</p>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-300">
              For standards mapping, advisory collaboration, or institution-led implementation pathways,
              connect with the Follicle Intelligence institutional team.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <Button
                asChild
                className="border border-[#b89a52] bg-[#b89a52] text-[#101821] hover:bg-[#c5ab69]"
              >
                <Link href="/contact?intent=institution">Contact Institutional Team</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-amber-100/20 bg-transparent text-[#f4eee2] hover:bg-white/5 hover:text-[#f4eee2]"
              >
                <Link href="/methodology">Review Methodology</Link>
              </Button>
            </div>
          </div>
        </FadeIn>
      </Section>
    </>
  );
}
