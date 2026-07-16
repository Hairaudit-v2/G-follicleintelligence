/**
 * Public copy for `/demo` — Platform and Migration Review (enterprise enquiry).
 * FI-WEB-REFRESH-1D.
 */

export const PLATFORM_REVIEW_PAGE_CONTENT = {
  seo: {
    title: "Request a Platform and Migration Review | Follicle Intelligence",
    description:
      "Discuss your clinic’s CRM, patient, operational and migration requirements with Follicle Intelligence. Explore a staged pathway to connect, transition or replace fragmented systems.",
    ogTitle: "Plan the next stage of your clinic’s operating system",
    ogDescription:
      "Request a focused review of your current systems and explore where Follicle Intelligence could connect, coexist, transition or progressively replace fragmented workflows.",
    path: "/demo" as const,
    keywords: [
      "hair restoration clinic software demo",
      "clinic CRM migration review",
      "HubSpot hair clinic transition",
      "enterprise clinic operating system",
      "Follicle Intelligence platform review",
    ] as const,
  },

  hero: {
    id: "platform-review-hero",
    eyebrow: "Platform and migration review",
    headline: "Plan the next stage of your clinic’s operating system.",
    subheadline:
      "Request a focused review of your current CRM, scheduling, patient, clinical and operational systems — and explore where Follicle Intelligence could connect, transition or progressively replace fragmented workflows.",
    supporting:
      "Tell us how your clinic operates today, which systems you use and where you want to improve. We will use that information to prepare a focused platform and transition discussion.",
    trustLine: "For clinic owners, medical leaders, operators and strategic partners.",
    primaryCta: {
      label: "Request a Platform and Migration Review",
      href: "#platform-review-form" as const,
    },
    secondaryCta: { label: "Explore the Platform", href: "/platform" as const },
    tertiaryCta: { label: "View Platform Progress", href: "/platform/progress" as const },
    migrationCta: {
      label: "Explore migration from HubSpot",
      href: "/migrate-from-hubspot" as const,
    },
  },

  positioning: {
    id: "review-positioning",
    body: "Follicle Intelligence is not introduced as another disconnected software subscription. The review is designed to understand your clinic’s current systems, workflows and priorities before recommending where FI should connect, coexist, transition or replace.",
  },

  audiences: {
    id: "who-this-is-for",
    eyebrow: "Who this is for",
    headline: "A structured conversation for serious operators.",
    items: [
      {
        title: "Clinic owners and directors",
        body: "Seeking better visibility, consistency and control across the patient journey.",
      },
      {
        title: "Multi-site clinic groups",
        body: "Looking to standardise workflows, reporting and patient records across locations.",
      },
      {
        title: "Clinical and surgical leaders",
        body: "Wanting commercial activity connected to consultation, surgery and outcomes.",
      },
      {
        title: "Operations and technology teams",
        body: "Assessing system integration, migration and staged adoption.",
      },
      {
        title: "Strategic partners",
        body: "Exploring deployment, licensing, research or industry collaboration.",
      },
    ] as const,
  },

  reviewAreas: {
    id: "what-can-be-reviewed",
    eyebrow: "What can be reviewed",
    headline: "A structured clinic assessment — not a generic product tour.",
    intro:
      "We tailor the discussion to your operational reality. Not every area below is fully deployed for every clinic; maturity is scoped honestly using public status language where relevant.",
    areas: [
      "Enquiry and CRM workflows",
      "Lead ownership and follow-up",
      "Appointment and calendar systems",
      "Patient records",
      "Consultation workflows",
      "Imaging and outcome tracking",
      "Surgery planning and procedural records",
      "Workforce and roster management",
      "Reporting and analytics",
      "HubSpot or other system transition",
      "Multi-site operating requirements",
      "Training, audit and clinical intelligence opportunities",
    ] as const,
    statusNote:
      "Where useful we reference Operational Pilot, Advanced Build or In Development — so recommendations match real readiness, not a sales slide.",
  },

  adoption: {
    id: "adoption-pathway",
    eyebrow: "Adoption pathway",
    headline: "Connect, coexist, transition or replace.",
    clinicLine: "Connect, transition or replace — at a pace that protects clinic continuity.",
    modes: [
      {
        title: "Connect",
        body: "Keep selected systems connected to FI.",
      },
      {
        title: "Coexist",
        body: "Run FI alongside existing systems during a controlled adoption period.",
      },
      {
        title: "Transition",
        body: "Move selected data and workflows into FI in verified stages.",
      },
      {
        title: "Replace",
        body: "Use FI as the primary operating environment within the agreed scope.",
      },
    ] as const,
  },

  process: {
    id: "what-happens-next",
    eyebrow: "What happens next",
    headline: "A consultative process after you submit.",
    steps: [
      {
        title: "Initial review",
        body: "FI reviews the submitted clinic profile, current systems and priorities.",
      },
      {
        title: "Focused discussion",
        body: "The meeting is tailored around your operational needs rather than a generic feature tour.",
      },
      {
        title: "Adoption pathway",
        body: "FI outlines where to connect, coexist, transition or replace.",
      },
      {
        title: "Defined next step",
        body: "Where appropriate, you receive a proposed pilot, migration review, workflow assessment or further technical discussion.",
      },
    ] as const,
    notPromised:
      "We do not promise a formal proposal for every submission, a fixed migration timeline, immediate access, guaranteed deployment, or a commercial quote before scope is understood.",
  },

  trust: {
    id: "trust-privacy",
    eyebrow: "Trust and privacy",
    headline: "No patient information is required for this review.",
    points: [
      "No patient information is required to start the conversation.",
      "Information is used to prepare a focused discussion.",
      "Submitted information is handled under our privacy policy.",
      "Migration scope is assessed before any data export or technical credentials are requested.",
      "Technical access, credentials or patient files should never be uploaded through this form.",
    ] as const,
    warning:
      "Please do not include patient information, medical records, credentials or sensitive data in this form.",
    privacyHref: "/privacy" as const,
  },

  form: {
    id: "platform-review-form",
    eyebrow: "Enquiry form",
    headline: "Request a Platform and Migration Review",
    intro:
      "Complete the sections below so we can prepare a useful conversation. Required fields are marked.",
    sections: {
      aboutYou: "About you",
      aboutClinic: "About your clinic",
      systems: "Current systems",
      priorities: "Priorities",
      context: "Additional context",
      consent: "Consent",
    },
    submitLabel: "Request a Platform and Migration Review",
    submittingLabel: "Sending enquiry…",
    successTitle: "Thank you — your enquiry has been received.",
    successBody:
      "We will review your clinic profile and priorities, then follow up to arrange a focused platform and migration discussion. If you need to add context, email sales@follicleintelligence.ai with the same organisation name.",
    failureTitle: "We could not send your enquiry right now.",
    failureBody:
      "Please try again in a few minutes, or email sales@follicleintelligence.ai with a short description of your clinic and priorities.",
    duplicateTitle: "This enquiry appears to have already been submitted.",
    duplicateBody:
      "If you need to update your details, email sales@follicleintelligence.ai and reference your organisation name.",
  },
} as const;

export type PlatformReviewPageContent = typeof PLATFORM_REVIEW_PAGE_CONTENT;
