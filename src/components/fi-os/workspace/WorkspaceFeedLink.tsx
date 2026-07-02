"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent, ReactNode } from "react";

import { inferWorkspaceFromHref } from "@/src/lib/fiOs/workspaceShell/workspaceHref";

import { useWorkspaceShellOptional } from "./WorkspaceShellContext";

type WorkspaceFeedLinkProps = Omit<ComponentProps<typeof Link>, "href" | "onClick"> & {
  href: string;
  children: ReactNode;
  /** When true, push onto the stack instead of replacing (linked-entity drill-down). */
  push?: boolean;
};

/**
 * Opens a workspace panel when the shell is active; otherwise navigates normally.
 */
export function WorkspaceFeedLink({ href, push = false, children, ...rest }: WorkspaceFeedLinkProps) {
  const shell = useWorkspaceShellOptional();
  const workspace = inferWorkspaceFromHref(href);

  if (!shell || !workspace) {
    return (
      <Link href={href} {...rest}>
        {children}
      </Link>
    );
  }

  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    if (push) shell!.pushWorkspace(workspace!);
    else shell!.openWorkspace(workspace!);
  }

  return (
    <Link href={href} {...rest} onClick={onClick}>
      {children}
    </Link>
  );
}
