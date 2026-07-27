/**
 * Local reproduce: loadBookingsForPatient for mobile demo patient.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadRepoEnvFiles(): void {
  for (const name of [".env.local", ".env"] as const) {
    const p = resolve(process.cwd(), name);
    if (!existsSync(p)) continue;
    let raw = readFileSync(p, "utf8");
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const withoutExport = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
      const eq = withoutExport.indexOf("=");
      if (eq <= 0) continue;
      const key = withoutExport.slice(0, eq).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
      let val = withoutExport.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}

loadRepoEnvFiles();

async function main(): Promise<void> {
  const { loadBookingsForPatient } = await import("../src/lib/bookings/bookings");
  const { buildPatientGatewayAppointmentsListResponse } = await import(
    "../src/lib/patientPortal/patientGatewayAppointmentsCore"
  );

  const tenantId = "c2615b95-b707-4485-aa5f-be8f78ec868a";
  const patientId = "cb007f3d-2b91-4868-b3d4-88bc0667bc35";

  try {
    const rows = await loadBookingsForPatient(tenantId, patientId);
    const list = buildPatientGatewayAppointmentsListResponse(
      rows,
      "Perth",
      new Date().toISOString()
    );
    console.log(
      JSON.stringify(
        {
          ok: true,
          rowCount: rows.length,
          upcoming: list.upcoming.map((a) => ({ id: a.id, title: a.title, status: a.status })),
          past: list.past.map((a) => ({ id: a.id, title: a.title, status: a.status })),
        },
        null,
        2
      )
    );
  } catch (e) {
    console.error(
      JSON.stringify({
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      })
    );
    process.exit(1);
  }
}

main();
