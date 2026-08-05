"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";

import { DashboardCard } from "@/src/components/fi-admin/dashboard-ui/DashboardCard";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui/InfoNotice";
import { FiOsPendingActionButton } from "@/src/components/fi-os/FiOsPendingActionButton";
import {
  copyOnboardingInviteLinkAction,
  resendOnboardingInviteAction,
  sendOnboardingInviteAction,
} from "@/src/lib/actions/workforce-onboarding-actions";
import {
  copyStaffLoginInviteLinkAction,
  requestStaffPinResetLinkAction,
  resendStaffLoginInviteAction,
  revokeStaffLoginAccessAction,
  sendStaffLoginInviteAction,
  suspendStaffLoginAccessAction,
} from "@/src/lib/actions/workforce-staff-access-actions";
import type {
  StaffProfileAction,
  StaffProfileActionContext,
  StaffProfileActionMenuModel,
  StaffProfileActionSection,
} from "@/src/lib/workforce/staffProfileHubCore";

const SECTION_LABELS: Record<Exclude<StaffProfileActionSection, "primary">, string> = {
  access: "Access",
  onboarding: "Onboarding",
  employment: "Employment & Leave",
  readiness: "Readiness",
  roster: "Roster",
  offboarding: "Offboarding",
  advanced: "Advanced",
};

type ServerMutation =
  | "send_onboarding"
  | "resend_onboarding"
  | "copy_onboarding"
  | "send_login"
  | "resend_login"
  | "copy_login"
  | "reset_pin"
  | "suspend"
  | "revoke";

function mutationForActionId(id: string): ServerMutation | null {
  const map: Record<string, ServerMutation> = {
    send_onboarding_invite: "send_onboarding",
    resend_onboarding_invite: "resend_onboarding",
    copy_onboarding_invite_link: "copy_onboarding",
    send_login_invite: "send_login",
    resend_login_invite: "resend_login",
    copy_login_invite_link: "copy_login",
    reset_pin: "reset_pin",
    suspend_access: "suspend",
    revoke_access: "revoke",
  };
  return map[id] ?? null;
}

function actionKey(staffMemberId: string, mutation: ServerMutation): string {
  const suffix =
    mutation === "send_onboarding" || mutation === "send_login"
      ? "send"
      : mutation === "resend_onboarding" || mutation === "resend_login"
        ? "resend"
        : mutation === "copy_onboarding" || mutation === "copy_login"
          ? "copy"
          : mutation === "reset_pin"
            ? "resetPin"
            : mutation === "suspend"
              ? "suspend"
              : mutation === "revoke"
                ? "revoke"
                : mutation;
  return `${staffMemberId}:${suffix}`;
}

function toneForAction(action: StaffProfileAction): "default" | "warn" | "danger" {
  if (action.actionKind === "danger") {
    return action.id === "revoke_access" ? "danger" : "warn";
  }
  if (action.section === "primary") return "default";
  return "default";
}

function ActionRow({
  action,
  staffMemberId,
  pendingActionKey,
  anyPending,
  copiedActionId,
  onRun,
  onModalAction,
}: {
  action: StaffProfileAction;
  staffMemberId: string;
  pendingActionKey: string | null;
  anyPending: boolean;
  copiedActionId: string | null;
  onRun: (action: StaffProfileAction) => void;
  onModalAction?: (actionId: string) => void;
}) {
  const mutation = mutationForActionId(action.id);
  const isLink = action.actionKind === "link" && action.href;
  const isModal = action.actionKind === "modal";
  const isMutation = mutation != null && !action.disabled;

  if (action.disabled) {
    return (
      <div
        className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
        title={action.disabledReason}
        data-testid={`staff-profile-action-${action.id}-disabled`}
      >
        <p className="text-xs font-medium text-slate-500">{action.label}</p>
        {action.disabledReason ? (
          <p className="mt-0.5 text-[10px] text-slate-600">{action.disabledReason}</p>
        ) : null}
      </div>
    );
  }

  if (isLink) {
    return (
      <Link
        href={action.href!}
        className="block rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-[#CBD5E1] transition-colors hover:border-[#22C1FF]/30 hover:bg-[#22C1FF]/5 hover:text-[#22C1FF]"
        data-testid={`staff-profile-action-${action.id}-link`}
      >
        {action.label}
      </Link>
    );
  }

  if (isModal && onModalAction) {
    return (
      <button
        type="button"
        onClick={() => onModalAction(action.id)}
        className="block w-full rounded-lg border border-white/10 px-3 py-2 text-left text-xs font-medium text-[#CBD5E1] transition-colors hover:border-[#22C1FF]/30 hover:bg-[#22C1FF]/5 hover:text-[#22C1FF]"
        data-testid={`staff-profile-action-${action.id}-modal`}
      >
        {action.label}
        {action.description ? (
          <span className="mt-0.5 block text-[10px] font-normal text-[#64748B]">
            {action.description}
          </span>
        ) : null}
      </button>
    );
  }

  if (isMutation) {
    const key = actionKey(staffMemberId, mutation);
    const copied = copiedActionId === action.id;
    const label =
      copied &&
      (mutation === "copy_onboarding" || mutation === "copy_login" || mutation === "reset_pin")
        ? "Copied"
        : action.label;

    return (
      <FiOsPendingActionButton
        label={label}
        pendingLabel={action.pendingLabel}
        actionKey={key}
        activeActionKey={pendingActionKey}
        anyPending={anyPending}
        tone={toneForAction(action)}
        onClick={() => onRun(action)}
        className="w-full justify-center px-3 py-2"
      />
    );
  }

  return (
    <span className="block rounded-lg border border-white/5 px-3 py-2 text-xs text-slate-500">
      {action.label}
    </span>
  );
}

