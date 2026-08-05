import { logLegacyWorkforceRouteAccess } from "@/src/lib/workforce/legacyRouteTelemetry.server";

export const dynamic = "force-dynamic";

/**
 * Phase A1 telemetry shell — /hr/* (readiness export, IIOHR import, sync
 * health) is a live-but-unadvertised legacy surface. Logs each load so A2
 * redirects around real usage. No gating or chrome here: pages keep their own
 * access guards.
 */
export default async function HrLegacyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  if (tenantId?.trim()) {
    await logLegacyWorkforceRouteAccess("hr", tenantId.trim());
  }
  return <>{children}</>;
}
