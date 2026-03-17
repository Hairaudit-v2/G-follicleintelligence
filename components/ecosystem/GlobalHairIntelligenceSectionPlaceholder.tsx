/**
 * Lightweight placeholder for GlobalHairIntelligenceSection when lazy-loading.
 * Preserves section structure, heading, description, and min-height to avoid CLS.
 * No client JS or heavy dependencies.
 */
export interface GlobalHairIntelligenceSectionPlaceholderProps {
  id?: string;
  heading: string;
  description: string;
  size?: "hero" | "compact";
  theme?: "light" | "dark" | "auto";
  className?: string;
}

export function GlobalHairIntelligenceSectionPlaceholder({
  id = "global-hair-intelligence-network",
  heading,
  description,
  className = "",
}: GlobalHairIntelligenceSectionPlaceholderProps) {
  return (
    <section
      id={id}
      className={`scroll-mt-20 border-t border-border/50 bg-muted/30 py-12 sm:py-16 md:py-20 ${className}`}
      aria-labelledby={`${id}-heading`}
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <h2
          id={`${id}-heading`}
          className="text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl md:text-4xl"
        >
          {heading}
        </h2>
        <p className="mx-auto mt-4 max-w-3xl whitespace-pre-line text-center leading-relaxed text-muted-foreground">
          {description}
        </p>
        <div
          className="mx-auto mt-8 w-full max-w-[min(1000px,100%)] overflow-hidden rounded-xl border border-border/40 bg-muted/20 md:min-h-[640px] lg:min-h-[720px]"
          style={{ minHeight: 520 }}
          aria-hidden
        >
          <div className="flex h-full min-h-[520px] items-center justify-center md:min-h-[640px] lg:min-h-[720px]" />
        </div>
      </div>
    </section>
  );
}
