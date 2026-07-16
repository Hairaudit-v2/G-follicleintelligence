import { Suspense } from "react";
import { headers } from "next/headers";

import { GuidedAssistWidget } from "@/src/components/onboarding-os/GuidedAssistWidget";
import { loadGuidedAssistSessionPayload } from "@/src/lib/onboarding-os/guidedAssist.server";

/**
 * Mounts the Clinic guide dock for every authenticated tenant session.
 * When the guide is off, the widget still renders a compact re-enable control
 * (and links to Settings → Clinic guide). Admins can force-show via cookie or `?debug=guide`.
 */
export async function GuidedAssistMount({ tenantId }: { tenantId: string }) {
  const h = headers();
  const pathname = h.get("x-pathname") ?? h.get("x-invoke-path") ?? `/fi-admin/${tenantId}`;
  const search =
    h.get("x-search") ??
    h.get("x-url")?.split("?")[1] ??
    h.get("referer")?.split("?")[1] ??
    null;

  const result = await loadGuidedAssistSessionPayload(tenantId, pathname, {
    search,
  });

  if (!result.ok || !result.payload) return null;

  return (
    <Suspense fallback={null}>
      <GuidedAssistWidget tenantId={tenantId} initialPayload={result.payload} />
    </Suspense>
  );
}
