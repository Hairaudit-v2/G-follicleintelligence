"use client";

import { useWorkspaceShell } from "@/src/components/fi-os/workspace/WorkspaceShellContext";
import type { WorkspaceRef } from "@/src/lib/fiOs/workspaceShell/types";

export type WorkspacePanelSignalRefresh = {
  signalRefreshToken?: number;
  lastSignalReason?: string;
  lastSignalAt?: string;
};

/** D6D — read soft refresh metadata for a workspace panel. */
export function useWorkspacePanelSignalRefresh(ref: WorkspaceRef | null): WorkspacePanelSignalRefresh {
  const { getWorkspaceSignalMeta } = useWorkspaceShell();
  if (!ref) {
    return { signalRefreshToken: 0 };
  }
  const meta = getWorkspaceSignalMeta(ref);
  return {
    signalRefreshToken: meta?.revision ?? 0,
    lastSignalReason: meta?.lastSignalReason,
    lastSignalAt: meta?.lastSignalAt,
  };
}