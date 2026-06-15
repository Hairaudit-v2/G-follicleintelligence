/**
 * FI design token helpers — Tailwind className string maps only.
 * No React dependency. Safe to import from server or client modules.
 *
 * These strings mirror existing FI surfaces; new call sites can adopt them incrementally.
 * Existing components are unchanged until explicitly migrated.
 */

/** Card / panel outer shell — full container classes where noted. */
export const fiSurfaceVariantClassNames = {
  /** OS glass panels (`DashboardCard`, dark tenant surfaces). */
  darkGlass:
    "rounded-xl border border-white/[0.08] bg-[#0F1629]/80 shadow-lg shadow-black/40 backdrop-blur-md",
  /** Clinic OS white cards (`FiCard`, `ClinicOsDashboardHome` sections). */
  clinicLight: "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5",
  /** CRM / directory gray document panels. */
  crmLight: "rounded-lg border border-gray-200 bg-white shadow-sm",
  /** HairAudit-style dark inset sections. */
  auditDark: "rounded-2xl border border-slate-700/80 bg-slate-900/60 p-6 backdrop-blur",
  /** Minimal bordered surface (tables, util strips) — add padding at call site if needed. */
  plain: "border border-gray-200 bg-white",
} as const;

export type FiSurfaceVariant = keyof typeof fiSurfaceVariantClassNames;

/**
 * Badge / pill semantic intents — color + ring (aligns with `PatientStatusBadge` / `SystemStatusBadge`).
 * At call site, add layout: e.g. `inline-flex items-center rounded-full font-medium` plus a density padding class.
 */
export const fiBadgeIntentClassNames = {
  success: "bg-emerald-100 text-emerald-900 ring-1 ring-inset ring-emerald-600/20",
  warning: "bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-600/20",
  danger: "bg-rose-100 text-rose-900 ring-1 ring-inset ring-rose-600/20",
  neutral: "bg-slate-100 text-slate-800 ring-1 ring-inset ring-slate-500/20",
  info: "bg-sky-100 text-sky-900 ring-1 ring-inset ring-sky-600/20",
  draft: "bg-zinc-100 text-zinc-800 ring-1 ring-inset ring-zinc-500/20",
  /** In-flight / waiting (distinct from `warning` operational caution). */
  pending: "bg-blue-50 text-blue-900 ring-1 ring-inset ring-blue-500/25",
  /** Terminal positive (e.g. checklist done) — slightly softer than `success`. */
  complete: "bg-emerald-50 text-emerald-900 ring-1 ring-inset ring-emerald-500/30",
} as const;

export type FiBadgeIntent = keyof typeof fiBadgeIntentClassNames;

/**
 * `FiStatusBadge` default “chip” shape — bordered `rounded-md` (distinct from ring-based `fiBadgeIntentClassNames` pills).
 */
export const fiStatusBadgeChipToneClassNames = {
  neutral: "border-slate-200 bg-slate-100 text-slate-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  danger: "border-red-200 bg-red-50 text-red-900",
  info: "border-sky-200 bg-sky-50 text-sky-900",
} as const;

export type FiStatusBadgeChipTone = keyof typeof fiStatusBadgeChipToneClassNames;

/**
 * Page header typography / rhythm — per variant, keyed by semantic part.
 * Compose on wrappers you already use (`header`, `div.min-w-0`, etc.).
 */
export const fiPageHeaderVariantClassNames = {
  /** Dark OS glass sections (`SectionHeader`, setup modules on `#0F1629`). */
  osDark: {
    root: "space-y-0.5",
    eyebrow: "text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-[#22C1FF]/85",
    title: "text-xs font-semibold tracking-tight text-[#F8FAFC] sm:text-sm",
    description: "max-w-2xl text-[11px] leading-relaxed text-[#94A3B8] sm:text-xs",
    meta: "text-[11px] text-[#64748B]",
  },
  /** Clinic OS light welcome / `FiPageHeader`-style titles on white + slate. */
  clinicLight: {
    root: "min-w-0 space-y-1",
    eyebrow: "text-xs font-semibold uppercase tracking-wide text-sky-700",
    title: "text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl",
    description: "max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base",
    meta: "text-xs text-slate-500",
  },
  /** Portal entry (OS login, HairAudit hub hero). */
  portal: {
    root: "space-y-2 text-center",
    eyebrow: "text-xs font-semibold uppercase tracking-[0.35em] text-cyan-400/90",
    title: "text-3xl font-semibold tracking-tight text-white sm:text-4xl",
    description: "text-sm text-slate-400 sm:text-base",
    meta: "text-xs text-slate-500",
  },
  /** CRM / cases / patients document pages (`gray-900` headings, blue links). */
  document: {
    root: "space-y-1",
    eyebrow: "text-xs font-semibold uppercase tracking-wide text-gray-500",
    title: "text-lg font-semibold text-gray-900",
    description: "max-w-3xl text-sm text-gray-600",
    /** Inline nav / “back to” links on document pages. */
    link: "text-sm text-blue-600 hover:underline",
    meta: "text-xs text-gray-500",
  },
} as const;

