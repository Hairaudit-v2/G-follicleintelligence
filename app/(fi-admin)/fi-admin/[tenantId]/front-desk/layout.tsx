import { notFound } from "next/navigation";

import { cn } from "@/lib/utils";
import { FrontDeskSubNav } from "@/src/components/fi-os/front-desk/FrontDeskSubNav";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { assertFiTenantPortalAccessUnlessStaffPinSession } from "@/src/lib/fiOs/fiOsPortalGate.server";

export const dynamic = "force-dynamic";

export default async function FrontDeskLayout({
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

  return (
    <div className={cn(fiOsChromeClasses.pageScrollContent, "px-4 pt-8")}>
      <FrontDeskSubNav tenantId={tid} />
      {children}
    </div>
  );
}
