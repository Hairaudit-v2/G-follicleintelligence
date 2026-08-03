/**
 * Pure consent requirement resolver (no I/O).
 * Derives required form_keys from patient status + booking signals.
 */

import {
  type ConsentFormKey,
  type ConsentRequirementResolution,
  CONSENT_FORM_KEYS,
} from "./consentTypes";

export type ConsentResolverBookingSignal = {
  booking_type?: string | null;
  title?: string | null;
  booking_status?: string | null;
};

export type ConsentResolverInput = {
  patientStatus?: string | null;
  bookings?: ConsentResolverBookingSignal[] | null;
  /** When true, ensures photo_clinical even if patient is not active. */
  hasImaging?: boolean;
  /**
   * When true (default), active patients always get privacy + photo minimum set.
   * Inactive/archived with no treatment bookings get no baseline keys.
   */
  requireBaselineForActive?: boolean;
};

const CANCELLED = new Set(["cancelled", "no_show"]);

function isOpenBooking(status: string | null | undefined): boolean {
  const s = String(status ?? "").trim().toLowerCase();
  if (!s) return true;
  return !CANCELLED.has(s);
}

function haystack(booking: ConsentResolverBookingSignal): string {
  const type = String(booking.booking_type ?? "").trim().toLowerCase();
  const title = String(booking.title ?? "").trim().toLowerCase();
  return `${type} ${title}`;
}

function addKey(
  keys: Set<ConsentFormKey>,
  reasons: Map<ConsentFormKey, string[]>,
  key: ConsentFormKey,
  reason: string
): void {
  keys.add(key);
  const list = reasons.get(key) ?? [];
  if (!list.includes(reason)) list.push(reason);
  reasons.set(key, list);
}

/**
 * Map booking type/title signals to treatment consent keys.
 * - surgery → surgery_procedure
 * - prp → prp_treatment
 * - exosome(s) → exosome_treatment
 * Does not invent keys for unrelated types (consultation, review, etc.).
 */
export function treatmentFormKeysFromBooking(
  booking: ConsentResolverBookingSignal
): ConsentFormKey[] {
  if (!isOpenBooking(booking.booking_status)) return [];
  const h = haystack(booking);
  const out: ConsentFormKey[] = [];
  if (h.includes("surgery") || String(booking.booking_type ?? "").toLowerCase() === "surgery") {
    out.push("surgery_procedure");
  }
  if (
    h.includes("prp") ||
    String(booking.booking_type ?? "").toLowerCase() === "prp" ||
    String(booking.booking_type ?? "").toLowerCase() === "prf"
  ) {
    out.push("prp_treatment");
  }
  if (
    h.includes("exosome") ||
    String(booking.booking_type ?? "").toLowerCase() === "exosomes"
  ) {
    out.push("exosome_treatment");
  }
  return out;
}

export function resolveRequiredConsentFormKeys(
  input: ConsentResolverInput
): ConsentRequirementResolution {
  const keys = new Set<ConsentFormKey>();
  const reasons = new Map<ConsentFormKey, string[]>();

  const status = String(input.patientStatus ?? "active").trim().toLowerCase();
  const isActive = status === "active" || status === "";
  const requireBaseline = input.requireBaselineForActive !== false;
  const bookings = (input.bookings ?? []).filter((b) => isOpenBooking(b.booking_status));

  if (requireBaseline && isActive) {
    addKey(keys, reasons, "privacy_treatment", "Active patient clinical pathway");
    addKey(keys, reasons, "photo_clinical", "Active patient clinical photography policy");
  }

  if (input.hasImaging) {
    addKey(keys, reasons, "photo_clinical", "Patient has clinical imaging on file or pathway");
  }

  for (const b of bookings) {
    const type = String(b.booking_type ?? "").trim() || "booking";
    for (const key of treatmentFormKeysFromBooking(b)) {
      if (key === "surgery_procedure") {
        addKey(keys, reasons, key, `Booking implies surgery (${type})`);
      } else if (key === "prp_treatment") {
        addKey(keys, reasons, key, `Booking implies PRP (${type})`);
      } else if (key === "exosome_treatment") {
        addKey(keys, reasons, key, `Booking implies exosome treatment (${type})`);
      }
    }
  }

  // Sparse fallback: if we have open non-cancelled bookings but no baseline yet
  // (e.g. inactive status overridden by active pathway), still require privacy + photo.
  if (keys.size === 0 && bookings.length > 0) {
    addKey(keys, reasons, "privacy_treatment", "Open clinical booking pathway");
    addKey(keys, reasons, "photo_clinical", "Open clinical booking pathway");
  }

  const requiredFormKeys = CONSENT_FORM_KEYS.filter((k) => keys.has(k));
  const reasonRecord = {} as Record<ConsentFormKey, string[]>;
  for (const k of requiredFormKeys) {
    reasonRecord[k] = reasons.get(k) ?? [];
  }

  return { requiredFormKeys, reasons: reasonRecord };
}

