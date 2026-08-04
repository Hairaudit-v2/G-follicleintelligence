import "server-only";

import { logStructured, type StructuredLogFields } from "@/src/lib/server/structuredLog";

export function emitTrichoscopyTelemetry(
  event: string,
  fields: StructuredLogFields = {}
): void {
  logStructured("info", `hli_trichoscopy.${event}`, fields);
}
