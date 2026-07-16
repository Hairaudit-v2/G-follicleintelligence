/**
 * Public copy for `/platform/leadflow` — LeadFlow + HubSpot transition positioning.
 * Aligns with FI-WEB-REFRESH-1A messaging standard and 1B Operational Pilot status.
 */

export type LeadFlowCapabilityMaturity = "Operational Pilot" | "Expanding" | "Future";

export type LeadFlowCapabilityItem = {
  title: string;
  body: string;
  maturity: LeadFlowCapabilityMaturity;
};

export const LEADFLOW_PAGE_CONTENT = {
  seo: {
    title: "LeadFlow | Hair Restoration CRM and Patient Acquisition | Follicle Intelligence",
    description:
      "Manage hair restoration enquiries, pipeline, ownership and follow-up in one system connected to consultation, clinical, surgical and outcome records. Connect, transition or replace HubSpot progressively.",
    ogTitle: "LeadFlow — Acquisition connected to the patient journey",
    ogDescription:
      "Purpose-built enquiry, pipeline and follow-up for hair restoration clinics — with controlled HubSpot coexistence and staged transition into Follicle Intelligence.",
    path: "/platform/leadflow" as const,
    keywords: [
      "hair restoration CRM",
      "hair transplant lead management",
      "clinic patient acquisition",
      "HubSpot migration hair clinic",
      "LeadFlow Follicle Intelligence",
    ] as const,
  },

  hero: {
    id: "leadflow-hero",
    eyebrow: "LeadFlow · Acquisition layer of Follicle Intelligence",
    headline: "From first enquiry to final outcome — one connected patient journey.",
    subheadline:
      "LeadFlow gives hair restoration clinics a purpose-built system for managing enquiries, ownership, follow-up and conversion — connected directly to the wider clinical and operational record.",
    supporting:
      "LeadFlow connects every enquiry, conversation and follow-up to the patient’s wider journey through consultation, treatment, surgery and outcomes.",
    supportingSecondary:
      "It gives clinics the commercial discipline of a modern CRM without separating acquisition from the clinical and operational record.",
    maturityLabel: "Operational Pilot",
    maturityBody:
      "Native enquiry, pipeline, assignment and follow-up workflows are active within FI. Controlled HubSpot migration and coexistence pathways are operational, while wider communication automation and reporting depth continue to expand.",
    primaryCta: { label: "Discuss Your Clinic’s Transition", href: "/contact" as const },
    secondaryCta: { label: "Explore the Platform", href: "/platform" as const },
    tertiaryCta: { label: "See Platform Progress", href: "/platform/progress" as const },
  },

  problem: {
    id: "disconnected-crm",
    eyebrow: "The gap",
    headline: "Traditional CRM stops where the clinical journey begins.",
    intro:
      "Horizontal CRM platforms can capture leads and activities — but they usually stop before treatment, surgery and outcomes begin. Hair restoration clinics need acquisition discipline that stays connected to the patient record.",
    quote:
      "Most CRM platforms know whether a lead booked. They do not know what treatment was recommended, whether surgery proceeded, how the donor was managed or what outcome was achieved.",
    problems: [
      {
        title: "Enquiries arrive through many channels",
        body: "Website, ads, referrals and partners create noise unless ownership and next actions are explicit.",
      },
      {
        title: "Follow-up is slow or inconsistent",
        body: "When cadence depends on memory and inbox heroics, high-intent patients quietly disappear.",
      },
      {
        title: "Leads are lost when staff change",
        body: "Without clear assignment and history, handovers break the commercial conversation.",
      },
      {
        title: "Conversion reasons stay opaque",
        body: "Teams see pipeline movement but struggle to explain why patients convert — or walk away.",
      },
      {
        title: "Marketing is disconnected from outcomes",
        body: "Spend is judged by form fills and bookings, not by suitability, procedures and long-term results.",
      },
      {
        title: "Patient data is duplicated everywhere",
        body: "CRM, booking, clinical notes and imaging recreate the same person under different identities.",
      },
      {
        title: "Changing CRM feels operationally dangerous",
        body: "Clinics fear downtime, lost history and staff disruption more than they fear a weak pipeline.",
      },
      {
        title: "History stays trapped in HubSpot",
        body: "Years of contacts and context remain hard to move without a staged, verified path.",
      },
    ] as const,
  },

  capabilities: {
    id: "what-leadflow-manages",
    eyebrow: "What LeadFlow manages",
    headline: "Commercial discipline built for hair restoration workflows.",
    intro:
      "LeadFlow is the acquisition and relationship-management layer of Follicle Intelligence — not a generic CRM clone, and not a renamed HubSpot interface.",
    maturityLegend: [
      {
        label: "Operational Pilot",
        meaning: "Active in defined clinic workflows within approved deployment scope.",
      },
      {
        label: "Expanding",
        meaning: "Foundations exist; automation, reporting or channel depth is still deepening.",
      },
      {
        label: "Future",
        meaning: "Strategic capability direction — not presented as operational product today.",
      },
    ] as const,
    items: [
      {
        title: "Website and campaign enquiries",
        body: "Capture and organise inbound enquiries so high-intent demand is visible to the team.",
        maturity: "Operational Pilot",
      },
      {
        title: "Lead source and attribution",
        body: "Record where enquiries originate so clinics can review source quality over time.",
        maturity: "Operational Pilot",
      },
      {
        title: "New enquiry triage",
        body: "Surface new demand quickly so the right person can respond with context.",
        maturity: "Operational Pilot",
      },
      {
        title: "Pipeline stages",
        body: "Move enquiries through clinic-defined stages from first touch toward consultation.",
        maturity: "Operational Pilot",
      },
      {
        title: "Lead ownership and assignment",
        body: "Make accountability explicit so follow-up does not depend on who happens to be online.",
        maturity: "Operational Pilot",
      },
      {
        title: "Follow-up tasks and activity",
        body: "Track next actions and contact history so conversations stay continuous.",
        maturity: "Operational Pilot",
      },
      {
        title: "Consultation progression",
        body: "Carry commercial context into consultation pathways rather than restarting the story.",
        maturity: "Operational Pilot",
      },
      {
        title: "Converted and lost review",
        body: "Review which enquiries progress and which stall — with clearer operational visibility.",
        maturity: "Operational Pilot",
      },
      {
        title: "Referral tracking",
        body: "Preserve partner and referral lineage into the patient journey.",
        maturity: "Expanding",
      },
      {
        title: "Operational pipeline reporting",
        body: "Clinic-facing signals for enquiry momentum, follow-up rhythm and booking readiness.",
        maturity: "Operational Pilot",
      },
      {
        title: "Connection into the patient record",
        body: "Link acquisition activity to the same identity that consultation, imaging and surgery inherit.",
        maturity: "Operational Pilot",
      },
      {
        title: "Communication automation depth",
        body: "Richer sequences, multi-channel cadence and enterprise automation continue to expand.",
        maturity: "Expanding",
      },
      {
        title: "Cross-journey acquisition intelligence",
        body: "Deeper answers about source quality, suitability, revenue and long-term outcomes as data depth grows.",
        maturity: "Future",
      },
    ] satisfies readonly LeadFlowCapabilityItem[],
  },

  journey: {
    id: "connected-journey",
    eyebrow: "Connected patient journey",
    headline: "Enquiry is the start of the record — not a separate system.",
    intro:
      "LeadFlow sits inside Follicle Intelligence so the same patient identity can continue from first contact through clinical and outcome history.",
    steps: [
      { label: "Enquiry", detail: "Capture, ownership and follow-up in LeadFlow" },
      { label: "Consultation", detail: "Structured assessment and planning in ConsultationOS" },
      {
        label: "Treatment or surgery",
        detail: "Scheduling, preparation and procedure continuity via ClinicOS and SurgeryOS",
      },
      { label: "Follow-up", detail: "Ongoing care and communication on one patient history" },
      {
        label: "Outcome intelligence",
        detail: "Imaging, audit and performance context through ImagingOS, AuditOS and AnalyticsOS",
      },
    ] as const,
    modulesNote:
      "LeadFlow connects into the wider operating system — including consultation, clinic scheduling, patient records, imaging, surgery, audit and analytics — without requiring every module on day one.",
    links: [
      { label: "Platform overview", href: "/platform" as const },
      { label: "ClinicOS", href: "/platform/clinic-os" as const },
      { label: "PatientOS", href: "/platform/patient-os" as const },
      { label: "SurgeryOS", href: "/platform/surgery-os" as const },
      { label: "AnalyticsOS", href: "/platform/analytics-os" as const },
    ] as const,
  },

  hubspot: {
    id: "hubspot-pathway",
    eyebrow: "Already on HubSpot",
    headline: "Already using HubSpot? You do not need to change everything at once.",
    intro:
      "If your clinic uses HubSpot today, you do not need an all-or-nothing cutover. Follicle Intelligence can connect to HubSpot, run alongside it, transition selected contacts and history in verified stages, or become the primary system for CRM and clinic operations when you are ready.",
    clinicLine: "Connect, transition or replace — at a pace that protects clinic continuity.",
    modes: [
      {
        title: "Connect",
        body: "Selected data or workflows continue to operate with HubSpot connected to FI.",
      },
      {
        title: "Coexist",
        body: "HubSpot and FI operate alongside one another during an agreed adoption period.",
      },
      {
        title: "Transition",
        body: "Selected contacts, leads and workflows move into FI through verified stages.",
      },
      {
        title: "Replace",
        body: "FI becomes the primary CRM and clinic operating environment within the agreed deployment scope.",
      },
    ] as const,
    scopeNote:
      "Not every HubSpot object, workflow or automation is already supported. Scope is agreed clinic by clinic so transition matches operational readiness.",
  },

  migration: {
    id: "controlled-transition",
    eyebrow: "Controlled transition",
    headline: "Move history carefully — without losing operational continuity.",
    intro:
      "Moving systems should not mean losing history or creating duplicate patient records. FI uses a staged and verified transition process designed to preserve continuity while each migration group is reviewed and reconciled.",
    safeguards: [
      "Historical backup before migration",
      "Preview before data is applied",
      "Staged migration groups",
      "Existing patient and lead matching",
      "Duplicate prevention",
      "Patient-record protection",
      "Post-migration verification",
      "Auditable migration history",
      "Continued clinic operation during staged transition",
    ] as const,
  },

  valueAfter: {
    id: "after-conversion",
    eyebrow: "Why FI becomes more valuable",
    headline: "In FI, conversion is the beginning of a connected clinical history.",
    intro:
      "In a traditional CRM, conversion is often the end of the commercial record. In Follicle Intelligence, it is the beginning of a connected clinical and outcome history — so acquisition activity becomes more useful over time.",
    questionsEyebrow: "Questions the connected platform may progressively answer",
    questions: [
      "Which lead sources produce suitable surgical candidates?",
      "Which consultation pathways convert most effectively?",
      "Which treatments lead to continued patient engagement?",
      "Which acquisition sources produce the strongest long-term outcomes?",
      "Where are patients dropping out of the journey?",
      "How do conversion, revenue and outcomes vary across clinics or teams?",
    ] as const,
    intelligenceNote:
      "Deeper cross-journey intelligence depends on structured capture across modules and expands with operational use. It is a strategic advantage of the operating system — not a claim that every question is fully answered for every clinic today.",
  },

  closing: {
    id: "leadflow-closing",
    eyebrow: "Next step",
    headline: "Start with the workflow your clinic needs most.",
    body: "Keep selected systems connected, transition active workflows in stages, or plan a wider move into the Follicle Intelligence operating system.",
    primaryCta: { label: "Discuss Your Clinic’s Transition", href: "/contact" as const },
    secondaryCta: { label: "View Platform Progress", href: "/platform/progress" as const },
  },
} as const;

export type LeadFlowPageContent = typeof LEADFLOW_PAGE_CONTENT;
