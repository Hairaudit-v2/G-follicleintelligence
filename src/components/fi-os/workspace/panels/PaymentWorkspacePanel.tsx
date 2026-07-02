"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { loadPaymentWorkspaceBundleAction } from "@/lib/actions/fi-workspace-shell-actions";
import type { PaymentWorkspacePayload } from "@/src/lib/fiOs/workspaceShell/workspaceShellLoaders.server";

import type { WorkspacePanelSignalRefresh } from "@/src/components/fi-os/workspace/useWorkspacePanelSignalRefresh";

import {
  WorkspaceShellContextCard,
  WorkspaceShellPanelFrame,
  workspacePanelActionClass,
} from "./WorkspaceShellPanelFrame";

type PaymentWorkspacePanelProps = WorkspacePanelSignalRefresh & {
  tenantId: string;
  paymentId: string | null;
  open: boolean;
  onClose: () => void;
};

export function PaymentWorkspacePanel({
  tenantId,
  paymentId,
  open,
  onClose,
  signalRefreshToken = 0,
  lastSignalReason,
  lastSignalAt,
}: PaymentWorkspacePanelProps) {
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [payload, setPayload] = useState<PaymentWorkspacePayload | null>(null);

  useEffect(() => {
    if (!open || !paymentId) {
      setPayload(null);
      setLoadError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void loadPaymentWorkspaceBundleAction(tenantId, paymentId).then((r) => {
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
  }, [open, paymentId, tenantId, signalRefreshToken]);

  const actions =
    payload && !loading && !loadError ? (
      <div className="flex flex-wrap gap-2">
        {payload.canSendLink && payload.checkoutUrl ? (
          <a
            href={payload.checkoutUrl}
            target="_blank"
            rel="noreferrer"
            className={workspacePanelActionClass()}
            onClick={() => onClose()}
          >
            Send link
          </a>
        ) : payload.canSendLink ? (
          <Link
            href={payload.fullPageHref}
            className={workspacePanelActionClass()}
            onClick={() => onClose()}
          >
            Send link
          </Link>
        ) : null}
        {payload.canRecordPayment ? (
          <Link
            href={payload.fullPageHref}
            className={workspacePanelActionClass()}
            onClick={() => onClose()}
          >
            Record payment
          </Link>
        ) : null}
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
      ariaLabel="Payment preview"
      title="Payment"
      fullPageHref={payload?.fullPageHref}
      open={open}
      onClose={onClose}
      loading={loading}
      loadError={loadError}
      actions={actions}
      lastSignalReason={lastSignalReason}
      lastSignalAt={lastSignalAt}
      signalRefreshToken={signalRefreshToken}
    >
      {payload ? (
        <div className="space-y-4 pb-24">
          <WorkspaceShellContextCard heading="Payment">
            <p className="font-medium text-slate-100">{payload.label}</p>
            {payload.patientLabel ? (
              <p className="mt-1 text-xs text-slate-400">Patient: {payload.patientLabel}</p>
            ) : null}
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-gray-500">Amount</dt>
                <dd className="font-medium tabular-nums">{payload.amountLabel}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Status</dt>
                <dd className="font-medium capitalize">{payload.status.replace(/_/g, " ")}</dd>
              </div>
            </dl>
          </WorkspaceShellContextCard>
        </div>
      ) : null}
    </WorkspaceShellPanelFrame>
  );
}
