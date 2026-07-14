"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { DashboardCard, InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { completeStaffAccessPinSetupAction } from "@/src/lib/actions/workforce-staff-access-actions";

export function StaffAccessPinSetupClient({
  tenantId,
  setupToken,
  staffName,
}: {
  tenantId: string;
  setupToken: string;
  staffName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");

  const onSetPin = () => {
    setError(null);
    if (pin !== pinConfirm) {
      setError("PIN confirmation does not match.");
      return;
    }
    startTransition(async () => {
      const result = await completeStaffAccessPinSetupAction(tenantId, { setupToken, pin });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("PIN updated successfully.");
      setPin("");
      setPinConfirm("");
      router.refresh();
    });
  };

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col justify-center px-4 py-12">
      <header className="text-center">
        <h1 className="text-2xl font-semibold text-slate-50">Set your staff PIN</h1>
        <p className="mt-2 text-sm text-slate-400">
          Hi {staffName}, choose a new 4-digit clinic PIN.
        </p>
      </header>

      {error ? (
        <InfoNotice variant="warning" className="mt-6">
          {error}
        </InfoNotice>
      ) : null}
      {message ? (
        <InfoNotice variant="success" className="mt-6">
          {message}
        </InfoNotice>
      ) : null}

      <DashboardCard className="mt-8 p-6" elevated>
        <p className="text-xs text-slate-400">
          Your clinic administrator cannot see this PIN. Use exactly 4 digits for clinic-floor
          sign-in.
        </p>
        <label className="mt-4 block text-sm">
          <span className="text-slate-400">PIN</span>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            className="mt-1 w-full rounded-lg border border-white/10 bg-[#0c1426] px-3 py-2 text-slate-100"
          />
        </label>
        <label className="mt-4 block text-sm">
          <span className="text-slate-400">Confirm PIN</span>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={4}
            value={pinConfirm}
            onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ""))}
            className="mt-1 w-full rounded-lg border border-white/10 bg-[#0c1426] px-3 py-2 text-slate-100"
          />
        </label>
        <Button className="mt-6 w-full" disabled={pending || pin.length !== 4} onClick={onSetPin}>
          {pending ? "Saving…" : "Save PIN"}
        </Button>
      </DashboardCard>
    </div>
  );
}
