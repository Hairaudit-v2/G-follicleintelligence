"use client";

import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  disableStaffPinAction,
  resetStaffPinAction,
  setStaffPinAction,
} from "@/lib/actions/fi-staff-pin-actions";
import type { StaffPinMetadata } from "@/src/lib/staffPin/staffPin.server";

function statusLabel(status: StaffPinMetadata["status"]): string {
  switch (status) {
    case "active":
      return "Active";
    case "not_set":
      return "Not set";
    case "locked":
      return "Locked";
    case "disabled":
      return "Disabled";
    default:
      return status;
  }
}

export function StaffPinSettingsPanel({
  tenantId,
  staffId,
  staffName,
  metadata,
  onUpdated,
}: {
  tenantId: string;
  staffId: string;
  staffName: string;
  metadata: StaffPinMetadata;
  onUpdated?: () => void;
}) {
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canSet = metadata.status === "not_set";
  const canReset = metadata.status === "active" || metadata.status === "locked";
  const canDisable = metadata.status === "active" || metadata.status === "locked";

  const lastUsedLabel = useMemo(() => {
    if (!metadata.lastUsedAt) return "Never";
    try {
      return new Date(metadata.lastUsedAt).toLocaleString();
    } catch {
      return metadata.lastUsedAt;
    }
  }, [metadata.lastUsedAt]);

  const submitPin = (mode: "set" | "reset") => {
    setError(null);
    startTransition(async () => {
      const body = { newPin, confirmPin };
      const result =
        mode === "set"
          ? await setStaffPinAction(tenantId, staffId, body)
          : await resetStaffPinAction(tenantId, staffId, body);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNewPin("");
      setConfirmPin("");
      onUpdated?.();
    });
  };

  const disablePin = () => {
    setError(null);
    startTransition(async () => {
      const result = await disableStaffPinAction(tenantId, staffId, {});
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onUpdated?.();
    });
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm" aria-label={`PIN access for ${staffName}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Clinic PIN access</h3>
          <p className="mt-1 text-xs text-gray-600">
            4-digit PIN for shared-terminal clinic-floor access. Does not replace admin login.
          </p>
        </div>
        <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700">
          {statusLabel(metadata.status)}
        </span>
      </div>

      <dl className="mb-4 grid gap-1 text-xs text-gray-600 sm:grid-cols-2">
        <div>
          <dt className="font-medium text-gray-700">Last used</dt>
          <dd>{lastUsedLabel}</dd>
        </div>
        {metadata.lockedUntil ? (
          <div>
            <dt className="font-medium text-gray-700">Locked until</dt>
            <dd>{new Date(metadata.lockedUntil).toLocaleString()}</dd>
          </div>
        ) : null}
      </dl>

      {error ? (
        <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </div>
      ) : null}

      {(canSet || canReset) && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-gray-700">
            {canSet ? "New PIN" : "Reset PIN"}
            <input
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              autoComplete="off"
              className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm tracking-widest"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="••••"
            />
          </label>
          <label className="block text-xs font-medium text-gray-700">
            Confirm PIN
            <input
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              autoComplete="off"
              className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm tracking-widest"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="••••"
            />
          </label>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {canSet ? (
          <Button type="button" disabled={pending || newPin.length !== 4} onClick={() => submitPin("set")}>
            {pending ? "Saving…" : "Set PIN"}
          </Button>
        ) : null}
        {canReset ? (
          <Button type="button" disabled={pending || newPin.length !== 4} onClick={() => submitPin("reset")}>
            {pending ? "Saving…" : "Reset PIN"}
          </Button>
        ) : null}
        {canDisable ? (
          <Button type="button" variant="outline" disabled={pending} onClick={disablePin}>
            Disable PIN
          </Button>
        ) : null}
      </div>
    </section>
  );
}
