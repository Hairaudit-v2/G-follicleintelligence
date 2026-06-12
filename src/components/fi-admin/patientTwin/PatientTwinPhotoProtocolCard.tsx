"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import {
  acceptProtocolSlotAction,
  analyseUnclassifiedProtocolImagesAction,
  attachImageToProtocolSlotAction,
  completePhotoProtocolSessionAction,
  createPhotoProtocolSessionAction,
  markProtocolSlotNeedsRetakeAction,
} from "@/src/lib/actions/fi-photo-protocol-actions";
import { HLI_PHOTO_PROTOCOL_CLINICAL_CONTEXTS } from "@/src/lib/hair-intelligence/photoProtocols/types";
import type { PatientTwinV1 } from "@/src/lib/patientTwin/patientTwinTypes";

const CTX_OPTS = [...HLI_PHOTO_PROTOCOL_CLINICAL_CONTEXTS];

export function PatientTwinPhotoProtocolCard({
  tenantId,
  patientId,
  twin,
}: {
  tenantId: string;
  patientId: string;
  twin: PatientTwinV1;
}) {
  const pp = twin.photo_protocol;
  const galleryById = useMemo(() => {
    const m = new Map<string, string>();
    for (const it of twin.imaging.gallery.items) {
      m.set(it.id, it.thumbnail_url);
    }
    return m;
  }, [twin.imaging.gallery.items]);

  const [msg, setMsg] = useState<string | null>(null);
  const [ctx, setCtx] = useState<string>(pp?.clinical_context ?? "consultation");
  const [pending, start] = useTransition();

  if (!pp) {
    return (
      <section className="rounded-lg border border-white/[0.08] bg-[#0b1220]/80 p-4 text-sm text-slate-400">
        <h2 className="text-sm font-semibold text-white">Smart Photography Protocol</h2>
        <p className="mt-2">Protocol templates are not available yet (database migration or seed missing).</p>
      </section>
    );
  }

  const done = pp.compliance.required_count - pp.compliance.missing_count;
  const pct = pp.compliance.required_count ? Math.round((100 * done) / pp.compliance.required_count) : 0;

  return (
    <section className="rounded-lg border border-white/[0.08] bg-[#0b1220]/80 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-cyan-400/90">Smart Photography Protocol</h2>
          <p className="mt-1 text-base font-medium text-white">{pp.template_name}</p>
          <p className="text-xs text-slate-400">Template: {pp.template_slug}</p>
        </div>
        <div className="text-right text-xs text-slate-400">
          {pp.active_session_id ? <span>Session: {pp.active_session_id.slice(0, 8)}… ({pp.active_session_status})</span> : <span>No active session</span>}
          <div className="mt-1">
            <Link
              href={`/fi-admin/${encodeURIComponent(tenantId)}/foundation-integrity#fi-os-photo-protocol-analytics`}
              className="text-cyan-300/90 hover:underline"
            >
              Tenant protocol analytics
            </Link>
          </div>
        </div>
      </div>

      {msg ? <p className="mt-2 text-xs text-amber-200/90">{msg}</p> : null}

      <div className="mt-4">
        <div className="flex justify-between text-xs text-slate-400">
          <span>Progress</span>
          <span>
            {done}/{pp.compliance.required_count} required matched
          </span>
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-cyan-500/80 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <span>Context</span>
          <select
            className="rounded-md border border-white/10 bg-[#0f172a] px-2 py-1 text-xs text-white"
            value={ctx}
            onChange={(e) => setCtx(e.target.value)}
            disabled={Boolean(pp.active_session_id)}
          >
            {CTX_OPTS.map((c) => (
              <option key={c} value={c}>
                {c.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={pending || Boolean(pp.active_session_id)}
          className="rounded-md bg-cyan-600/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-600 disabled:opacity-40"
          onClick={() => {
            setMsg(null);
            start(async () => {
              const res = await createPhotoProtocolSessionAction(tenantId, patientId, { clinical_context: ctx as (typeof CTX_OPTS)[number] });
              if (!res.ok) setMsg(res.error);
            });
          }}
        >
          Start protocol
        </button>
        {pp.unclassified_image_ids.length > 0 ? (
          <button
            type="button"
            disabled={pending}
            className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-white ring-1 ring-white/15 hover:bg-white/15 disabled:opacity-40"
            onClick={() => {
              setMsg(null);
              start(async () => {
                const res = await analyseUnclassifiedProtocolImagesAction(tenantId, patientId, {
                  image_ids: pp.unclassified_image_ids,
                });
                if (!res.ok) setMsg(res.error);
              });
            }}
          >
            Analyse missing images ({pp.unclassified_image_ids.length})
          </button>
        ) : null}
        {pp.active_session_id ? (
          <button
            type="button"
            disabled={pending || !pp.can_complete_session}
            className="rounded-md bg-emerald-700/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
            title={!pp.can_complete_session ? "Complete required checklist (accept or strong capture) first." : undefined}
            onClick={() => {
              setMsg(null);
              start(async () => {
                const res = await completePhotoProtocolSessionAction(tenantId, patientId, pp.active_session_id!, {});
                if (!res.ok) setMsg(res.error);
              });
            }}
          >
            Complete protocol
          </button>
        ) : null}
      </div>

      {pp.compliance.warnings.length > 0 ? (
        <ul className="mt-3 list-inside list-disc text-xs text-amber-200/90">
          {pp.compliance.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 space-y-3">
        <p className="text-xs font-semibold text-slate-300">Checklist</p>
        <ul className="space-y-2">
          {pp.checklist.map((row) => {
            const sug = pp.compliance.suggested_matches[row.slot_id]?.[0];
            const thumb = row.patient_image_id ? galleryById.get(row.patient_image_id) : sug ? galleryById.get(sug.image_id) : null;
            return (
              <li key={row.slot_id + row.session_slot_id} className="rounded-md border border-white/[0.06] bg-white/[0.03] p-2 text-xs">
                <div className="flex flex-wrap items-start gap-2">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-white/5 text-[10px] text-slate-500">—</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white">{row.label}</p>
                    <p className="text-[10px] uppercase text-slate-500">{row.is_required ? "Required" : "Optional"}</p>
                    <p className="text-slate-400">
                      Status: <span className="text-slate-200">{row.status}</span>
                      {row.ai_match_confidence != null ? ` · match ${row.ai_match_confidence.toFixed(2)}` : null}
                    </p>
                    {row.capture_guidance ? <p className="mt-1 text-slate-500">{row.capture_guidance}</p> : null}
                  </div>
                </div>
                {pp.active_session_id && row.session_slot_id ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {sug ? (
                      <button
                        type="button"
                        disabled={pending}
                        className="rounded bg-white/10 px-2 py-1 text-[10px] text-white hover:bg-white/15 disabled:opacity-40"
                        onClick={() => {
                          setMsg(null);
                          start(async () => {
                            const res = await attachImageToProtocolSlotAction(tenantId, patientId, pp.active_session_id!, {
                              session_slot_row_id: row.session_slot_id,
                              patient_image_id: sug.image_id,
                            });
                            if (!res.ok) setMsg(res.error);
                          });
                        }}
                      >
                        Use best match
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={pending}
                      className="rounded bg-white/10 px-2 py-1 text-[10px] text-white hover:bg-white/15 disabled:opacity-40"
                      onClick={() => {
                        setMsg(null);
                        start(async () => {
                          const res = await acceptProtocolSlotAction(tenantId, patientId, pp.active_session_id!, {
                            session_slot_row_id: row.session_slot_id,
                            ...(row.patient_image_id ? { patient_image_id: row.patient_image_id } : {}),
                          });
                          if (!res.ok) setMsg(res.error);
                        });
                      }}
                    >
                      Mark accepted
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      className="rounded bg-rose-900/50 px-2 py-1 text-[10px] text-rose-100 hover:bg-rose-900/70 disabled:opacity-40"
                      onClick={() => {
                        const note = typeof window !== "undefined" ? window.prompt("Retake reason?", "Needs retake") : null;
                        if (!note?.trim()) return;
                        setMsg(null);
                        start(async () => {
                          const res = await markProtocolSlotNeedsRetakeAction(tenantId, patientId, pp.active_session_id!, {
                            session_slot_row_id: row.session_slot_id,
                            note: note.trim(),
                          });
                          if (!res.ok) setMsg(res.error);
                        });
                      }}
                    >
                      Needs retake
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
