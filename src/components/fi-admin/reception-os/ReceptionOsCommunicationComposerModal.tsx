"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import {
  previewReceptionCommunicationAction,
  sendPaymentReminderAction,
  sendReceptionCommunicationAction,
  type ReceptionCommunicationPreviewPayload,
} from "@/lib/actions/fi-reception-communication-actions";
import type { ReceptionCommunicationContextInput } from "@/src/lib/receptionOs/receptionCommunicationComposer";
import type { ReceptionCommunicationTemplateKey } from "@/src/lib/receptionOs/receptionCommunicationTemplates";
import { RECEPTION_COMMUNICATION_TEMPLATE_KEYS } from "@/src/lib/receptionOs/receptionCommunicationTemplates";
import type { ReceptionComposerChannel } from "@/src/components/fi-admin/reception-os/receptionOsCommunicationContext";

const CHANNEL_LABELS: Record<ReceptionComposerChannel, string> = {
  sms: "Send SMS",
  email: "Send email",
  phone: "Log call",
  note: "Add note",
};

export function ReceptionOsCommunicationComposerModal({
  tenantId,
  open,
  onClose,
  channel,
  context,
  clinicName,
  onSent,
}: {
  tenantId: string;
  open: boolean;
  onClose: () => void;
  channel: ReceptionComposerChannel;
  context: ReceptionCommunicationContextInput;
  clinicName: string;
  onSent?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ReceptionCommunicationPreviewPayload | null>(null);
  const [templateKey, setTemplateKey] = useState<ReceptionCommunicationTemplateKey | null>(null);
  const [smsBody, setSmsBody] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [manualPreview, setManualPreview] = useState("");
  const [callOutcome, setCallOutcome] = useState("connected");

  useEffect(() => {
    if (!open) return;
    setError(null);
    startTransition(async () => {
      const res = await previewReceptionCommunicationAction(tenantId, {
        context: { ...context, clinicName },
      });
      if (!res.ok) {
        setError(res.error);
        setPreview(null);
        return;
      }
      setPreview(res.preview);
      setTemplateKey(res.preview.templateKey);
      setSmsBody(res.preview.smsBody ?? "");
      setEmailSubject(res.preview.emailSubject ?? "");
      setEmailBody(res.preview.emailBody ?? "");
      setManualPreview("");
    });
  }, [open, tenantId, channel, context, clinicName]);

  if (!open) return null;

  const maySubmit =
    channel === "phone"
      ? preview?.canLogCall
      : channel === "note"
        ? preview?.canAddNote
        : channel === "sms"
          ? preview?.canSendSms
          : preview?.canSendEmail;

  const runSend = () => {
    if (!templateKey || !maySubmit) return;
    setError(null);
    startTransition(async () => {
      const isPaymentReminder =
        context.sourceKind === "deposit" ||
        context.alertKind === "missing_deposit" ||
        context.alertKind === "deposit_overdue";

      const payload = {
        context: { ...context, clinicName },
        templateKey,
        channel,
        smsBody: channel === "sms" ? smsBody : null,
        emailSubject: channel === "email" ? emailSubject : null,
        emailBody: channel === "email" ? emailBody : null,
        manualPreview: channel === "phone" || channel === "note" ? manualPreview : null,
        callOutcome: channel === "phone" ? callOutcome : null,
        updateTaskStatus: isPaymentReminder ? ("in_progress" as const) : null,
      };

      const res =
        isPaymentReminder && (channel === "sms" || channel === "email")
          ? await sendPaymentReminderAction(tenantId, {
              context: payload.context,
              channel,
              smsBody: payload.smsBody,
              emailSubject: payload.emailSubject,
              emailBody: payload.emailBody,
            })
          : await sendReceptionCommunicationAction(tenantId, payload);

      if (!res.ok) {
        setError(res.error);
        return;
      }
      onSent?.();
      onClose();
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal
    >
      <div
        className={cn(
          fiOsChromeClasses.toolbarControlSurface,
          "max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/10 bg-slate-950 p-4 shadow-2xl"
        )}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400/80">
              ReceptionOS
            </p>
            <h2 className="text-lg font-semibold text-slate-50">{CHANNEL_LABELS[channel]}</h2>
            <p className="mt-0.5 text-sm text-slate-500">{context.label}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-white/5 hover:text-slate-200"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {preview && channel !== "phone" && channel !== "note" ? (
          <label className="mb-3 block text-xs text-slate-500">
            Template
            <select
              value={templateKey ?? preview.suggestedTemplateKey}
              onChange={(e) => {
                const key = e.target.value as ReceptionCommunicationTemplateKey;
                setTemplateKey(key);
                startTransition(async () => {
                  const res = await previewReceptionCommunicationAction(tenantId, {
                    context: { ...context, clinicName },
                    templateKey: key,
                  });
                  if (res.ok) {
                    setPreview(res.preview);
                    setSmsBody(res.preview.smsBody ?? "");
                    setEmailSubject(res.preview.emailSubject ?? "");
                    setEmailBody(res.preview.emailBody ?? "");
                  }
                });
              }}
              className={cn(
                fiOsChromeClasses.toolbarControlSurface,
                "mt-1 w-full px-2 py-1.5 text-sm text-slate-200"
              )}
            >
              {RECEPTION_COMMUNICATION_TEMPLATE_KEYS.map((key) => (
                <option key={key} value={key}>
                  {key === preview.suggestedTemplateKey
                    ? `Suggested: ${key}`
                    : key.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {preview?.paymentLink ? (
          <p className="mb-3 rounded border border-cyan-500/20 bg-cyan-500/5 px-2 py-1.5 text-xs text-cyan-200/90">
            Payment link available for this record.
          </p>
        ) : null}

        {channel === "sms" ? (
          <label className="block text-xs text-slate-500">
            SMS preview (editable)
            <textarea
              value={smsBody}
              onChange={(e) => setSmsBody(e.target.value)}
              rows={5}
              className={cn(
                fiOsChromeClasses.toolbarControlSurface,
                "mt-1 w-full px-2 py-1.5 text-sm text-slate-200"
              )}
            />
          </label>
        ) : null}

        {channel === "email" ? (
          <div className="space-y-2">
            <label className="block text-xs text-slate-500">
              Subject
              <input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className={cn(
                  fiOsChromeClasses.toolbarControlSurface,
                  "mt-1 w-full px-2 py-1.5 text-sm text-slate-200"
                )}
              />
            </label>
            <label className="block text-xs text-slate-500">
              Body
              <textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={8}
                className={cn(
                  fiOsChromeClasses.toolbarControlSurface,
                  "mt-1 w-full px-2 py-1.5 text-sm text-slate-200"
                )}
              />
            </label>
          </div>
        ) : null}

        {channel === "phone" ? (
          <div className="space-y-2">
            <label className="block text-xs text-slate-500">
              Call notes
              <textarea
                value={manualPreview}
                onChange={(e) => setManualPreview(e.target.value)}
                placeholder="What was discussed?"
                rows={4}
                className={cn(
                  fiOsChromeClasses.toolbarControlSurface,
                  "mt-1 w-full px-2 py-1.5 text-sm text-slate-200"
                )}
              />
            </label>
            <label className="block text-xs text-slate-500">
              Outcome
              <select
                value={callOutcome}
                onChange={(e) => setCallOutcome(e.target.value)}
                className={cn(
                  fiOsChromeClasses.toolbarControlSurface,
                  "mt-1 w-full px-2 py-1.5 text-sm text-slate-200"
                )}
              >
                <option value="connected">Connected</option>
                <option value="voicemail">Voicemail</option>
                <option value="no_answer">No answer</option>
                <option value="follow_up_required">Follow-up required</option>
              </select>
            </label>
          </div>
        ) : null}

        {channel === "note" ? (
          <label className="block text-xs text-slate-500">
            Internal note
            <textarea
              value={manualPreview}
              onChange={(e) => setManualPreview(e.target.value)}
              rows={4}
              className={cn(
                fiOsChromeClasses.toolbarControlSurface,
                "mt-1 w-full px-2 py-1.5 text-sm text-slate-200"
              )}
            />
          </label>
        ) : null}

        {!maySubmit && preview && (channel === "sms" || channel === "email") ? (
          <p className="mt-2 text-xs text-amber-400/90">
            Your role can preview this message. Sending SMS/email requires consultant or manager
            permissions for this template.
          </p>
        ) : null}

        {error ? <p className="mt-2 text-xs text-rose-400">{error}</p> : null}

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className={cn(
              fiOsChromeClasses.toolbarControlSurface,
              "px-3 py-1.5 text-sm text-slate-300"
            )}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending || !templateKey || !maySubmit}
            onClick={runSend}
            className={cn(
              fiOsChromeClasses.toolbarControlSurface,
              "inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-cyan-100 disabled:opacity-50"
            )}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {CHANNEL_LABELS[channel]}
          </button>
        </div>
      </div>
    </div>
  );
}
