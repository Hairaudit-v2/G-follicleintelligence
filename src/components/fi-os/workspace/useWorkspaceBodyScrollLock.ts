"use client";

import { useBodyScrollLock } from "@/src/lib/dom/useBodyScrollLock";

import { useWorkspaceShell } from "./WorkspaceShellContext";

/** Prevent background scroll while a workspace panel is open (mobile + desktop). */
export function useWorkspaceBodyScrollLock() {
  const { openWorkspaces } = useWorkspaceShell();
  useBodyScrollLock(openWorkspaces.length > 0);
}
