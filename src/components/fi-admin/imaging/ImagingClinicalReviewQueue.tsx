"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import {
  bulkAssignImagingQueueStaffNoteAction,
  bulkFlagImagingQueueRetakeAction,
  bulkMarkImagingQueueReviewedAction,
  flagImagingReviewRetakeAction,
  markImagingReviewReviewedAction,
  reassignImagingReviewViewTypeAction,
} from "@/lib/actions/fi-imaging-actions";
import { ALLOWED_STAFF_REASSIGN_VIEW_TYPES } from "@/src/lib/imaging-os/imagingStaffReviewCore";
import type { ImagingClinicalReviewQueueItem } from "@/src/lib/imaging-os/imagingClinicalReviewQueue.server";

const REASON_LABELS: Record<string, string> = {
  low_classification_confidence: "Low classification confidence",
  poor_quality_metadata: "Quality needs review",
  missing_scalp_region: "Missing scalp region",
  missing_donor_scalp_region: "Missing donor scalp region",
  missing_recipient_scalp_region: "Missing recipient scalp region",
  failed_live_analysis: "Live analysis failed",
  possible_duplicate: "Possible duplicate",
  donor_assessment_needs_review: "Donor assessment needs review",
  recipient_assessment_needs_review: "Recipient assessment needs review",
  admin_fallback_missing_region: "Admin fallback — region missing",
  openai_not_configured: "AI provider unavailable",
  retake_required: "Retake flagged by staff",
};

function formatReason(reason: string): string {
  return REASON_LABELS[reason] ?? reason.replace(/_/g, " ");
}

type Props = {
  tenantId: string;
  items: ImagingClinicalReviewQueueItem[];
};

