import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i < 0) continue;
  const k = line.slice(0, i).trim();
  let v = line.slice(i + 1);
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  if (k === "FI_EXTERNAL_CONNECTOR_MASTER_KEY") {
    const prior = process.env[k] ?? "";
    if (!prior || v.length > prior.length) process.env[k] = v;
    continue;
  }
  process.env[k] = v;
}

process.env.FI_HUBSPOT_RECOVERY_ACTOR_AUTH_USER_ID ??=
  "d82c54e2-7347-4fc4-b93a-c75ceecb3731";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ref = url.replace("https://", "").split(".")[0];
if (ref !== "iqqvzgxoimxchhcnbzxl") {
  console.error(
    JSON.stringify({
      error: "Refusing to run: Supabase URL is not official production",
      ref,
      expected: "iqqvzgxoimxchhcnbzxl",
    })
  );
  process.exit(2);
}

console.log(
  JSON.stringify({
    supabase_ref: ref,
    master_key_len: process.env.FI_EXTERNAL_CONNECTOR_MASTER_KEY?.length ?? 0,
    actor_set: Boolean(process.env.FI_HUBSPOT_RECOVERY_ACTOR_AUTH_USER_ID),
    mode: process.argv.includes("--probe-only") ? "probe" : "backup",
  })
);

const args = [
  "scripts/run-with-system-ca.mjs",
  "node",
  "-r",
  "./scripts/patch-server-only-for-scripts.cjs",
  "./node_modules/tsx/dist/cli.mjs",
  "scripts/hubspot-engagement-communications-backup.ts",
];
if (process.argv.includes("--probe-only")) args.push("--probe-only");

const r = spawnSync(process.execPath, args, {
  stdio: "inherit",
  env: process.env,
});
process.exit(r.status ?? 1);
