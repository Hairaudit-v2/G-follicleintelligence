/**
 * Shared Tailwind class strings for marketing CTAs (homepage, placeholders).
 * Keeps gold-forward primary and glass secondary buttons visually aligned.
 */

/** Primary CTA — gold-forward; full width on small screens. */
export const MARKETING_CTA_PRIMARY_CLASS =
  "h-12 min-h-[48px] w-full justify-center gap-2 rounded-xl border border-amber-300/35 bg-gradient-to-b from-amber-200/[0.18] to-amber-200/[0.07] px-5 text-sm font-semibold text-foreground shadow-[0_14px_44px_rgb(212_175_55_/0.14),inset_0_1px_0_rgb(255_255_255_/0.12)] hover:from-amber-200/25 hover:to-amber-200/10 sm:h-11 sm:min-h-0 sm:w-auto sm:justify-between";

/** Secondary CTA — glass outline with gold hover. */
export const MARKETING_CTA_SECONDARY_CLASS =
  "h-12 min-h-[48px] w-full justify-center gap-2 rounded-xl border border-white/12 bg-background/35 px-5 text-sm font-semibold text-foreground shadow-[inset_0_1px_0_rgb(255_255_255_/0.06)] backdrop-blur-sm hover:border-amber-300/30 hover:bg-white/[0.04] sm:h-11 sm:min-h-0 sm:w-auto sm:justify-between";
