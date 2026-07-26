/**
 * FI-PATIENT-APP-1C — pure validation + patient-safe image DTOs.
 */

import {
  PATIENT_IMAGE_ALLOWED_CONTENT_TYPES,
  PATIENT_IMAGE_MAX_BYTES,
  PATIENT_IMAGES_BUCKET_DEFAULT,
} from "@/src/lib/patientImages/patientImagePolicy";
import type { PatientImageRow } from "@/src/lib/patientImages/patientImageTypes";

import {
  mapPatientGatewayImageSlot,
  parsePatientGatewayImageSlot,
  type PatientGatewayImageSlot,
  type PatientGatewayImageSlotMapping,
} from "./patientGatewayImageSlots";
import type { PatientGatewayDenyCode } from "./patientGatewayTypes";

export type PatientGatewayImageListItem = {
  id: string;
  category: string;
  capturedAt: string | null;
  status: "held" | "released" | "archived";
  thumbnailUrl: string | null;
  thumbnailExpiresAt: string | null;
};

export type ValidateUploadIntentInputResult =
  | {
      ok: true;
      slot: PatientGatewayImageSlot;
      mapping: PatientGatewayImageSlotMapping;
      mimeType: string;
      fileSize: number;
      bucket: string;
    }
  | { ok: false; code: PatientGatewayDenyCode; message: string };

const MIME_SET = new Set<string>(
  PATIENT_IMAGE_ALLOWED_CONTENT_TYPES.map((m) => m.toLowerCase())
);

export function validatePatientGatewayUploadIntentInput(input: {
  category: unknown;
  mimeType: unknown;
  fileSize: unknown;
}): ValidateUploadIntentInputResult {
  const slot = parsePatientGatewayImageSlot(input.category);
  if (!slot) {
    return {
      ok: false,
      code: "invalid_category",
      message: "Invalid image category. Use a supported patient image slot.",
    };
  }

  const mimeType = String(input.mimeType ?? "")
    .trim()
    .toLowerCase();
  if (!mimeType || !MIME_SET.has(mimeType)) {
    return {
      ok: false,
      code: "invalid_mime",
      message:
        "Unsupported file type. Allowed: image/jpeg, image/png, image/webp, image/heic, image/heif.",
    };
  }

  const fileSize = Number(input.fileSize);
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    return { ok: false, code: "file_too_large", message: "Invalid file size." };
  }
  if (fileSize > PATIENT_IMAGE_MAX_BYTES) {
    return {
      ok: false,
      code: "file_too_large",
      message: `File exceeds maximum size of ${PATIENT_IMAGE_MAX_BYTES} bytes.`,
    };
  }

  return {
    ok: true,
    slot,
    mapping: mapPatientGatewayImageSlot(slot),
    mimeType,
    fileSize,
    bucket: PATIENT_IMAGES_BUCKET_DEFAULT,
  };
}

export function mapPatientImageRowToGatewayListItem(
  row: PatientImageRow,
  signed?: { url: string; expiresAtIso: string } | null
): PatientGatewayImageListItem {
  const status: PatientGatewayImageListItem["status"] =
    row.image_status === "archived"
      ? "archived"
      : row.patient_portal_release_status === "released"
        ? "released"
        : "held";

  return {
    id: row.id,
    category: row.imaging_protocol_slot_slug?.trim() || row.image_category,
    capturedAt: row.taken_at ?? row.created_at,
    status,
    thumbnailUrl: signed?.url ?? null,
    thumbnailExpiresAt: signed?.expiresAtIso ?? null,
  };
}

export function extensionForMimeType(mimeType: string): string {
  switch (mimeType.toLowerCase()) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    default:
      return "jpg";
  }
}
