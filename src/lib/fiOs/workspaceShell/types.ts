/**
 * FI-UX-REBUILD D1 — universal workspace shell kinds.
 *
 * D1 ships patient / lead / appointment. Additional kinds are reserved for later
 * D1 follow-ups (case, consultation, payment, pathology) without renaming.
 */

export const D1_WORKSPACE_KINDS = ["patient", "lead", "appointment"] as const;

export type D1WorkspaceKind = (typeof D1_WORKSPACE_KINDS)[number];

/** All workspace kinds the shell may eventually support. */
export type WorkspaceKind =
  | D1WorkspaceKind
  | "booking"
  | "payment"
  | "pathology_result"
  | "surgery_case"
  | "staff"
  | "consultation"
  | "prescription";

export type WorkspaceRef = {
  kind: D1WorkspaceKind;
  id: string;
};

export function workspaceRefKey(ref: WorkspaceRef): string {
  return `${ref.kind}:${ref.id}`;
}

export function isD1WorkspaceKind(kind: string): kind is D1WorkspaceKind {
  return (D1_WORKSPACE_KINDS as readonly string[]).includes(kind);
}

export function parseWorkspaceRef(raw: string): WorkspaceRef | null {
  const trimmed = raw.trim();
  const colon = trimmed.indexOf(":");
  if (colon <= 0) return null;
  const kind = trimmed.slice(0, colon).trim().toLowerCase();
  const id = trimmed.slice(colon + 1).trim();
  if (!isD1WorkspaceKind(kind) || !id) return null;
  return { kind, id };
}
