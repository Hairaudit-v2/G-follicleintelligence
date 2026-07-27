/**
 * Direct PostgREST check: same filters as loadBookingsForPatient.
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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const tenantId = "c2615b95-b707-4485-aa5f-be8f78ec868a";
  const patientId = "cb007f3d-2b91-4868-b3d4-88bc0667bc35";
  const bookingId = "213b2ee7-0c8c-40ba-b0d7-a833a0b6b1e4";
  if (!url || !key) throw new Error("missing env");

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
  };

  const listUrl = `${url}/rest/v1/fi_bookings?select=id,title,patient_id,tenant_id,booking_status&tenant_id=eq.${tenantId}&patient_id=eq.${patientId}&order=start_at.asc`;
  const byIdUrl = `${url}/rest/v1/fi_bookings?select=id,title,patient_id,tenant_id&tenant_id=eq.${tenantId}&id=eq.${bookingId}`;

  const listRes = await fetch(listUrl, { headers });
  const byIdRes = await fetch(byIdUrl, { headers });
  console.log(
    JSON.stringify(
      {
        listStatus: listRes.status,
        listBody: await listRes.json(),
        byIdStatus: byIdRes.status,
        byIdBody: await byIdRes.json(),
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
