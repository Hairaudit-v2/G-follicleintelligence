"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, X } from "lucide-react";

import {
  createLeadflowEnquiryAction,
  loadLeadflowEnquiryFormOptionsAction,
} from "@/lib/actions/createLeadflowEnquiryAction";
import { LabeledTextInput } from "@/src/components/fi-admin/consultations/consultationOsPreviewFields";
import {
  LEADFLOW_ENQUIRY_INTEREST_OPTIONS,
  LEADFLOW_ENQUIRY_PRIORITY_OPTIONS,
  LEADFLOW_ENQUIRY_SOURCE_OPTIONS,
} from "@/src/lib/leadFlow/createLeadflowEnquiryCore";
import { leadFlowLinkButtonClass } from "@/src/lib/fiAdmin/leadFlowPresentation";
import type { CrmShellUserPickerOption } from "@/src/lib/crm/types";

const fieldLabelClass = "mb-1 block text-xs font-medium text-slate-300";
const selectClass =
  "block w-full rounded-lg border border-white/[0.12] bg-black/30 px-3 py-2 text-sm text-slate-100 disabled:opacity-60";

type OwnerOpt = Pick<CrmShellUserPickerOption, "id" | "email" | "full_name">;

function ownerLabel(owner: OwnerOpt): string {
  return owner.full_name?.trim() || owner.email?.trim() || `${owner.id.slice(0, 8)}…`;
}

