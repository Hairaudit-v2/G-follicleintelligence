/**
 * Canonical FI OS marketing screenshots (FI-WEB-REFRESH-1I).
 * Paths are public URLs under /os-images — never local drive paths.
 */

export type FiOsScreenshotId =
  | "today"
  | "calendar"
  | "frontDesk"
  | "patients"
  | "pipeline"
  | "surgery";

export type FiOsScreenshotAsset = {
  id: FiOsScreenshotId;
  /** Public path under /public */
  src: string;
  width: number;
  height: number;
  alt: string;
  /** Short module / capability label */
  eyebrow: string;
  /** Caption used on homepage / module pages */
  caption: string;
  /** Vision-page strategic caption (operating-system framing) */
  visionCaption: string;
  /** Vision-page eyebrow */
  visionEyebrow: string;
};

export const FIOS_SCREENSHOTS = {
  today: {
    id: "today",
    src: "/os-images/fios-today-command-centre.webp",
    width: 3314,
    height: 1230,
    alt: "Follicle Intelligence Today command centre showing clinic priorities and operational alerts",
    eyebrow: "Today",
    caption: "See what needs attention across the clinic.",
    visionEyebrow: "Operate the clinic",
    visionCaption:
      "See priorities, patient movement and operational attention in one place.",
  },
  calendar: {
    id: "calendar",
    src: "/os-images/fios-calendar-week-view.webp",
    width: 3314,
    height: 1230,
    alt: "FI OS weekly clinic calendar showing scheduled consultations and surgery",
    eyebrow: "CalendarOS",
    caption: "Coordinate consultations, treatments, teams and surgery.",
    visionEyebrow: "Coordinate resources",
    visionCaption: "Manage appointments, treatments, surgery, rooms and teams.",
  },
  frontDesk: {
    id: "frontDesk",
    src: "/os-images/fios-front-desk-today.webp",
    width: 3314,
    height: 1230,
    alt: "FI OS Front Desk workspace showing arrivals, blockers and patient actions",
    eyebrow: "Front Desk",
    caption: "Manage arrivals, delays, blockers and patient flow.",
    visionEyebrow: "Manage patient flow",
    visionCaption: "Coordinate arrivals, delays, blockers and front-desk actions.",
  },
  patients: {
    id: "patients",
    src: "/os-images/fios-patient-journey-workspace.webp",
    width: 3314,
    height: 1230,
    alt: "FI OS Patients workspace showing connected patient journey coordination",
    eyebrow: "PatientOS",
    caption: "Follow the patient journey through every stage of care.",
    visionEyebrow: "Connect the patient record",
    visionCaption:
      "Carry the patient journey from consultation through care and outcomes.",
  },
  pipeline: {
    id: "pipeline",
    src: "/os-images/fios-leadflow-pipeline-board.webp",
    width: 3314,
    height: 1230,
    alt: "LeadFlow pipeline board showing enquiries moving through consultation stages",
    eyebrow: "LeadFlow",
    caption: "Manage ownership, follow-up and conversion.",
    visionEyebrow: "Convert enquiries",
    visionCaption: "Give every enquiry an owner, a next action and a visible journey.",
  },
  surgery: {
    id: "surgery",
    src: "/os-images/fios-surgery-workspace.webp",
    width: 3314,
    height: 1230,
    alt: "SurgeryOS workspace showing surgical readiness and procedure workflow",
    eyebrow: "SurgeryOS",
    caption: "Coordinate planning, readiness, procedures and follow-up.",
    visionEyebrow: "Run specialist surgery workflows",
    visionCaption:
      "Coordinate planning, readiness, procedure activity and follow-up.",
  },
} as const satisfies Record<FiOsScreenshotId, FiOsScreenshotAsset>;

/** Vision gallery — six primary OS story images */
export const FIOS_VISION_SHOWCASE: readonly FiOsScreenshotId[] = [
  "today",
  "calendar",
  "frontDesk",
  "pipeline",
  "patients",
  "surgery",
] as const;

/** Homepage product showcase — featured + supporting */
export const FIOS_HOME_FEATURED: FiOsScreenshotId = "calendar";
export const FIOS_HOME_SUPPORTING: readonly FiOsScreenshotId[] = [
  "today",
  "frontDesk",
  "pipeline",
  "surgery",
] as const;

/** Clinic Owners — owner-outcome mapping */
export const FIOS_CLINIC_OWNERS: readonly FiOsScreenshotId[] = [
  "today",
  "frontDesk",
  "calendar",
] as const;

/** LeadFlow page */
export const FIOS_LEADFLOW: readonly FiOsScreenshotId[] = ["pipeline"] as const;

/** Platform module showcase */
export const FIOS_PLATFORM: readonly FiOsScreenshotId[] = [
  "patients",
  "pipeline",
  "calendar",
  "surgery",
] as const;

export const FIOS_DEMO_DATA_NOTE = "Interface shown with demonstration data." as const;

export function getFiOsScreenshot(id: FiOsScreenshotId): FiOsScreenshotAsset {
  return FIOS_SCREENSHOTS[id];
}
