"use client";

import { useWorkspaceEscapeClose } from "./useWorkspaceEscapeClose";
import { useWorkspaceBodyScrollLock } from "./useWorkspaceBodyScrollLock";
import { useWorkspaceShell } from "./WorkspaceShellContext";
import { useWorkspaceSignalSync } from "./useWorkspaceSignalSync";

type WorkspaceShellEffectsProps = {
  workspaceSignalSyncEnabled?: boolean;
  workspaceRevisionPollEnabled?: boolean;
};

/** Side-effect hooks that must run inside WorkspaceShellContext. */
export function WorkspaceShellEffects({
  workspaceSignalSyncEnabled = true,
  workspaceRevisionPollEnabled = true,
}: WorkspaceShellEffectsProps) {
  const { tenantId, openWorkspaces, applyWorkspaceSignalUpdates } = useWorkspaceShell();

  useWorkspaceEscapeClose();
  useWorkspaceBodyScrollLock();
  useWorkspaceSignalSync({
    tenantId,
    openWorkspaces,
    enabled: workspaceSignalSyncEnabled,
    revisionPollEnabled: workspaceRevisionPollEnabled,
    applyWorkspaceSignalUpdates,
  });

  return null;
}
