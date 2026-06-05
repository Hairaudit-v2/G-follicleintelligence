"use client";

import { LeadPhotoGalleryPanel } from "@/src/components/fi/crm/detail/LeadPhotoGalleryPanel";
import type { PatientImagesProfileBundle } from "@/src/lib/patientImages/patientImageTypes";

export function AppointmentGallerySection({
  tenantId,
  patientId,
  bundle,
}: {
  tenantId: string;
  patientId: string | null;
  bundle: PatientImagesProfileBundle | null;
}) {
  return <LeadPhotoGalleryPanel tenantId={tenantId} patientId={patientId} bundle={bundle} />;
}