export function ImagingClinicalReviewQueue({ tenantId, items }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adminKey, setAdminKey] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [reassignView, setReassignView] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [bulkNote, setBulkNote] = useState("");

  const withAdmin = useCallback(
    <T extends Record<string, unknown>>(body: T): T & { adminKey?: string } => {
      const k = adminKey.trim();
      return k ? { ...body, adminKey: k } : body;
    },
    [adminKey]
  );

  const runAction = useCallback(
    (
      patientId: string,
      imageId: string,
      action: () => Promise<{ ok: true } | { ok: false; error: string }>
    ) => {
      setMsg(null);
      startTransition(async () => {
        const res = await action();
        if (!res.ok) {
          setMsg(res.error);
          return;
        }
        setMsg(`Updated image ${imageId.slice(0, 8)}…`);
        router.refresh();
      });
    },
    [router]
  );

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-white/[0.08] bg-[#0F1629]/60 p-8 text-center">
        <p className="text-sm text-slate-400">No images currently require staff review.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block text-xs text-slate-400">
        Optional admin key (CRM write gate)
        <input
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
          className="mt-1 block w-full max-w-md rounded border border-slate-700 px-2 py-1 font-mono text-xs"
          autoComplete="off"
        />
      </label>
      {msg ? <p className="text-sm text-slate-300">{msg}</p> : null}
      {pending ? <p className="text-xs text-gray-500">Saving…</p> : null}

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
        <input
          type="text"
          placeholder="Bulk staff note (optional)"
          value={bulkNote}
          onChange={(e) => setBulkNote(e.target.value)}
          className="min-w-[200px] flex-1 rounded border border-slate-700 bg-[#020617] px-2 py-1 text-xs"
        />
        <button
          type="button"
          disabled={pending || Object.values(selected).every((v) => !v)}
          className="rounded bg-emerald-900/40 px-3 py-1 text-xs text-emerald-200 disabled:opacity-40"
          onClick={() => {
            const bulkItems = items
              .filter((i) => selected[i.imageId])
              .map((i) => ({ patientId: i.patientId, patientImageId: i.imageId }));
            if (!bulkItems.length) return;
            setMsg(null);
            startTransition(async () => {
              const res = await bulkMarkImagingQueueReviewedAction(
                tenantId,
                withAdmin({ items: bulkItems, staffNote: bulkNote || undefined })
              );
              if (!res.ok) {
                setMsg(res.error);
                return;
              }
              setMsg(`Marked ${res.succeeded} reviewed${res.failed.length ? `; ${res.failed.length} failed` : ""}`);
              router.refresh();
            });
          }}
        >
          Bulk mark reviewed
        </button>
        <button
          type="button"
          disabled={pending || Object.values(selected).every((v) => !v)}
          className="rounded bg-amber-900/40 px-3 py-1 text-xs text-amber-200 disabled:opacity-40"
          onClick={() => {
            const bulkItems = items
              .filter((i) => selected[i.imageId])
              .map((i) => ({ patientId: i.patientId, patientImageId: i.imageId }));
            if (!bulkItems.length) return;
            setMsg(null);
            startTransition(async () => {
              const res = await bulkFlagImagingQueueRetakeAction(
                tenantId,
                withAdmin({ items: bulkItems, staffNote: bulkNote || undefined })
              );
              if (!res.ok) {
                setMsg(res.error);
                return;
              }
              setMsg(`Flagged ${res.succeeded} retake${res.failed.length ? `; ${res.failed.length} failed` : ""}`);
              router.refresh();
            });
          }}
        >
          Bulk flag retake
        </button>
        <button
          type="button"
          disabled={pending || Object.values(selected).every((v) => !v) || !bulkNote.trim()}
          className="rounded bg-sky-900/40 px-3 py-1 text-xs text-sky-200 disabled:opacity-40"
          onClick={() => {
            const bulkItems = items
              .filter((i) => selected[i.imageId])
              .map((i) => ({ patientId: i.patientId, patientImageId: i.imageId }));
            if (!bulkItems.length) return;
            setMsg(null);
            startTransition(async () => {
              const res = await bulkAssignImagingQueueStaffNoteAction(
                tenantId,
                withAdmin({ items: bulkItems, staffNote: bulkNote })
              );
              if (!res.ok) {
                setMsg(res.error);
                return;
              }
              setMsg(`Assigned note to ${res.succeeded}${res.failed.length ? `; ${res.failed.length} failed` : ""}`);
              router.refresh();
            });
          }}
        >
          Bulk assign note
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-white/[0.08] bg-[#0F1629]/60">
        <table className="min-w-full divide-y divide-white/[0.06] text-sm">
          <thead className="bg-white/[0.03] text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={items.length > 0 && items.every((i) => selected[i.imageId])}
                  onChange={(e) => {
                    const on = e.target.checked;
                    const next: Record<string, boolean> = {};
                    for (const i of items) next[i.imageId] = on;
                    setSelected(next);
                  }}
                />
              </th>
              <th className="px-4 py-3">Preview</th>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">View</th>
              <th className="px-4 py-3">Quality</th>
              <th className="px-4 py-3">Confidence</th>
              <th className="px-4 py-3">Review reasons</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04] text-slate-200">
            {items.map((item) => {
              const imagingHref = `/fi-admin/${tenantId}/patients/${item.patientId}/imaging`;
              return (
                <tr key={item.imageId} className="align-top hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={Boolean(selected[item.imageId])}
                      onChange={(e) =>
                        setSelected((prev) => ({ ...prev, [item.imageId]: e.target.checked }))
                      }
                      aria-label={`Select image ${item.imageId.slice(0, 8)}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    {item.previewSignedUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.previewSignedUrl}
                        alt=""
                        className="h-14 w-14 rounded object-cover ring-1 ring-white/10"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded bg-white/5 text-[10px] text-slate-500">
                        No preview
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{item.patientLabel ?? "Patient"}</div>
                    <div className="flex flex-col gap-0.5">
                      <Link href={imagingHref} className="text-xs text-sky-400 hover:text-sky-300">
                        Imaging workspace
                      </Link>
                      {item.deepLinks.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          className="text-[11px] text-slate-400 hover:text-slate-300"
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{item.viewType ?? "—"}</div>
                    <div className="text-xs text-slate-500">{item.captureSource ?? "unknown"}</div>
                  </td>
                  <td className="px-4 py-3 capitalize">{item.qualityStatus ?? "—"}</td>
                  <td className="px-4 py-3">
                    {item.classificationConfidence != null
                      ? `${Math.round(item.classificationConfidence * 100)}%`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <ul className="space-y-0.5 text-xs text-amber-200/90">
                      {item.reviewReasons.map((r) => (
                        <li key={r}>{formatReason(r)}</li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex min-w-[200px] flex-col gap-2">
                      <input
                        type="text"
                        placeholder="Staff note (optional)"
                        value={notes[item.imageId] ?? ""}
                        onChange={(e) =>
                          setNotes((prev) => ({ ...prev, [item.imageId]: e.target.value }))
                        }
                        className="rounded border border-slate-700 bg-[#020617] px-2 py-1 text-xs"
                      />
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          disabled={pending}
                          className="rounded bg-emerald-900/40 px-2 py-1 text-[11px] text-emerald-200 hover:bg-emerald-900/60"
                          onClick={() =>
                            runAction(item.patientId, item.imageId, () =>
                              markImagingReviewReviewedAction(
                                tenantId,
                                item.patientId,
                                withAdmin({
                                  patientImageId: item.imageId,
                                  staffNote: notes[item.imageId],
                                })
                              )
                            )
                          }
                        >
                          Mark reviewed
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          className="rounded bg-amber-900/40 px-2 py-1 text-[11px] text-amber-200 hover:bg-amber-900/60"
                          onClick={() =>
                            runAction(item.patientId, item.imageId, () =>
                              flagImagingReviewRetakeAction(
                                tenantId,
                                item.patientId,
                                withAdmin({
                                  patientImageId: item.imageId,
                                  staffNote: notes[item.imageId],
                                })
                              )
                            )
                          }
                        >
                          Flag retake
                        </button>
                      </div>
                      <div className="flex gap-1">
                        <select
                          value={reassignView[item.imageId] ?? item.viewType ?? "donor"}
                          onChange={(e) =>
                            setReassignView((prev) => ({
                              ...prev,
                              [item.imageId]: e.target.value,
                            }))
                          }
                          className="flex-1 rounded border border-slate-700 bg-[#020617] px-2 py-1 text-xs"
                        >
                          {ALLOWED_STAFF_REASSIGN_VIEW_TYPES.map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={pending}
                          className="rounded bg-sky-900/40 px-2 py-1 text-[11px] text-sky-200 hover:bg-sky-900/60"
                          onClick={() =>
                            runAction(item.patientId, item.imageId, () =>
                              reassignImagingReviewViewTypeAction(
                                tenantId,
                                item.patientId,
                                withAdmin({
                                  patientImageId: item.imageId,
                                  assignedViewType:
                                    reassignView[item.imageId] ?? item.viewType ?? "donor",
                                  staffNote: notes[item.imageId],
                                })
                              )
                            )
                          }
                        >
                          Reassign
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}