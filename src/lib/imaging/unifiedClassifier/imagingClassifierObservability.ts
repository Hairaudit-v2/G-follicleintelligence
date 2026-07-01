/**
 * Structured logging for unified imaging classifier (FIN-IMAGING-2).
 */

import { logStructured } from "@/src/lib/server/structuredLog";

export type ImagingClassifierLogEvent =
  | "fi_imaging_classifier_request"
  | "fi_imaging_classifier_success"
  | "fi_imaging_classifier_fallback"
  | "fi_imaging_classifier_null_result"
  | "fi_imaging_classifier_validation_failed"
  | "fi_imaging_classifier_provider_error"
  | "fi_imaging_classifier_unsupported_source"
  | "fi_imaging_classifier_security_rejected"
  | "fi_imaging_classifier_category_alias";

export function logImagingClassifierEvent(
  event: ImagingClassifierLogEvent,
  fields: Record<string, string | number | boolean | null | undefined>
): void {
  const level =
    event === "fi_imaging_classifier_security_rejected" ||
    event === "fi_imaging_classifier_provider_error" ||
    event === "fi_imaging_classifier_null_result"
      ? "warn"
      : event === "fi_imaging_classifier_fallback"
        ? "warn"
        : "info";

  logStructured(level, event, fields);
}

export function logImagingClassifierAlert(
  message: string,
  fields: Record<string, string | number | boolean | null | undefined>
): void {
  logStructured("warn", "fi_imaging_classifier_alert", {
    alert_message: message,
    ...fields,
  });
}