function SectionBlock({
  title,
  actions,
  staffMemberId,
  pendingActionKey,
  anyPending,
  copiedActionId,
  onRun,
  onModalAction,
}: {
  title: string;
  actions: StaffProfileAction[];
  staffMemberId: string;
  pendingActionKey: string | null;
  anyPending: boolean;
  copiedActionId: string | null;
  onRun: (action: StaffProfileAction) => void;
  onModalAction?: (actionId: string) => void;
}) {
  if (actions.length === 0) return null;

  return (
    <div data-testid={`staff-profile-action-section-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
        {title}
      </p>
      <div className="space-y-1.5">
        {actions.map((action) => (
          <ActionRow
            key={`${action.section}-${action.id}`}
            action={action}
            staffMemberId={staffMemberId}
            pendingActionKey={pendingActionKey}
            anyPending={anyPending}
            copiedActionId={copiedActionId}
            onRun={onRun}
            onModalAction={onModalAction}
          />
        ))}
      </div>
    </div>
  );
}

export function StaffProfileActionMenu({
  menu,
  context,
  tenantId,
  compact = false,
  onModalAction,
  accessActions,
  onboardingActions,
  complianceActions,
  identityActions,
}: {
  menu: StaffProfileActionMenuModel;
  context: StaffProfileActionContext;
  tenantId: string;
  compact?: boolean;
  onModalAction?: (actionId: string) => void;
  /** Canonical access flags from StaffAccessEntry — presentation only. */
  accessActions?: {
    canInvite: boolean;
    canResend: boolean;
    canSuspend: boolean;
    canRevoke: boolean;
  } | null;
  /** Canonical onboarding flags from StaffOnboardingEntry.actions. */
  onboardingActions?: {
    canResendOnboardingInvite: boolean;
    canCancelOnboarding: boolean;
    canContinueSetup: boolean;
    canCreateSchedulingRecord: boolean;
    canRepairIdentityLink: boolean;
    canSendOnboardingInvite: boolean;
    canCopyOnboardingInviteLink: boolean;
  } | null;
  /** Canonical compliance flags from StaffComplianceEntry.actions. */
  complianceActions?: {
    canUploadCredential: boolean;
    canVerifyCredential: boolean;
    canRejectCredential: boolean;
    canRequestReplacement: boolean;
    canResolveIdentity: boolean;
  } | null;
  /** Profile identity gate flags — suppress unsafe mutations when readOnly. */
  identityActions?: {
    canRepairIdentityLink: boolean;
    canCreateSchedulingRecord: boolean;
    readOnly: boolean;
  } | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [manualCopyUrl, setManualCopyUrl] = useState<string | null>(null);
  const [copiedActionId, setCopiedActionId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const { staffMemberId } = context;

  const gatedMenu = useMemo(() => {
    const readOnly = Boolean(identityActions?.readOnly);
    const actions = menu.actions.map((action) => {
      let disabled = action.disabled;
      let disabledReason = action.disabledReason;

      if (readOnly && (action.actionKind === "server-action" || action.actionKind === "danger")) {
        disabled = true;
        disabledReason = disabledReason ?? "Identity requires reconciliation before this action.";
      }

      if (accessActions) {
        if (action.id === "send_login_invite" && !accessActions.canInvite) {
          disabled = true;
          disabledReason = disabledReason ?? "Login invite is not available for this identity.";
        }
        if (action.id === "resend_login_invite" && !accessActions.canResend) {
          disabled = true;
          disabledReason = disabledReason ?? "Resend invite is not available for this identity.";
        }
        if (action.id === "suspend_access" && !accessActions.canSuspend) {
          disabled = true;
          disabledReason = disabledReason ?? "Suspend is not available for this identity.";
        }
        if (action.id === "revoke_access" && !accessActions.canRevoke) {
          disabled = true;
          disabledReason = disabledReason ?? "Revoke is not available for this identity.";
        }
      }

      if (onboardingActions) {
        if (action.id === "send_onboarding_invite" && !onboardingActions.canSendOnboardingInvite) {
          disabled = true;
          disabledReason =
            disabledReason ?? "Onboarding invite is not available for this identity.";
        }
        if (
          action.id === "resend_onboarding_invite" &&
          !onboardingActions.canResendOnboardingInvite
        ) {
          disabled = true;
          disabledReason =
            disabledReason ?? "Resend onboarding invite is not available for this identity.";
        }
        if (
          action.id === "copy_onboarding_invite_link" &&
          !onboardingActions.canCopyOnboardingInviteLink
        ) {
          disabled = true;
          disabledReason =
            disabledReason ?? "Onboarding invite link is not available for this identity.";
        }
      }

      void complianceActions;

      return { ...action, disabled, disabledReason };
    });

    const primaryAction =
      actions.find((a) => a.id === menu.primaryAction?.id) ??
      actions.find((a) => a.section === "primary" && !a.disabled) ??
      null;

    return {
      ...menu,
      actions,
      primaryAction,
      recommendedStep: primaryAction,
    };
  }, [
    menu,
    accessActions,
    onboardingActions,
    complianceActions,
    identityActions,
  ]);

  const sections = useMemo(() => {
    const grouped: Record<Exclude<StaffProfileActionSection, "primary">, StaffProfileAction[]> = {
      access: [],
      onboarding: [],
      employment: [],
      readiness: [],
      roster: [],
      offboarding: [],
      advanced: [],
    };

    for (const action of gatedMenu.actions) {
      if (action.section === "primary") continue;
      grouped[action.section as Exclude<StaffProfileActionSection, "primary">]?.push(action);
    }

    return grouped;
  }, [gatedMenu.actions]);

  const primaryAction = gatedMenu.primaryAction;

  const runAction = useCallback(
    (action: StaffProfileAction) => {
      const mutation = mutationForActionId(action.id);
      if (!mutation) return;

      if (
        action.confirmTitle &&
        !window.confirm(`${action.confirmTitle}\n\n${action.confirmDescription ?? ""}`)
      ) {
        return;
      }

      setMessage(null);
      setManualCopyUrl(null);
      const key = actionKey(staffMemberId, mutation);
      setPendingActionKey(key);

      startTransition(async () => {
        try {
          let result:
            | { ok: true; inviteUrl?: string; emailSent?: boolean; warning?: string | null }
            | { ok: false; error: string };

          const body = { staffMemberId };

          if (mutation === "send_onboarding") {
            result = await sendOnboardingInviteAction(tenantId, staffMemberId);
          } else if (mutation === "resend_onboarding") {
            result = await resendOnboardingInviteAction(tenantId, staffMemberId);
          } else if (mutation === "copy_onboarding") {
            result = await copyOnboardingInviteLinkAction(tenantId, staffMemberId);
          } else if (mutation === "send_login") {
            result = await sendStaffLoginInviteAction(tenantId, body);
          } else if (mutation === "resend_login") {
            result = await resendStaffLoginInviteAction(tenantId, body);
          } else if (mutation === "copy_login") {
            result = await copyStaffLoginInviteLinkAction(tenantId, body);
          } else if (mutation === "reset_pin") {
            result = await requestStaffPinResetLinkAction(tenantId, body);
          } else if (mutation === "revoke") {
            result = await revokeStaffLoginAccessAction(tenantId, body);
          } else {
            result = await suspendStaffLoginAccessAction(tenantId, body);
          }

          if (!result.ok) {
            setMessage(result.error);
            return;
          }

          if ((mutation === "copy_onboarding" || mutation === "copy_login") && result.inviteUrl) {
            try {
              await navigator.clipboard.writeText(result.inviteUrl);
              setCopiedActionId(action.id);
              setMessage(
                mutation === "copy_onboarding" ? "Invite link copied." : "Invite link copied."
              );
            } catch {
              setManualCopyUrl(result.inviteUrl);
              setMessage("Copy manually.");
            }
          } else if (mutation === "reset_pin" && result.inviteUrl) {
            try {
              await navigator.clipboard.writeText(result.inviteUrl);
              setCopiedActionId(action.id);
              setMessage("PIN setup link copied.");
            } catch {
              setManualCopyUrl(result.inviteUrl);
              setMessage("Copy manually.");
            }
          } else if (mutation === "send_onboarding" || mutation === "resend_onboarding") {
            setMessage(
              result.emailSent
                ? "Onboarding invite sent by email."
                : "Onboarding invite created — copy the link if email delivery is not configured."
            );
          } else if (mutation === "send_login" || mutation === "resend_login") {
            const baseMessage = result.emailSent
              ? "Login invite sent by email."
              : "Login invite created — copy the link if email delivery is not configured.";
            setMessage(result.warning ? `${baseMessage} ${result.warning}` : baseMessage);
          } else if (mutation === "revoke") {
            setMessage("Staff login access revoked.");
          } else if (mutation === "suspend") {
            setMessage("Staff login access suspended.");
          }

          router.refresh();
        } finally {
          setPendingActionKey(null);
        }
      });
    },
    [router, staffMemberId, tenantId]
  );

  const menuBody = (
    <div className="space-y-4">
      {gatedMenu.guidance ? (
        <p className="text-xs text-rose-200/90" data-testid="staff-profile-action-guidance">
          {gatedMenu.guidance}
        </p>
      ) : null}

      {message ? (
        <InfoNotice variant={message.includes("failed") ? "danger" : "success"}>
          {message}
        </InfoNotice>
      ) : null}

      {manualCopyUrl ? (
        <div className="space-y-1">
          <p className="text-[10px] text-[#64748B]">Copy manually:</p>
          <input
            readOnly
            value={manualCopyUrl}
            className="w-full rounded border border-white/10 bg-black/20 px-2 py-1 font-mono text-[10px] text-[#CBD5E1]"
            onFocus={(e) => e.target.select()}
          />
        </div>
      ) : null}

      {primaryAction ? (
        <div data-testid="staff-profile-action-primary">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
            Primary action
          </p>
          <ActionRow
            action={primaryAction}
            staffMemberId={staffMemberId}
            pendingActionKey={pendingActionKey}
            anyPending={pendingActionKey !== null}
            copiedActionId={copiedActionId}
            onRun={runAction}
            onModalAction={onModalAction}
          />
        </div>
      ) : null}

      {(Object.keys(SECTION_LABELS) as Array<keyof typeof SECTION_LABELS>).map((sectionKey) => (
        <SectionBlock
          key={sectionKey}
          title={SECTION_LABELS[sectionKey]}
          actions={sections[sectionKey]}
          staffMemberId={staffMemberId}
          pendingActionKey={pendingActionKey}
          anyPending={pendingActionKey !== null}
          copiedActionId={copiedActionId}
          onRun={runAction}
          onModalAction={onModalAction}
        />
      ))}
    </div>
  );

  if (compact) {
    return (
      <div data-testid="staff-profile-action-menu-mobile">
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-[#0F1629]/80 px-4 py-3 text-sm font-semibold text-[#E2E8F0]"
          aria-expanded={mobileOpen}
        >
          Actions
          <span className="text-xs text-[#64748B]">{mobileOpen ? "Hide" : "Show"}</span>
        </button>
        {mobileOpen ? <div className="mt-3">{menuBody}</div> : null}
      </div>
    );
  }

  return (
    <DashboardCard className="p-4 sm:p-5" data-testid="staff-profile-action-menu">
      <p className="text-xs font-medium uppercase tracking-wider text-[#64748B]">Action menu</p>
      <div className="mt-3">{menuBody}</div>
    </DashboardCard>
  );
}
