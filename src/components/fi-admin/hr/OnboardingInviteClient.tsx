"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { DashboardCard, InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import {
  acceptOnboardingInviteAction,
  completeOnboardingPinSetupAction,
} from "@/src/lib/actions/workforce-onboarding-actions";
import type { OnboardingInvitePageModel } from "@/src/lib/workforce/onboarding/onboardingTypes";

export function OnboardingInviteClient({
  model,
  inviteToken,
}: {
  model: OnboardingInvitePageModel;
  inviteToken: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [accepted, setAccepted] = useState(model.invitationStatus === "accepted");

  const expired = model.invitationStatus === "expired";
  const canSetupPin = !expired && model.pinSetupToken && (accepted || model.invitationStatus === "pending");

  const onAccept = () => {
    setError(null);
    startTransition(async () => {
      const result = await acceptOnboardingInviteAction(model.tenantId, inviteToken);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAccepted(true);
      setMessage("Invitation accepted. Choose your clinic PIN below.");
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
      const result = await completeOnboardingPinSetupAction(model.tenantId, {
        setupToken: model.pinSetupToken!,
        pin,
        inviteToken: accepted ? undefined : inviteToken,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("PIN set successfully. Your clinic administrator will finalize permissions and training.");
      setPin("");
      setPinConfirm("");
      router.refresh();
    });
  };

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col justify-center px-4 py-12">
      <header className="text-center">
        <h1 className="text-2xl font-semibold text-slate-50">Staff onboarding</h1>
        <p className="mt-2 text-sm text-slate-400">
          Welcome, {model.staffName}. Complete your onboarding to access the clinic workspace.
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
            This invitation expired on {new Date(model.expiresAt).toLocaleDateString()}. Contact
            your clinic administrator for a new invite.
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
                  <dd className="text-slate-200">{model.roleCode}</dd>
                </div>
              ) : null}
            </dl>

            {!accepted && model.invitationStatus === "pending" ? (
              <Button className="mt-6 w-full" disabled={pending} onClick={onAccept}>
                {pending ? "Accepting…" : "Accept invitation"}
              </Button>
            ) : null}

            {canSetupPin ? (
              <div className="mt-6 space-y-4 border-t border-white/10 pt-6">
                <h2 className="text-sm font-semibold text-slate-100">Choose your clinic PIN</h2>
                <p className="text-xs text-slate-400">
                  Use exactly 4 digits. This PIN is for clinic-floor sign-in only — not your admin
                  login.
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

            {accepted && !model.pinSetupToken ? (
              <p className="mt-4 text-sm text-slate-400">
                Invitation accepted. PIN setup will be available once your administrator completes
                account provisioning.
              </p>
            ) : null}
          </>
        )}
      </DashboardCard>
    </div>
  );
}
