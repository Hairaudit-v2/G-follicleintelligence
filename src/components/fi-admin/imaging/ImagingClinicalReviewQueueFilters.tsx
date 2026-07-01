"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

export function ImagingClinicalReviewQueueFilters({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const apply = useCallback(
    (form: HTMLFormElement) => {
      const fd = new FormData(form);
      const params = new URLSearchParams();
      for (const [key, value] of fd.entries()) {
        const v = String(value).trim();
        if (v) params.set(key, v);
      }
      startTransition(() => {
        const q = params.toString();
        router.push(`/fi-admin/${tenantId}/imaging/review${q ? `?${q}` : ""}`);
      });
    },
    [router, tenantId]
  );

  return (
    <form
      className="grid gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 sm:grid-cols-2 lg:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        apply(e.currentTarget);
      }}
    >
      <label className="text-xs text-slate-400">
        Review reason
        <input
          name="reason"
          defaultValue={searchParams.get("reason") ?? ""}
          className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] px-2 py-1 text-xs"
          placeholder="e.g. retake_required"
        />
      </label>
      <label className="text-xs text-slate-400">
        Quality
        <select
          name="quality"
          defaultValue={searchParams.get("quality") ?? ""}
          className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] px-2 py-1 text-xs"
        >
          <option value="">Any</option>
          <option value="pass">Pass</option>
          <option value="review">Review</option>
          <option value="fail">Fail</option>
        </select>
      </label>
      <label className="text-xs text-slate-400">
        Confidence
        <select
          name="confidence"
          defaultValue={searchParams.get("confidence") ?? "any"}
          className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] px-2 py-1 text-xs"
        >
          <option value="any">Any</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </label>
      <label className="text-xs text-slate-400">
        View type
        <input
          name="view"
          defaultValue={searchParams.get("view") ?? ""}
          className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] px-2 py-1 text-xs"
        />
      </label>
      <label className="text-xs text-slate-400">
        Capture source
        <input
          name="capture"
          defaultValue={searchParams.get("capture") ?? ""}
          className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] px-2 py-1 text-xs"
        />
      </label>
      <label className="text-xs text-slate-400">
        Patient ID
        <input
          name="patient"
          defaultValue={searchParams.get("patient") ?? ""}
          className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] px-2 py-1 text-xs font-mono"
        />
      </label>
      <label className="text-xs text-slate-400">
        Assigned reviewer
        <input
          name="assigned"
          defaultValue={searchParams.get("assigned") ?? ""}
          className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] px-2 py-1 text-xs font-mono"
        />
      </label>
      <label className="text-xs text-slate-400">
        Retake required
        <select
          name="retake"
          defaultValue={searchParams.get("retake") ?? ""}
          className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] px-2 py-1 text-xs"
        >
          <option value="">Any</option>
          <option value="1">Yes</option>
          <option value="0">No</option>
        </select>
      </label>
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-sky-900/50 px-3 py-1.5 text-xs text-sky-100 disabled:opacity-50"
        >
          Apply filters
        </button>
        <button
          type="button"
          disabled={pending}
          className="rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-300"
          onClick={() => router.push(`/fi-admin/${tenantId}/imaging/review`)}
        >
          Clear
        </button>
      </div>
    </form>
  );
}