import type { ReactNode } from "react";
import { getClinicFloorPageSession } from "@/src/lib/staffPin/clinicFloorAccess";

export const dynamic = "force-dynamic";

type AppointmentsShellLayoutProps = {
  children: ReactNode;
  params: Promise<{ tenantId: string }>;
};

/** Auth gate; slide-over provider is mounted on the page with booking context. */
export default async function AppointmentsShellLayout({ children, params }: AppointmentsShellLayoutProps) {
  const { tenantId } = await params;
  await getClinicFloorPageSession(tenantId);
  return children;
}
