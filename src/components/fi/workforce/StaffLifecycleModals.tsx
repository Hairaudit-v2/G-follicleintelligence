"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  archiveStaffAction,
  changeStaffEmploymentStatusAction,
  manuallyLinkStaffHrAction,
  restoreStaffAction,
  updateStaffProfileAction,
} from "@/lib/actions/workforce-os-staff-lifecycle-actions";
import type { StaffMemberLifecycleRow } from "@/src/lib/workforce-os/staffLifecycleTypes";
import {
  OFFBOARDING_CENTRE_EMPLOYMENT_STATUSES,
  STAFF_EMPLOYMENT_STATUSES,
} from "@/src/lib/workforce-os/staffLifecycleTypes";
import {
  isExternallyManagedStaff,
  resolveEditableProfileFields,
} from "@/src/lib/workforce-os/staffLifecycleCore";

const inputClassName =
  "mt-1 block w-full rounded-lg border border-white/[0.1] bg-[#0B1220] px-3 py-2 text-sm text-[#F8FAFC] focus:border-[#22C1FF]/40 focus:outline-none focus:ring-1 focus:ring-[#22C1FF]/30";
const labelClassName = "block text-xs font-medium text-[#94A3B8]";

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-lg rounded-2xl border border-white/10 bg-[#0F1629] p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[#F8FAFC]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[#94A3B8] hover:bg-white/5 hover:text-[#F8FAFC]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function StaffEditModal({
  tenantId,
  row,
  open,
  onClose,
}: {
  tenantId: string;
  row: StaffMemberLifecycleRow;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const external = isExternallyManagedStaff(row);
  const { locked } = resolveEditableProfileFields(row);

  const [form, setForm] = useState({
    first_name: row.first_name ?? "",
    last_name: row.last_name ?? "",
    professional_title: row.professional_title ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    role_code: row.role_code ?? "",
    employment_type: row.employment_type ?? "",
    employment_status: row.employment_status,
    timezone: row.timezone ?? "",
    notes: row.notes ?? "",
  });

  if (!open) return null;

  function fieldLocked(name: string): boolean {
    return external && (locked as readonly string[]).includes(name);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await updateStaffProfileAction(tenantId, row.id, form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <ModalShell title="Edit Staff" onClose={onClose}>
      {external ? (
        <p className="mb-4 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
          Managed by IIOHR HR — identity fields are read-only. Local metadata can still be edited.
        </p>
      ) : null}
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClassName}>
            First name
            <input
              className={inputClassName}
              value={form.first_name}
              disabled={fieldLocked("first_name")}
              onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
            />
          </label>
          <label className={labelClassName}>
            Last name
            <input
              className={inputClassName}
              value={form.last_name}
              disabled={fieldLocked("last_name")}
              onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
            />
          </label>
        </div>
        <label className={labelClassName}>
          Professional title
          <input
            className={inputClassName}
            value={form.professional_title}
            onChange={(e) => setForm((f) => ({ ...f, professional_title: e.target.value }))}
          />
        </label>
        <label className={labelClassName}>
          Email
          <input
            type="email"
            className={inputClassName}
            value={form.email}
            disabled={fieldLocked("email")}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </label>
        <label className={labelClassName}>
          Phone
          <input
            className={inputClassName}
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
        </label>
        <label className={labelClassName}>
          Role
          <input
            className={inputClassName}
            value={form.role_code}
            disabled={fieldLocked("role_code")}
            onChange={(e) => setForm((f) => ({ ...f, role_code: e.target.value }))}
          />
        </label>
        <label className={labelClassName}>
          Employment status
          <select
            className={inputClassName}
            value={form.employment_status}
            disabled={fieldLocked("employment_status")}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                employment_status: e.target.value as typeof form.employment_status,
              }))
            }
          >
            {STAFF_EMPLOYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClassName}>
          Timezone
          <input
            className={inputClassName}
            value={form.timezone}
            onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
          />
        </label>
        <label className={labelClassName}>
          Notes
          <textarea
            className={inputClassName}
            rows={3}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </label>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

