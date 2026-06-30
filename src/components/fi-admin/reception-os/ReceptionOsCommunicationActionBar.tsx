"use client";

import { useState } from "react";
import { Copy, Mail, MessageSquare, Phone, StickyNote } from "lucide-react";

import { cn } from "@/lib/utils";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { resolveReceptionPaymentLinkAction } from "@/lib/actions/fi-reception-communication-actions";
import { ReceptionOsCommunicationComposerModal } from "@/src/components/fi-admin/reception-os/ReceptionOsCommunicationComposerModal";
import type { ReceptionCommunicationContextInput } from "@/src/lib/receptionOs/receptionCommunicationComposer";
import type { ReceptionComposerChannel } from "@/src/components/fi-admin/reception-os/receptionOsCommunicationContext";

export function ReceptionOsCommunicationActionBar({
  tenantId,
  clinicName,
  context,
  showPaymentLink = false,
  paymentRecordId,
  onMutated,
  className,
}: {
  tenantId: string;
  clinicName: string;
  context: ReceptionCommunicationContextInput;
  showPaymentLink?: boolean;
  paymentRecordId?: string | null;
  onMutated?: () => void;
  className?: string;
}) {
  const [composerChannel, setComposerChannel] = useState<ReceptionComposerChannel | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  const open = (channel: ReceptionComposerChannel) => {
    setCopyMsg(null);
    setComposerChannel(channel);
  };

  const copyPaymentLink = async () => {
    setCopyMsg(null);
    const res = await resolveReceptionPaymentLinkAction(tenantId, {
      paymentRecordId:
        paymentRecordId ?? (context.sourceKind === "deposit" ? context.sourceId : undefined),
      context,
    });
    if (!res.ok) {
      setCopyMsg(res.error);
      return;
    }
    const link = res.paymentLink ?? context.paymentLink;
    if (!link) {
      setCopyMsg("No payment link on file.");
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopyMsg("Payment link copied.");
    } catch {
      setCopyMsg(link);
    }
  };

  return (
    <>
      <div className={cn("flex flex-wrap gap-1.5", className)}>
        <ActionBtn icon={MessageSquare} label="Send SMS" onClick={() => open("sms")} />
        <ActionBtn icon={Mail} label="Send email" onClick={() => open("email")} />
        <ActionBtn icon={Phone} label="Log call" onClick={() => open("phone")} />
        <ActionBtn icon={StickyNote} label="Add note" onClick={() => open("note")} />
        {showPaymentLink || context.sourceKind === "deposit" ? (
          <ActionBtn icon={Copy} label="Copy payment link" onClick={() => void copyPaymentLink()} />
        ) : null}
      </div>
      {copyMsg ? <p className="mt-1 text-xs text-slate-500">{copyMsg}</p> : null}
      {composerChannel ? (
        <ReceptionOsCommunicationComposerModal
          tenantId={tenantId}
          open
          channel={composerChannel}
          context={context}
          clinicName={clinicName}
          onClose={() => setComposerChannel(null)}
          onSent={onMutated}
        />
      ) : null}
    </>
  );
}

function ActionBtn({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Phone;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        fiOsChromeClasses.toolbarControlSurface,
        "inline-flex items-center gap-1 px-2 py-1 text-[0.68rem] font-semibold text-slate-300"
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </button>
  );
}
