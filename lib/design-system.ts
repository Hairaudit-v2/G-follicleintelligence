/**
 * Evolved Hair Clinics — Follicle Intelligence design system
 *
 * Tailwind + shadcn/ui token layer. No React dependency — safe for server and client.
 * Pair with `app/globals.css` CSS variables and `tailwind.config.ts` theme extensions.
 */

import type { BookingStatus, BookingType } from "@/src/lib/bookings/bookingPolicy";

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

/** Primary UI stack — load via `next/font/google` Inter in root layout when ready. */
export const fontFamily = {
  sans: [
    "Inter",
    "ui-sans-serif",
    "system-ui",
    "-apple-system",
    "Segoe UI",
    "Roboto",
    "Helvetica Neue",
    "Arial",
    "sans-serif",
  ],
  /** Display / marketing headings — optional Satoshi via local font or CDN. */
  display: ["Satoshi", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
  mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
} as const;

export const fontFamilyClassNames = {
  sans: "font-sans",
  display: "font-display",
  mono: "font-mono",
} as const;

/** Type scale — rem sizes with matching Tailwind utilities and line heights. */
export const typography = {
  display: {
    size: "2.25rem",
    lineHeight: "2.5rem",
    letterSpacing: "-0.025em",
    weight: 600,
    className: "font-display text-4xl font-semibold tracking-tight leading-tight sm:text-5xl",
  },
  h1: {
    size: "1.875rem",
    lineHeight: "2.25rem",
    letterSpacing: "-0.02em",
    weight: 600,
    className: "text-3xl font-semibold tracking-tight leading-tight",
  },
  h2: {
    size: "1.5rem",
    lineHeight: "2rem",
    letterSpacing: "-0.015em",
    weight: 600,
    className: "text-2xl font-semibold tracking-tight leading-snug",
  },
  h3: {
    size: "1.25rem",
    lineHeight: "1.75rem",
    letterSpacing: "-0.01em",
    weight: 600,
    className: "text-xl font-semibold tracking-tight",
  },
  h4: {
    size: "1.125rem",
    lineHeight: "1.625rem",
    letterSpacing: "-0.01em",
    weight: 600,
    className: "text-lg font-semibold",
  },
  body: {
    size: "0.875rem",
    lineHeight: "1.5rem",
    letterSpacing: "-0.006em",
    weight: 400,
    className: "text-sm leading-relaxed",
  },
  bodyLg: {
    size: "1rem",
    lineHeight: "1.625rem",
    letterSpacing: "-0.008em",
    weight: 400,
    className: "text-base leading-relaxed",
  },
  caption: {
    size: "0.75rem",
    lineHeight: "1.125rem",
    letterSpacing: "0",
    weight: 500,
    className: "text-xs font-medium leading-snug",
  },
  overline: {
    size: "0.6875rem",
    lineHeight: "1rem",
    letterSpacing: "0.08em",
    weight: 600,
    className: "text-[0.6875rem] font-semibold uppercase tracking-widest",
  },
} as const;

export type FiTypographyScale = keyof typeof typography;

// ---------------------------------------------------------------------------
// Spacing
// ---------------------------------------------------------------------------

/** Spacing scale (px) — mirrors Tailwind default with FI semantic aliases. */
export const spacing = {
  0: 0,
  px: 1,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  11: 44,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
} as const;

/** Layout rhythm helpers — compose with Tailwind `gap-*` / `p-*` at call sites. */
export const layoutSpacingClassNames = {
  pageX: "px-4 sm:px-6 lg:px-8",
  pageY: "py-6 sm:py-8",
  sectionY: "space-y-6",
  stackSm: "space-y-2",
  stackMd: "space-y-4",
  stackLg: "space-y-6",
  inlineSm: "gap-2",
  inlineMd: "gap-3",
  inlineLg: "gap-4",
} as const;

// ---------------------------------------------------------------------------
// Border radius
// ---------------------------------------------------------------------------

export const radius = {
  none: "0",
  sm: "calc(var(--radius) - 4px)",
  md: "calc(var(--radius) - 2px)",
  lg: "var(--radius)",
  xl: "calc(var(--radius) + 4px)",
  "2xl": "calc(var(--radius) + 8px)",
  full: "9999px",
} as const;

export const radiusClassNames = {
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  full: "rounded-full",
} as const;

// ---------------------------------------------------------------------------
// Shadows
// ---------------------------------------------------------------------------

export const shadowTokens = {
  xs: "0 1px 2px 0 rgb(15 23 42 / 6%)",
  sm: "0 1px 3px 0 rgb(15 23 42 / 10%), 0 1px 2px -1px rgb(15 23 42 / 8%)",
  md: "0 4px 6px -1px rgb(15 23 42 / 10%), 0 2px 4px -2px rgb(15 23 42 / 8%)",
  lg: "0 10px 15px -3px rgb(15 23 42 / 10%), 0 4px 6px -4px rgb(15 23 42 / 8%)",
  xl: "0 20px 25px -5px rgb(15 23 42 / 12%), 0 8px 10px -6px rgb(15 23 42 / 8%)",
  /** OS glass panel elevation */
  panel: "0 16px 50px rgb(1 5 12 / 48%), inset 0 1px 0 rgb(255 255 255 / 4%)",
  /** Calendar event chip */
  event: "0 1px 2px 0 rgb(15 23 42 / 8%)",
} as const;

export const shadowClassNames = {
  xs: "shadow-sm",
  sm: "shadow",
  md: "shadow-md",
  lg: "shadow-lg",
  xl: "shadow-xl",
  panel: "shadow-[0_16px_50px_rgb(1_5_12/48%)]",
  event: "shadow-sm",
  none: "shadow-none",
} as const;

// ---------------------------------------------------------------------------
// Procedure color families (calendar / CRM semantics)
// ---------------------------------------------------------------------------

export const fiProcedureFamilies = [
  "pre_surgery_consult",
  "full_transplant",
  "prp_session",
  "follow_up_nurse_prp",
  "virtual_zoom",
] as const;

export type FiProcedureFamily = (typeof fiProcedureFamilies)[number];

/** Human labels for legends, filters, and accessibility. */
export const fiProcedureFamilyLabels: Record<FiProcedureFamily, string> = {
  pre_surgery_consult: "Pre-Surgery Consult",
  full_transplant: "Full Transplant",
  prp_session: "PRP Session",
  follow_up_nurse_prp: "Follow-up / Nurse PRP",
  virtual_zoom: "Virtual / Zoom",
};

/**
 * Core hue per procedure — Tailwind palette key.
 * indigo · rose · emerald · sky · amber
 */
export const fiProcedureHue: Record<FiProcedureFamily, "indigo" | "rose" | "emerald" | "sky" | "amber"> = {
  pre_surgery_consult: "indigo",
  full_transplant: "rose",
  prp_session: "emerald",
  follow_up_nurse_prp: "sky",
  virtual_zoom: "amber",
};

/** HSL triplets (no `hsl()` wrapper) for CSS variables — light mode defaults. */
export const fiProcedureCssVarsLight: Record<FiProcedureFamily, { base: string; foreground: string; muted: string }> = {
  pre_surgery_consult: { base: "239 84% 67%", foreground: "243 75% 18%", muted: "226 100% 97%" },
  full_transplant: { base: "350 89% 60%", foreground: "343 84% 17%", muted: "356 100% 97%" },
  prp_session: { base: "160 84% 39%", foreground: "166 91% 9%", muted: "152 81% 96%" },
  follow_up_nurse_prp: { base: "199 89% 48%", foreground: "204 80% 16%", muted: "204 100% 97%" },
  virtual_zoom: { base: "38 92% 50%", foreground: "26 83% 14%", muted: "48 100% 96%" },
};

/** HSL triplets for dark mode surfaces. */
export const fiProcedureCssVarsDark: Record<FiProcedureFamily, { base: string; foreground: string; muted: string }> = {
  pre_surgery_consult: { base: "239 84% 67%", foreground: "226 100% 94%", muted: "243 47% 20%" },
  full_transplant: { base: "350 89% 60%", foreground: "356 100% 94%", muted: "343 50% 18%" },
  prp_session: { base: "160 84% 39%", foreground: "152 81% 92%", muted: "166 50% 14%" },
  follow_up_nurse_prp: { base: "199 89% 48%", foreground: "204 100% 94%", muted: "204 50% 16%" },
  virtual_zoom: { base: "38 92% 50%", foreground: "48 100% 92%", muted: "32 55% 16%" },
};

/** Badge / pill classes — light CRM surfaces with dark-mode counterparts. */
export const fiProcedureBadgeClassNames: Record<FiProcedureFamily, string> = {
  pre_surgery_consult:
    "border-indigo-200 bg-indigo-50 text-indigo-950 ring-1 ring-inset ring-indigo-600/15 dark:border-indigo-800/60 dark:bg-indigo-950/50 dark:text-indigo-100 dark:ring-indigo-400/20",
  full_transplant:
    "border-rose-200 bg-rose-50 text-rose-950 ring-1 ring-inset ring-rose-600/15 dark:border-rose-800/60 dark:bg-rose-950/50 dark:text-rose-100 dark:ring-rose-400/20",
  prp_session:
    "border-emerald-200 bg-emerald-50 text-emerald-950 ring-1 ring-inset ring-emerald-600/15 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-100 dark:ring-emerald-400/20",
  follow_up_nurse_prp:
    "border-sky-200 bg-sky-50 text-sky-950 ring-1 ring-inset ring-sky-600/15 dark:border-sky-800/60 dark:bg-sky-950/50 dark:text-sky-100 dark:ring-sky-400/20",
  virtual_zoom:
    "border-amber-200 bg-amber-50 text-amber-950 ring-1 ring-inset ring-amber-600/15 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-100 dark:ring-amber-400/20",
};

/** Calendar event border — per procedure family. */
export const fiProcedureBorderClassNames: Record<FiProcedureFamily, string> = {
  pre_surgery_consult: "border-indigo-300/80 dark:border-indigo-700/70",
  full_transplant: "border-rose-300/80 dark:border-rose-700/70",
  prp_session: "border-emerald-300/80 dark:border-emerald-700/70",
  follow_up_nurse_prp: "border-sky-300/80 dark:border-sky-700/70",
  virtual_zoom: "border-amber-300/80 dark:border-amber-700/70",
};

/** Calendar event background tint — per procedure family. */
export const fiProcedureBackgroundTintClassNames: Record<FiProcedureFamily, string> = {
  pre_surgery_consult: "bg-indigo-100/90 dark:bg-indigo-950/70",
  full_transplant: "bg-rose-100/90 dark:bg-rose-950/70",
  prp_session: "bg-emerald-100/90 dark:bg-emerald-950/70",
  follow_up_nurse_prp: "bg-sky-100/90 dark:bg-sky-950/70",
  virtual_zoom: "bg-amber-100/90 dark:bg-amber-950/70",
};

/** Calendar event foreground text — per procedure family. */
export const fiProcedureTextClassNames: Record<FiProcedureFamily, string> = {
  pre_surgery_consult: "text-indigo-950 dark:text-indigo-50",
  full_transplant: "text-rose-950 dark:text-rose-50",
  prp_session: "text-emerald-950 dark:text-emerald-50",
  follow_up_nurse_prp: "text-sky-950 dark:text-sky-50",
  virtual_zoom: "text-amber-950 dark:text-amber-50",
};

/** Calendar event block classes — higher contrast fill for time-grid chips. */
export const fiProcedureEventClassNames: Record<FiProcedureFamily, string> = {
  pre_surgery_consult: `${fiProcedureBorderClassNames.pre_surgery_consult} ${fiProcedureBackgroundTintClassNames.pre_surgery_consult} ${fiProcedureTextClassNames.pre_surgery_consult}`,
  full_transplant: `${fiProcedureBorderClassNames.full_transplant} ${fiProcedureBackgroundTintClassNames.full_transplant} ${fiProcedureTextClassNames.full_transplant}`,
  prp_session: `${fiProcedureBorderClassNames.prp_session} ${fiProcedureBackgroundTintClassNames.prp_session} ${fiProcedureTextClassNames.prp_session}`,
  follow_up_nurse_prp: `${fiProcedureBorderClassNames.follow_up_nurse_prp} ${fiProcedureBackgroundTintClassNames.follow_up_nurse_prp} ${fiProcedureTextClassNames.follow_up_nurse_prp}`,
  virtual_zoom: `${fiProcedureBorderClassNames.virtual_zoom} ${fiProcedureBackgroundTintClassNames.virtual_zoom} ${fiProcedureTextClassNames.virtual_zoom}`,
};

/** Left-edge accent bar / dot for compact list rows. */
export const fiProcedureAccentClassNames: Record<FiProcedureFamily, string> = {
  pre_surgery_consult: "bg-indigo-500 dark:bg-indigo-400",
  full_transplant: "bg-rose-500 dark:bg-rose-400",
  prp_session: "bg-emerald-500 dark:bg-emerald-400",
  follow_up_nurse_prp: "bg-sky-500 dark:bg-sky-400",
  virtual_zoom: "bg-amber-500 dark:bg-amber-400",
};

/** Map canonical booking types to procedure families. */
export const bookingTypeProcedureFamily: Record<BookingType, FiProcedureFamily> = {
  consultation: "pre_surgery_consult",
  surgery: "full_transplant",
  prp: "prp_session",
  prf: "prp_session",
  mesotherapy: "prp_session",
  exosomes: "prp_session",
  review: "follow_up_nurse_prp",
  follow_up: "follow_up_nurse_prp",
  other: "virtual_zoom",
};

// ---------------------------------------------------------------------------
// Appointment status colors
// ---------------------------------------------------------------------------

/** Primary workflow statuses requested for the CRM calendar. */
export const fiAppointmentStatuses = ["confirmed", "arrived", "completed", "no_show"] as const;

export type FiAppointmentStatus = (typeof fiAppointmentStatuses)[number];

export const fiAppointmentStatusLabels: Record<FiAppointmentStatus, string> = {
  confirmed: "Confirmed",
  arrived: "Arrived",
  completed: "Completed",
  no_show: "No-Show",
};

/** HSL triplets for status CSS variables (light). */
export const fiStatusCssVarsLight: Record<FiAppointmentStatus, { base: string; foreground: string; muted: string }> = {
  confirmed: { base: "217 91% 60%", foreground: "224 76% 18%", muted: "214 100% 97%" },
  arrived: { base: "38 92% 50%", foreground: "26 83% 14%", muted: "48 100% 96%" },
  completed: { base: "160 84% 39%", foreground: "166 91% 9%", muted: "152 81% 96%" },
  no_show: { base: "0 72% 51%", foreground: "0 74% 18%", muted: "0 86% 97%" },
};

export const fiStatusCssVarsDark: Record<FiAppointmentStatus, { base: string; foreground: string; muted: string }> = {
  confirmed: { base: "217 91% 60%", foreground: "214 100% 94%", muted: "224 50% 18%" },
  arrived: { base: "38 92% 50%", foreground: "48 100% 92%", muted: "32 55% 16%" },
  completed: { base: "160 84% 39%", foreground: "152 81% 92%", muted: "166 50% 14%" },
  no_show: { base: "0 72% 51%", foreground: "0 86% 94%", muted: "0 50% 18%" },
};

export const fiAppointmentStatusBadgeClassNames: Record<FiAppointmentStatus, string> = {
  confirmed:
    "border-sky-200 bg-sky-50 text-sky-950 ring-1 ring-inset ring-sky-500/20 dark:border-sky-800/60 dark:bg-sky-950/50 dark:text-sky-100 dark:ring-sky-400/25",
  arrived:
    "border-amber-200 bg-amber-50 text-amber-950 ring-1 ring-inset ring-amber-500/20 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-100 dark:ring-amber-400/25",
  completed:
    "border-emerald-200 bg-emerald-50 text-emerald-950 ring-1 ring-inset ring-emerald-500/20 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-100 dark:ring-emerald-400/25",
  no_show:
    "border-rose-200 bg-rose-50 text-rose-950 ring-1 ring-inset ring-rose-500/20 dark:border-rose-800/60 dark:bg-rose-950/50 dark:text-rose-100 dark:ring-rose-400/25",
};

/** Ring accent for calendar chips (non-terminal emphasis). */
export const fiAppointmentStatusRingClassNames: Record<FiAppointmentStatus, string> = {
  confirmed: "ring-1 ring-sky-400/50 dark:ring-sky-500/40",
  arrived: "ring-2 ring-amber-400/70 dark:ring-amber-500/50",
  completed: "ring-2 ring-emerald-400/70 dark:ring-emerald-500/50",
  no_show: "ring-2 ring-rose-400/80 dark:ring-rose-500/55",
};

/** Extended booking statuses beyond the four primary CRM states. */
export const fiExtendedStatusBadgeClassNames: Record<BookingStatus, string> = {
  scheduled:
    "border-slate-200 bg-slate-50 text-slate-800 ring-1 ring-inset ring-slate-400/20 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 dark:ring-slate-500/25",
  confirmed: fiAppointmentStatusBadgeClassNames.confirmed,
  arrived: fiAppointmentStatusBadgeClassNames.arrived,
  completed: fiAppointmentStatusBadgeClassNames.completed,
  cancelled:
    "border-slate-200 bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-400/15 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400 dark:ring-slate-600/20",
  no_show: fiAppointmentStatusBadgeClassNames.no_show,
};

// ---------------------------------------------------------------------------
// Surfaces (shadcn-compatible light / dark shells)
// ---------------------------------------------------------------------------

export const fiSurfaceClassNames = {
  clinicLight:
    "rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50",
  crmDocument:
    "rounded-lg border border-gray-200 bg-white text-gray-900 shadow-sm dark:border-gray-800 dark:bg-gray-950 dark:text-gray-50",
  osDark:
    "rounded-2xl border border-white/[0.08] bg-[#0F1629]/75 text-slate-50 shadow-xl shadow-black/40 backdrop-blur-md",
  muted:
    "rounded-lg border border-border bg-muted/40 text-muted-foreground dark:border-border dark:bg-muted/30",
} as const;

export type FiSurfaceVariant = keyof typeof fiSurfaceClassNames;

// ---------------------------------------------------------------------------
// Badge layout primitives
// ---------------------------------------------------------------------------

export const fiBadgeLayoutClassNames = {
  pill: "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
  chip: "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
  dot: "inline-block h-2 w-2 shrink-0 rounded-full",
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isFiProcedureFamily(v: string): v is FiProcedureFamily {
  return (fiProcedureFamilies as readonly string[]).includes(v.trim());
}

export function isFiAppointmentStatus(v: string): v is FiAppointmentStatus {
  return (fiAppointmentStatuses as readonly string[]).includes(v.trim() as FiAppointmentStatus);
}

/** Resolve procedure family from booking type and optional virtual flag in metadata. */
export function resolveProcedureFamily(input: {
  bookingType: string;
  isVirtual?: boolean;
}): FiProcedureFamily {
  if (input.isVirtual) return "virtual_zoom";
  const t = input.bookingType.trim();
  if (t in bookingTypeProcedureFamily) {
    return bookingTypeProcedureFamily[t as BookingType];
  }
  return "virtual_zoom";
}

export function procedureBadgeClasses(family: FiProcedureFamily): string {
  return `${fiBadgeLayoutClassNames.chip} ${fiProcedureBadgeClassNames[family]}`;
}

export function procedureEventClasses(family: FiProcedureFamily): string {
  return `${radiusClassNames.md} ${shadowClassNames.event} ${fiProcedureEventClassNames[family]}`;
}

export function procedureAccentDotClasses(family: FiProcedureFamily): string {
  return `${fiBadgeLayoutClassNames.dot} ${fiProcedureAccentClassNames[family]}`;
}

export function appointmentStatusBadgeClasses(status: string): string {
  const s = status.trim();
  if (s in fiExtendedStatusBadgeClassNames) {
    return `${fiBadgeLayoutClassNames.chip} ${fiExtendedStatusBadgeClassNames[s as BookingStatus]}`;
  }
  return `${fiBadgeLayoutClassNames.chip} ${fiExtendedStatusBadgeClassNames.scheduled}`;
}

export function appointmentStatusRingClasses(status: string): string {
  const s = status.trim();
  if (isFiAppointmentStatus(s)) return fiAppointmentStatusRingClassNames[s];
  return "";
}

export function bookingTypeProcedureBadgeClasses(bookingType: string, opts?: { isVirtual?: boolean }): string {
  return procedureBadgeClasses(resolveProcedureFamily({ bookingType, isVirtual: opts?.isVirtual }));
}

export function bookingTypeProcedureEventClasses(bookingType: string, opts?: { isVirtual?: boolean }): string {
  return procedureEventClasses(resolveProcedureFamily({ bookingType, isVirtual: opts?.isVirtual }));
}

/** CSS custom property names for globals.css — `--fi-procedure-{family}-{role}`. */
export function fiProcedureCssVarName(family: FiProcedureFamily, role: "base" | "foreground" | "muted"): string {
  return `--fi-procedure-${family.replace(/_/g, "-")}-${role}`;
}

export function fiStatusCssVarName(status: FiAppointmentStatus, role: "base" | "foreground" | "muted"): string {
  return `--fi-status-${status.replace(/_/g, "-")}-${role}`;
}
