"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { X } from "lucide-react";

import { crmCreateLeadAction } from "@/lib/actions/fi-crm-actions";
import { LabeledTextInput } from "@/src/components/fi-admin/consultations/consultationOsPreviewFields";

export function FiOsCreateLeadModal({
  tenantId,
  open,
  onOpenChange,
}: {
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = useCallback(() => {
    if (busy) return;
    onOpenChange(false);
    setError(null);
  }, [busy, onOpenChange]);

  const reset = useCallback(() => {
    setFirstName("");
    setLastName("");
    setMobile("");
    setEmail("");
    setNotes("");
    setError(null);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fn = firstName.trim();
    const ln = lastName.trim();
    const mob = mobile.trim();
    const em = email.trim();
    if (!fn || !ln) {
      setError("First and last name are required.");
      return;
    }
    if (!mob && !em) {
      setError("Provide at least a mobile number or email.");
      return;
    }

    const displayName = `${fn} ${ln}`.trim();
    const summary = notes.trim() || `Enquiry — ${displayName}`;

    setBusy(true);
    try {
      const r = await crmCreateLeadAction(tenantId.trim(), {
        summary,
        status: "open",
        person: {
          display_name: displayName,
          phone: mob || undefined,
          email: em || undefined,
          metadata: {
            first_name: fn,
            last_name: ln,
            notes: notes.trim() || undefined,
          },
        },
        metadata: notes.trim() ? { intake_notes: notes.trim() } : undefined,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      reset();
      onOpenChange(false);
      router.push(`/fi-admin/${tenantId.trim()}/crm/leads/${encodeURIComponent(r.lead.id)}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-start justify-center px-3 pt-[min(12vh,6rem)] sm:px-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        aria-label="Close create lead"
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fi-os-create-lead-title"
        className="relative z-[1] w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0a1424]/98 text-slate-100 shadow-2xl shadow-black/60 backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
          <h2 id="fi-os-create-lead-title" className="text-sm font-semibold text-slate-100">
            New lead
          </h2>
          <button
            type="button"
            onClick={close}
            disabled={busy}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="space-y-3 px-4 py-4" onSubmit={(e) => void onSubmit(e)}>
          <div className="grid grid-cols-2 gap-3">
            <LabeledTextInput
              id="create-lead-first-name"
              label="First name"
              value={firstName}
              onChange={setFirstName}
              disabled={busy}
            />
            <LabeledTextInput
              id="create-lead-last-name"
              label="Last name"
              value={lastName}
              onChange={setLastName}
              disabled={busy}
            />
          </div>
          <LabeledTextInput
            id="create-lead-mobile"
            label="Mobile"
            value={mobile}
            onChange={setMobile}
            disabled={busy}
          />
          <LabeledTextInput
            id="create-lead-email"
            label="Email"
            value={email}
            onChange={setEmail}
            disabled={busy}
          />
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-300">Notes</span>
            <textarea
              id="create-lead-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={busy}
              rows={3}
              className="block w-full rounded-lg border border-white/[0.12] bg-black/30 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
              placeholder="Optional enquiry details"
            />
          </label>

          {error ? (
            <p
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex flex-1 items-center justify-center rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-[#041018] hover:bg-cyan-400 disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save lead"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={close}
              className="inline-flex items-center justify-center rounded-lg border border-white/[0.12] px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/[0.06] disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
