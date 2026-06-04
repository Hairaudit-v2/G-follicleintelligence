import type { CSSProperties } from "react";

/**
 * FI Admin OS dashboard — Tailwind-oriented tokens (arbitrary values).
 * Aligns with Follicle Intelligence OS login: deep navy, cyan accent, glass surfaces.
 */
export const fiAdminDashboard = {
  bg: "#081020",
  surface: "#0F1629",
  surfaceElevated: "#141C33",
  cyan: "#22C1FF",
  cyanHover: "#0EA5E9",
  purple: "#7C3AED",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  text: "#F8FAFC",
  textMuted: "#94A3B8",
  border: "rgba(255,255,255,0.08)",
} as const;

/** Inline style for the ambient background (matches login radial + deep base). */
export const fiAdminAmbientBackgroundStyle: CSSProperties = {
  opacity: 0.95,
  background: [
    "radial-gradient(1200px 600px at 18% 0%, rgba(34, 193, 255, 0.14), transparent 55%)",
    "radial-gradient(900px 520px at 100% 18%, rgba(124, 58, 237, 0.07), transparent 50%)",
    "radial-gradient(700px 400px at 50% 100%, rgba(14, 165, 233, 0.06), transparent 45%)",
    `linear-gradient(180deg, ${fiAdminDashboard.bg} 0%, #0a1528 42%, ${fiAdminDashboard.bg} 100%)`,
  ].join(", "),
};
