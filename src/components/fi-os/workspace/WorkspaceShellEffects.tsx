"use client";

import { useWorkspaceEscapeClose } from "./useWorkspaceEscapeClose";
import { useWorkspaceBodyScrollLock } from "./useWorkspaceBodyScrollLock";

/** Side-effect hooks that must run inside WorkspaceShellContext. */
export function WorkspaceShellEffects() {
  useWorkspaceEscapeClose();
  useWorkspaceBodyScrollLock();
  return null;
}
