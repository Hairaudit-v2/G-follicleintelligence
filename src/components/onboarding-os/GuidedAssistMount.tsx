import { headers } from "next/headers";

import { GuidedAssistWidget } from "@/src/components/onboarding-os/GuidedAssistWidget";
import { loadGuidedAssistSessionPayload } from "@/src/lib/onboarding-os/guidedAssist.server";

/**
 * Mounts the Clinic guide dock for every authenticated tenant session.
 * When the guide is off, the widget still renders a compact re-enable control
 * (and links to Settings → Clinic guide).
 */
export async function GuidedAssistMount({ tenantId }: { tenantId: string }) {
  const pathname = headers().get("x-pathname") ?? `/fi-admin/${tenantId}`;
  const result = await loadGuidedAssistSessionPayload(tenantId, pathname);

  if (!result.ok || !result.payload) return null;

  return <GuidedAssistWidget tenantId={tenantId} initialPayload={result.payload} />;
}
