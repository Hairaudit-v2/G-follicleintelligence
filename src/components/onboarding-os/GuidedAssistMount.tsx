import { headers } from "next/headers";

import { GuidedAssistWidget } from "@/src/components/onboarding-os/GuidedAssistWidget";
import { loadGuidedAssistSessionPayload } from "@/src/lib/onboarding-os/guidedAssist.server";

export async function GuidedAssistMount({ tenantId }: { tenantId: string }) {
  const pathname = headers().get("x-pathname") ?? `/fi-admin/${tenantId}`;
  const result = await loadGuidedAssistSessionPayload(tenantId, pathname);

  if (!result.ok || !result.payload) return null;

  return <GuidedAssistWidget tenantId={tenantId} initialPayload={result.payload} />;
}
