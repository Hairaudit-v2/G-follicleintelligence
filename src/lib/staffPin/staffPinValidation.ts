/** Exactly four digits — clinic-floor PIN format. */
export const STAFF_PIN_DIGIT_COUNT = 4;

const STAFF_PIN_RE = /^\d{4}$/;

export function isValidStaffPinFormat(pin: string): boolean {
  return STAFF_PIN_RE.test(String(pin ?? "").trim());
}

export function normalizeStaffPinInput(pin: string): string {
  return String(pin ?? "").trim();
}

export function assertStaffPinFormat(pin: string): void {
  if (!isValidStaffPinFormat(pin)) {
    throw new Error("PIN must be exactly 4 digits.");
  }
}

export function staffPinsMatch(newPin: string, confirmPin: string): boolean {
  return normalizeStaffPinInput(newPin) === normalizeStaffPinInput(confirmPin);
}
