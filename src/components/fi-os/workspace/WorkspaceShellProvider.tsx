"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { formatWorkspaceSearchParam } from "@/src/lib/fiOs/workspaceShell/workspaceQuery";
import type { WorkspaceRef, WorkspaceShellKind } from "@/src/lib/fiOs/workspaceShell/types";
import { workspaceRefKey } from "@/src/lib/fiOs/workspaceShell/types";

import {
  WorkspaceShellContext,
  type WorkspaceShellContextValue,
  type WorkspaceShellOperatorContext,
  type WorkspaceSignalSyncMeta,
} from "./WorkspaceShellContext";
import { WorkspaceShellStack } from "./WorkspaceShellStack";
import { WorkspaceShellEffects } from "./WorkspaceShellEffects";
import {
  buildWorkspaceQueryUrl,
  parseWorkspaceStackFromSearchParams,
  stacksEqual,
} from "./workspaceShellUrlWrite";

function normalizeRef(ref: WorkspaceRef): WorkspaceRef {
  return { kind: ref.kind, id: ref.id.trim() };
}

function dedupePush(stack: WorkspaceRef[], ref: WorkspaceRef): WorkspaceRef[] {
  const key = workspaceRefKey(ref);
  const without = stack.filter((item) => workspaceRefKey(item) !== key);
  return [...without, ref];
}

export type WorkspaceShellProviderProps = WorkspaceShellOperatorContext & {
  children: ReactNode;
  workspaceSignalSyncEnabled?: boolean;
  workspaceRevisionPollEnabled?: boolean;
};

function WorkspaceShellProviderInner({
  children,
  tenantId,
  operatorFiUserId,
  userRole,
  canUseClinicFeatures,
  canCapturePatientPhotos = false,
  workspaceSignalSyncEnabled = true,
  workspaceRevisionPollEnabled = true,
}: WorkspaceShellProviderProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const [openWorkspaces, setOpenWorkspaces] = useState<WorkspaceRef[]>(() =>
    parseWorkspaceStackFromSearchParams(searchParams)
  );
  const [workspaceSignalByKey, setWorkspaceSignalByKey] = useState<
    Record<string, WorkspaceSignalSyncMeta>
  >({});
  /** Skip one URL→stack echo after we push/replace from user actions. */
  const skipUrlSyncRef = useRef(false);

  const writeStackToUrl = useCallback(
    (stack: readonly WorkspaceRef[], mode: "push" | "replace") => {
      skipUrlSyncRef.current = true;
      const next = buildWorkspaceQueryUrl(pathname, new URLSearchParams(searchParams.toString()), stack);
      if (mode === "push") router.push(next, { scroll: false });
      else router.replace(next, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  // Browser back/forward and external URL edits → stack.
  useEffect(() => {
    if (skipUrlSyncRef.current) {
      skipUrlSyncRef.current = false;
      return;
    }
    const fromUrl = parseWorkspaceStackFromSearchParams(searchParams);
    setOpenWorkspaces((prev) => (stacksEqual(fromUrl, prev) ? prev : fromUrl));
  }, [searchParams]);

  const openWorkspace = useCallback(
    (ref: WorkspaceRef) => {
      const stack = [normalizeRef(ref)];
      setOpenWorkspaces(stack);
      writeStackToUrl(stack, "push");
    },
    [writeStackToUrl]
  );

  const pushWorkspace = useCallback(
    (ref: WorkspaceRef) => {
      setOpenWorkspaces((prev) => {
        const next = dedupePush(prev, normalizeRef(ref));
        writeStackToUrl(next, "push");
        return next;
      });
    },
    [writeStackToUrl]
  );

  const closeAll = useCallback(() => {
    setOpenWorkspaces([]);
    writeStackToUrl([], "replace");
  }, [writeStackToUrl]);

  const popWorkspace = useCallback(() => {
    setOpenWorkspaces((prev) => {
      if (prev.length <= 1) {
        writeStackToUrl([], "replace");
        return [];
      }
      router.back();
      return prev;
    });
  }, [router, writeStackToUrl]);

  const setStack = useCallback(
    (stack: WorkspaceRef[]) => {
      const normalized = stack.map(normalizeRef);
      setOpenWorkspaces(normalized);
      writeStackToUrl(normalized, "replace");
    },
    [writeStackToUrl]
  );

  const activeWorkspace = openWorkspaces[openWorkspaces.length - 1] ?? null;

  const activeOfKind = useCallback(
    (kind: WorkspaceShellKind) => {
      for (let i = openWorkspaces.length - 1; i >= 0; i -= 1) {
        const ref = openWorkspaces[i]!;
        if (ref.kind === kind) return ref;
      }
      return null;
    },
    [openWorkspaces]
  );

  const getWorkspaceSignalMeta = useCallback(
    (ref: WorkspaceRef) => workspaceSignalByKey[workspaceRefKey(ref)],
    [workspaceSignalByKey]
  );

  const applyWorkspaceSignalUpdates = useCallback(
    (updates: Record<string, { reason: string; at: string }>) => {
      setWorkspaceSignalByKey((prev) => {
        const next = { ...prev };
        for (const [key, update] of Object.entries(updates)) {
          const current = next[key];
          next[key] = {
            revision: (current?.revision ?? 0) + 1,
            lastSignalReason: update.reason,
            lastSignalAt: update.at,
          };
        }
        return next;
      });
    },
    []
  );

  const value = useMemo<WorkspaceShellContextValue>(
    () => ({
      tenantId,
      operatorFiUserId,
      userRole,
      canUseClinicFeatures,
      canCapturePatientPhotos,
      openWorkspaces,
      activeWorkspace,
      workspaceSignalByKey,
      getWorkspaceSignalMeta,
      applyWorkspaceSignalUpdates,
      openWorkspace,
      pushWorkspace,
      popWorkspace,
      closeAll,
      activeOfKind,
      setStack,
    }),
    [
      tenantId,
      operatorFiUserId,
      userRole,
      canUseClinicFeatures,
      canCapturePatientPhotos,
      openWorkspaces,
      activeWorkspace,
      workspaceSignalByKey,
      getWorkspaceSignalMeta,
      applyWorkspaceSignalUpdates,
      openWorkspace,
      pushWorkspace,
      popWorkspace,
      closeAll,
      activeOfKind,
      setStack,
    ]
  );

  return (
    <WorkspaceShellContext.Provider value={value}>
      {children}
      <WorkspaceShellEffects
        workspaceSignalSyncEnabled={workspaceSignalSyncEnabled}
        workspaceRevisionPollEnabled={workspaceRevisionPollEnabled}
      />
      <WorkspaceShellStack
        tenantId={tenantId}
        operatorFiUserId={operatorFiUserId}
        userRole={userRole}
        canUseClinicFeatures={canUseClinicFeatures}
        canCapturePatientPhotos={canCapturePatientPhotos}
      />
    </WorkspaceShellContext.Provider>
  );
}

/** FI-UX-REBUILD D1 — universal workspace shell with stacking + shallow URL sync. */
export function WorkspaceShellProvider(props: WorkspaceShellProviderProps) {
  return (
    <Suspense fallback={props.children}>
      <WorkspaceShellProviderInner {...props} />
    </Suspense>
  );
}

export { formatWorkspaceSearchParam };
