/**
 * Sprint 9 — role-agnostic screen guides for UAT mode (pure, no I/O).
 */

export type StaffUatScreenKey =
  | "reception_board"
  | "calendar"
  | "surgery_booking_wizard"
  | "patient_profile"
  | "patient_journey"
  | "procedure_day"
  | "workforce_os";

export type StaffUatScreenGuide = {
  purpose: string;
  nextBestAction: string;
  commonMistakes: string[];
};

export const STAFF_UAT_SCREEN_GUIDES: Record<StaffUatScreenKey, StaffUatScreenGuide> = {
  reception_board: {
    purpose: "Run the entire clinic day — see who is arriving, what is blocked, and move patients forward.",
    nextBestAction: "Check in the next scheduled patient, then clear any red action alerts.",
    commonMistakes: [
      "Refreshing the page instead of using the Live refresh button.",
      "Ignoring yellow payment badges — collect deposit before surgery day.",
      "Opening patient record when the next action is on the calendar (room/staff assignment).",
    ],
  },
  calendar: {
    purpose: "See every appointment on the grid, assign staff and rooms, and resolve scheduling blockers.",
    nextBestAction: "Click a surgery with blockers and assign room + surgeon from the booking drawer.",
    commonMistakes: [
      "Booking surgery without a room — the readiness board will stay red.",
      "Assuming hover tooltips show blockers — surgery cards show readiness on the card.",
      "Changing time without checking staff overlap warnings.",
    ],
  },
  surgery_booking_wizard: {
    purpose: "Book a surgery in four steps with deposit, room, and surgeon captured up front.",
    nextBestAction: "Use Find next available slots, then confirm deposit and pre-op checklist on the success screen.",
    commonMistakes: [
      "Skipping surgeon selection before picking a date.",
      "Closing the wizard before step 4 — booking is not created until Confirm.",
      "Picking a room that is not eligible for surgery — use suggested slots.",
    ],
  },
  patient_profile: {
    purpose: "Single view of clinical history, journey stage, imaging, and financial status for one patient.",
    nextBestAction: "Follow the Patient Journey ribbon — it shows blockers and the recommended next step.",
    commonMistakes: [
      "Editing demographics when the blocker is consent or deposit on the journey ribbon.",
      "Booking from CRM when the patient already has an open surgery case.",
    ],
  },
  patient_journey: {
    purpose: "Shows where this patient is in the treatment pathway and what must happen before surgery.",
    nextBestAction: "Clear red blockers first (consent, deposit), then book or confirm surgery date.",
    commonMistakes: [
      "Treating yellow imaging warnings as optional on surgery week.",
      "Manual override without documenting why in CRM notes.",
    ],
  },
  procedure_day: {
    purpose: "Live surgical day cockpit — advance stages, record graft counts, and complete procedures.",
    nextBestAction: "Start the session when the patient is in pre-op, then use Next stage buttons through post-op.",
    commonMistakes: [
      "Advancing stages without recording graft metrics during extraction/implantation.",
      "Completing procedure without post-op summary — follow-up tasks may not be created.",
    ],
  },
  workforce_os: {
    purpose: "Staff readiness, certifications, and surgical team coverage for upcoming procedures.",
    nextBestAction: "Resolve critical attention queue items before today's surgeries.",
    commonMistakes: [
      "Assigning staff in calendar without checking workforce compliance flags.",
      "Ignoring expired certification badges on staff cards.",
    ],
  },
};

export function resolveStaffUatScreenKeyFromPath(pathname: string): StaffUatScreenKey | null {
  const p = pathname.toLowerCase();
  if (p.includes("/reception-board") || p.endsWith("/reception")) return "reception_board";
  if (p.includes("/calendar")) return "calendar";
  if (p.includes("/procedure-day")) return "procedure_day";
  if (p.includes("/workforce-os")) return "workforce_os";
  if (p.includes("/patients/") && !p.endsWith("/patients")) return "patient_profile";
  if (p.includes("/surgery-booking")) return "surgery_booking_wizard";
  return null;
}

export function staffUatModuleFromPath(pathname: string): string {
  const key = resolveStaffUatScreenKeyFromPath(pathname);
  if (key) return key;
  if (pathname.includes("/crm")) return "crm";
  if (pathname.includes("/financial")) return "financial";
  if (pathname.includes("/surgery-readiness")) return "surgery_readiness";
  return "other";
}