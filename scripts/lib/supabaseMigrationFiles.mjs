import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATION_FILE_RE = /^(\d{12,14})_(.+)\.sql$/;

/**
 * @returns {{ version: string, name: string, filename: string, sql: string }[]}
 */
export function listLocalMigrationFiles(migrationsDir) {
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const parsed = [];
  const versionCounts = new Map();

  for (const filename of files) {
    const match = filename.match(MIGRATION_FILE_RE);
    if (!match) {
      throw new Error(`Invalid migration filename (expected {12-14-digit-version}_{name}.sql): ${filename}`);
    }
    const [, version, name] = match;
    versionCounts.set(version, (versionCounts.get(version) ?? 0) + 1);
    parsed.push({
      version,
      name,
      filename,
      sql: readFileSync(join(migrationsDir, filename), "utf8"),
    });
  }

  const duplicates = [...versionCounts.entries()].filter(([, count]) => count > 1);
  if (duplicates.length > 0) {
    const detail = duplicates
      .map(([version]) => {
        const names = parsed.filter((m) => m.version === version).map((m) => m.filename);
        return `${version}: ${names.join(", ")}`;
      })
      .join("; ");
    throw new Error(`Duplicate migration version prefix(es) in supabase/migrations — rename before push: ${detail}`);
  }

  return parsed;
}
