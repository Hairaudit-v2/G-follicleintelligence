"use client";

import { useMemo, useState } from "react";

import { DocumentTemplatesSection } from "@/src/components/fi-admin/settings/DocumentTemplatesSection";
import { ReceptionTemplatesSection } from "@/src/components/fi-admin/settings/ReceptionTemplatesSection";
import { ReminderTemplatesSection } from "@/src/components/fi-admin/settings/ReminderTemplatesSection";
import type { FiDocumentTemplateRow } from "@/src/lib/documentTemplates/documentTemplateTypes";
import type { ReceptionCommunicationTemplateContent } from "@/src/lib/receptionOs/receptionCommunicationTemplates";
import type { FiReminderTemplateRow } from "@/src/lib/reminders/reminderTypes";
import { cn } from "@/lib/utils";

const TABS = [
  {
    id: "booking",
    label: "Booking & lifecycle",
    description: "Automated booking, lead, consult, and invoice payment reminder templates.",
  },
  {
    id: "commercial",
    label: "Front-desk & payments",
    description: "ReceptionOS messages for deposits, invoices, payment links, and booking notices.",
  },
  {
    id: "documents",
    label: "Sales documents",
    description: "Terms & conditions, invoice terms, policies, and consent summaries.",
  },
] as const;

export type TemplatesHubTabId = (typeof TABS)[number]["id"];

export function TemplatesHubClient(props: {
  tenantId: string;
  initialTab?: TemplatesHubTabId;
  reminderTemplates: FiReminderTemplateRow[];
  receptionTemplates: ReceptionCommunicationTemplateContent[];
  documentTemplates: FiDocumentTemplateRow[];
}) {
  const initial = useMemo(() => {
    const t = props.initialTab;
    if (t === "booking" || t === "commercial" || t === "documents") return t;
    return "booking";
  }, [props.initialTab]);

  const [tab, setTab] = useState<TemplatesHubTabId>(initial);
  const active = TABS.find((t) => t.id === tab) ?? TABS[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-white/[0.08] pb-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
              tab === t.id
                ? "bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/35"
                : "text-[#94A3B8] hover:bg-white/[0.04] hover:text-[#E2E8F0]"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-[#64748B]">{active.description}</p>

      {tab === "booking" ? (
        <ReminderTemplatesSection
          tenantId={props.tenantId}
          initialTemplates={props.reminderTemplates}
        />
      ) : null}
      {tab === "commercial" ? (
        <ReceptionTemplatesSection
          tenantId={props.tenantId}
          initialTemplates={props.receptionTemplates}
        />
      ) : null}
      {tab === "documents" ? (
        <DocumentTemplatesSection
          tenantId={props.tenantId}
          initialTemplates={props.documentTemplates}
        />
      ) : null}
    </div>
  );
}
