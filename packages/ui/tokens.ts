/**
 * Follicle Intelligence Network — shared design tokens.
 * Values align with the FI marketing surface (glass, charcoal, premium accents).
 * Pair with Tailwind utilities; use `platformSurfaceClasses()` for per-brand shells.
 */

export const networkSpacing = {
  sectionY: "py-16 sm:py-20 md:py-24",
  sectionX: "px-4 sm:px-6",
  stackLg: "space-y-12 md:space-y-16",
  stackMd: "space-y-8 md:space-y-10",
  gridGap: "gap-6 sm:gap-8",
} as const;

export const networkRadius = {
  card: "rounded-[1.35rem]",
  panel: "rounded-2xl",
  pill: "rounded-full",
  control: "rounded-md",
} as const;

export const networkShadow = {
  glass:
    "shadow-[0_20px_56px_rgb(0_0_0_/0.4),inset_0_1px_0_rgb(255_255_255_/0.06)]",
  glassLift:
    "shadow-[0_26px_72px_rgb(212_175_55_/0.1),inset_0_1px_0_rgb(255_255_255_/0.09)]",
  fiPanel: "shadow-fi-panel",
  subtle: "shadow-sm",
} as const;

/** Typography scale — class fragments for marketing surfaces */
export const networkTypography = {
  displayLg:
    "font-display text-4xl font-semibold tracking-tight sm:text-5xl md:text-[3.1rem] md:leading-[1.06]",
  displayMd:
    "font-display text-3xl font-semibold tracking-tight sm:text-4xl md:text-[2.75rem] md:leading-[1.12]",
  lead: "text-base leading-relaxed text-muted-foreground sm:text-lg md:leading-relaxed",
  eyebrow:
    "text-[10px] font-semibold uppercase tracking-[0.28em] sm:text-[11px]",
  monoEyebrow:
    "font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground",
} as const;

export type NetworkPlatform = "fi" | "hairaudit" | "hli" | "iiohr";

type PlatformTheme = {
  label: string;
  /** Primary accent (gold, emerald, etc.) */
  accentText: string;
  accentBorder: string;
  accentGlow: string;
  /** Page shell */
  surface: string;
  surfaceAlt: string;
  /** Muted clinical copy */
  muted: string;
  /** Optional light-mode shell (HLI) */
  lightSurface?: string;
  lightForeground?: string;
  lightMuted?: string;
};

export const platformColorTokens: Record<NetworkPlatform, PlatformTheme> = {
  fi: {
    label: "Follicle Intelligence",
    accentText: "text-amber-200/90",
    accentBorder: "border-amber-400/25",
    accentGlow: "from-amber-300/70 via-amber-400/25",
    surface: "bg-[rgb(2_2_10_/0.92)] text-foreground",
    surfaceAlt: "bg-background",
    muted: "text-muted-foreground",
  },
  hairaudit: {
    label: "HairAudit",
    accentText: "text-amber-200/90",
    accentBorder: "border-amber-400/30",
    accentGlow: "from-amber-200/70 via-sky-400/20",
    surface: "bg-[rgb(6_12_28_/0.96)] text-foreground",
    surfaceAlt: "bg-slate-950",
    muted: "text-slate-300/80",
  },
  hli: {
    label: "Hair Longevity Institute",
    accentText: "text-emerald-200/90",
    accentBorder: "border-emerald-400/30",
    accentGlow: "from-emerald-300/55 via-teal-400/22",
    surface: "bg-slate-950 text-foreground",
    surfaceAlt: "bg-emerald-950/25",
    muted: "text-slate-300/85",
    lightSurface: "bg-[#fbfefa] text-slate-900",
    lightForeground: "text-slate-900",
    lightMuted: "text-slate-600",
  },
  iiohr: {
    label: "IIOHR",
    accentText: "text-slate-200/90",
    accentBorder: "border-slate-300/20",
    accentGlow: "from-slate-200/55 via-amber-200/18",
    surface: "bg-[rgb(8_14_32_/0.97)] text-foreground",
    surfaceAlt: "bg-slate-950",
    muted: "text-slate-300/80",
  },
};

export function platformSurfaceClasses(
  platform: NetworkPlatform,
  appearance: "dark" | "light" = "dark"
): string {
  const t = platformColorTokens[platform];
  if (platform === "hli" && appearance === "light" && t.lightSurface) {
    return [t.lightSurface, t.lightForeground, t.lightMuted].filter(Boolean).join(" ");
  }
  return [t.surface, t.muted].join(" ");
}

export function platformAccentRuleClasses(platform: NetworkPlatform): string {
  const glow = platformColorTokens[platform].accentGlow;
  return `bg-gradient-to-r ${glow} to-transparent`;
}
