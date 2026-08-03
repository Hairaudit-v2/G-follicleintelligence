import "server-only";

import { logStructured } from "@/src/lib/server/structuredLog";

export function emitTrichoscopyTelemetry(
  event: string,
  fields: Record<string, unknown>
): void {
  logStructured({
    level: "info",
    event: `hli_trichoscopy.${event}`,
    ...fields,
  });
}
