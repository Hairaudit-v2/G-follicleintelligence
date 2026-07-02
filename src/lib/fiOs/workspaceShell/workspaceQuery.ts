import { parseWorkspaceRef, type WorkspaceRef } from "./types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Parse `?workspace=kind:id` or a comma-separated stack `kind:id,kind:id`. */
export function parseWorkspaceSearchParam(
  raw: string | string[] | null | undefined
): WorkspaceRef[] {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const t = v?.trim();
  if (!t) return [];

  return t
    .split(",")
    .map((segment) => parseWorkspaceRef(segment))
    .filter((ref): ref is WorkspaceRef => ref != null && UUID_RE.test(ref.id));
}

/** Serialize a workspace stack into a single `workspace` query value. */
export function formatWorkspaceSearchParam(stack: readonly WorkspaceRef[]): string | null {
  if (stack.length === 0) return null;
  return stack.map((ref) => `${ref.kind}:${ref.id}`).join(",");
}
