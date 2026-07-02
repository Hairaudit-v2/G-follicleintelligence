/**
 * FI-UX-REBUILD workspace shell kinds.
 *
 * D1: patient / lead / appointment.
 * D4: payment / pathology_result / surgery_case / consultation / staff.
 */

export const D1_WORKSPACE_KINDS = ["patient", "lead", "appointment"] as const;

export type D1WorkspaceKind = (typeof D1_WORKSPACE_KINDS)[number];

/** D4 secondary workspace kinds (shipped in FI-UX-REBUILD D4). */
export const D4_WORKSPACE_KINDS = [
  "payment",
  "pathology_result",
  "surgery_case",
  "consultation",
  "staff",
] as const;

export type D4WorkspaceKind = (typeof D4_WORKSPACE_KINDS)[number];

/** All kinds the workspace shell currently supports. */
export const WORKSPACE_SHELL_KINDS = [
  ...D1_WORKSPACE_KINDS,
  ...D4_WORKSPACE_KINDS,
] as const;

export type WorkspaceShellKind = (typeof WORKSPACE_SHELL_KINDS)[number];

/** All workspace kinds the shell may eventually support. */
export type WorkspaceKind =
  | WorkspaceShellKind
  | "booking"
  | "prescription";

export type WorkspaceRef = {
  kind: WorkspaceShellKind;
  id: string;
};

export function workspaceRefKey(ref: WorkspaceRef): string {
  return `${ref.kind}:${ref.id}`;
}

export function isD1WorkspaceKind(kind: string): kind is D1WorkspaceKind {
  return (D1_WORKSPACE_KINDS as readonly string[]).includes(kind);
}

export function isD4WorkspaceKind(kind: string): kind is D4WorkspaceKind {
  return (D4_WORKSPACE_KINDS as readonly string[]).includes(kind);
}

export function isWorkspaceShellKind(kind: string): kind is WorkspaceShellKind {
  return (WORKSPACE_SHELL_KINDS as readonly string[]).includes(kind);
}

export function parseWorkspaceRef(raw: string): WorkspaceRef | null {
  const trimmed = raw.trim();
  const colon = trimmed.indexOf(":");
  if (colon <= 0) return null;
  const kind = trimmed.slice(0, colon).trim().toLowerCase();
  const id = trimmed.slice(colon + 1).trim();
  if (!isWorkspaceShellKind(kind) || !id) return null;
  return { kind, id };
}
