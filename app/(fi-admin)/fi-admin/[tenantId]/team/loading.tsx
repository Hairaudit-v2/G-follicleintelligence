import { TeamWorkspacePageFallback } from "@/src/components/fi-os/team/TeamWorkspacePageFallback";

/**
 * Team workspace loading boundary — tab navigations render an immediate
 * skeleton instead of leaving the previous page frozen while the server
 * loads (which read as "clicking tabs does nothing").
 */
export default function TeamWorkspaceLoading() {
  return <TeamWorkspacePageFallback />;
}
