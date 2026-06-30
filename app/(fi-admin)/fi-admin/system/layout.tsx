import type { ReactNode } from "react";

import { SystemAdminNav } from "@/src/components/fi-admin/system/SystemAdminNav";
import { assertFiPlatformAdminSystemAccess } from "@/src/lib/fiOs/fiOsPlatformSystemGate.server";

export const dynamic = "force-dynamic";

export default async function SystemAdminLayout({ children }: { children: ReactNode }) {
  await assertFiPlatformAdminSystemAccess();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-3 py-6 sm:px-4 lg:flex-row lg:py-8">
      <SystemAdminNav />
      <div className="min-w-0 flex-1 space-y-6">{children}</div>
    </div>
  );
}
