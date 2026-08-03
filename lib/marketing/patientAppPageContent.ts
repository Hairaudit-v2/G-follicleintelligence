/**
 * Public copy for `/platform/patient-app` — FI-PATIENT-APP-2A.
 * FI Patient App is distinct from PatientOS. Status: Operational Pilot only.
 */

export const PATIENT_APP_PAGE_CONTENT = {
  seo: {
    title: "FI Patient App | Connected Hair Restoration Patient Journey",
    description:
      "Give patients one clear place for next steps, milestones, quotes, documents, pathology and remote progress photo capture — a mobile experience connected to Follicle Intelligence clinic workflows.",
    ogTitle: "FI Patient App — the patient journey, in the patient’s hands",
    ogDescription:
      "Next steps, milestones, documents and remote progress photo updates — connected to clinic workflows. Available within controlled clinic pilots.",
    path: "/platform/patient-app" as const,
    keywords: [
      "FI Patient App",
      "hair restoration patient app",
      "patient journey mobile app",
      "clinic patient actions",
      "progress photo capture",
      "Follicle Intelligence patient experience",
    ] as const,
  },

  naming: {
    productName: "FI Patient App",
    shortName: "Patient App",
    patientOs: "PatientOS",
    patientOsDefinition:
      "The clinic-facing longitudinal patient record shared across FI workflows.",
    patientAppDefinition:
      "The patient-facing mobile experience for actions, milestones, next steps, quotes, documents, pathology, remote progress photo capture and journey communication.",
  },

  hero: {
    id: "patient-app-hero",
    eyebrow: "FI Patient App · Patient surface of Follicle Intelligence",
    headline: "The patient journey, in the patient’s hands.",
    subheadline:
      "See the next step, complete important actions, follow milestones, keep quotes and documents connected — and submit progress photos when a clinic visit is not possible.",
    supporting:
      "The FI Patient App gives patients one clear place to understand what happens next, complete important actions, follow milestones, share visual progress updates and access the information connected to their care.",
    clinicLine:
      "The clinic manages the journey in FI. The patient follows, completes actions and contributes progress photos through the Patient App.",
    strategicLine:
      "The Patient App closes the loop between clinic workflows and patient participation, creating a more complete record of readiness, communication, visual progress and long-term engagement.",
    maturityLabel: "Operational Pilot",
    maturityBody:
      "Core patient journey workflows — including remote progress photo capture — are implemented and available within controlled pilot scope. Wider patient deployment, support validation and distribution readiness are continuing.",
    availabilityNote:
      "Available within approved clinic pilot programmes. Public app-store distribution is not yet available.",
    primaryCta: {
      label: "Request a Platform and Migration Review",
      href: "/demo" as const,
    },
    secondaryCta: { label: "View Platform Progress", href: "/platform/progress" as const },
    tertiaryCta: { label: "Explore PatientOS", href: "/platform/patient-os" as const },
  },

  problem: {
    id: "patient-fragmentation",
    eyebrow: "The patient problem",
    headline: "Important information should not live across disconnected channels.",
    intro:
      "Patients often know they are progressing through a clinic journey, but not always what they need to do next. Important information can become fragmented across calls, email, forms and separate systems.",
    channels: [
      "Emails",
      "SMS messages",
      "Verbal instructions",
      "Quotes",
      "Pathology requests",
      "Documents",
      "Appointment information",
      "Post-treatment guidance",
    ] as const,
    consequences: [
      { title: "Missed actions", body: "Patients lose track of what still needs their attention." },
      { title: "Repeated questions", body: "Teams re-explain the same next step across channels." },
      {
        title: "Delayed readiness",
        body: "Quotes, documents and pathology stall without a shared view of progress.",
      },
      {
        title: "Confusion about responsibility",
        body: "It is unclear what the clinic owns versus what the patient must complete.",
      },
      {
        title: "Hard-to-find information",
        body: "Patients struggle to retrieve the right quote, form or instruction later.",
      },
      {
        title: "More administrative chasing",
        body: "Staff spend time following up through email and phone instead of the journey record.",
      },
    ] as const,
  },

  nextStep: {
    id: "one-clear-next-step",
    eyebrow: "Usability principle",
    headline: "One clear next step.",
    body: "The app prioritises the action that matters most, helping the patient move forward without navigating a full clinic system.",
    examples: [
      { label: "Review a quote", status: "current" as const },
      { label: "Complete a document", status: "current" as const },
      { label: "Upload required information", status: "current" as const },
      { label: "Capture a progress photo update", status: "current" as const },
      { label: "Complete pathology requirements", status: "current" as const },
      { label: "Prepare for the next milestone", status: "current" as const },
      { label: "Contact the clinic when attention is needed", status: "current" as const },
    ],
  },

  remoteProgressUpdates: {
    id: "remote-progress-updates",
    eyebrow: "Remote Progress Updates",
    headline: "Capture progress photos when you cannot return to the clinic.",
    body: "Patients can capture and submit progress photos directly in the FI Patient App. Visual updates help patients stay within treatment guarantee guidelines and keep the clinical team informed of healing and density progress between visits.",
    points: [
      {
        title: "Remote photo capture",
        body: "Submit progress photos from the patient’s phone when a clinic visit is not practical.",
      },
      {
        title: "Continuity of care",
        body: "Visual updates support follow-up between appointments without fragmenting the record across messaging apps.",
      },
      {
        title: "Guarantee compliance support",
        body: "Structured photo submissions help patients remain compliant with treatment guarantee requirements where the clinic pathway requires them.",
      },
      {
        title: "Connected clinical record",
        body: "Photos become part of the same longitudinal patient record clinic teams use in FI — not a disconnected album.",
      },
      {
        title: "Authorised clinical access",
        body: "Submissions are secured and visible only to the authorised clinical team for that patient and tenant.",
      },
    ] as const,
    honestyNote:
      "Available within approved clinic pilot programmes and configured pathways. Not a claim of public app-store distribution or full multi-clinic outcome programmes.",
  },

  actionCentre: {
    id: "action-centre",
    eyebrow: "Action Centre",
    headline: "Outstanding work, clearly prioritised.",
    body: "Patients can see outstanding actions, priority, due state, completion status and unfinished work — including progress photo requests — and return directly from notifications.",
    patientBenefits: [
      "Less uncertainty about what to do next",
      "Clearer responsibility",
      "Faster completion",
      "Easier return to pending tasks",
      "A clear path to submit progress photos when requested",
    ] as const,
    clinicBenefits: [
      "Reduced chasing",
      "Better readiness visibility",
      "Fewer missed actions",
      "More consistent patient communication",
      "Visual progress updates without ad-hoc photo channels",
    ] as const,
  },

  timeline: {
    id: "journey-timeline",
    eyebrow: "Journey Timeline",
    headline: "Understand where you are — and what comes next.",
    body: "The timeline turns a complex treatment or surgery pathway into a series of understandable milestones.",
    points: [
      "Where the patient is now",
      "What has been completed",
      "What is coming next",
      "Which milestones require patient action",
      "Which milestones are clinic-managed",
    ] as const,
    caveat:
      "Configured pathways depend on the approved clinic pilot. Not every clinic pathway is claimed as currently configured.",
  },

  connectedElements: {
    id: "quotes-documents-pathology",
    eyebrow: "Connected journey elements",
    headline: "Quotes, documents and pathology stay on the same journey.",
    intro:
      "These are not separate products. They appear as connected elements of the patient journey when the clinic pathway requires them.",
    items: [
      {
        title: "Quotes",
        points: [
          "Review the clinic’s proposal",
          "Understand when action is required",
          "Return to the quote without searching email",
        ],
      },
      {
        title: "Documents",
        points: [
          "Access important clinic documents",
          "Complete required steps",
          "Keep documentation linked to the relevant milestone",
        ],
      },
      {
        title: "Pathology",
        points: [
          "See what is required",
          "Understand whether actions remain outstanding",
          "Keep readiness visible to both patient and clinic",
        ],
      },
    ] as const,
    limitations:
      "Electronic signatures beyond current document flows, payments, result interpretation and pathology-provider integration are not claimed on this page.",
  },

  notifications: {
    id: "relevant-notifications",
    eyebrow: "Notifications",
    headline: "Take the patient directly to the action that needs attention.",
    body: "Notifications should take the patient directly to the action that requires attention.",
    benefits: [
      "Less navigation",
      "Faster completion",
      "Reduced notification fatigue",
      "Better measurement of engagement",
    ] as const,
    caveat:
      "Notification behaviour depends on the approved pilot environment and device permissions.",
  },

  connectedOs: {
    id: "connected-operating-system",
    eyebrow: "Connected to the clinic operating system",
    headline: "One journey, seen from both sides.",
    body: "Clinic teams work in FI. Patients participate through the Patient App. The same journey state connects both views.",
    systems: [
      "LeadFlow",
      "PatientOS",
      "ClinicOS",
      "ConsultationOS",
      "SurgeryOS",
      "ImagingOS",
      "AuditOS",
      "Event Bus",
      "Security Layer",
      "FI Patient App",
    ] as const,
    sequence: [
      "Clinic creates or updates the journey",
      "FI determines the next action",
      "Patient receives the action in the app",
      "Patient completes or responds",
      "Clinic sees the updated journey state",
    ] as const,
  },

  patientBenefits: {
    id: "patient-benefits",
    eyebrow: "Patient benefits",
    headline: "Clarity, confidence and continuity for the patient.",
    items: [
      {
        title: "Clarity",
        body: "Patients can see what happens next and what requires their attention.",
      },
      {
        title: "Confidence",
        body: "Milestones make the journey feel coordinated and understandable.",
      },
      {
        title: "Convenience",
        body: "Important information remains available in one mobile experience.",
      },
      {
        title: "Continuity",
        body: "Instructions, documents, actions and progress photos remain connected to the same journey.",
      },
      {
        title: "Participation",
        body: "Patients can complete their part of the process — including remote visual updates — without relying on repeated calls or email threads.",
      },
      {
        title: "Progress between visits",
        body: "When a clinic return is not possible, patients can still provide structured photo updates that support guarantee compliance and clinical follow-up.",
      },
    ] as const,
  },

  clinicBenefits: {
    id: "clinic-benefits",
    eyebrow: "Clinic benefits",
    headline: "Less chasing. Clearer readiness. A connected patient record.",
    items: [
      {
        title: "Reduced administrative chasing",
        body: "Outstanding patient actions are visible and can be followed through the same journey staff manage.",
        future: false,
      },
      {
        title: "Improved readiness",
        body: "Quotes, documents, pathology requirements and requested progress photos can be tracked before the next appointment or procedure.",
        future: false,
      },
      {
        title: "Clearer responsibility",
        body: "FI can distinguish between clinic actions and patient actions.",
        future: false,
      },
      {
        title: "Consistent communication",
        body: "Patients receive the same structured pathway regardless of which team member is working.",
        future: false,
      },
      {
        title: "Connected patient record",
        body: "Patient activity and progress photos contribute to the longitudinal journey rather than sitting in a disconnected messaging channel.",
        future: false,
      },
      {
        title: "Remote progress visibility",
        body: "Clinical teams can review authorised patient-submitted progress photos inside the connected FI record when pathways request them.",
        future: false,
      },
      {
        title: "Future outcome engagement",
        body: "Broader long-term outcome programmes, imaging reminders and outcome analytics remain planned expansions of the same patient surface — beyond current pilot photo capture.",
        future: true,
      },
    ] as const,
  },

  pilot: {
    id: "controlled-pilot",
    eyebrow: "Controlled pilot status",
    headline: "Available through controlled clinic pilots.",
    intro:
      "The current pilot is designed to validate usability, patient completion, clinic readiness and support before wider deployment.",
    points: [
      "Clinics must be approved",
      "Patients must be invited",
      "Pilot workflows are limited to approved use cases",
      "Support is provided by the participating clinic and FI pilot team",
      "Feedback is collected",
      "Public app-store distribution is not yet offered",
    ] as const,
    noSelfRegister:
      "Patients cannot self-register for the pilot. Access is invitation-only through an approved clinic programme.",
  },

  screenshots: {
    id: "product-screens",
    eyebrow: "Inside the Patient App",
    headline: "A clear mobile surface for the journey ahead.",
    description:
      "Demonstration screens from Phase 1 Journey Control — next step, Action Centre, timeline, quotes, pathology and structured patient actions. Remote progress photo capture is part of the same pilot patient surface.",
    demoNote: "Interface shown with demonstration data.",
  },

  faq: {
    id: "patient-app-faq",
    eyebrow: "FAQ",
    headline: "Practical questions about the FI Patient App.",
    items: [
      {
        q: "Can patients download the app now?",
        a: "Not from the public Apple App Store or Google Play. The Patient App is available within approved clinic pilot programmes through controlled distribution such as internal builds, TestFlight or Play internal testing where configured.",
      },
      {
        q: "How does a patient receive access?",
        a: "Patients are invited by an approved clinic. There is no public self-registration pathway for the controlled pilot.",
      },
      {
        q: "Is the Patient App the same as PatientOS?",
        a: "No. PatientOS is the clinic-facing longitudinal patient record shared across FI workflows. The FI Patient App is the patient-facing mobile experience for actions, milestones, next steps, quotes, documents, pathology, remote progress photo capture and journey communication.",
      },
      {
        q: "What can patients currently do?",
        a: "Within controlled pilot scope, patients can see their next step, use Action Centre, follow the Journey Timeline, review quotes, complete documents, track pathology requirements, capture and submit progress photos when the pathway requests them, and open relevant notification destinations.",
      },
      {
        q: "Can patients message the clinic?",
        a: "Secure clinic messaging exists as a patient surface, but unsupported or uncontrolled messaging is outside the initial controlled-pilot commitment. Pilot pathways emphasise structured actions over open-ended chat.",
      },
      {
        q: "Are payments supported?",
        a: "Payment collection is not part of the initial controlled-pilot scope unless separately approved for a clinic programme.",
      },
      {
        q: "Does the app provide medical advice?",
        a: "No. The FI Patient App does not provide medical advice, diagnosis or emergency support. For urgent medical concerns, patients should contact their clinic or the appropriate emergency service.",
      },
      {
        q: "Is patient information secure?",
        a: "Patient access uses authenticated sessions with server-side tenant and ownership checks. Progress photos are stored on the connected clinical record and visible only to the authorised clinical team for that patient. Public marketing screens use demonstration data only. Broader security validation continues as part of pilot readiness.",
      },
      {
        q: "Can the clinic decide which actions appear?",
        a: "Actions are driven by the clinic-managed journey in FI. The patient sees the actions that belong to their approved pathway, not a generic consumer task list.",
      },
      {
        q: "What happens when a patient completes an action?",
        a: "Completion updates the shared journey state so clinic staff can see readiness progress in FI.",
      },
      {
        q: "Can patients submit follow-up or progress photos?",
        a: "Yes — within approved pilot pathways, patients can capture and submit progress photos from their phone so the clinic can review healing and density updates between visits. Photos join the connected clinical record rather than remaining in personal messaging threads. Broader long-term outcome programmes and multi-clinic outcome analytics remain future expansions, not a claim of fully Deployed outcome suites today.",
      },
      {
        q: "How can a clinic join the pilot?",
        a: "Request a Platform and Migration Review. FI and the clinic agree eligibility, pathways, support ownership and invitation scope before any patients are invited.",
      },
    ] as const,
  },

  closing: {
    id: "patient-app-closing",
    eyebrow: "Next step",
    headline: "Bring the patient into the same connected journey.",
    body: "Explore how FI can connect clinic workflows, patient actions and long-term care through one operating system.",
    primaryCta: {
      label: "Request a Platform and Migration Review",
      href: "/demo" as const,
    },
    secondaryCta: { label: "View Platform Progress", href: "/platform/progress" as const },
  },
} as const;

export type PatientAppPageContent = typeof PATIENT_APP_PAGE_CONTENT;
