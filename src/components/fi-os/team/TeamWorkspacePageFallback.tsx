import { WorkforceOsSkeleton } from "@/src/components/fi-admin/workforce/WorkforceOsSkeleton";

/** Immediate fallback while a team workspace tab page loads. */
export function TeamWorkspacePageFallback() {
  return (
    <div aria-busy="true" aria-live="polite" data-testid="team-workspace-page-loading">
      <p className="sr-only">Loading team workspace…</p>
      <WorkforceOsSkeleton />
    </div>
  );
}
