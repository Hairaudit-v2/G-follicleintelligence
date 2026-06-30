"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { Link2, Users } from "lucide-react";

import { bulkLinkStaffToFiUsersAction } from "@/src/lib/actions/fi-staff-fi-user-link-actions";
import type { StaffFiUserLinkPageModel } from "@/src/lib/staff/staffFiUserLink.server";

function actionLabel(action: string): string {
  if (action === "link_existing_user") return "Link to existing fi_user (email match)";
  if (action === "create_user_and_link") return "Create fi_user (member) and link";
  return action;
}

export function StaffLinkUsersClient({
  tenantId,
  pageModel,
}: {
  tenantId: string;
  pageModel: StaffFiUserLinkPageModel;
}) {
  const router = useRouter();
  const base = `/fi-admin/${tenantId}`;
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(pageModel.rows.map((r) => r.staffId))
  );
  const [adminKey, setAdminKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    linkedCount: number;
    createdUsers: number;
    unlinkedBefore: number;
    unlinkedAfter: number;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  const rows = pageModel.rows;
  const allSelected = rows.length > 0 && selected.size === rows.length;

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (rows.length === 0) return prev;
      if (prev.size === rows.length) return new Set();
      return new Set(rows.map((r) => r.staffId));
    });
  }, [rows]);

  const toggleOne = useCallback((staffId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(staffId)) next.delete(staffId);
      else next.add(staffId);
      return next;
    });
  }, []);

  const selectedRows = useMemo(() => rows.filter((r) => selected.has(r.staffId)), [rows, selected]);

  const runBulkLink = useCallback(() => {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const body: Record<string, unknown> = { staffIds: Array.from(selected) };
      if (adminKey.trim()) body.adminKey = adminKey.trim();
      const r = await bulkLinkStaffToFiUsersAction(tenantId, body);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setResult({
        linkedCount: r.linkedCount,
        createdUsers: r.createdUsers,
        unlinkedBefore: r.unlinkedBefore,
        unlinkedAfter: r.unlinkedAfter,
      });
      router.refresh();
    });
  }, [adminKey, router, selected, tenantId]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Settings · Staff
        </p>
        <h1 className="text-xl font-semibold text-slate-100">Link staff to login users</h1>
        <p className="max-w-2xl text-sm text-slate-400">
          Repair staff profiles that have an email but no linked fi_user. Matches existing tenant
          users by email or creates a safe member login row when none exists — never duplicates
          users for the same email.
        </p>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            href={`${base}/staff`}
            className="font-medium text-cyan-300 underline hover:text-cyan-200"
          >
            Staff directory
          </Link>
          <Link
            href={`${base}/hr/staff-readiness`}
            className="font-medium text-cyan-300 underline hover:text-cyan-200"
          >
            Staff readiness
          </Link>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40">
          <p className="text-xs font-medium uppercase text-slate-500">Unlinked (with email)</p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-semibold text-slate-100">
            <Users className="h-5 w-5 text-slate-400" aria-hidden />
            {pageModel.unlinkedBefore}
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40">
          <p className="text-xs font-medium uppercase text-slate-500">Selected for repair</p>
          <p className="mt-1 text-2xl font-semibold text-slate-100">{selected.size}</p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40">
          <p className="text-xs font-medium uppercase text-slate-500">After last run</p>
          <p className="mt-1 text-2xl font-semibold text-slate-100">
            {result ? result.unlinkedAfter : "—"}
          </p>
        </div>
      </div>

      {result ? (
        <div
          className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
          role="status"
        >
          Linked {result.linkedCount} staff profile{result.linkedCount === 1 ? "" : "s"}
          {result.createdUsers > 0
            ? ` (created ${result.createdUsers} new fi_user${result.createdUsers === 1 ? "" : "s"})`
            : ""}
          . Unlinked count: {result.unlinkedBefore} → {result.unlinkedAfter}.
        </div>
      ) : null}

      {error ? (
        <div
          className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <label className="block max-w-md text-xs text-slate-400">
        FI Admin key (optional — when your session cannot manage staff)
        <input
          type="password"
          className="mt-1 w-full rounded-lg border border-white/[0.08] px-3 py-2 font-mono text-sm"
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
          autoComplete="off"
        />
      </label>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-8 text-center text-sm text-slate-400">
          All staff with emails already have linked login users.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md shadow-lg shadow-black/40">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/[0.08] bg-white/[0.03] text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="px-3 py-2">Staff</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Planned action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.staffId} className="border-b border-white/[0.06] last:border-0">
                    <td className="px-3 py-2 align-top">
                      <input
                        type="checkbox"
                        checked={selected.has(row.staffId)}
                        onChange={() => toggleOne(row.staffId)}
                        aria-label={`Select ${row.fullName}`}
                      />
                    </td>
                    <td className="px-3 py-2 align-top font-medium text-slate-100">
                      {row.fullName}
                    </td>
                    <td className="px-3 py-2 align-top text-slate-300">{row.email}</td>
                    <td className="px-3 py-2 align-top text-slate-400">
                      <span className="inline-flex items-center gap-1.5">
                        <Link2 className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                        {actionLabel(row.action)}
                        {row.matchedUserEmail ? ` · ${row.matchedUserEmail}` : null}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            disabled={pending || selectedRows.length === 0}
            onClick={() => void runBulkLink()}
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Linking…" : `Bulk link selected (${selected.size})`}
          </button>
        </>
      )}
    </div>
  );
}
