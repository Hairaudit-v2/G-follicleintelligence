import { CheckCircle2 } from "lucide-react";

import { Section } from "@/components/layout/section";
import { FadeIn } from "@/components/ui/fade-in";
import type { HomeComparisonRow } from "@/lib/marketing/homePageContent";
import { cn } from "@/lib/utils";

function SectionHeading({
  id,
  title,
  description,
  eyebrow,
}: {
  id: string;
  title: string;
  description?: string;
  eyebrow?: string;
}) {
  return (
    <header className="max-w-4xl">
      {eyebrow ? (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-amber-200/75">
            {eyebrow}
          </p>
          <div
            className="mt-3 h-px w-14 bg-gradient-to-r from-amber-300/70 via-amber-400/25 to-transparent"
            aria-hidden
          />
        </div>
      ) : null}
      <h2
        id={id}
        className={cn(
          "max-w-[52rem] font-display font-semibold tracking-tight text-foreground text-balance",
          eyebrow
            ? "mt-5 text-3xl sm:text-4xl md:text-[2.75rem] md:leading-[1.12]"
            : "text-3xl sm:text-4xl md:text-[2.75rem] md:leading-[1.12]"
        )}
      >
        {title}
      </h2>
      {description ? (
        <p className="mt-5 max-w-3xl text-base leading-[1.65] text-muted-foreground sm:text-lg md:leading-relaxed">
          {description}
        </p>
      ) : null}
    </header>
  );
}

const thBase =
  "border-b border-white/[0.08] px-3 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.18em] sm:px-4 sm:py-4 sm:text-[11px] sm:tracking-[0.2em]";
const tdBase =
  "border-b border-white/[0.06] px-3 py-3 align-top text-[13px] leading-snug sm:px-4 sm:py-3.5 sm:text-sm sm:leading-relaxed";
const rowLabel =
  "border-b border-white/[0.07] bg-white/[0.02] px-3 py-3 align-top text-[12px] font-semibold leading-snug text-foreground/95 sm:px-4 sm:py-3.5 sm:text-[13px]";

export function FiMarketingComparisonSection({
  section,
}: {
  section: {
    id: string;
    storyEyebrow: string;
    headline: string;
    subtext: string;
    footnote: string;
    columns: readonly ["Traditional CRM", "Generic Clinic Software", "Follicle Intelligence"];
    rows: readonly HomeComparisonRow[];
  };
}) {
  const [colA, colB, colFi] = section.columns;

  return (
    <Section
      id={section.id}
      className="border-b border-border/50 bg-gradient-to-b from-background via-muted/[0.04] to-background py-20 sm:py-24 md:py-28"
      aria-labelledby={`${section.id}-heading`}
    >
      <FadeIn>
        <SectionHeading
          id={`${section.id}-heading`}
          eyebrow={section.storyEyebrow}
          title={section.headline}
          description={section.subtext}
        />

        <div className="mt-12 sm:mt-14">
          <div
            className={cn(
              "relative overflow-hidden rounded-[1.35rem] border border-white/[0.09] bg-gradient-to-br from-white/[0.06] via-[rgb(6_9_15_/0.55)] to-[rgb(4_7_12_/0.88)] shadow-[0_24px_72px_rgb(0_0_0_/0.42),inset_0_1px_0_rgb(255_255_255_/0.06)] backdrop-blur-md sm:rounded-[1.75rem]"
            )}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 w-[26.5%] min-w-[10rem] bg-[linear-gradient(180deg,rgb(212_175_55_/0.1),rgb(212_175_55_/0.03)_45%,transparent)] opacity-90 sm:w-[27%]"
            />
            <div className="relative overflow-x-auto [-webkit-overflow-scrolling:touch]">
              <table className="relative w-full min-w-[42rem] border-separate border-spacing-0 sm:min-w-[52rem]">
                <caption className="sr-only">
                  Comparison of Traditional CRM, Generic Clinic Software, and Follicle Intelligence
                  across clinical and intelligence capabilities.
                </caption>
                <thead>
                  <tr>
                    <th
                      scope="col"
                      className={cn(
                        thBase,
                        "w-[min(22%,14rem)] rounded-tl-[1.2rem] bg-white/[0.03] text-muted-foreground"
                      )}
                    >
                      Capability
                    </th>
                    <th scope="col" className={cn(thBase, "bg-white/[0.03] text-muted-foreground")}>
                      {colA}
                    </th>
                    <th scope="col" className={cn(thBase, "bg-white/[0.03] text-muted-foreground")}>
                      {colB}
                    </th>
                    <th
                      scope="col"
                      className={cn(
                        thBase,
                        "relative rounded-tr-[1.2rem] border-l border-amber-400/25 bg-[linear-gradient(180deg,rgb(212_175_55_/0.14),rgb(8_12_20_/0.92))] text-amber-50 shadow-[inset_0_1px_0_rgb(255_255_255_/0.08)]"
                      )}
                    >
                      <span className="inline-flex items-center gap-2">
                        <CheckCircle2
                          className="h-3.5 w-3.5 shrink-0 text-amber-300/90 sm:h-4 sm:w-4"
                          aria-hidden
                        />
                        {colFi}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((row, idx) => {
                    const isLast = idx === section.rows.length - 1;
                    return (
                      <tr
                        key={row.capability}
                        className="transition-colors duration-200 hover:bg-white/[0.02]"
                      >
                        <th
                          scope="row"
                          className={cn(rowLabel, isLast && "rounded-bl-[1.2rem] border-b-0")}
                        >
                          {row.capability}
                        </th>
                        <td className={cn(tdBase, "text-muted-foreground", isLast && "border-b-0")}>
                          {row.traditionalCrm}
                        </td>
                        <td className={cn(tdBase, "text-muted-foreground", isLast && "border-b-0")}>
                          {row.genericClinic}
                        </td>
                        <td
                          className={cn(
                            tdBase,
                            "relative border-l border-amber-400/20 bg-[linear-gradient(90deg,rgb(212_175_55_/0.06),transparent_55%)] font-medium text-foreground/95",
                            isLast &&
                              "rounded-br-[1.2rem] border-b-0 shadow-[inset_0_-1px_0_rgb(212_175_55_/0.12)]"
                          )}
                        >
                          <span className="relative z-10">{row.follicleIntelligence}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground/90 sm:text-sm">
            {section.footnote}
          </p>
        </div>
      </FadeIn>
    </Section>
  );
}
