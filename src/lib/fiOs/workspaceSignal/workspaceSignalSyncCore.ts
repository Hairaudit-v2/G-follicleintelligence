import type { WorkspaceRef } from "@/src/lib/fiOs/workspaceShell/types";
import { workspaceRefKey } from "@/src/lib/fiOs/workspaceShell/types";

import {
  getWorkspaceSignalReason,
  shouldWorkspaceRevalidateForSignal,
  type WorkspaceSignalPayload,
} from "./workspaceSignalRegistry";

/** FI-UX-REBUILD D6D — debounce window for workspace signal refresh cycles. */
export const WORKSPACE_SIGNAL_DEBOUNCE_MS = 1_250;

export type WorkspaceSignalUpdate = {
  reason: string;
  at: string;
};

export function collectAffectedWorkspaceUpdates(
  openWorkspaces: readonly WorkspaceRef[],
  signals: readonly WorkspaceSignalPayload[],
  at: string = new Date().toISOString()
): Record<string, WorkspaceSignalUpdate> {
  const updates: Record<string, WorkspaceSignalUpdate> = {};

  for (const workspace of openWorkspaces) {
    for (const signal of signals) {
      if (!shouldWorkspaceRevalidateForSignal(workspace, signal)) continue;
      updates[workspaceRefKey(workspace)] = {
        reason: getWorkspaceSignalReason(signal.signalType, workspace.kind),
        at,
      };
      break;
    }
  }

  return updates;
}

export function mergeWorkspaceSignalUpdates(
  previous: Readonly<Record<string, WorkspaceSignalUpdate>>,
  incoming: Readonly<Record<string, WorkspaceSignalUpdate>>
): Record<string, WorkspaceSignalUpdate> {
  return { ...previous, ...incoming };
}

export function shouldSkipDuplicateRevisionTick(
  previousRevision: string | null,
  nextRevision: string | null
): boolean {
  if (!nextRevision) return true;
  return previousRevision === nextRevision;
}
