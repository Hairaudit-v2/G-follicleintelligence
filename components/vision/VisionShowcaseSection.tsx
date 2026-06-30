import Image from "next/image";

import { Section } from "@/components/layout/section";
import { FadeIn } from "@/components/ui/fade-in";
import { cn } from "@/lib/utils";

const SHOWCASE = [
  {
    file: "FI OS Calendar.jpeg",
    label: "ClinicOS",
    caption: "Intelligent scheduling, room allocation, team coordination, and workflow management.",
  },
  {
    file: "Consultation Conversion Board.jpeg",
    label: "LeadFlow",
    caption:
      "Patient acquisition, consultations, conversion intelligence, and surgical pipeline management.",
  },
  {
    file: "Doctor Workspace.jpeg",
    label: "DoctorOS",
    caption: "Clinical workflows, prescribing, treatment management, and patient decision support.",
  },
  {
    file: "Tomorrow Readiness Board.jpeg",
    label: "OperationsOS",
    caption: "Daily operational management, surgery readiness, and front-desk coordination.",
  },
  {
    file: "Reception Board.jpeg",
    label: "OperationsOS",
    caption:
      "Live reception rhythm, team handoffs, and same-day operational visibility across the clinic.",
  },
  {
    file: "Operations centre.jpeg",
    label: "OperationsOS",
    caption:
      "Operations centre view for coordinated scheduling, block readiness, and real-time clinic command.",
  },
  {
    file: "Analyticsos.jpeg",
    label: "AnalyticsOS",
    caption:
      "Analytics layer for pipeline health, performance signals, and decision-ready intelligence across FI OS.",
  },
  {
    file: "Patient Twin.jpeg",
    label: "Patient Twin Intelligence",
    caption:
      "A living digital record connecting consultations, diagnostics, imaging, treatments, surgery, and outcomes.",
  },
] as const;

function showcaseSrc(file: string) {
  return `/marketing/product-showcase/${encodeURIComponent(file)}`;
}

export function VisionShowcaseSection() {
  return (
    <Section
      className={cn(
        "border-y border-white/[0.06] py-24 sm:py-28 md:py-32",
        "bg-[radial-gradient(ellipse_at_50%_0%,rgb(212_175_55_/0.06),transparent_45%),radial-gradient(ellipse_at_100%_30%,rgb(42_168_220_/0.05),transparent_40%),linear-gradient(180deg,rgb(3_5_10)_0%,rgb(5_8_14)_45%,rgb(2_4_8)_100%)]"
      )}
      aria-labelledby="vision-product-proof-heading"
    >
      <FadeIn>
        <header className="mx-auto max-w-4xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-200/70">
            Product depth
          </p>
          <div
            className="mx-auto mt-3 h-px w-14 bg-gradient-to-r from-transparent via-amber-400/35 to-transparent"
            aria-hidden
          />
          <h2
            id="vision-product-proof-heading"
            className="mt-6 font-display text-3xl font-semibold tracking-tight text-foreground text-balance sm:text-4xl md:text-[2.75rem] md:leading-[1.1]"
          >
            This Is Not a Concept
          </h2>
          <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg md:leading-relaxed">
            We are actively building the world&apos;s first connected operating system for hair
            restoration medicine.
          </p>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg md:leading-relaxed">
            Designed to unify every layer of modern clinical practice.
          </p>
        </header>

        <ul className="mx-auto mt-16 grid max-w-6xl list-none grid-cols-1 gap-10 sm:mt-20 sm:gap-12 lg:grid-cols-2">
          {SHOWCASE.map((item, index) => (
            <li key={item.file} className="min-w-0">
              <article
                className={cn(
                  "group relative flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-white/[0.08]",
                  "bg-gradient-to-br from-[rgb(10_14_22_/0.95)] via-[rgb(6_9_15_/0.92)] to-[rgb(3_5_10_/0.98)]",
                  "shadow-[0_28px_80px_rgb(0_0_0_/0.55),inset_0_1px_0_rgb(255_255_255_/0.06),0_0_0_1px_rgb(212_175_55_/0.04)_inset]",
                  "transition-[transform,box-shadow,border-color] duration-500 ease-out will-change-transform",
                  "hover:-translate-y-0.5 hover:border-amber-400/20 hover:shadow-[0_36px_100px_rgb(0_0_0_/0.58),0_0_48px_rgb(212_175_55_/0.05),inset_0_1px_0_rgb(255_255_255_/0.08)]"
                )}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  style={{
                    background:
                      "radial-gradient(900px 280px at 50% 0%, rgb(212 175 55 / 0.07), transparent 52%), radial-gradient(600px 200px at 80% 100%, rgb(42 168 220 / 0.05), transparent 50%)",
                  }}
                />
                <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-white/[0.06]">
                  <Image
                    src={showcaseSrc(item.file)}
                    alt={`${item.label} — FI OS interface preview`}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover object-top transition-transform duration-700 ease-out group-hover:scale-[1.02]"
                    priority={index < 2}
                  />
                  <div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgb(3_5_10_/0.85)] via-transparent to-transparent opacity-80"
                    aria-hidden
                  />
                </div>
                <div className="relative space-y-3 px-6 py-7 sm:px-8 sm:py-8">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-200/75 sm:text-[11px]">
                    {item.label}
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground/95 sm:text-[0.9375rem] sm:leading-relaxed">
                    {item.caption}
                  </p>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </FadeIn>
    </Section>
  );
}
