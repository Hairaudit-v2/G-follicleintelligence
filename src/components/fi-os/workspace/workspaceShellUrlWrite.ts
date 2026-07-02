import {
  formatWorkspaceSearchParam,
  parseWorkspaceSearchParam,
} from "@/src/lib/fiOs/workspaceShell/workspaceQuery";
import type { WorkspaceRef } from "@/src/lib/fiOs/workspaceShell/types";
import { workspaceRefKey } from "@/src/lib/fiOs/workspaceShell/types";

export function buildWorkspaceQueryUrl(
  pathname: string,
  searchParams: URLSearchParams,
  stack: readonly WorkspaceRef[]
): string {
  const params = new URLSearchParams(searchParams.toString());
  const formatted = formatWorkspaceSearchParam(stack);
  if (formatted) params.set("workspace", formatted);
  else params.delete("workspace");
  const q = params.toString();
  return q ? `${pathname}?${q}` : pathname;
}

export function stacksEqual(a: readonly WorkspaceRef[], b: readonly WorkspaceRef[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((ref, i) => workspaceRefKey(ref) === workspaceRefKey(b[i]!));
}

export function parseWorkspaceStackFromSearchParams(
  searchParams: URLSearchParams | { get: (key: string) => string | null }
): WorkspaceRef[] {
  return parseWorkspaceSearchParam(searchParams.get("workspace"));
}
