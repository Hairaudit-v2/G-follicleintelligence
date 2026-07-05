"use client";

import type { ReactNode } from "react";

/**
 * Re-mounts on tab navigations so route transitions are visibly distinct even
 * when the previous page content would otherwise linger during slow RSC loads.
 */
export default function TeamWorkspaceTemplate({ children }: { children: ReactNode }) {
  return <div className="min-w-0">{children}</div>;
}
