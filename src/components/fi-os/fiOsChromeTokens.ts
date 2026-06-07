/**
 * FI OS workspace chrome — shared with `fiAdminDashboard` / login (`FiOsLoginScreen`):
 * deep navy base, cyan accent, glass borders, slate text steps.
 */
export { fiAdminDashboard as fiOsDesignTokens, fiAdminAmbientBackgroundStyle } from "@/src/components/fi-admin/dashboard-ui/dashboardTheme";

/** Tailwind class bundles (static strings for build). */
export const fiOsChromeClasses = {
  shellRoot: "flex min-h-[100dvh] w-full flex-col bg-[#081020] text-[#F8FAFC]",
  shellBody: "flex min-h-[100dvh] w-full min-h-0 flex-1",
  mainColumn: "flex min-h-0 min-w-0 flex-1 flex-col",
  /** Command bar — tighter vertical rhythm than marketing pages. */
  topBar: "sticky top-0 z-30 shrink-0 border-b border-white/[0.08] bg-[#0a1424]/92 px-3 py-2 backdrop-blur-xl sm:px-4 lg:px-5",
  /** Main workspace gutter — app density (not wide marketing margins). */
  mainScroll: "relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 sm:px-4 sm:py-4 lg:px-5 lg:py-5",
  /** Tenant route inset card behind page content (glass + soft lift). */
  tenantMainSurface:
    "relative min-h-[min(32vh,400px)] overflow-hidden rounded-xl border border-white/[0.08] bg-[#050a12]/94 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_10px_36px_rgba(0,0,0,0.32)]",
  tenantMainSurfaceInner: "relative px-3 py-3 sm:px-4 sm:py-4 lg:px-5 lg:py-5",
  /** Desktop primary rail (decorative glow applied inline in `FiOsSidebar`) */
  sidebarRail:
    "relative hidden w-[260px] shrink-0 flex-col border-r border-white/[0.08] bg-[#060d18]/96 py-3 backdrop-blur-xl lg:flex lg:w-[272px]",
  /** Mobile drawer panel */
  sidebarDrawer: "relative flex h-full w-[min(88vw,300px)] flex-col border-r border-white/[0.1] bg-[#060d18] shadow-2xl",
  /** Login-adjacent glass card (matches login form panel feel) */
  glassCard: "rounded-xl border border-cyan-500/10 bg-white/[0.03] backdrop-blur-md",
  /** OS section eyebrow (compact modules, control centre panels). */
  sectionEyebrow: "text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-slate-500",
  /** Shared control surface — search, quick create, icon buttons. */
  toolbarControlSurface:
    "rounded-xl border border-white/[0.1] bg-white/[0.05] text-slate-100 shadow-sm shadow-black/30 backdrop-blur-md transition hover:border-cyan-500/35 hover:bg-white/[0.08] hover:shadow-cyan-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40",
  /** Primary emphasis control (Quick create). */
  toolbarPrimaryAccent: "ring-1 ring-cyan-400/25 ring-offset-0 ring-offset-[#0a1424]",
} as const;
