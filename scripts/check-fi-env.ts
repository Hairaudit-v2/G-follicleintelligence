/** Scripts run outside Next.js — import schema directly (not server.ts, which uses `server-only`). */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { assertValidEnv } from "../src/lib/env/schema";

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
assertValidEnv();

async function probeSupabaseConnectivity(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing — add it to .env.local at the repo root.");
  }

  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" },
    });
    if (res.status >= 500) {
      throw new Error(`Supabase REST returned ${res.status}`);
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    const cause =
      err instanceof Error && err.cause instanceof Error ? err.cause.message : "";
    const tlsIntercepted = /UNABLE_TO_VERIFY|CERT|SELF_SIGNED|LEAF_SIGNATURE/i.test(
      `${detail} ${cause}`
    );
    if (tlsIntercepted) {
      throw new Error(
        "Supabase TLS verification failed (likely corporate proxy/AV interception). " +
          "Re-run via `npm run check:env` (uses --use-system-ca) or set NODE_OPTIONS=--use-system-ca for tsx scripts. " +
          "See e2e/README.md TLS note."
      );
    }
    throw new Error(`Supabase connectivity probe failed: ${detail}`);
  }
}

async function main(): Promise<void> {
  await probeSupabaseConnectivity();
  console.log("FI OS environment validation passed.");
  console.log("Supabase connectivity probe passed.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
