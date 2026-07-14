import { notFound } from "next/navigation";

import { cn } from "@/lib/utils";
import { SurgerySubNav } from "@/src/components/fi-os/surgery/SurgerySubNav";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { assertFiTenantPortalAccessUnlessStaffPinSession } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { readFiProcedureDayEnabled } from "@/src/lib/procedureDay/procedureDayEnv.server";

export const dynamic = "force-dynamic";

export default async function SurgeryLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  const tid = tenantId.trim();
  await assertFiTenantPortalAccessUnlessStaffPinSession(tid);
  const showProcedureDayNav = readFiProcedureDayEnabled();

  return (
    <div className={cn(fiOsChromeClasses.pageScrollContent, "px-4 pt-8")}>
      <SurgerySubNav tenantId={tid} showProcedureDayNav={showProcedureDayNav} />
      {children}
    </div>
  );
}
