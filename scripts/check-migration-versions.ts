import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "supabase", "migrations");
const files = fs.readdirSync(dir).filter((file) => file.endsWith(".sql"));

const seen = new Map<string, string[]>();

for (const file of files) {
  const version = file.split("_")[0];
  seen.set(version, [...(seen.get(version) ?? []), file]);
}

const duplicates = [...seen.entries()].filter(([, files]) => files.length > 1);

if (duplicates.length) {
  console.error("Duplicate Supabase migration versions found:");
  for (const [version, files] of duplicates) {
    console.error(`\n${version}`);
    for (const file of files) console.error(`  - ${file}`);
  }
  process.exit(1);
}

console.log("Migration versions OK");
