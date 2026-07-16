/**
 * Map loaded patient profile foundation data → journey view (no server-only).
 */

import { derivePatientIdentityContact } from "@/src/lib/patients/patientIdentityContact";
import type { PatientProfileFoundationData } from "@/src/lib/patients/patientProfileLoader";
import { buildPatientJourneyView } from "./patientJourneyCore";
import type { PatientJourneyView } from "./patientJourneyTypes";

export function journeyViewFromProfileData(
  data: PatientProfileFoundationData
): PatientJourneyView {
  const idc = derivePatientIdentityContact({
    personMetadata: data.person.metadata,
    patientMetadata: data.patient.metadata,
    preferredContactMethod: data.patient.preferred_contact_method,
    reminderConsent: data.patient.reminder_consent,
  });
  const images = data.patientImages.activeWithSignedUrls.map((tile) => ({
    id: tile.image.id,
    image_category: String(tile.image.image_category),
    caption: tile.image.caption,
    taken_at: tile.image.taken_at,
    created_at: tile.image.created_at,
    thumbUrl: tile.signed.url,
  }));
  const clinicalRow = data.clinicalDetails.row;
  return buildPatientJourneyView({
    tenantId: data.tenantId,
    patientId: data.foundationPatientId,
    displayName: idc.fullName,
    images,
    clinical: clinicalRow
      ? {
          norwood_scale: clinicalRow.norwood_scale,
          ludwig_scale: clinicalRow.ludwig_scale,
          hairline_pattern: clinicalRow.hairline_pattern,
          metadata: clinicalRow.metadata,
          updated_at: clinicalRow.updated_at,
        }
      : null,
    timelineItems: data.patientTimeline.items.map((item) => ({
      id: item.id,
      occurred_at: item.occurred_at,
      item_type: item.item_type,
      title: item.title,
      subtitle: item.subtitle,
      href: item.href,
      is_sensitive: item.is_sensitive,
    })),
    upcomingBookingCount: data.bookings.upcoming.length,
  });
}
