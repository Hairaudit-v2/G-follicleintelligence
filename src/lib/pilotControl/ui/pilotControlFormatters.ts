/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.5 — display formatters (pure).
 * Never invent readiness values; never treat unknown as ready.
 */

import type { PilotBlockerSeverity, PilotHealthVerdict } from "../pilotControlContracts";
import type {
  PilotControlHealthResponse,
  PilotControlOverview,
} from "../api/pilotControlApiTypes";

export type ReadinessDisplayLabel =
  | "Not started"
  | "In progress"
  | "Awaiting review"
  | "Attention required"
  | "Blocked"
  | "Ready"
  | "Completed"
  | "Not applicable"
  | "Unknown"
  | "Not evaluated in register"
  | "Blocker-derived attention";

const READY_LIKE = new Set(["ready", "completed"]);

/** Human label for readiness / domain status tokens from the API. */
export function formatReadinessLabel(raw: string | null | undefined): ReadinessDisplayLabel {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (!v || v === "unknown" || v === "not_evaluated") return "Unknown";
  if (v === "not_started") return "Not started";
  if (v === "in_progress") return "In progress";
  if (v === "awaiting_review") return "Awaiting review";
  if (v === "attention_required" || v === "attention") return "Attention required";
  if (v === "blocked") return "Blocked";
  if (v === "ready") return "Ready";
  if (v === "completed") return "Completed";
  if (v === "not_applicable" || v === "n_a" || v === "na") return "Not applicable";
  if (v === "not_evaluated_in_register") return "Not evaluated in register";
  if (v === "blocker_derived_attention") return "Blocker-derived attention";
  return "Unknown";
}

/** True when the value must not use success/ready styling. */
export function readinessMustNotLookReady(raw: string | null | undefined): boolean {
  const label = formatReadinessLabel(raw);
  return (
    label === "Unknown" ||
    label === "Not evaluated in register" ||
    label === "Blocker-derived attention" ||
    label === "Not applicable" ||
    label === "Attention required" ||
    label === "Blocked" ||
    label === "Not started" ||
    label === "In progress" ||
    label === "Awaiting review"
  );
}

export function readinessLooksReady(raw: string | null | undefined): boolean {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return READY_LIKE.has(v);
}

/** Rate display: null / NaN / zero-denominator → em dash, never 0%. */
export function formatRateOrDash(rate: number | null | undefined): string {
  if (rate == null || Number.isNaN(rate) || !Number.isFinite(rate)) return "—";
  return `${Math.round(rate * 1000) / 10}%`;
}

export function formatCountOrDash(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return String(n);
}

