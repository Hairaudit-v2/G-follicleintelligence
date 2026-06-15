/**
 * Single-line JSON logs for cron, webhooks, and security-sensitive routes.
 * Intended for log drains (Vercel / Datadog / CloudWatch); avoid PII in `fields`.
 */
export type StructuredLogLevel = "info" | "warn" | "error";

export type StructuredLogFields = Record<string, string | number | boolean | null | undefined>;

export function logStructured(
  level: StructuredLogLevel,
  event: string,
  fields: StructuredLogFields = {}
): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}
