"use client";

import Link from "next/link";

import { FiCard } from "@/src/components/fi-design/FiCard";
import { fiOsLightFormSurfaceClassNames } from "@/src/components/fi-design/fiDesignTokens";
import { cn } from "@/lib/utils";

type HubRouteTile = {
  title: string;
  body: string;
  href: string | null;
  cta: string;
};

export function ConsultationOsHubRoutingActions({
  tenantId,
  consultationId,
  caseId,
  leadId,
  patientId,
}: {
  tenantId: string;
  consultationId: string;
  caseId?: string | null;
  leadId?: string | null;
  patientId?: string | null;
}) {
  const tid = tenantId.trim();
  const cid = consultationId.trim();
  const kase = caseId?.trim() || null;
  const lid = leadId?.trim() || null;
  const pid = patientId?.trim() || null;
  const base = `/fi-admin/${tid}/consultations/${cid}`;

  const tiles: HubRouteTile[] = [
    {
      title: "Open SurgeryOS",
      body: "Case workspace for planning, graft design, and operative documentation.",
      href: kase ? `/fi-admin/${tid}/cases/${kase}` : null,
      cta: kase ? "Open case" : "Link a case on this consultation",
    },
    {
      title: "Create RevenueOS quote",
      body: "Invoices use consultation quote fields and CRM quote drafts. Open the case workspace for payments, or the guided form for Create quote draft.",
      href: kase ? `/fi-admin/${tid}/cases/${kase}` : `${base}/forms`,
      cta: kase ? "Open case (payments)" : "Open consultation form",
    },
    {
      title: "Send to HairAudit",
      body: "HairAudit OS queue and evidence surfaces for surgical audit workflows.",
      href: "/hair-audit/admin",
      cta: "Open HairAudit",
    },
    {
      title: "Update Patient Twin",
      body: "Foundation twin, checklist, and longitudinal signals for this patient.",
      href: pid ? `/fi-admin/${tid}/patients/${pid}/twin` : null,
      cta: pid ? "Open Patient Twin" : "Link a patient first",
    },
    {
      title: "Open Pathology",
      body: "Scalp disorder / pathology pathway form, or patient lab requests and results.",
      href: pid ? `/fi-admin/${tid}/patients/${pid}/blood-request` : `${base}/forms/pathology`,
      cta: pid ? "Patient labs" : "Pathology pathway form",
    },
    {
      title: "Schedule follow-up",
      body: "Operational calendar for booking the next visit.",
      href: `/fi-admin/${tid}/calendar`,
      cta: "Open calendar",
    },
  ];

  return (
    <div className="space-y-3">
      <h3 className={fiOsLightFormSurfaceClassNames.panelCaption}>Routing</h3>
      <p className={fiOsLightFormSurfaceClassNames.helper}>
        Next operating surfaces for this consultation. Nothing here runs automatically — pick the workflow you need.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => {
          const enabled = Boolean(t.href);
          return (
            <div key={t.title}>
              <FiCard
                className={cn(
                  "flex h-full flex-col gap-2 p-4 transition",
                  enabled ? "border-slate-200 hover:border-sky-300 hover:shadow-sm" : "border-slate-100 bg-slate-50/60 opacity-80"
                )}
              >
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-50">{t.title}</h4>
                <p className={cn("flex-1 text-xs", fiOsLightFormSurfaceClassNames.helper)}>{t.body}</p>
                {enabled ? (
                  <Link
                    href={t.href!}
                    className="mt-1 inline-flex min-h-[40px] items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-center text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                  >
                    {t.cta}
                  </Link>
                ) : (
                  <span className="mt-1 inline-flex min-h-[40px] items-center justify-center rounded-lg border border-dashed border-slate-200 px-3 py-2 text-center text-xs font-medium text-slate-500 dark:border-slate-600 dark:text-slate-400">
                    {t.cta}
                  </span>
                )}
              </FiCard>
            </div>
          );
        })}
      </div>
      {lid ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          CRM:{" "}
          <Link href={`/fi-admin/${tid}/crm/leads/${lid}`} className="font-semibold text-sky-700 underline dark:text-sky-400">
            Open linked lead
          </Link>
        </p>
      ) : null}
    </div>
  );
}
