"use client";

import { useMemo, useState, useTransition } from "react";

import {
  resetReceptionTemplateAction,
  upsertReceptionTemplateAction,
} from "@/lib/actions/fi-reception-template-actions";
import {
  RECEPTION_COMMUNICATION_DEFAULT_TEMPLATES,
  RECEPTION_COMMUNICATION_TEMPLATE_KEYS,
  RECEPTION_COMMUNICATION_TEMPLATE_LABELS,
  RECEPTION_COMMUNICATION_TEMPLATE_VARIABLES,
  type ReceptionCommunicationTemplateContent,
  type ReceptionCommunicationTemplateKey,
} from "@/src/lib/receptionOs/receptionCommunicationTemplates";

const inputClass =
  "w-full rounded-lg border border-white/[0.1] bg-[#081020]/85 px-2 py-1.5 text-sm text-[#F8FAFC] shadow-inner outline-none transition placeholder:text-[#475569] focus:border-[#22C1FF]/45 focus:ring-2 focus:ring-[#22C1FF]/20";

const sectionClass =
  "rounded-2xl border border-white/[0.08] bg-[#0F1629]/75 p-4 shadow-lg shadow-black/25 backdrop-blur-md sm:p-5";

export function ReceptionTemplatesSection(props: {
  tenantId: string;
  initialTemplates: ReceptionCommunicationTemplateContent[];
}) {
  const { tenantId } = props;
  const [templates, setTemplates] = useState(props.initialTemplates);
  const [selectedKey, setSelectedKey] = useState<ReceptionCommunicationTemplateKey>(
    "invoice_payment_reminder"
  );
  const [busy, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const current = useMemo(() => {
    return (
      templates.find((t) => t.templateKey === selectedKey) ??
      RECEPTION_COMMUNICATION_DEFAULT_TEMPLATES[selectedKey]
    );
  }, [templates, selectedKey]);

  const [smsBody, setSmsBody] = useState(current.smsBody ?? "");
  const [emailSubject, setEmailSubject] = useState(current.emailSubject ?? "");
  const [emailBody, setEmailBody] = useState(current.emailBody ?? "");

  function loadKey(key: ReceptionCommunicationTemplateKey) {
    const row =
      templates.find((t) => t.templateKey === key) ??
      RECEPTION_COMMUNICATION_DEFAULT_TEMPLATES[key];
    setSelectedKey(key);
    setSmsBody(row.smsBody ?? "");
    setEmailSubject(row.emailSubject ?? "");
    setEmailBody(row.emailBody ?? "");
    setMsg(null);
  }

  return (
    <div className="space-y-4">
      <div className={sectionClass}>
        <h2 className="mb-2 text-base font-semibold text-[#F8FAFC]">
          Front-desk &amp; commercial messages
        </h2>
        <p className="text-xs leading-relaxed text-[#94A3B8]">
          Used by ReceptionOS composers for deposits, quotes, payment links, invoice chases, and
          booking notices. Defaults ship with the platform; save to store a tenant override.
        </p>
        <p className="mt-2 text-xs text-[#94A3B8]">
          Merge fields:{" "}
          {RECEPTION_COMMUNICATION_TEMPLATE_VARIABLES.map((k) => (
            <code
              key={k}
              className="mr-1 rounded bg-[#141C33] px-1 py-0.5 text-[11px] text-[#22C1FF]"
            >
              {`{{${k}}}`}
            </code>
          ))}
        </p>
      </div>

      <div className={sectionClass}>
        <label className="mb-3 block text-xs text-[#94A3B8]">
          Template
          <select
            className={`${inputClass} mt-1`}
            value={selectedKey}
            onChange={(e) => loadKey(e.target.value as ReceptionCommunicationTemplateKey)}
          >
            {RECEPTION_COMMUNICATION_TEMPLATE_KEYS.map((k) => (
              <option key={k} value={k}>
                {RECEPTION_COMMUNICATION_TEMPLATE_LABELS[k]}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-3">
          <label className="block text-xs text-[#94A3B8]">
            SMS body
            <textarea
              className={`${inputClass} mt-1`}
              rows={3}
              value={smsBody}
              onChange={(e) => setSmsBody(e.target.value)}
            />
          </label>
          <label className="block text-xs text-[#94A3B8]">
            Email subject
            <input
              className={`${inputClass} mt-1`}
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
            />
          </label>
          <label className="block text-xs text-[#94A3B8]">
            Email body
            <textarea
              className={`${inputClass} mt-1`}
              rows={6}
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            className="rounded-lg bg-gradient-to-r from-cyan-600 to-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md transition hover:from-cyan-500 hover:to-sky-500 disabled:opacity-50"
            onClick={() => {
              setMsg(null);
              startTransition(async () => {
                const r = await upsertReceptionTemplateAction({
                  tenantId,
                  templateKey: selectedKey,
                  smsBody,
                  emailSubject,
                  emailBody,
                  isActive: true,
                });
                if (!r.ok) {
                  setMsg(r.error);
                  return;
                }
                setTemplates((prev) => {
                  const next = prev.filter((t) => t.templateKey !== selectedKey);
                  next.push(r.template);
                  return next;
                });
                setMsg("Saved tenant override.");
              });
            }}
          >
            Save override
          </button>
          <button
            type="button"
            disabled={busy}
            className="rounded-lg border border-white/[0.12] bg-[#141C33]/80 px-3 py-1.5 text-xs font-semibold text-[#E2E8F0] hover:border-[#22C1FF]/35 disabled:opacity-50"
            onClick={() => {
              setMsg(null);
              startTransition(async () => {
                const r = await resetReceptionTemplateAction({
                  tenantId,
                  templateKey: selectedKey,
                });
                if (!r.ok) {
                  setMsg(r.error);
                  return;
                }
                const def = RECEPTION_COMMUNICATION_DEFAULT_TEMPLATES[selectedKey];
                setTemplates((prev) => prev.filter((t) => t.templateKey !== selectedKey));
                setSmsBody(def.smsBody ?? "");
                setEmailSubject(def.emailSubject ?? "");
                setEmailBody(def.emailBody ?? "");
                setMsg("Reset to platform default.");
              });
            }}
          >
            Reset to default
          </button>
        </div>
        {msg ? <p className="mt-2 text-xs text-[#94A3B8]">{msg}</p> : null}
      </div>
    </div>
  );
}
