"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { markCrmQuoteAcceptedAction } from "@/lib/actions/fi-crm-quote-actions";
import { useAppointmentSlideOverOptional } from "@/src/components/fi/appointments/AppointmentSlideOver";
import { FiCard } from "@/src/components/fi-design/FiCard";
import { fiOsLightFormSurfaceClassNames } from "@/src/components/fi-design/fiDesignTokens";
import { buildSurgeryAppointmentPrefillFromAcceptedQuote } from "@/src/lib/crm/acceptedCrmQuoteSurgeryPrefill";
import { crmQuoteDisplayTitle } from "@/src/lib/crm/crmQuoteDisplayTitle";
import type { CaseCrmQuoteRow } from "@/src/lib/crm/crmQuoteLoaders.server";

function quoteTitle(q: CaseCrmQuoteRow): string {
  return crmQuoteDisplayTitle(q.metadata, q.line_items_snapshot);
}

export function CaseCrmQuotesPipelineCard(props: {
  tenantId: string;
  caseId: string;
  patientFoundationId: string | null;
  leadId: string | null;
  personId: string | null;
  clinicId: string | null;
  quotes: CaseCrmQuoteRow[];
}) {
  const tid = props.tenantId.trim();
  const cid = props.caseId.trim();
  const router = useRouter();
  const slide = useAppointmentSlideOverOptional();
  const [adminKey, setAdminKey] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const withKey = useCallback(
    <T extends Record<string, unknown>>(body: T): T & { adminKey?: string } => {
      const k = adminKey.trim();
      return k ? { ...body, adminKey: k } : body;
    },
    [adminKey]
  );

  const onAccept = useCallback(
    async (quoteId: string) => {
      setMsg(null);
      setBusyId(quoteId);
      const res = await markCrmQuoteAcceptedAction(tid, withKey({ quoteId }));
      setBusyId(null);
      if (!res.ok) {
        setMsg(res.error);
        return;
      }
      setMsg(
        res.result.reused
          ? "Quote was already accepted."
          : res.result.leadStageUpdated
            ? "Quote marked accepted — CRM stage advanced where applicable."
            : "Quote marked accepted."
      );
      router.refresh();
    },
    [router, tid, withKey]
  );

  const openSurgeryFromQuote = useCallback(
    (q: CaseCrmQuoteRow) => {
      if (!slide) return;
      const title = quoteTitle(q);
      const { description, initialMetadata } = buildSurgeryAppointmentPrefillFromAcceptedQuote({
        id: q.id,
        consultation_id: q.consultation_id,
        subtotal_amount: q.subtotal_amount,
        total_amount: q.total_amount,
        metadata: q.metadata,
        line_items_snapshot: q.line_items_snapshot,
      });
      slide.openCreateAppointment({
        caseId: cid,
        patientId: props.patientFoundationId,
        personId: props.personId,
        leadId: props.leadId,
        clinicId: props.clinicId,
        bookingType: "surgery",
        title: title.length > 120 ? `${title.slice(0, 117)}…` : title,
        description,
        consultationId: q.consultation_id,
        initialMetadata,
      });
    },
    [cid, props.clinicId, props.leadId, props.personId, props.patientFoundationId, slide]
  );

  if (!props.quotes.length) {
    return (
      <FiCard className="space-y-2 p-4">
        <h2 className="text-sm font-semibold text-slate-100">Quotes &amp; booking handoff</h2>
        <p className={`text-xs ${fiOsLightFormSurfaceClassNames.helper}`}>
          No CRM quotes are linked to this case yet. Complete a guided consultation, then use{" "}
          <strong>Create quote draft</strong> on the consultation form hand-offs (requires a linked
          lead or this case).
        </p>
        <p className={`text-xs ${fiOsLightFormSurfaceClassNames.helper}`}>
          <Link
            href={`/fi-admin/${tid}/consultations`}
            className="font-semibold text-cyan-300 underline"
          >
            Open consultations
          </Link>
        </p>
      </FiCard>
    );
  }

  return (
    <FiCard className="space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-100">Quotes &amp; booking handoff</h2>
        <label className="text-xs text-slate-400">
          Staff key{" "}
          <input
            className="ml-1 rounded border border-slate-700 px-2 py-0.5 font-mono text-[11px]"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            autoComplete="off"
          />
        </label>
      </div>
      <p className={`text-xs ${fiOsLightFormSurfaceClassNames.helper}`}>
        CRM quotes from consultations linked to this case. Mark accepted to log CRM activity (and
        advance the lead when it is on <span className="font-mono">quote_sent</span>). Use surgery
        scheduling when the quote is accepted. Deposit invoices and payment links live in{" "}
        <strong>Payments &amp; invoices</strong> below.
      </p>
      {msg ? (
        <p
          className="rounded border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-xs text-slate-200"
          role="status"
        >
          {msg}
        </p>
      ) : null}
      <ul className="divide-y divide-white/[0.06] rounded border border-white/[0.08]">
        {props.quotes.map((q) => {
          const consHref = q.consultation_id
            ? `/fi-admin/${tid}/consultations/${encodeURIComponent(q.consultation_id)}`
            : null;
          const accepted = q.status.trim().toLowerCase() === "accepted";
          return (
            <li key={q.id} className="space-y-2 px-3 py-3 text-xs">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-100">{quoteTitle(q)}</p>
                  <p className="mt-0.5 text-slate-400">
                    Status: <span className="font-mono">{q.status}</span>
                    {q.valid_until ? ` · valid until ${q.valid_until.slice(0, 10)}` : null}
                  </p>
                  {consHref ? (
                    <p className="mt-1">
                      <Link href={consHref} className="font-semibold text-cyan-300 underline">
                        Open consultation
                      </Link>
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={
                      Boolean(busyId) ||
                      accepted ||
                      ["declined", "expired", "cancelled"].includes(q.status.trim().toLowerCase())
                    }
                    onClick={() => void onAccept(q.id)}
                    className="rounded bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
                  >
                    {busyId === q.id ? "Saving…" : accepted ? "Accepted" : "Mark accepted"}
                  </button>
                  <button
                    type="button"
                    disabled={!slide || !accepted}
                    onClick={() => openSurgeryFromQuote(q)}
                    title={
                      !slide
                        ? "Sign in with booking permissions to schedule from this page."
                        : undefined
                    }
                    className="rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2.5 py-1.5 text-[11px] font-semibold text-slate-100 disabled:opacity-50"
                  >
                    Schedule surgery
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </FiCard>
  );
}