export type FiPageHeaderVariant = keyof typeof fiPageHeaderVariantClassNames;

/**
 * **FI OS light form surfaces** — typography and control colors that stay readable while `<html class="dark">`
 * is set globally (`app/layout.tsx`). Tailwind’s `dark:` variant still applies under that flag, so patterns
 * like `text-slate-800 dark:text-slate-100` on a **white** `clinicLight` / `FiCard` default (`bg-white`) card
 * produce white-on-white text. Use this map for those panels instead of `dark:` text classes.
 * **Use** for: labels, helpers, section copy, and inset inputs on white/off-white cards rendered inside the FI OS
 * tenant shell (e.g. ConsultationOS guided form, `FiCard` defaults, `FiSection` with default `clinicLight`).
 *
 * **Do not use** for: `darkGlass` / `auditDark` cards, primary sidebar / top bar, or any surface that already
 * commits to a dark background for both light and dark branches. There, keep explicit dark-theme pairs or OS
 * chrome tokens (`fiOsChromeClasses`, etc.). If a whole panel flips with `bg-white dark:bg-slate-950` **and**
 * matching `text-slate-900 dark:text-slate-100`, that is self-consistent — this map is not required.
 *
 * **Inset controls** (`controlInset*`) use `#020617`, `text-white`, and `placeholder:text-slate-400` so values
 * and placeholders stay AA-friendly on the light card without relying on `dark:`.
 */
export const fiOsLightFormSurfaceClassNames = {
  sectionTitle: "text-lg font-semibold text-slate-900",
  panelCaption: "text-sm font-semibold uppercase tracking-wide text-slate-600",
  label: "block text-sm font-medium text-slate-800",
  labelInline: "text-sm font-medium text-slate-800",
  compactLabel: "text-xs font-medium text-slate-700",
  legend: "text-sm font-medium text-slate-800",
  legendCompact: "text-xs font-medium text-slate-700",
  helper: "text-xs leading-relaxed text-slate-600",
  meta: "text-xs text-slate-500",
  body: "text-sm text-slate-800",
  bodyMuted: "text-sm text-slate-600",
  choiceRow: "flex items-center gap-2 text-sm text-slate-800",
  requiredMark: "text-red-600",
  /** Text-like inputs, selects, textareas — dark control on light card */
  controlInset:
    "w-full rounded-lg border border-slate-700 bg-[#020617] px-3 py-2 text-sm text-white shadow-sm placeholder:text-slate-400 selection:bg-cyan-500/25 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/35 disabled:cursor-not-allowed disabled:opacity-60",
  controlInsetDate:
    "w-full max-w-xs rounded-lg border border-slate-700 bg-[#020617] px-3 py-2 text-sm text-white shadow-sm [color-scheme:dark] focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/35 disabled:cursor-not-allowed disabled:opacity-60",
  /** Boolean / checkbox-group / radio — on white card */
  choiceCheckbox:
    "h-4 w-4 shrink-0 rounded border-slate-500 text-cyan-600 focus:ring-2 focus:ring-cyan-400/35 disabled:opacity-60",
  /** Small bordered chips (quick inserts, secondary buttons) on the light form */
  chipNeutral:
    "min-h-[40px] touch-manipulation rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm transition hover:border-cyan-300 hover:bg-cyan-50/50",
} as const;

/** Full-width interactive button / link affordances (primary actions). */
export const fiButtonVariantClassNames = {
  /** FI OS gradient CTA (`FiHomeDashboard` empty state / primary CTA pattern). */
  osPrimary:
    "inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-cyan-950/40 transition duration-200 ease-out hover:-translate-y-0.5 hover:from-cyan-500 hover:to-sky-500 hover:shadow-xl hover:shadow-cyan-500/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#22C1FF]/60",
  /** Clinic OS solid primary (`ClinicOsDashboardHome` “New booking”). */
  clinicPrimary:
    "inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2",
  /** Neutral filled / secondary (`PatientDirectoryFilters` Apply-adjacent). */
  neutral:
    "inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-400/40 focus-visible:ring-offset-2",
  /** Text / low-emphasis control (footer links, tertiary). */
  ghost:
    "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-400/30",
  /** Destructive confirmation (aligns with shadcn destructive tone). */
  danger:
    "inline-flex items-center justify-center rounded-lg border border-rose-500/40 bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 focus-visible:outline focus-visible:ring-2 focus-visible:ring-rose-400/60 focus-visible:ring-offset-2",
} as const;

export type FiButtonVariant = keyof typeof fiButtonVariantClassNames;

/** Section / card gutter + padding density (single map: compact | default | spacious). */
export const fiDensityClassNames = {
  compact: "gap-2 p-3",
  default: "gap-3 p-4 sm:p-5",
  spacious: "gap-4 p-6 sm:p-8",
} as const;

export type FiDensity = keyof typeof fiDensityClassNames;