const MANAGE_EMPLOYMENT_STATUSES = STAFF_EMPLOYMENT_STATUSES.filter(
  (s) => !OFFBOARDING_CENTRE_EMPLOYMENT_STATUSES.has(s)
);

export function ManageEmploymentModal({
  tenantId,
  staffMemberId,
  open,
  onClose,
}: {
  tenantId: string;
  staffMemberId: string;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("inactive");
  const [reason, setReason] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [archive, setArchive] = useState(true);

  if (!open) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await changeStaffEmploymentStatusAction(tenantId, staffMemberId, {
        employment_status: status as (typeof STAFF_EMPLOYMENT_STATUSES)[number],
        reason,
        effective_date: new Date(effectiveDate).toISOString(),
        archive_from_active: archive,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <ModalShell title="Manage Employment" onClose={onClose}>
      <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
        To terminate, record a resignation, or end a contract, use the{" "}
        <Link
          href={`/fi-admin/${tenantId}/hr-os/offboarding`}
          className="font-medium text-amber-50 underline underline-offset-2 hover:text-white"
        >
          HR OS Offboarding Centre
        </Link>
        . That flow revokes system access, PIN login, and permissions while preserving audit history.
      </p>
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <label className={labelClassName}>
          New employment status
          <select
            className={inputClassName}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {MANAGE_EMPLOYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClassName}>
          Reason
          <textarea
            className={inputClassName}
            rows={2}
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <label className={labelClassName}>
          Effective date
          <input
            type="date"
            className={inputClassName}
            required
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-[#CBD5E1]">
          <input type="checkbox" checked={archive} onChange={(e) => setArchive(e.target.checked)} />
          Archive from active workforce
        </label>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Updating…" : "Apply change"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

export function ArchiveStaffModal({
  tenantId,
  staffMemberId,
  staffName,
  archived,
  open,
  onClose,
}: {
  tenantId: string;
  staffMemberId: string;
  staffName: string;
  archived: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      const res = archived
        ? await restoreStaffAction(tenantId, staffMemberId)
        : await archiveStaffAction(tenantId, staffMemberId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <ModalShell title={archived ? "Restore Staff" : "Archive Staff"} onClose={onClose}>
      <p className="text-sm text-[#94A3B8]">
        {archived
          ? `Restore ${staffName} to the active staff directory? Historical records are preserved.`
          : `Archive ${staffName}? Training, SOP, permissions, audit, and document history will be retained.`}
      </p>
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button type="button" onClick={onConfirm} disabled={pending}>
          {pending ? "Working…" : archived ? "Restore" : "Archive"}
        </Button>
      </div>
    </ModalShell>
  );
}

export function LinkHrIdentityModal({
  tenantId,
  staffMemberId,
  open,
  onClose,
  candidates,
}: {
  tenantId: string;
  staffMemberId: string;
  open: boolean;
  onClose: () => void;
  candidates: { id: string; full_name: string | null; email: string | null }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(candidates[0]?.id ?? "");

  if (!open) return null;

  function onConfirm() {
    if (!selected) {
      setError("Select an IIOHR record.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await manuallyLinkStaffHrAction(tenantId, staffMemberId, selected);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <ModalShell title="Link HR Identity" onClose={onClose}>
      <p className="mb-4 text-sm text-[#94A3B8]">
        Select a matching IIOHR staff record. This action is audited and restricted to HR managers.
      </p>
      <label className={labelClassName}>
        IIOHR staff record
        <select className={inputClassName} value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Select…</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name ?? "Unknown"} — {c.email ?? "no email"}
            </option>
          ))}
        </select>
      </label>
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button type="button" onClick={onConfirm} disabled={pending || !selected}>
          {pending ? "Linking…" : "Confirm link"}
        </Button>
      </div>
    </ModalShell>
  );
}
