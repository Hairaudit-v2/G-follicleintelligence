/**
 * Patient workspace shared surface tokens.
 *
 * Dark-elevated card language that runs across PatientCommandHero,
 * PatientDetailsSummary, PatientCommandSummaryRow, and PatientOverviewTab.
 * All values are plain Tailwind className strings — no React dependency.
 */

/** Outer card shell — dark glass, consistent border + shadow. */
export const pwsCard =
  "rounded-xl border border-white/[0.07] bg-[#0c1220]/80 shadow-lg shadow-black/30";

/** Standard inner padding (omit when content needs edge-to-edge). */
export const pwsCardPad = "p-4 sm:p-5";

/** Full card shell with padding — convenience shorthand. */
export const pwsCardFull = `${pwsCard} ${pwsCardPad}`;

/** Card containing a legacy white-bg component (not fully controllable). */
export const pwsLegacyCard =
  "rounded-xl border border-slate-700/40 bg-[#0c1220]/60 shadow-md shadow-black/20";

/** Card section header: eyebrow, title, optional meta line. */
export const pwsTitle = "text-sm font-semibold text-slate-100";
export const pwsMeta = "mt-0.5 text-xs text-slate-500";

/** Uppercase field label (e.g. "Next appointment"). */
export const pwsLabel = "text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-slate-500";

/** Primary field value. */
export const pwsValue = "text-sm font-medium text-slate-200";

/** Muted secondary value / description. */
export const pwsValueMuted = "text-sm text-slate-400";

/** Horizontal divider on dark surface. */
export const pwsDivider = "border-t border-white/[0.06]";

/** Empty state paragraph. */
export const pwsEmpty = "text-sm text-slate-500";

/** Small metric tile (2×2 grid inside cards). */
export const pwsMetricTile = "rounded-lg border border-white/[0.06] bg-white/[0.04] p-2.5";

export const pwsMetricLabel = "text-[0.6rem] font-semibold uppercase tracking-wide text-slate-500";

export const pwsMetricValue = "mt-0.5 text-lg font-bold tabular-nums text-slate-100";

/** Ghost CTA chip — dark surface, muted text. */
export const pwsCta =
  "rounded-md border border-white/[0.10] bg-white/[0.05] px-2.5 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-white/[0.09] hover:text-slate-100";

/** Cyan primary CTA — high-value actions (Patient Twin, book appointment). */
export const pwsCtaCyan =
  "rounded-md border border-cyan-500/30 bg-cyan-950/60 px-2.5 py-1 text-xs font-semibold text-cyan-300 transition-colors hover:bg-cyan-900/70 hover:text-cyan-200";

/** Small badge pill on dark surface. */
export const pwsBadgeNeutral =
  "inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.06] px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400";
