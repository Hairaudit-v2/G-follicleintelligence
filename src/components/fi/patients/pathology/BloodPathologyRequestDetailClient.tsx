"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PathologyRequestDetailBundle } from "@/src/lib/pathology/pathologyTypes";

export function BloodPathologyRequestDetailClient({
  tenantId,
  patientId,
  requestId,
  bundle,
  audit,
}: {
  tenantId: string;
  patientId: string;
  requestId: string;
  bundle: PathologyRequestDetailBundle;
  audit: { id: string; occurred_at: string; activity_kind: string; title: string | null }[];
}) {
  const router = useRouter();
  const { request, items, patientName, dateOfBirth, patientEmail, patientPhone, doctorDisplayName, templateLabel } =
    bundle;
  const [notes, setNotes] = useState(request.clinical_notes ?? "");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesMsg, setNotesMsg] = useState<string | null>(null);
  const [emailNote, setEmailNote] = useState("");
  const [busy, setBusy] = useState<null | "email" | "cancel" | "pdf">(null);
  const [err, setErr] = useState<string | null>(null);

  const base = `/api/tenants/${encodeURIComponent(tenantId)}/patients/${encodeURIComponent(patientId)}/pathology-requests/${encodeURIComponent(requestId)}`;

  const saveNotes = async () => {
    setNotesMsg(null);
    setErr(null);
    setNotesSaving(true);
    try {
      const res = await fetch(base, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinical_notes: notes.trim() ? notes.trim() : null }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || json.ok !== true) {
        setNotesMsg(json.error ?? "Could not save notes.");
        return;
      }
      setNotesMsg("Saved.");
      router.refresh();
    } finally {
      setNotesSaving(false);
    }
  };

  const downloadPdf = async () => {
    setErr(null);
    setBusy("pdf");
    try {
      const res = await fetch(`${base}/pdf`);
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setErr(j.error ?? `Download failed (${res.status}).`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pathology-request-${requestId.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(null);
    }
  };

  const sendEmail = async () => {
    setErr(null);
    setBusy("email");
    try {
      const res = await fetch(`${base}/send-to-patient`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personal_note: emailNote.trim() ? emailNote.trim() : null }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || json.ok !== true) {
        setErr(json.error ?? `Send failed (${res.status}).`);
        return;
      }
      setEmailNote("");
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const cancelReq = async () => {
    if (!globalThis.confirm("Cancel this blood request? This cannot be undone.")) return;
    setErr(null);
    setBusy("cancel");
    try {
      const res = await fetch(`${base}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || json.ok !== true) {
        setErr(json.error ?? `Cancel failed (${res.status}).`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const cancelled = request.status === "cancelled";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Blood test request</h1>
          <p className="mt-1 text-sm text-slate-400">
            Patient <span className="font-medium text-slate-100">{patientName}</span>
            {dateOfBirth ? (
              <>
                {" "}
                · DOB <span className="font-mono text-xs">{dateOfBirth}</span>
              </>
            ) : null}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Request ID <code className="rounded bg-white/[0.06] px-1">{requestId}</code>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={Boolean(busy) || cancelled}
            onClick={downloadPdf}
            className="rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-3 py-1.5 text-sm font-medium text-slate-100 hover:bg-white/[0.03] disabled:opacity-50"
          >
            {busy === "pdf" ? "Preparing…" : "Download PDF"}
          </button>
          <button
            type="button"
            disabled={Boolean(busy) || cancelled}
            onClick={cancelReq}
            className="rounded border border-rose-500/20 bg-[#0F1629]/80 backdrop-blur-md px-3 py-1.5 text-sm font-medium text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
          >
            {busy === "cancel" ? "Cancelling…" : "Cancel request"}
          </button>
        </div>
      </div>

      {err ? <p className="rounded border border-rose-500/20 bg-rose-500/10 p-2 text-sm text-rose-300">{err}</p> : null}

      {!cancelled && !patientEmail ? (
        <p className="rounded border border-amber-400/20 bg-amber-400/10 p-2 text-sm text-amber-200">
          No email is stored on the linked person record — add one to enable emailing this PDF to the patient.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40">
          <h2 className="text-sm font-semibold text-slate-100">Request details</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-gray-500">Status</dt>
              <dd className="font-medium text-slate-100">{request.status}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray-500">Request date</dt>
              <dd className="text-slate-100">{request.request_date}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray-500">Template</dt>
              <dd className="text-right text-slate-100">{templateLabel}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray-500">Doctor</dt>
              <dd className="text-right text-slate-100">{doctorDisplayName ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray-500">Patient email</dt>
              <dd className="text-right text-slate-100">{patientEmail ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray-500">Patient phone</dt>
              <dd className="text-right text-slate-100">{patientPhone ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray-500">Emailed to patient</dt>
              <dd className="text-right text-xs text-slate-100">
                {request.emailed_to_patient_at ? request.emailed_to_patient_at.slice(0, 19).replace("T", " ") : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray-500">Stored PDF</dt>
              <dd className="text-right text-xs text-slate-300">{request.pdf_storage_path ? "Yes (private bucket)" : "—"}</dd>
            </div>
            {request.cancelled_at ? (
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">Cancelled at</dt>
                <dd className="text-right text-xs text-slate-100">{request.cancelled_at.slice(0, 19).replace("T", " ")}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40">
          <h2 className="text-sm font-semibold text-slate-100">Clinical notes / indication</h2>
          <p className="mt-1 text-xs text-slate-400">Shown on the PDF. {cancelled ? "Read-only (cancelled)." : null}</p>
          <textarea
            className="mt-2 w-full rounded border border-slate-700 px-2 py-2 text-sm"
            rows={6}
            value={notes}
            disabled={cancelled}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional clinical context for the laboratory or patient…"
          />
          {!cancelled ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={notesSaving}
                onClick={saveNotes}
                className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {notesSaving ? "Saving…" : "Save notes"}
              </button>
              {notesMsg ? <span className="text-xs text-slate-400">{notesMsg}</span> : null}
            </div>
          ) : null}
        </section>
      </div>

      {!cancelled && patientEmail ? (
        <section className="rounded border border-blue-100 bg-blue-500/10 p-4">
          <h2 className="text-sm font-semibold text-slate-100">Email to patient</h2>
          <p className="mt-1 text-xs text-slate-400">
            Sends a short message with the PDF attached. Requires Resend (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`).
          </p>
          <textarea
            className="mt-2 w-full rounded border border-slate-700 px-2 py-2 text-sm"
            rows={3}
            value={emailNote}
            onChange={(e) => setEmailNote(e.target.value)}
            placeholder="Optional personal line to append (e.g. fasting instructions)…"
          />
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={sendEmail}
            className="mt-2 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy === "email" ? "Sending…" : "Email PDF to patient"}
          </button>
        </section>
      ) : null}

      <section className="rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40">
        <h2 className="text-sm font-semibold text-slate-100">Requested tests</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-100">
          {items.map((it) => (
            <li key={it.id}>
              {it.test_code ? <span className="font-mono text-xs text-slate-400">{it.test_code}</span> : null}
              {it.test_code ? " · " : null}
              {it.test_label}
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40">
        <h2 className="text-sm font-semibold text-slate-100">Audit trail (this request)</h2>
        <p className="mt-1 text-xs text-slate-400">CRM activity rows scoped to this pathology request id.</p>
        {audit.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">No matching events.</p>
        ) : (
          <ul className="mt-3 divide-y divide-white/[0.06]">
            {audit.map((a) => (
              <li key={a.id} className="py-2 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium text-slate-100">{a.title?.trim() || a.activity_kind}</span>
                  <time className="text-xs text-gray-500" dateTime={a.occurred_at}>
                    {a.occurred_at.slice(0, 19).replace("T", " ")}
                  </time>
                </div>
                <p className="text-xs text-slate-400">{a.activity_kind}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-sm text-slate-400">
        <Link href={`/fi-admin/${tenantId}/patients/${patientId}`} className="text-blue-600 hover:underline">
          ← Back to patient profile
        </Link>
      </p>
    </div>
  );
}
