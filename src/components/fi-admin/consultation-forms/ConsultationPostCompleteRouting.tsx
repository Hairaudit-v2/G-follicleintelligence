"use client";

import Link from "next/link";

import { FiCard } from "@/src/components/fi-design/FiCard";
import { fiOsLightFormSurfaceClassNames } from "@/src/components/fi-design/fiDesignTokens";
import { cn } from "@/lib/utils";

type RouteTile = {
  title: string;
  body: string;
  href: string | null;
  cta: string;
};

export function ConsultationPostCompleteRouting({
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

  const tiles: RouteTile[] = [
    {
      title: "SurgeryOS",
      body: "Open the linked case for planning, graft design, and operative documentation.",
      href: kase ? `/fi-admin/${tid}/cases/${kase}` : null,
      cta: kase ? "Open case" : "Link a case first",
    },
    {
      title: "RevenueOS",
      body: "Quotes, payment requests, and billing configuration for this tenant.",
      href: `/fi-admin/${tid}/payments`,
      cta: "Open payments",
    },
    {
      title: "LeadFlow follow-up",
      body: "Return to the CRM lead workspace for sequencing and tasks.",
      href: lid ? `/fi-admin/${tid}/crm/leads/${lid}` : null,
      cta: lid ? "Open lead" : "Link a lead first",
    },
    {
      title: "Pathology / labs",
      body: "Prepare a blood or screening request from the guided hand-offs below when indicated.",
      href: pid ? `/fi-admin/${tid}/patients/${pid}` : null,
      cta: pid ? "Open patient" : "Link a patient first",
    },
    {
      title: "HairAudit baseline",
      body: "Platform audit queue and evidence surfaces (HairAudit OS).",
      href: "/hair-audit/admin",
      cta: "HairAudit admin",
    },
    {
      title: "Treatment pathway",
      body: "Consultation workspace — imaging, medications, and longitudinal care.",
      href: base,
      cta: "Back to consultation",
    },
  ];

  return (
    <div className="space-y-3">
      <h3 className={fiOsLightFormSurfaceClassNames.panelCaption}>Where next?</h3>
      <p className={fiOsLightFormSurfaceClassNames.helper}>
        Consultation is locked. Pick the next operating surface — nothing here runs automatically.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => {
          const enabled = Boolean(t.href);
          const inner = (
            <FiCard
              className={cn(
                "flex h-full flex-col gap-2 p-4 transition",
                enabled
                  ? "border-white/[0.08] hover:border-sky-300 hover:shadow-sm"
                  : "border-white/[0.06] bg-white/[0.03] opacity-80"
              )}
            >
              <h4 className="text-sm font-semibold text-slate-100">{t.title}</h4>
              <p className={cn("flex-1 text-xs", fiOsLightFormSurfaceClassNames.helper)}>
                {t.body}
              </p>
              {enabled ? (
                <Link
                  href={t.href!}
                  className="mt-1 inline-flex min-h-[40px] items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-center text-xs font-semibold text-white hover:bg-slate-800"
                >
                  {t.cta}
                </Link>
              ) : (
                <span className="mt-1 inline-flex min-h-[40px] items-center justify-center rounded-lg border border-dashed border-white/[0.08] px-3 py-2 text-center text-xs font-medium text-slate-500">
                  {t.cta}
                </span>
              )}
            </FiCard>
          );
          return <div key={t.title}>{inner}</div>;
        })}
      </div>
    </div>
  );
}
