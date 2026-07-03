/**
 * FI OS workspace chrome — shared with `fiAdminDashboard` / login (`FiOsLoginScreen`):
 * deep navy base, cyan accent, glass borders, slate text steps.
 */
export {
  fiAdminDashboard as fiOsDesignTokens,
  fiAdminAmbientBackgroundStyle,
} from "@/src/components/fi-admin/dashboard-ui/dashboardTheme";

import type { CSSProperties } from "react";

/** CSS custom properties — measured on `FiOsAppShell` root; fallbacks used until hydration. */
export const fiOsChromeCssVars = {
  topOffset: "--fi-os-top-chrome-offset",
  bottomOffset: "--fi-os-bottom-chrome-offset",
} as const;

/** ≈ compact command bar without banners (ResizeObserver replaces at runtime). */
export const FI_OS_TOP_CHROME_OFFSET_FALLBACK = "3.75rem";

/** Shared padding + flex sizing for FI OS `<main>` (vertical overflow chosen in `FiOsAppShell`). */
const FI_OS_MAIN_PAD =
  "relative min-h-0 flex-1 overflow-x-hidden px-3 py-3 sm:px-4 sm:py-4 lg:px-5 lg:py-5";

const FI_OS_RIGHT_DRAWER_TOP = `top-[var(${fiOsChromeCssVars.topOffset},${FI_OS_TOP_CHROME_OFFSET_FALLBACK})]`;
const FI_OS_RIGHT_DRAWER_BOTTOM = `bottom-[calc(var(${fiOsChromeCssVars.bottomOffset},0px)+env(safe-area-inset-bottom,0px))]`;

/** Inline style for measured chrome offsets (applied on `FiOsAppShell` root). */
export function buildFiOsChromeViewportStyle(topPx: number, bottomPx: number): CSSProperties {
  return {
    [fiOsChromeCssVars.topOffset as string]: `${Math.max(0, Math.round(topPx))}px`,
    [fiOsChromeCssVars.bottomOffset as string]: `${Math.max(0, Math.round(bottomPx))}px`,
  };
}

/** Scrollable primary nav list — flex child must use min-h-0 for overflow-y-auto to engage. */
export const FI_OS_SIDEBAR_NAV_SCROLL =
  "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-y-contain px-1.5 py-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] [overflow-scrolling:touch]";

/** Tailwind class bundles (static strings for build). */
export const fiOsChromeClasses = {
  /** Viewport-locked shell — only `<main>` and sidebar nav scroll vertically. */
  shellRoot:
    "flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden bg-[#081020] text-[#F8FAFC]",
  shellBody: "flex min-h-0 w-full flex-1 overflow-hidden",
  mainColumn: "flex min-h-0 min-w-0 flex-1 flex-col",
  /** Command bar — tighter vertical rhythm than marketing pages. */
  topBar:
    "sticky top-0 z-30 shrink-0 border-b border-white/[0.08] bg-[#0a1424]/92 px-3 py-2 backdrop-blur-xl sm:px-4 lg:px-5",
  /** Non-calendar tenant pages: single vertical scroll on `<main>`. */
  mainScroll: `${FI_OS_MAIN_PAD} overflow-y-auto overscroll-y-contain [overflow-scrolling:touch]`,
  /** Calendar subtree owns scroll; `<main>` does not scroll vertically (`isFiOsTenantCalendarPath`). */
  mainScrollCalendarLock: `${FI_OS_MAIN_PAD} overflow-hidden`,
  /** Extra bottom room for fixed Guided Assist + mobile bottom nav on scrollable main. */
  mainScrollFloatingAssistPad:
    "pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]",
  /** Tenant route inset card behind page content (glass + soft lift). */
  tenantMainSurface:
    "relative min-h-[min(32vh,400px)] rounded-xl border border-white/[0.08] bg-[#050a12]/94 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_10px_36px_rgba(0,0,0,0.32)]",
  /** Calendar fill chain — passes height to scheduling subtree (`overflow-hidden` stays on calendar layout). */
  tenantMainSurfaceFill: "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
  /** Scroll-friendly pages (Today, settings, etc.) — content grows `<main>` scroll height. */
  tenantMainSurfaceScroll: "flex min-w-0 flex-col",
  tenantMainSurfaceInner: "relative px-3 py-3 sm:px-4 sm:py-4 lg:px-5 lg:py-5",
  /** Desktop primary rail (decorative glow applied inline in `FiOsSidebar`) */
  sidebarRail:
    "relative z-20 hidden min-h-0 w-[260px] shrink-0 flex-col self-stretch overflow-hidden border-r border-white/[0.08] bg-[#060d18]/96 py-3 backdrop-blur-xl lg:flex lg:w-[272px]",
  /** Scrollable nav list inside rail / drawer (`FiOsModuleNav`). */
  sidebarNavScroll: FI_OS_SIDEBAR_NAV_SCROLL,
  /** D2 minimal nav rail — icon-first primary destinations. */
  minimalNavRail:
    "relative z-20 hidden min-h-0 w-[4.75rem] shrink-0 flex-col self-stretch overflow-hidden border-r border-white/[0.08] bg-[#060d18]/96 backdrop-blur-xl lg:flex",
  /** D2 mobile bottom action bar (replaces hamburger drawer). */
  mobileBottomNav:
    "fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around gap-0.5 border-t border-white/[0.08] bg-[#060d18]/96 px-1 py-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden",
  /** Extra bottom padding on `<main>` when the mobile bottom nav is mounted. */
  mainColumnMobileBottomNavPad: "pb-[calc(4.25rem+env(safe-area-inset-bottom))] lg:pb-0",
  /** Mobile drawer panel */
  sidebarDrawer:
    "relative flex h-full max-h-[100dvh] min-h-0 w-[min(88vw,300px)] flex-col overflow-hidden border-r border-white/[0.1] bg-[#060d18] shadow-2xl",
  /** Login-adjacent glass card (matches login form panel feel) */
  glassCard: "rounded-xl border border-cyan-500/10 bg-white/[0.03] backdrop-blur-md",
  /** OS section eyebrow (compact modules, control centre panels). */
  sectionEyebrow: "text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-slate-500",
  /** Shared control surface — search, quick create, icon buttons. */
  toolbarControlSurface:
    "rounded-xl border border-white/[0.1] bg-white/[0.05] text-slate-100 shadow-sm shadow-black/30 backdrop-blur-md transition hover:border-cyan-500/35 hover:bg-white/[0.08] hover:shadow-cyan-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40",
  /** Primary emphasis control (Quick create). */
  toolbarPrimaryAccent: "ring-1 ring-cyan-400/25 ring-offset-0 ring-offset-[#0a1424]",
  /**
   * Viewport-aware right drawer shell — sits below measured top chrome and above mobile bottom nav.
   * Pair with `rightDrawerPanel` + `rightDrawerBodyScroll` + `rightDrawerFooter`.
   */
  rightDrawerOverlay: `fixed inset-x-0 ${FI_OS_RIGHT_DRAWER_TOP} ${FI_OS_RIGHT_DRAWER_BOTTOM} flex justify-end`,
  rightDrawerBackdrop: "absolute inset-0 bg-black/55 backdrop-blur-[2px]",
  rightDrawerPanel:
    "relative flex h-full max-h-full w-full max-w-full flex-col overflow-hidden sm:mr-2 sm:max-w-md sm:rounded-2xl",
  rightDrawerHeader: "shrink-0",
  rightDrawerBodyScroll:
    "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain [overflow-scrolling:touch]",
  rightDrawerFooter: "shrink-0",
} as const;
