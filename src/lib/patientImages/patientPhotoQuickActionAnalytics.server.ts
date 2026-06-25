import "server-only";

import type { AnalyticsEventCoreOptions } from "@/src/lib/analytics-os/analyticsEventCore";
import { publishPatientEvent } from "@/src/lib/analytics-os/analyticsModulePublishers";
import type {
  PatientImagingCaptureIntent,
  PatientPhotoQuickActionSource,
} from "@/src/lib/patientImages/patientImagingCaptureRoutes";

export type PublishPatientPhotoQuickActionCompletedInput = {
  tenantId: string;
  patientId: string;
  intent: PatientImagingCaptureIntent;
  source: PatientPhotoQuickActionSource;
};

/** Records AnalyticsOS event when a profile quick-action photo capture/upload completes. */
export async function publishPatientPhotoQuickActionCompletedEvent(
  input: PublishPatientPhotoQuickActionCompletedInput,
  options?: AnalyticsEventCoreOptions
): Promise<void> {
  const tenantId = input.tenantId.trim();
  const patientId = input.patientId.trim();
  if (!tenantId || !patientId) return;

  await publishPatientEvent(
    {
      tenantId,
      eventType: "patient_photo_quick_action_completed",
      entityId: patientId,
      entityType: "patient",
      eventMetadata: {
        tenant_id: tenantId,
        patient_id: patientId,
        intent: input.intent,
        source: input.source,
        returned_to_gallery: true,
      },
    },
    options
  );
}
