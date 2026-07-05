"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { TenantBrandMark } from "@/src/components/brand/TenantBrandMark";
import { DashboardCard, InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import {
  acceptStaffAccessInviteAction,
  completeStaffAccessPinSetupAction,
} from "@/src/lib/actions/workforce-staff-access-actions";
import type { NormalizedTenantBranding } from "@/src/lib/fi/foundation/tenantBrandingCore";
import type { StaffAccessAcceptPageModel } from "@/src/lib/workforce/staffAccessAccept.server";

export function StaffAccessAcceptClient({
  model,
  inviteToken,
  branding,
}: {
  model: StaffAccessAcceptPageModel;
  inviteToken: string;
  branding: NormalizedTenantBranding;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [accepted, setAccepted] = useState(model.invitationStatus === "accepted");
  const [pinComplete, setPinComplete] = useState(false);

  const expired = model.invitationStatus === "expired";
  const revoked = model.invitationStatus === "revoked";
  const canSetupPin =
    !expired &&
    !revoked &&
    model.pinSetupToken &&
    (accepted || model.invitationStatus === "pending" || model.invitationStatus === "sent");

  const onAccept = () => {
    setError(null);
    startTransition(async () => {
      const result = await acceptStaffAccessInviteAction(model.tenantId, {
        inviteToken,
        pinSetupToken: model.pinSetupToken,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAccepted(true);
      setMessage("Access confirmed. Set your secure staff PIN below.");
      router.refresh();
    });
  };

  const onSetPin = () => {
    setError(null);
    setMessage(null);
    if (pin !== pinConfirm) {
      setError("PIN confirmation does not match.");
      return;
    }
    if (!model.pinSetupToken) {
      setError("PIN setup is not available for this invitation.");
      return;
    }
    startTransition(async () => {
      const result = await completeStaffAccessPinSetupAction(model.tenantId, {
        setupToken: model.pinSetupToken!,
        pin,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPinComplete(true);
      setMessage("PIN set successfully.");
      setPin("");
      setPinConfirm("");
      router.refresh();
    });
  };

  const onContinueToLogin = () => {
    if (model.authInviteLink) {
      window.location.href = model.authInviteLink;
    }
  };

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col justify-center px-4 py-12">
      <header className="flex flex-col items-center text-center">
        <TenantBrandMark branding={branding} size="lg" showLabel />
        <h1 className="mt-4 text-2xl font-semibold text-slate-50">Staff access invitation</h1>
        <p className="mt-2 text-sm text-slate-400">
          Welcome, {model.staffName}. Activate your access to {model.tenantName}.
        </p>
      </header>

      {error ? (
        <InfoNotice variant="warning" title="Something went wrong" className="mt-6">
          <p className="text-sm">{error}</p>
        </InfoNotice>
      ) : null}
      {message ? (
        <InfoNotice variant="success" title="Success" className="mt-6">
          <p className="text-sm">{message}</p>
        </InfoNotice>
      ) : null}

      <DashboardCard className="mt-8 p-6" elevated>
        {expired ? (
          <p className="text-sm text-rose-300">
            This invitation expired on {new Date(model.expiresAt).toLocaleDateString()}. Ask your
            clinic administrator to resend it.
          </p>
        ) : revoked ? (
          <p className="text-sm text-rose-300">
            This invite is no longer active. Ask your clinic administrator for a new invite.
          </p>
        ) : (
          <>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-slate-500">Email</dt>
                <dd className="text-slate-200">{model.email}</dd>
              </div>
              {model.roleCode ? (
                <div>
                  <dt className="text-slate-500">Role</dt>
                  <dd className="text-slate-200">{model.roleCode.replace(/_/g, " ")}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-slate-500">Expires</dt>
                <dd className="text-slate-200">{new Date(model.expiresAt).toLocaleDateString()}</dd>
              </div>
            </dl>

            {!accepted && (model.invitationStatus === "pending" || model.invitationStatus === "sent") ? (
              <Button className="mt-6 w-full" disabled={pending} onClick={onAccept}>
                {pending ? "Confirming…" : "Confirm staff access"}
              </Button>
            ) : null}

            {canSetupPin ? (
              <div className="mt-6 space-y-4 border-t border-white/10 pt-6">
                <h2 className="text-sm font-semibold text-slate-100">Set your secure staff PIN</h2>
                <p className="text-xs text-slate-400">
                  Use exactly 4 digits. This PIN is for clinic-floor sign-in only — not your admin
                  login. Your clinic administrator cannot see this PIN.
                </p>
                <label className="block text-sm">
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
                <label className="block text-sm">
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
                <Button className="w-full" disabled={pending || pin.length !== 4} onClick={onSetPin}>
                  {pending ? "Saving…" : "Set PIN"}
                </Button>
              </div>
            ) : null}

            {(accepted || pinComplete) && model.authInviteLink ? (
              <div className="mt-6 border-t border-white/10 pt-6">
                <h2 className="text-sm font-semibold text-slate-100">Complete login setup</h2>
                <p className="mt-2 text-xs text-slate-400">
                  Continue to activate your Follicle Intelligence login session.
                </p>
                <Button className="mt-4 w-full" onClick={onContinueToLogin}>
                  Continue to sign in
                </Button>
              </div>
            ) : null}

            {accepted && !model.pinSetupToken ? (
              <p className="mt-4 text-sm text-slate-400">
                Access confirmed. PIN setup will be available once your administrator completes
                account provisioning.
              </p>
            ) : null}
          </>
        )}
      </DashboardCard>
    </div>
  );
}