/** Pure: which required keys need a new outstanding instance for the active template version. */
export function planOutstandingConsentCreates(input: {
  requiredFormKeys: ConsentFormKey[];
  activeTemplatesByKey: Partial<
    Record<ConsentFormKey, { version: string; templateId: string }>
  >;
  existingInstances: Array<{
    form_key: string;
    form_version: string;
    status: string;
  }>;
}): Array<{ formKey: ConsentFormKey; formVersion: string; templateId: string }> {
  const out: Array<{ formKey: ConsentFormKey; formVersion: string; templateId: string }> = [];

  for (const formKey of input.requiredFormKeys) {
    const active = input.activeTemplatesByKey[formKey];
    if (!active) continue;

    const forKey = input.existingInstances.filter(
      (i) => i.form_key === formKey && i.status !== "void"
    );

    const hasSignedCurrent = forKey.some(
      (i) => i.status === "signed" && i.form_version === active.version
    );
    const hasOutstanding = forKey.some((i) => i.status === "outstanding");

    // Idempotent: skip if already signed for current version or any outstanding row exists
    // (version bump on outstanding is handled separately by planOutstandingVersionSync).
    if (hasSignedCurrent || hasOutstanding) continue;

    out.push({
      formKey,
      formVersion: active.version,
      templateId: active.templateId,
    });
  }

  return out;
}

/** Pure: outstanding rows whose template version lags the active template. */
export function planOutstandingVersionSync(input: {
  requiredFormKeys: ConsentFormKey[];
  activeTemplatesByKey: Partial<
    Record<ConsentFormKey, { version: string; templateId: string }>
  >;
  existingInstances: Array<{
    id?: string;
    form_key: string;
    form_version: string;
    status: string;
  }>;
}): Array<{ formKey: ConsentFormKey; formVersion: string; templateId: string }> {
  const out: Array<{ formKey: ConsentFormKey; formVersion: string; templateId: string }> = [];
  for (const formKey of input.requiredFormKeys) {
    const active = input.activeTemplatesByKey[formKey];
    if (!active) continue;
    const outstanding = input.existingInstances.find(
      (i) => i.form_key === formKey && i.status === "outstanding"
    );
    if (!outstanding) continue;
    if (outstanding.form_version === active.version) continue;
    out.push({
      formKey,
      formVersion: active.version,
      templateId: active.templateId,
    });
  }
  return out;
}

/** Pure status summary from required keys + instance rows. */
export function computePatientConsentStatusSummary(input: {
  requiredFormKeys: ConsentFormKey[];
  instances: Array<{ form_key: string; status: string }>;
}): {
  required: ConsentFormKey[];
  signed: ConsentFormKey[];
  outstanding: ConsentFormKey[];
  allRequiredSigned: boolean;
} {
  const required = [...input.requiredFormKeys];
  const signedSet = new Set(
    input.instances
      .filter((i) => i.status === "signed")
      .map((i) => i.form_key)
  );
  const outstandingSet = new Set(
    input.instances
      .filter((i) => i.status === "outstanding")
      .map((i) => i.form_key)
  );

  const signed = required.filter((k) => signedSet.has(k));
  const outstanding = required.filter((k) => !signedSet.has(k));
  // Prefer explicit outstanding rows when present; still list required-not-signed as outstanding.
  for (const k of required) {
    if (outstandingSet.has(k) && !signed.includes(k) && !outstanding.includes(k)) {
      outstanding.push(k);
    }
  }

  const allRequiredSigned =
    required.length > 0 && required.every((k) => signedSet.has(k));

  // Empty required set → not "all signed" in a blocking sense for treatments,
  // but allRequiredSigned is true only when every required key is signed.
  // When nothing is required, treat as true (no blockers).
  const allRequiredSignedFinal =
    required.length === 0 ? true : allRequiredSigned;

  return {
    required,
    signed,
    outstanding: required.filter((k) => !signedSet.has(k)),
    allRequiredSigned: allRequiredSignedFinal,
  };
}
