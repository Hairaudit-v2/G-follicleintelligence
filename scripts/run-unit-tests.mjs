/**
 * Runs `tsx --test` over all `*.test.ts` files under lib/, src/, and packages/
 * so Windows is not blocked by npm script argv length limits.
 */
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..");

const roots = ["lib", "src", "packages"].map((d) => join(root, d));

/** @param {string} dir @param {string[]} acc */
function walk(dir, acc) {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const name of names) {
    if (name === "node_modules" || name === ".next" || name === "dist") continue;
    const p = join(dir, name);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(p, acc);
    else if (name.endsWith(".test.ts")) acc.push(relative(root, p).split("\\").join("/"));
  }
  return acc;
}

const files = roots.flatMap((d) => walk(d, [])).sort();
if (files.length === 0) {
  console.error("run-unit-tests: no *.test.ts files found.");
  process.exit(1);
}

const cli = join(root, "node_modules", "tsx", "dist", "cli.mjs");
const r = spawnSync(process.execPath, [cli, "--test", ...files], {
  cwd: root,
  stdio: "inherit",
});

if (r.error) {
  console.error(r.error);
  process.exit(1);
}
process.exit(r.status ?? 1);
