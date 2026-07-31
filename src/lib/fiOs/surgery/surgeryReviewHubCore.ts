/**
 * FI-UX-REBUILD D6G-D — staff-safe Surgery Review hub (not full intelligence dashboard).
 */

import { surgeryCasesWorklistBasePath } from "@/src/lib/cases/casesIndexFilters";
import {
  buildFiOsSurgeryBase,
  buildFiOsSurgeryLegacyHref,
} from "@/src/lib/fiOs/surgery/surgeryWorkspaceCore";

export type SurgeryReviewHubAccess = {
  canAccessCases: boolean;
  canAccessSurgeryWorkspace: boolean;
  /** Full /surgery-os/intelligence — admin/platform only; never general staff default. */
  canAccessAdvancedOutcomeView: boolean;
  canAccessGraftCounting: boolean;
};

export type SurgeryReviewHubCard = {
  id: string;
  title: string;
  description: string;
  statusLabel: string;
  ctaLabel: string;
  href: string | null;
};

export type SurgeryReviewHubPanel = {
  id: "records" | "grafts" | "imaging" | "outcomes";
  title: string;
  description: string;
  statusLabel: string;
  ctaLabel: string;
  href: string | null;
};

export type SurgeryReviewHubModel = {
  headerTitle: string;
  headerDescription: string;
  summaryCards: SurgeryReviewHubCard[];
  panels: SurgeryReviewHubPanel[];
  advancedAdminLink: {
    label: string;
    description: string;
    href: string;
  } | null;
};

export function buildSurgeryReviewHubModel(input: {
  tenantId: string;
  access: SurgeryReviewHubAccess;
}): SurgeryReviewHubModel {
  const tid = input.tenantId.trim();
  const surgeryBase = buildFiOsSurgeryBase(tid);
  const casesHref = surgeryCasesWorklistBasePath(tid);
  const overviewHref = surgeryBase;

  const casesAllowed = input.access.canAccessCases && input.access.canAccessSurgeryWorkspace;
  const casesOrNull = casesAllowed ? casesHref : null;

  const summaryCards: SurgeryReviewHubCard[] = [
    {
      id: "cases-awaiting",
      title: "Cases awaiting review",
      description: "Open the surgery case list to check records that still need attention.",
      statusLabel: casesAllowed ? "Available" : "Not available",
      ctaLabel: "Open review queue",
      href: casesOrNull,
    },
    {
      id: "graft-confirmation",
      title: "Graft records requiring confirmation",
      description: "Confirm graft documentation from the case worklist or graft tools you can access.",
      statusLabel: casesAllowed || input.access.canAccessGraftCounting ? "Available" : "Not available",
      ctaLabel: "Review graft records",
      href: casesOrNull,
    },
    {
      id: "imaging-awaiting",
      title: "Imaging awaiting review",
      description: "Open cases to review linked surgical imaging from each patient record.",
      statusLabel: casesAllowed ? "Available" : "Not available",
      ctaLabel: "View imaging",
      href: casesOrNull,
    },
    {
      id: "outcomes-due",
      title: "Outcome reviews due",
      description: "Follow up post-op and outcome notes from the surgery case worklist.",
      statusLabel: casesAllowed ? "Available" : "Not available",
      ctaLabel: "Review outcomes",
      href: casesOrNull,
    },
    {
      id: "recently-completed",
      title: "Recently completed reviews",
      description: "Return to the surgery overview for today’s completed surgical activity.",
      statusLabel: input.access.canAccessSurgeryWorkspace ? "Available" : "Not available",
      ctaLabel: "Open overview",
      href: input.access.canAccessSurgeryWorkspace ? overviewHref : null,
    },
  ].filter((card) => card.href != null);

  const allPanels: SurgeryReviewHubPanel[] = [
    {
      id: "records",
      title: "Surgical records",
      description: "Case plans, procedure notes, and readiness still open for confirmation.",
      statusLabel: casesAllowed ? "Ready to open" : "Restricted",
      ctaLabel: "Open review queue",
      href: casesOrNull,
    },
    {
      id: "grafts",
      title: "Graft documentation",
      description: "Graft counts and tray notes that need a second look after surgery.",
      statusLabel: casesAllowed ? "Ready to open" : "Restricted",
      ctaLabel: "Review graft records",
      href: casesOrNull,
    },
    {
      id: "imaging",
      title: "Imaging",
      description: "Surgical photos and imaging checks linked from the case record.",
      statusLabel: casesAllowed ? "Ready to open" : "Restricted",
      ctaLabel: "View imaging",
      href: casesOrNull,
    },
    {
      id: "outcomes",
      title: "Outcomes and follow-up",
      description: "Post-op follow-up and outcome notes that still need staff attention.",
      statusLabel: casesAllowed ? "Ready to open" : "Restricted",
      ctaLabel: "Review outcomes",
      href: casesOrNull,
    },
  ];
  const panels = allPanels.filter((panel) => panel.href != null);

  const advancedAdminLink =
    input.access.canAccessAdvancedOutcomeView
      ? {
          label: "Open advanced outcome view",
          description:
            "Administrative analytics for published graft and outcome facts. Role-gated; not part of day-to-day review.",
          href: buildFiOsSurgeryLegacyHref(tid, "surgery-os/intelligence"),
        }
      : null;

  return {
    headerTitle: "Surgery review",
    headerDescription:
      "Review surgical records, graft documentation, imaging and outcomes requiring attention.",
    summaryCards,
    panels,
    advancedAdminLink,
  };
}

/** Staff-facing labels must not include “intelligence” as a product name. */
export function surgeryReviewHubUsesStaffSafeLabels(model: SurgeryReviewHubModel): boolean {
  const texts = [
    model.headerTitle,
    model.headerDescription,
    ...model.summaryCards.flatMap((c) => [c.title, c.description, c.ctaLabel]),
    ...model.panels.flatMap((p) => [p.title, p.description, p.ctaLabel]),
    model.advancedAdminLink?.label,
    model.advancedAdminLink?.description,
  ].filter(Boolean) as string[];
  return texts.every((t) => !/\bsurgery\s+intelligence\b/i.test(t) && !/\boutcome\s+intelligence\b/i.test(t));
}
