"use client";

import { useEffect } from "react";

import { useWorkspaceShell } from "./WorkspaceShellContext";

/** Prevent background scroll while a workspace panel is open (mobile + desktop). */
export function useWorkspaceBodyScrollLock() {
  const { openWorkspaces } = useWorkspaceShell();

  useEffect(() => {
    if (openWorkspaces.length === 0) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [openWorkspaces.length]);
}