export function NewEnquiryDialog({
  tenantId,
  open,
  onOpenChange,
  owners: ownersProp,
  defaultOwnerUserId: defaultOwnerProp,
  buttonClassName,
  triggerLabel = "+ New enquiry",
  showTrigger = true,
}: {
  tenantId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  owners?: OwnerOpt[];
  defaultOwnerUserId?: string;
  buttonClassName?: string;
  triggerLabel?: string;
  showTrigger?: boolean;
}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined && onOpenChange !== undefined;
  const dialogOpen = isControlled ? open : internalOpen;
  const setDialogOpen = isControlled ? onOpenChange! : setInternalOpen;

  const [owners, setOwners] = useState<OwnerOpt[]>(ownersProp ?? []);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [interest, setInterest] = useState("");
  const [leadSource, setLeadSource] = useState("");
  const [primaryOwnerUserId, setPrimaryOwnerUserId] = useState(defaultOwnerProp ?? "");
  const [priority, setPriority] = useState("normal");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingOwners, setLoadingOwners] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<{ leadId: string } | null>(null);

  useEffect(() => {
    if (ownersProp) setOwners(ownersProp);
  }, [ownersProp]);

  useEffect(() => {
    if (defaultOwnerProp) setPrimaryOwnerUserId(defaultOwnerProp);
  }, [defaultOwnerProp]);

  useEffect(() => {
    if (!dialogOpen || ownersProp?.length) return;
    let cancelled = false;
    setLoadingOwners(true);
    void loadLeadflowEnquiryFormOptionsAction(tenantId.trim())
      .then((r) => {
        if (cancelled) return;
        if (r.ok) {
          setOwners(r.owners);
          if (!defaultOwnerProp && !primaryOwnerUserId) {
            setPrimaryOwnerUserId(r.defaultOwnerUserId);
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingOwners(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load owners once when dialog opens without preset list
  }, [dialogOpen, ownersProp?.length, tenantId]);

  const reset = useCallback(() => {
    setName("");
    setPhone("");
    setEmail("");
    setInterest("");
    setLeadSource("");
    setPriority("normal");
    setNotes("");
    setError(null);
    if (defaultOwnerProp) setPrimaryOwnerUserId(defaultOwnerProp);
  }, [defaultOwnerProp]);

  const close = useCallback(() => {
    if (busy) return;
    setDialogOpen(false);
    setError(null);
  }, [busy, setDialogOpen]);

  useEffect(() => {
    if (!successToast) return;
    const t = window.setTimeout(() => setSuccessToast(null), 6000);
    return () => window.clearTimeout(t);
  }, [successToast]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    setBusy(true);
    try {
      const r = await createLeadflowEnquiryAction(tenantId.trim(), {
        name,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        interest,
        leadSource: leadSource.trim() || undefined,
        primaryOwnerUserId: primaryOwnerUserId.trim() || undefined,
        priority,
        notes: notes.trim() || undefined,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      reset();
      setDialogOpen(false);
      setSuccessToast({ leadId: r.leadId });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {showTrigger ? (
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className={buttonClassName ?? leadFlowLinkButtonClass}
        >
          {triggerLabel}
        </button>
      ) : null}

      {successToast ? (
        <div
          className="pointer-events-auto fixed right-4 z-[100] w-[min(100vw-2rem,22rem)] rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3 py-2.5 text-emerald-50 shadow-lg backdrop-blur-sm bottom-20 md:bottom-4"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-snug">Enquiry created</p>
              <Link
                href={`/fi-admin/${tenantId.trim()}/crm/leads/${encodeURIComponent(successToast.leadId)}`}
                className="mt-1 inline-block text-xs font-semibold text-emerald-100 underline underline-offset-2 hover:text-white"
                onClick={() => setSuccessToast(null)}
              >
                Open enquiry
              </Link>
            </div>
            <button
              type="button"
              onClick={() => setSuccessToast(null)}
              className="rounded-md p-0.5 opacity-70 transition hover:opacity-100"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      {dialogOpen ? (
        <div className="fixed inset-0 z-[85] flex items-start justify-center px-3 pt-[min(10vh,5rem)] sm:px-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
            aria-label="Close new enquiry"
            onClick={close}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-enquiry-title"
            className="relative z-[1] w-full max-w-lg overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0a1424]/98 text-slate-100 shadow-2xl shadow-black/60 backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] px-4 py-4 sm:px-5">
              <div>
                <h2 id="new-enquiry-title" className="text-base font-semibold text-slate-100">
                  New enquiry
                </h2>
                <p className="mt-1 text-sm text-slate-400">Capture a patient opportunity and assign the next action.</p>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={busy}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="max-h-[min(72vh,40rem)] space-y-3 overflow-y-auto px-4 py-4 sm:px-5" onSubmit={(e) => void onSubmit(e)}>
              <LabeledTextInput
                id="new-enquiry-name"
                label="Patient / enquiry name *"
                value={name}
                onChange={setName}
                disabled={busy}
                placeholder="Full name"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <LabeledTextInput
                  id="new-enquiry-phone"
                  label="Phone"
                  value={phone}
                  onChange={setPhone}
                  disabled={busy}
                  placeholder="Mobile or landline"
                />
                <LabeledTextInput
                  id="new-enquiry-email"
                  label="Email"
                  value={email}
                  onChange={setEmail}
                  disabled={busy}
                  placeholder="name@example.com"
                />
              </div>

              <label className="block text-sm">
                <span className={fieldLabelClass}>Interest *</span>
                <select
                  id="new-enquiry-interest"
                  value={interest}
                  onChange={(e) => setInterest(e.target.value)}
                  disabled={busy}
                  required
                  className={selectClass}
                >
                  <option value="">Select interest…</option>
                  {LEADFLOW_ENQUIRY_INTEREST_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className={fieldLabelClass}>Lead source</span>
                <select
                  id="new-enquiry-source"
                  value={leadSource}
                  onChange={(e) => setLeadSource(e.target.value)}
                  disabled={busy}
                  className={selectClass}
                >
                  <option value="">Select source…</option>
                  {LEADFLOW_ENQUIRY_SOURCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className={fieldLabelClass}>Assigned owner</span>
                <select
                  id="new-enquiry-owner"
                  value={primaryOwnerUserId}
                  onChange={(e) => setPrimaryOwnerUserId(e.target.value)}
                  disabled={busy || loadingOwners}
                  className={selectClass}
                >
                  <option value="">Unassigned</option>
                  {owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {ownerLabel(owner)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className={fieldLabelClass}>Priority</span>
                <select
                  id="new-enquiry-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  disabled={busy}
                  className={selectClass}
                >
                  {LEADFLOW_ENQUIRY_PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className={fieldLabelClass}>Notes</span>
                <textarea
                  id="new-enquiry-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={busy}
                  rows={3}
                  className="block w-full rounded-lg border border-white/[0.12] bg-black/30 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                  placeholder="Optional context for the team"
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
                  {busy ? "Creating…" : "Create enquiry"}
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
      ) : null}
    </>
  );
}
