"use client";

import { createContext, useContext } from "react";

import type { WorkspaceRef, WorkspaceShellKind } from "@/src/lib/fiOs/workspaceShell/types";

export type WorkspaceShellOperatorContext = {
  tenantId: string;
  operatorFiUserId: string;
  userRole: string;
  canUseClinicFeatures?: boolean;
  canCapturePatientPhotos?: boolean;
};

export type WorkspaceShellContextValue = WorkspaceShellOperatorContext & {
  /** Full open stack — bottom (index 0) to top. */
  openWorkspaces: WorkspaceRef[];
  /** Topmost workspace, if any. */
  activeWorkspace: WorkspaceRef | null;
  /** Replace the stack with a single workspace (Today feed, search result). */
  openWorkspace: (ref: WorkspaceRef) => void;
  /** Push a linked entity on top (patient → lead drill-down). */
  pushWorkspace: (ref: WorkspaceRef) => void;
  /** Close the top workspace; clears the stack when empty. */
  popWorkspace: () => void;
  /** Close every open workspace. */
  closeAll: () => void;
  activeOfKind: (kind: WorkspaceShellKind) => WorkspaceRef | null;
  /** Internal — full stack replace (URL sync). */
  setStack: (stack: WorkspaceRef[]) => void;
};

export const WorkspaceShellContext = createContext<WorkspaceShellContextValue | null>(null);

export function useWorkspaceShell(): WorkspaceShellContextValue {
  const v = useContext(WorkspaceShellContext);
  if (!v) throw new Error("useWorkspaceShell must be used within WorkspaceShellProvider");
  return v;
}

export function useWorkspaceShellOptional(): WorkspaceShellContextValue | null {
  return useContext(WorkspaceShellContext);
}
