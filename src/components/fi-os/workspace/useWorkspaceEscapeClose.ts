"use client";

import { useEffect } from "react";

import { useWorkspaceShell } from "./WorkspaceShellContext";

/** Central Escape handler — closes the top workspace panel. */
export function useWorkspaceEscapeClose() {
  const { popWorkspace, openWorkspaces } = useWorkspaceShell();

  useEffect(() => {
    if (openWorkspaces.length === 0) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      popWorkspace();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openWorkspaces.length, popWorkspace]);
}
