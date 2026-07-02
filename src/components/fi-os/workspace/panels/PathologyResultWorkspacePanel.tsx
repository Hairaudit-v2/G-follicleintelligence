"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { loadPathologyResultWorkspaceBundleAction } from "@/lib/actions/fi-workspace-shell-actions";
import type { PathologyResultWorkspacePayload } from "@/src/lib/fiOs/workspaceShell/workspaceShellLoaders.server";

import {
  WorkspaceShellContextCard,
  WorkspaceShellPanelFrame,
  workspacePanelActionClass,
} from "./WorkspaceShellPanelFrame";

type PathologyResultWorkspacePanelProps = {
  tenantId: string;
  resultId: string | null;
  open: boolean;
  onClose: () => void;
};

export function PathologyResultWorkspacePanel({
  tenantId,
  resultId,
  open,
  onClose,
}: PathologyResultWorkspacePanelProps) {
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [payload, setPayload] = useState<PathologyResultWorkspacePayload | null>(null);

  useEffect(() => {
    if (!open || !resultId) {
      setPayload(null);
      setLoadError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void loadPathologyResultWorkspaceBundleAction(tenantId, resultId).then((r) => {
      if (cancelled) return;
      setLoading(false);
      if (!r.ok) {
        setPayload(null);
        setLoadError(r.error);
        return;
      }
      setPayload(r.data);
    });
    return () => {
      cancelled = true;
    };
  }, [open, resultId, tenantId]);

  const actions =
    payload && !loading && !loadError ? (
      <div className="flex flex-wrap gap-2">
        <Link
          href={payload.fullPageHref}
          className={workspacePanelActionClass()}
          onClick={() => onClose()}
        >
          Review
        </Link>
        <Link
          href={`/fi-admin/${tenantId}/patients/${payload.patientId}`}
          className={workspacePanelActionClass()}
          onClick={() => onClose()}
        >
          Open patient
        </Link>
        <Link
          href={payload.fullPageHref}
          className={workspacePanelActionClass()}
          onClick={() => onClose()}
        >
          Open full page
        </Link>
      </div>
    ) : null;

  return (
    <WorkspaceShellPanelFrame
      ariaLabel="Pathology result preview"
      title="Blood result"
      fullPageHref={payload?.fullPageHref}
      open={open}
      onClose={onClose}
      loading={loading}
      loadError={loadError}
      actions={actions}
    >
      {payload ? (
        <div className="space-y-4 pb-24">
          <WorkspaceShellContextCard heading="Result">
            <p className="font-medium text-slate-100">
              {payload.patientLabel} · {payload.resultDate}
            </p>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-gray-500">Status</dt>
                <dd className="font-medium capitalize">{payload.status.replace(/_/g, " ")}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Review</dt>
                <dd className="font-medium">{payload.reviewState}</dd>
              </div>
              {payload.abnormalCount > 0 ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-gray-500">Abnormal markers</dt>
                  <dd className="font-medium text-amber-200">{payload.abnormalCount}</dd>
                </div>
              ) : null}
            </dl>
          </WorkspaceShellContextCard>
        </div>
      ) : null}
    </WorkspaceShellPanelFrame>
  );
}
