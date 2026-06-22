/**
 * Long-form copy and structure for `/platform` — product architecture overview.
 * Edit here to update marketing content without touching layout code.
 */

export const PLATFORM_PAGE_CONTENT = {
  hero: {
    eyebrow: "Platform",
    headline: "The Complete Operating System For Hair Restoration",
    subtext:
      "Follicle Intelligence connects acquisition, consultation, clinical intelligence, surgical planning, auditing, training, analytics, and long-term patient intelligence into one integrated platform.",
    primaryCta: { label: "Explore Modules", href: "#modules" },
    secondaryCta: { label: "Book Enterprise Demo", href: "/demo" },
  },

  architecture: {
    id: "architecture",
    eyebrow: "Architecture",
    headline: "One connected architecture. Every critical workflow.",
    introParagraphs: [
      "Generic software manages isolated tasks. Each product optimises its own screen while context fragments across spreadsheets, inboxes, and local habits.",
      "Follicle Intelligence connects every operational, clinical, educational, and intelligence layer of a hair restoration organisation—so decisions inherit the same patient story, evidence posture, and governance history from first touch through lifetime outcome.",
    ],
    bands: [
      {
        title: "Acquisition & Operations",
        summary: "Demand, pipeline discipline, scheduling, services, and day-to-day clinic rhythm—wired into the same tenant policy and record spine.",
        modules: ["LeadFlowOS", "ClinicOS"],
      },
      {
        title: "Clinical & Patient Intelligence",
        summary: "Structured assessments, longitudinal records, Patient Twin™, and AI-assisted pathways—without divorcing clinical nuance from operational reality.",
        modules: ["PatientOS / FoundationOS", "ConsultationOS", "HairIntel"],
      },
      {
        title: "Surgery & Outcome Governance",
        summary: "Planning, procedure-day execution, photography and evidence, independent review, and quality scoring that institutions can run under scrutiny.",
        modules: ["SurgeryOS", "AuditOS"],
      },
      {
        title: "Training, Analytics & Global Intelligence",
        summary: "Competency programs, revenue and conversion intelligence, productivity KPIs, and the structured outcome substrate that sharpens cohorts over time.",
        modules: ["AcademyOS", "AnalyticsOS", "Global Intelligence Network"],
      },
    ],
  },

  modules: {
    id: "modules",
    eyebrow: "Module surface",
    headline: "Eleven connected systems. One operating model.",
    intro:
      "Each module is a product-grade surface with explicit integration contracts. Together they form the architecture serious operators deploy—not a loose bundle of features.",
    items: [
      {
        id: "leadflow-os",
        name: "LeadFlowOS",
        tagline: "CRM, lead capture, pipeline, tasks, follow-ups, patient acquisition.",
        description:
          "LeadFlowOS is the acquisition control plane: enquiry capture, pipeline stages, ownership, tasks, and follow-up rhythm tied to real clinic capacity.",
        connects: "ClinicOS availability, PatientOS identity, AnalyticsOS funnel and cohort reporting.",
        why: "Growth without operational coupling creates leakage. LeadFlowOS keeps demand, accountability, and downstream clinical context aligned.",
        learnMoreHref: "/platform/leadflow",
        learnMoreLabel: "LeadFlow module",
      },
      {
        id: "clinic-os",
        name: "ClinicOS",
        tagline: "Scheduling, appointments, staff availability, services, daily operations.",
        description:
          "ClinicOS runs the operational heartbeat: calendars, services, rooms and roles, appointment lifecycle, and the constraints that consultation and surgery inherit.",
        connects: "LeadFlowOS pipeline, PatientOS records, ConsultationOS bookings, AnalyticsOS operational KPIs.",
        why: "When scheduling is disconnected from clinical workflow, capacity lies. ClinicOS makes operational truth portable across modules.",
        learnMoreHref: "/platform/clinic-os",
        learnMoreLabel: "ClinicOS module",
      },
      {
        id: "patient-os",
        name: "PatientOS / FoundationOS",
        tagline: "Patient records, timelines, Patient Twin, longitudinal intelligence.",
        description:
          "PatientOS is the longitudinal substrate: demographics, encounters, media, assessments, procedures, and the Patient Twin™ narrative that other modules read and enrich.",
        connects: "Every clinical and governance module—consultation, imaging, surgery, audit, analytics.",
        why: "Hair restoration is a multi-year story. A fragmented chart makes every downstream module weaker; a unified record compounds intelligence responsibly.",
        learnMoreHref: "/platform/patient-os",
        learnMoreLabel: "PatientOS module",
      },
      {
        id: "consultation-os",
        name: "ConsultationOS",
        tagline: "Assessment workflows, diagnosis, recommendations, quotes, clinical handoff.",
        description:
          "ConsultationOS structures the consult lifecycle: discovery, clinical assessment, recommendations, pricing and quotes, consent posture, and handoff into planning and scheduling.",
        connects: "PatientOS history, ClinicOS appointments, HairIntel pathways, SurgeryOS planning inputs.",
        why: "The consult is where expectations are set. Structuring it reduces variance, improves traceability, and feeds better planning and audit evidence later.",
        learnMoreHref: "/patient-twin",
        learnMoreLabel: "Patient Twin & records",
      },
      {
        id: "hair-intel",
        name: "HairIntel",
        tagline: "AI intake, diagnostic pathways, blood interpretation, risk scoring, treatment planning.",
        description:
          "HairIntel brings model-assisted intake and classification alongside human judgment—standardising history capture, triage, and documentation density before clinicians commit time.",
        connects: "ConsultationOS assessments, PatientOS timelines, SurgeryOS planning context, AuditOS evidence expectations.",
        why: "AI value is not a chat window; it is consistent structure at scale. HairIntel increases signal quality entering human decision points.",
        learnMoreHref: "/hair-intelligence",
        learnMoreLabel: "Hair intelligence",
      },
      {
        id: "surgery-os",
        name: "SurgeryOS",
        tagline: "Surgical planning, graft targets, donor intelligence, procedure day tracking, follow-ups.",
        description:
          "SurgeryOS carries the surgical programme: targets, donor assessment, day-of workflow, graft accounting, post-operative milestones, and continuity into outcomes.",
        connects: "ConsultationOS plans, PatientOS record, imaging and photography surfaces, AuditOS review packets.",
        why: "Surgical quality is where reputation is won or lost. SurgeryOS aligns planning, execution telemetry, and follow-up in one governable thread.",
        learnMoreHref: "/platform/surgery-os",
        learnMoreLabel: "SurgeryOS module",
      },
      {
        id: "audit-os",
        name: "AuditOS",
        tagline: "HairAudit integration, independent review, evidence capture, quality scoring, benchmarking.",
        description:
          "AuditOS is the governance and evidence layer: HairAudit-aligned review, structured scoring, disclosure separation, and benchmark-ready cohort participation where policy allows.",
        connects: "SurgeryOS cases, imaging evidence, PatientOS outcomes over time, AcademyOS remediation tracks, AnalyticsOS standing.",
        why: "Benchmarks without review discipline are marketing. AuditOS encodes the institutional habits regulators and boards expect to see under diligence.",
        learnMoreHref: "/hair-intelligence",
        learnMoreLabel: "HairAudit & intelligence",
      },
      {
        id: "academy-os",
        name: "AcademyOS",
        tagline: "International Institute of Hair Restoration training, certification, competency tracking.",
        description:
          "AcademyOS links standards-led training and certification to real-world performance signals—so education is not detached from cases, audits, and operational reality.",
        connects: "AuditOS findings, ClinicOS staffing roles, AnalyticsOS competency and productivity views.",
        why: "Training that does not close the loop on outcomes decays. AcademyOS ties curriculum, credentialing, and improvement cycles to the same platform spine.",
        learnMoreHref: "/methodology",
        learnMoreLabel: "Methodology & standards",
      },
      {
        id: "analytics-os",
        name: "AnalyticsOS",
        tagline: "Revenue, conversion, productivity, operational KPIs, outcome intelligence.",
        description:
          "AnalyticsOS turns structured platform events into executive and clinical operations views: funnel integrity, utilisation, revenue integrity, and outcome-linked productivity.",
        connects: "LeadFlowOS, ClinicOS, PatientOS, AuditOS, AcademyOS program completion.",
        why: "Dashboards built on fragmented extracts go stale. AnalyticsOS inherits semantics from modules so KPIs mean the same thing across sites.",
        learnMoreHref: "/platform/analytics-os",
        learnMoreLabel: "AnalyticsOS module",
      },
      {
        id: "onboarding-os",
        name: "OnboardingOS",
        tagline: "Enterprise clinic deployment, module activation, and sandbox onboarding.",
        description:
          "OnboardingOS is the enterprise deployment engine for new clinic tenants—guided provisioning sessions, clinic configuration templates, module bundle planning, role packs, and sandbox training environments that accelerate safe adoption.",
        connects: "ClinicOS services, module entitlements, AcademyOS training tracks, WorkforceOS bootstrap, and platform admin governance.",
        why: "Multi-clinic groups cannot scale on manual setup. OnboardingOS standardises how new organisations enter the FI ecosystem with repeatable, reviewable deployment templates.",
        learnMoreHref: "/platform/progress#progress-onboarding-os",
        learnMoreLabel: "OnboardingOS progress",
      },
      {
        id: "global-intelligence",
        name: "Global Intelligence Network",
        tagline: "Structured outcome data, benchmarking, predictive intelligence foundation.",
        description:
          "The Global Intelligence Network is the cross-tenant, policy-governed layer where anonymised or consented structured outcomes can sharpen cohorts, baselines, and standing—without collapsing clinical judgment into a single score.",
        connects: "AuditOS cohorts, AnalyticsOS aggregates, research and standards partners where contractually enabled.",
        why: "Category leadership compounds when evidence depth and governance history grow together. The network is the long-range substrate for defensible benchmarks.",
        learnMoreHref: "/technology",
        learnMoreLabel: "Technology & architecture",
      },
    ],
  },

  workflow: {
    id: "workflow",
    eyebrow: "Operating loop",
    headline: "From lead to lifetime outcome.",
    subtext:
      "The value is not in digitising one step—it is in connecting every step so evidence, accountability, and learning move forward with the patient instead of restarting at each handoff.",
    steps: [
      "Lead capture",
      "Consultation",
      "Diagnosis",
      "Treatment plan",
      "Surgery plan",
      "Procedure",
      "Follow-up",
      "Audit",
      "Outcome intelligence",
      "Training feedback loop",
    ],
  },

  enterprise: {
    id: "enterprise",
    eyebrow: "Scale patterns",
    headline: "Built for single clinics. Designed for global groups.",
    audiences: [
      {
        title: "Single clinic operators",
        body: "Deploy a complete OS without stitching vendors: acquisition, operations, clinical intelligence, surgery, and audit-ready evidence in one tenant envelope.",
      },
      {
        title: "Emerging multi-site groups",
        body: "Standardise modules and policy while preserving brand variation: shared benchmarks, role templates, and governance visibility across a growing footprint.",
      },
      {
        title: "Established enterprise networks",
        body: "Run multi-brand, multi-region programmes with separation of duties, review queues, exportable diligence packets, and analytics that respect group and local semantics.",
      },
      {
        title: "Education and audit organisations",
        body: "Anchor standards programs and independent review on the same structured evidence model clinics already generate—reducing friction between practice and profession.",
      },
    ],
  },

  dataMoat: {
    id: "data-moat",
    eyebrow: "Compounding intelligence",
    headline: "The intelligence layer compounds over time.",
    paragraphs: [
      "Every consultation, patient record, procedure, audit, and outcome can become structured intelligence that the platform retains under explicit policy—so cohort definitions, baselines, and governance history deepen with serious use.",
      "As structured data grows, Follicle Intelligence can support richer operational forensics and may help teams prioritise improvement opportunities with clearer denominators and traceability.",
      "Predictive and assistive features, where enabled, should remain adjuncts to clinical judgment; the architecture is built so human accountability stays visible even as models assist.",
    ],
  },

  finalCta: {
    id: "platform-final-cta",
    eyebrow: "Next step",
    headline: "Build on the operating system designed for hair restoration.",
    primaryCta: { label: "Book Enterprise Demo", href: "/demo" },
    secondaryCta: { label: "Return Home", href: "/" },
  },
} as const;
