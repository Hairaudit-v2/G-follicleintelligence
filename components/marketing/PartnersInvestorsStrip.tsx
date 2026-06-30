import Link from "next/link";

/**
 * Quiet bottom band for institutional partners — homepage, vision, and similar surfaces.
 * No deck, PDF, or public fundraising materials; contact only.
 */
export function PartnersInvestorsStrip() {
  return (
    <aside
      aria-label="For partners and institutional collaborators"
      className="border-t border-border/35 bg-muted/[0.03] py-10 sm:py-12"
    >
      <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-muted-foreground/70">
          For Partners &amp; Institutional Collaborators
        </p>
        <p className="mx-auto mt-3 max-w-xl text-xs leading-relaxed text-muted-foreground/90 sm:text-sm">
          We are building foundational infrastructure designed to improve standards and outcomes
          across global hair restoration medicine.
        </p>
        <p className="mx-auto mt-4 max-w-lg text-[11px] leading-relaxed text-muted-foreground/75 sm:text-xs">
          For strategic partnerships, institutional collaboration, or private discussions:
        </p>
        <div className="mt-5 flex flex-col items-center gap-1.5">
          <Link
            href="/contact?intent=partnership"
            className="text-xs font-medium text-foreground/90 underline decoration-primary/35 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary/60 sm:text-sm"
          >
            Contact our team
          </Link>
          <span className="text-[10px] tracking-wide text-muted-foreground/55">
            Private access only.
          </span>
        </div>
      </div>
    </aside>
  );
}
