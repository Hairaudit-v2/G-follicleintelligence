#!/usr/bin/env node
/** Validate .env.local and .env.vercel.production against Zod schema via tsx. */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = new URL("..", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");

function parseEnvFile(path) {
  const full = join(repoRoot, path);
  if (!existsSync(full)) return {};
  const out = {};
  for (const line of readFileSync(full, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const local = parseEnvFile(".env.local");
const vercel = parseEnvFile(".env.vercel.production");

const cases = [
  { name: "local (development)", env: { ...local, NODE_ENV: "development" } },
  { name: "vercel production snapshot", env: { ...vercel, NODE_ENV: "production", VERCEL_ENV: "production" } },
];

for (const { name, env } of cases) {
  const script = `
    import { validateFullEnv } from "./src/lib/env/schema.ts";
    const result = validateFullEnv(${JSON.stringify(env)});
    if (!result.ok) {
      for (const i of result.issues) console.log(i.variable + "\\t" + i.message);
      process.exit(1);
    }
    console.log("PASS");
  `;
  const r = spawnSync("npx", ["tsx", "-e", script], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: true,
  });
  console.log(`\n=== ${name} ===`);
  if (r.status === 0) {
    console.log(r.stdout.trim());
  } else {
    console.log("FAIL:");
    console.log((r.stdout || r.stderr || "").trim());
  }
}