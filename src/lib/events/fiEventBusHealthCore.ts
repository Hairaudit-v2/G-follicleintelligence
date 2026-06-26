/**
 * FI Event Bus health types and UI helpers (client-safe).
 */

export type FiEventBusHealthStatus = "healthy" | "degraded" | "failing";

export type FiEventBusHealthClientModel = {
  emittedLast24h: number;
  pendingDeliveries: number;
  failedDeliveries: number;
  lastEventName: string | null;
  lastEventAt: string | null;
  lastFailure: {
    eventName: string;
    error: string | null;
    at: string;
  } | null;
  healthStatus: FiEventBusHealthStatus;
};

export function formatFiEventBusHealthLabel(status: FiEventBusHealthStatus): string {
  if (status === "healthy") return "Healthy";
  if (status === "degraded") return "Degraded";
  return "Failing";
}

export function fiEventBusHealthBadgeClass(status: FiEventBusHealthStatus): string {
  if (status === "healthy") return "bg-emerald-500/15 text-emerald-300";
  if (status === "degraded") return "bg-amber-500/15 text-amber-300";
  return "bg-red-500/15 text-red-300";
}
