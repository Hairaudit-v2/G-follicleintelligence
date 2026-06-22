import { GlassCard, SectionHeading } from "@/components/marketing/FiMarketingPrimitives";
import { Section } from "@/components/layout/section";
import { FadeIn } from "@/components/ui/fade-in";
import { HOME_PAGE_CONTENT } from "@/lib/marketing/homePageContent";

const c = HOME_PAGE_CONTENT.clinicalEcosystem;

function EcosystemModuleCard({ index, name, description }: { index: number; name: string; description: string }) {
  return (
    <GlassCard
      variant="os"
      className="group flex h-full min-h-[10.5rem] flex-col border-white/[0.07] transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-amber-400/22 sm:min-h-[11.5rem]"
    >
      <div className="flex items-center border-b border-white/[0.07] pb-3">
        <span className="font-mono text-[10px] font-semibold uppercase tabular-nums tracking-[0.22em] text-amber-200/55">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="ml-auto h-px w-12 bg-gradient-to-r from-amber-400/45 to-transparent" aria-hidden />
      </div>
      <p className="mt-4 text-sm font-semibold uppercase tracking-[0.12em] text-amber-100/95 transition-colors group-hover:text-amber-50">
        {name}
      </p>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
    </GlassCard>
  );
}

export function FiMarketingClinicalEcosystemSection() {
  return (
    <Section
      id={c.id}
      className="border-b border-border/50 bg-gradient-to-b from-background via-muted/[0.06] to-background py-20 sm:py-24 md:py-28"
      aria-labelledby={`${c.id}-heading`}
    >
      <FadeIn>
        <SectionHeading
          id={`${c.id}-heading`}
          eyebrow={c.storyEyebrow}
          title={c.headline}
          description={c.subtext}
        />
        <ul className="mt-12 grid list-none gap-4 p-0 sm:mt-14 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {c.modules.map((mod, index) => (
            <li key={mod.name}>
              <EcosystemModuleCard index={index} name={mod.name} description={mod.description} />
            </li>
          ))}
        </ul>
      </FadeIn>
    </Section>
  );
}
