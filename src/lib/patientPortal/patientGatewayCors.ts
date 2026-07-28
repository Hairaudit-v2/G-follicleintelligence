/**
 * Explicit CORS allowlist for the production patient web/PWA origin.
 * Never uses wildcard for authenticated patient APIs.
 */

export const PATIENT_WEB_PRODUCTION_ORIGIN = "https://app.follicleintelligence.ai";

const EXTRA_ORIGINS = (process.env.FI_PATIENT_WEB_CORS_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function developmentOrigins(): string[] {
  if (process.env.NODE_ENV === "production") return [];
  return ["http://localhost:8081", "http://localhost:19006", "http://127.0.0.1:8081"];
}

export function listPatientWebAllowedOrigins(): string[] {
  return Array.from(
    new Set([PATIENT_WEB_PRODUCTION_ORIGIN, ...EXTRA_ORIGINS, ...developmentOrigins()])
  );
}

export function resolvePatientWebCorsOrigin(requestOrigin: string | null): string | null {
  if (!requestOrigin) return null;
  const allowed = listPatientWebAllowedOrigins();
  return allowed.includes(requestOrigin) ? requestOrigin : null;
}

export function isPatientGatewayApiPath(pathname: string): boolean {
  return pathname === "/api/patient/v1" || pathname.startsWith("/api/patient/v1/");
}

export const PATIENT_GATEWAY_CORS_METHODS = "GET,POST,PATCH,PUT,DELETE,OPTIONS";
export const PATIENT_GATEWAY_CORS_HEADERS = "Authorization, Content-Type, Accept";