export function formatAgeSeconds(ageSeconds: number | null | undefined): string {
  if (ageSeconds == null || ageSeconds < 0 || Number.isNaN(ageSeconds)) return "—";
  if (ageSeconds < 60) return `${ageSeconds}s`;
  const mins = Math.floor(ageSeconds / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

export function formatDateTime(iso: string | null | undefined, timeZone = "Australia/Sydney"): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("en-AU", {
      timeZone,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

export function formatSeverityLabel(severity: PilotBlockerSeverity | string | null | undefined): string {
  const v = String(severity ?? "")
    .trim()
    .toLowerCase();
  if (v === "critical") return "Critical";
  if (v === "high") return "High";
  if (v === "attention") return "Attention";
  if (v === "info") return "Info";
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : "Unknown";
}

export function severitySortRank(severity: string | null | undefined): number {
  const v = String(severity ?? "")
    .trim()
    .toLowerCase();
  if (v === "critical") return 0;
  if (v === "high") return 1;
  if (v === "attention") return 2;
  if (v === "info") return 3;
  return 9;
}

export function formatExpansionRecommendation(
  rec: PilotControlOverview["health"]["expansionRecommendation"] | string | null | undefined
): string {
  switch (rec) {
    case "continue_current_scope":
      return "Continue within approved scope";
    case "hold_expansion":
      return "Hold expansion";
    case "pause_pilot":
      return "Pause pilot recommended";
    case "insufficient_evidence":
      return "Insufficient live evidence";
    default:
      return "—";
  }
}

export function formatProgrammeStatus(status: string | null | undefined): string {
  const v = String(status ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ");
  if (!v) return "Unknown";
  return v.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function healthVerdictTone(
  verdict: PilotHealthVerdict | string | null | undefined
): "success" | "warning" | "danger" | "neutral" {
  const v = String(verdict ?? "")
    .trim()
    .toUpperCase();
  if (v === "GREEN") return "success";
  if (v === "AMBER") return "warning";
  if (v === "RED") return "danger";
  return "neutral";
}

/** Empty / planned cohort must never present as GREEN success. */
export function coerceDisplayedHealthVerdict(args: {
  verdict: PilotHealthVerdict | string | null | undefined;
  expansionRecommendation?: string | null;
  totalApproved?: number;
  realPatientInvitesEnabled?: boolean;
}): { verdict: string; forceInsufficientEvidence: boolean } {
  const expansion = String(args.expansionRecommendation ?? "");
  const total = args.totalApproved ?? 0;
  if (
    expansion === "insufficient_evidence" ||
    (total === 0 && !args.realPatientInvitesEnabled)
  ) {
    return { verdict: "AMBER", forceInsufficientEvidence: true };
  }
  const v = String(args.verdict ?? "AMBER").toUpperCase();
  if (total === 0 && v === "GREEN") {
    return { verdict: "AMBER", forceInsufficientEvidence: true };
  }
  return { verdict: v, forceInsufficientEvidence: false };
}

export function healthBannerCopy(args: {
  verdict: string;
  expansionRecommendation?: string | null;
  forceInsufficientEvidence?: boolean;
  health?: PilotControlHealthResponse | null;
}): { title: string; body: string } {
  if (
    args.forceInsufficientEvidence ||
    args.expansionRecommendation === "insufficient_evidence"
  ) {
    return {
      title: "Insufficient live pilot evidence",
      body: "The platform is technically ready for controlled use, but no real patient cohort has been evaluated.",
    };
  }
  const v = String(args.verdict).toUpperCase();
  if (v === "GREEN") {
    return {
      title: "Pilot healthy within approved scope",
      body: "No critical stop conditions are open.",
    };
  }
  if (v === "RED") {
    return {
      title: "Pilot pause recommended",
      body: "A critical safety, identity, privacy or integrity condition is open.",
    };
  }
  return {
    title: "Pilot requires attention",
    body: "Expansion should remain on hold until the listed concerns are resolved.",
  };
}

/** Dimension readiness for register: never fabricate ready. */
export function registerDimensionDisplay(
  value: string | null | undefined,
  opts?: { approximate?: boolean }
): { label: ReadinessDisplayLabel; approximate: boolean; isReady: boolean } {
  const raw = String(value ?? "").trim();
  if (!raw || raw.toLowerCase() === "unknown") {
    return {
      label: "Not evaluated in register",
      approximate: true,
      isReady: false,
    };
  }
  if (opts?.approximate && !readinessLooksReady(raw)) {
    const label = formatReadinessLabel(raw);
    if (label === "Attention required" || label === "Blocked") {
      return { label: "Blocker-derived attention", approximate: true, isReady: false };
    }
  }
  const label = formatReadinessLabel(raw);
  return {
    label,
    approximate: Boolean(opts?.approximate),
    isReady: readinessLooksReady(raw) && label !== "Unknown",
  };
}

export function clampActivityRangeDays(days: number): number {
  if (!Number.isFinite(days) || days < 1) return 1;
  if (days > 31) return 31;
  return Math.floor(days);
}

export function activityDateRangeIso(preset: "today" | "7d" | "30d", now = new Date()): {
  from: string;
  to: string;
  days: number;
} {
  const to = now.toISOString();
  const days = preset === "today" ? 1 : preset === "7d" ? 7 : 30;
  const clamped = clampActivityRangeDays(days);
  const fromDate = new Date(now.getTime() - (clamped - 1) * 24 * 60 * 60 * 1000);
  fromDate.setUTCHours(0, 0, 0, 0);
  return { from: fromDate.toISOString(), to, days: clamped };
}
