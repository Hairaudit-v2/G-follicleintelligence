import { Suspense } from "react";
import { headers } from "next/headers";

import { GuidedAssistWidget } from "@/src/components/onboarding-os/GuidedAssistWidget";
import { loadGuidedAssistSessionPayload } from "@/src/lib/onboarding-os/guidedAssist.server";

/**
 * Mounts the Clinic guide dock for authenticated tenant sessions when the guide is on
 * (or admin force-show / `?debug=guide` is active).
 *
 * When the guide is off, nothing is rendered — no floating chip or panel.
 * Staff turn it back on anytime via Settings → Clinic guide (per-user preference).
 * Collapse preference (while on) is remembered per tenant in localStorage.
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

  // Fully hide when preference is off (and not force-shown). Re-enable via settings.
  if (!result.payload.guideVisible) return null;

  return (
    <Suspense
      fallback={
        <div
          className="pointer-events-none fixed bottom-4 right-4 z-40 h-12 w-28 animate-pulse rounded-full bg-cyan-950/40"
          aria-hidden
        />
      }
    >
      <GuidedAssistWidget tenantId={tenantId} initialPayload={result.payload} />
    </Suspense>
  );
}
