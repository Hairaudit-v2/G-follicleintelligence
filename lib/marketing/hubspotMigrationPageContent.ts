/**
 * Public copy for `/migrate-from-hubspot` — FI-WEB-REFRESH-1G.
 * Scope claims are evidence-backed against completed HubSpot backup/import stages.
 */

export type MigrationScopeStatus =
  | "Supported"
  | "Supported with scope review"
  | "Not currently included"
  | "Future consideration";

export type MigrationScopeRow = {
  item: string;
  status: MigrationScopeStatus;
  note?: string;
};

export const HUBSPOT_MIGRATION_PAGE_CONTENT = {
  seo: {
    title: "Migrate from HubSpot to a Hair Restoration Operating System | Follicle Intelligence",
    description:
      "Explore a controlled pathway to connect, coexist with or progressively replace HubSpot using Follicle Intelligence. Preserve clinic history while connecting CRM, patient and operational workflows.",
    ogTitle: "Move beyond HubSpot without losing clinic history",
    ogDescription:
      "Staged, verified HubSpot transition into Follicle Intelligence — designed to protect patient identity and clinic continuity.",
    path: "/migrate-from-hubspot" as const,
    keywords: [
      "migrate from HubSpot",
      "hair transplant clinic CRM",
      "hair restoration operating system",
      "HubSpot hair clinic migration",
      "clinic CRM transition",
    ] as const,
  },

  hero: {
    id: "hubspot-migration-hero",
    eyebrow: "HubSpot migration pathway",
    headline: "Move beyond HubSpot without losing the history that built your clinic.",
    subheadline:
      "Follicle Intelligence provides a controlled pathway to connect, coexist with or progressively replace HubSpot — while preserving the contacts, relationships and operational context your clinic depends on.",
    supporting:
      "Transition contacts, enquiries and selected workflows into Follicle Intelligence through a staged, verified process designed to protect patient identity and clinic continuity.",
    scopeLine: "For hair restoration clinics and clinic groups evaluating CRM transition.",
    primaryCta: {
      label: "Request a Platform and Migration Review",
      href: "/demo?interest=hubspot-migration" as const,
    },
    secondaryCta: { label: "Explore LeadFlow", href: "/platform/leadflow" as const },
    tertiaryCta: { label: "View Platform Progress", href: "/platform/progress" as const },
  },

  whyBeyond: {
    id: "why-beyond-hubspot",
    eyebrow: "Why clinics look beyond CRM alone",
    headline: "HubSpot manages relationships. Hair restoration continues far beyond the CRM.",
    intro:
      "HubSpot is effective as a horizontal CRM across many industries. FI is purpose-built for the full hair restoration journey — commercial activity connected to consultation, patient records, imaging, treatment, surgery, workforce, follow-up and outcome audit.",
    quote:
      "The challenge is not that HubSpot cannot manage contacts. The challenge is that the patient journey continues far beyond the CRM.",
    fragmentation: [
      "A lead becomes a patient in another system",
      "Commercial history separates from clinical history",
      "Staff duplicate information across tools",
      "Handover becomes inconsistent",
      "Conversion data loses clinical context",
      "Owners cannot easily connect acquisition to final outcome",
    ] as const,
  },

  beyondCrm: {
    id: "beyond-crm",
    eyebrow: "What FI adds",
    headline: "From enquiry to outcome — one progressive patient identity.",
    intro:
      "The same patient identity can progressively connect lead source, contact history, consultation findings, imaging, treatment plan, procedure data, staff involvement, follow-up and outcome audit — without requiring every analytic layer to be fully live on day one.",
    steps: [
      { label: "Enquiry", detail: "Source, ownership and follow-up in LeadFlow" },
      { label: "Consultation", detail: "Structured assessment and planning" },
      { label: "Treatment or surgery", detail: "Preparation, procedure and team activity" },
      { label: "Follow-up", detail: "Care continuity and next actions" },
      { label: "Outcome", detail: "Imaging, review and audit pathways" },
    ] as const,
    maturityNote:
      "Cross-module intelligence expands with structured capture. Maturity varies by system — see Platform Progress for current status.",
  },

  modes: {
    id: "adoption-modes",
    eyebrow: "Four adoption pathways",
    headline: "Connect, coexist, transition or replace.",
    clinicLine: "Connect, transition or replace — at a pace that protects clinic continuity.",
    items: [
      {
        title: "Connect",
        body: "Selected data or workflows remain connected between HubSpot and FI.",
        suitable:
          "Clinics that want to begin using FI while retaining HubSpot as the primary CRM.",
      },
      {
        title: "Coexist",
        body: "HubSpot and FI operate alongside one another during an agreed adoption period.",
        suitable: "Staged rollout, workflow evaluation and staff adoption.",
      },
      {
        title: "Transition",
        body: "Selected contacts, leads, history and workflows move into FI through verified migration stages.",
        suitable: "Clinics ready to make LeadFlow the operational home for active CRM workflows.",
      },
      {
        title: "Replace",
        body: "FI becomes the primary CRM and wider clinic operating environment within the agreed deployment scope.",
        suitable:
          "Only after scope, migration readiness and operational controls are confirmed.",
      },
    ] as const,
  },

  stages: {
    id: "migration-stages",
    eyebrow: "Migration process",
    headline: "A staged process — discovery before data movement.",
    items: [
      {
        title: "Discovery and scope",
        body: "Review HubSpot usage, pipelines, forms, owners, notes, activities, automations, integrations, reporting, clinic workflows and patient-identity considerations.",
      },
      {
        title: "Historical protection",
        body: "Historical backup is completed, available objects are inventoried, scope limitations are documented, unsupported data is identified and recovery evidence is retained.",
      },
      {
        title: "Preview and reconciliation",
        body: "Migration records are previewed, existing FI patients and leads are matched, duplicate risks are identified, ambiguous identities are held for review and scope is frozen for the approved stage.",
      },
      {
        title: "Staged transition",
        body: "Records move in controlled groups. Patient records are protected. New lead creation is limited to approved scope. Active operations may continue during staged adoption.",
      },
      {
        title: "Verification",
        body: "Applied records are reconciled, duplicate creation is checked, patient mutations are reviewed, exceptions are recorded and migration history is retained.",
      },
      {
        title: "Operational adoption",
        body: "Staff use agreed FI workflows. HubSpot may remain connected during transition. Wider workflows move only when readiness is confirmed.",
      },
    ] as const,
  },

  scope: {
    id: "migration-scope",
    eyebrow: "What can be migrated",
    headline: "Scope is evidence-based — not assumed.",
    intro:
      "Not every HubSpot object, workflow or automation is automatically supported. What moves is governed by discovery, technical readiness and agreed deployment scope.",
    rows: [
      {
        item: "Contacts",
        status: "Supported",
        note: "Controlled staged import with preview and verification.",
      },
      {
        item: "Lead records and pipeline context",
        status: "Supported",
        note: "Lead linkage and pipeline context within approved cohorts.",
      },
      {
        item: "Selected ownership data",
        status: "Supported with scope review",
        note: "Owner mapping depends on available source properties.",
      },
      {
        item: "Forms and submissions",
        status: "Supported with scope review",
        note: "Inventory and reconciliation subject to source access.",
      },
      {
        item: "Selected notes and engagement history",
        status: "Supported with scope review",
        note: "Engagement backup and residual coverage vary by object.",
      },
      {
        item: "Source attribution",
        status: "Supported",
        note: "Where present on contact/lead records.",
      },
      {
        item: "Contact–lead relationships",
        status: "Supported",
        note: "Identity-linked mappings in controlled migration stages.",
      },
      {
        item: "File metadata",
        status: "Supported with scope review",
        note: "Metadata where available; file bodies may be limited.",
      },
      {
        item: "Custom properties",
        status: "Supported with scope review",
        note: "Mapped only when defined in the agreed scope.",
      },
      {
        item: "Complex automation workflows",
        status: "Not currently included",
        note: "Rebuilt or redesigned in FI — not one-to-one ported.",
      },
      {
        item: "Marketing lists and campaigns",
        status: "Not currently included",
        note: "May remain in HubSpot during coexistence.",
      },
      {
        item: "Deals and tickets",
        status: "Not currently included",
        note: "Subject to future consideration if clinically relevant.",
      },
      {
        item: "Custom objects",
        status: "Not currently included",
      },
      {
        item: "Email, call, meeting and conversation history",
        status: "Supported with scope review",
        note: "Engagement coverage depends on backup and import readiness.",
      },
      {
        item: "Attachments and file bodies",
        status: "Supported with scope review",
        note: "Not assumed complete for every historical file.",
      },
      {
        item: "Third-party integrations",
        status: "Not currently included",
        note: "Reconnected separately as part of deployment design.",
      },
      {
        item: "Archived or duplicate records",
        status: "Supported with scope review",
        note: "Often quarantined or excluded by design.",
      },
      {
        item: "Consent and subscription status",
        status: "Supported with scope review",
        note: "Requires explicit mapping and legal review per clinic.",
      },
      {
        item: "Every HubSpot object or full historical parity",
        status: "Not currently included",
        note: "Never assumed. Scope is documented before application.",
      },
      {
        item: "Marketplace-style CRM ecosystem breadth",
        status: "Future consideration",
        note: "FI prioritises vertical clinic depth over horizontal marketplace parity.",
      },
    ] satisfies readonly MigrationScopeRow[],
  },

  identity: {
    id: "identity-protection",
    eyebrow: "Identity protection",
    headline: "Migration must protect the patient record.",
    intro:
      "A CRM migration should never casually create a second version of the same patient. FI applies identity reconciliation and patient-protection controls before records enter operational workflows.",
    principles: [
      "Existing patient records are not casually recreated",
      "Lead and patient identity are reconciled before application",
      "Ambiguous records are held for review",
      "Duplicate prevention is part of the migration process",
      "Migration stages are verified before proceeding",
      "Patient changes are limited to the approved scope",
    ] as const,
    distinguishes: [
      "Existing patients",
      "Existing leads",
      "New leads",
      "Ambiguous identities",
    ] as const,
    closing:
      "FI is designed to prevent duplicate creation — not to claim that duplicates are impossible in every edge case. Ambiguity is held for review rather than force-merged.",
  },

  coexistence: {
    id: "coexistence-boundaries",
    eyebrow: "During transition",
    headline: "What may remain in HubSpot — and what FI can take on.",
    intro:
      "Ownership depends on deployment scope. There is no single universal cutover architecture for every clinic.",
    hubspotMayRetain: [
      "Marketing automation",
      "Campaign management",
      "Email sequences",
      "Unsupported custom objects",
      "Historical reference",
      "Specific integrations",
      "Teams not yet transitioned",
    ] as const,
    fiMayOwn: [
      "Active enquiries",
      "Pipeline management",
      "Lead ownership",
      "Follow-up",
      "Patient conversion",
      "Connected clinic workflows",
    ] as const,
  },

  readiness: {
    id: "readiness-checklist",
    eyebrow: "Migration readiness",
    headline: "A practical checklist for serious operators.",
    items: [
      "We know which HubSpot pipelines are actively used",
      "We know which forms create important enquiries",
      "We understand who owns active leads",
      "We know which fields staff rely on",
      "We have identified important workflows and automations",
      "We know where patient records currently live",
      "We can identify likely duplicate contacts",
      "We understand which systems integrate with HubSpot",
      "We have a staff adoption owner",
      "We know which workflow should move first",
    ] as const,
  },

  outcomes: {
    id: "migration-outcomes",
    eyebrow: "Successful transition",
    headline: "What a controlled migration should produce.",
    intro:
      "Migration creates the foundation for better visibility and accountability. It does not guarantee commercial performance by itself.",
    items: [
      "Preserved historical context",
      "Cleaner active pipeline",
      "Clearer ownership",
      "Reduced duplication",
      "Connected lead-to-patient journey",
      "Better operational handover",
      "Reduced reliance on disconnected systems",
      "A staged path into wider FI capabilities",
      "Clear record of what moved and what did not",
    ] as const,
  },

  evidence: {
    id: "migration-evidence",
    eyebrow: "Execution maturity",
    headline: "Verified migration controls — without exposing sensitive detail.",
    body: "Verified migration controls have been tested in controlled operational stages — including historical protection, preview before application, identity reconciliation, patient-protection gates, post-application reconciliation and staged boundaries for replay and rollback review.",
    note: "Public pages do not publish clinic identities, production contact counts, batch identifiers or internal control codes.",
  },

  comparison: {
    id: "comparison",
    eyebrow: "Differentiation",
    headline: "Horizontal CRM depth vs vertical clinic operating system.",
    hubspot: {
      title: "HubSpot",
      items: [
        "Horizontal CRM",
        "Strong general-purpose marketing and sales tooling",
        "Broad ecosystem",
        "Commercial relationship focus",
        "External integrations required for clinical depth",
      ],
    },
    fi: {
      title: "Follicle Intelligence",
      items: [
        "Vertical hair restoration operating system",
        "Acquisition connected to patient, clinical, surgical and outcome records",
        "Specialist workflow depth",
        "Progressive clinic adoption",
        "Longitudinal patient and clinic intelligence",
      ],
    },
    honesty:
      "FI does not claim to exceed HubSpot in marketing automation breadth, email infrastructure, general CRM ecosystem size or global CRM marketplace maturity. The differentiation is vertical clinic depth and progressive operating-system adoption.",
  },

  faq: {
    id: "migration-faq",
    eyebrow: "FAQ",
    headline: "Practical questions clinics ask.",
    items: [
      {
        q: "Do we have to stop using HubSpot immediately?",
        a: "No. Many clinics begin by connecting or coexisting, then transition selected workflows only when ready.",
      },
      {
        q: "Can FI run alongside HubSpot?",
        a: "Yes. Coexistence during an agreed adoption period is a core part of the pathway.",
      },
      {
        q: "What data can currently be migrated?",
        a: "Contacts, lead context, selected ownership, source attribution and related mappings are supported within controlled scope. Engagement history, files and custom properties require scope review. Full object parity is not assumed.",
      },
      {
        q: "Will all our HubSpot workflows move?",
        a: "No. Complex automations and marketing workflows are not automatically ported. They are redesigned, retained in HubSpot, or deferred by agreement.",
      },
      {
        q: "How does FI avoid duplicate patient records?",
        a: "Identity reconciliation matches existing patients and leads before application. Ambiguous records are held for review. FI is designed to prevent duplicate creation — not to claim duplicates are impossible in every edge case.",
      },
      {
        q: "Can we migrate one pipeline or clinic first?",
        a: "Yes. Staged transition by pipeline, cohort or location is the preferred approach for multi-site groups.",
      },
      {
        q: "What happens to historical HubSpot data?",
        a: "Historical protection and inventory come before application. Some data may remain in HubSpot as reference during coexistence.",
      },
      {
        q: "Can we continue using HubSpot for marketing automation?",
        a: "Often yes during transition, depending on scope. Marketing sequences and campaigns may remain in HubSpot while LeadFlow owns active enquiries.",
      },
      {
        q: "How long does migration take?",
        a: "Timing depends on record volume, object complexity, identity quality, integrations and the agreed deployment scope. Fixed durations are not published.",
      },
      {
        q: "Can multi-site groups transition clinic by clinic?",
        a: "Yes. Controlled rollout by clinic is a supported adoption pattern.",
      },
      {
        q: "Do we need to upload patient information through this website?",
        a: "No. Do not upload patient records, medical information or credentials through public forms. Migration data movement is handled under a governed deployment process after discovery.",
      },
      {
        q: "What happens after we request a review?",
        a: "FI reviews your clinic profile, HubSpot usage and priorities, then holds a focused discussion to define connect, coexist, transition or replace boundaries.",
      },
    ] as const,
  },

  closing: {
    id: "migration-closing",
    eyebrow: "Next step",
    headline: "Plan the transition before moving the data.",
    body: "Start with a review of your current HubSpot setup, clinic workflows and patient-record structure. FI will help define which systems should connect, coexist, transition or remain in place.",
    primaryCta: {
      label: "Request a Platform and Migration Review",
      href: "/demo?interest=hubspot-migration" as const,
    },
    secondaryCta: { label: "Explore LeadFlow", href: "/platform/leadflow" as const },
    tertiaryCta: { label: "View Platform Progress", href: "/platform/progress" as const },
  },
} as const;

export type HubspotMigrationPageContent = typeof HUBSPOT_MIGRATION_PAGE_CONTENT;

/** Maps public demo query values to form interest options. */
export const DEMO_INTEREST_QUERY_MAP: Record<string, string> = {
  "hubspot-migration": "Transition away from HubSpot",
  "connect-hubspot": "Connect HubSpot to FI",
  "transition-hubspot": "Transition away from HubSpot",
  hubspot: "Transition away from HubSpot",
};
