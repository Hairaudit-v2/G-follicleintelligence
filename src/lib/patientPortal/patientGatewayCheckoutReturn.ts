/**
 * Resolve Stripe Checkout return URLs for patient gateway sessions.
 * Web → HTTPS patient PWA. Native → configured FI_PAYMENT_* URLs (deep-link bridge).
 */

import {
  readFiPaymentCancelUrl,
  readFiPaymentSuccessUrl,
} from "@/src/lib/payments/fiPaymentEnv.server";

export type PatientCheckoutPlatform = "web" | "native";

export function readPatientWebAppUrl(): string | undefined {
  const u = process.env.FI_PATIENT_WEB_APP_URL?.trim();
  if (u) return u.replace(/\/+$/, "");
  return "https://app.follicleintelligence.ai";
}

export function parsePatientCheckoutPlatform(raw: unknown): PatientCheckoutPlatform | null {
  if (raw === "web" || raw === "native") return raw;
  return null;
}

export function resolvePatientCheckoutReturnUrls(platform: PatientCheckoutPlatform | null): {
  successUrl: string;
  cancelUrl: string;
} {
  if (platform === "web") {
    const base = readPatientWebAppUrl();
    if (!base) {
      throw new Error("FI_PATIENT_WEB_APP_URL is required for web checkout returns.");
    }
    const returnUrl = `${base}/payment/return`;
    return { successUrl: returnUrl, cancelUrl: returnUrl };
  }

  const success = readFiPaymentSuccessUrl();
  const cancel = readFiPaymentCancelUrl();
  if (!success?.trim() || !cancel?.trim()) {
    throw new Error(
      "FI_PAYMENT_SUCCESS_URL and FI_PAYMENT_CANCEL_URL are required for Stripe checkout."
    );
  }
  return { successUrl: success.trim(), cancelUrl: cancel.trim() };
}
