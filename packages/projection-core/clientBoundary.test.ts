/**
 * Regression: /client must never reach node:crypto or server/idempotency.
 * Walks the static import graph from client.ts (fixture mirrors "use client" consumers).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PKG_ROOT = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_ENTRY = path.join(PKG_ROOT, "client.ts");

const IMPORT_RE =
  /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"](\.[^'"]+)['"]/g;

function resolveImport(fromFile: string, spec: string): string | null {
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

function walkClientGraph(entry: string): { files: string[]; sources: Map<string, string> } {
  const files: string[] = [];
  const sources = new Map<string, string>();
  const queue = [entry];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    files.push(file);
    const source = readFileSync(file, "utf8");
    sources.set(file, source);
    IMPORT_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = IMPORT_RE.exec(source)) !== null) {
      const resolved = resolveImport(file, match[1]);
      if (resolved && !seen.has(resolved)) queue.push(resolved);
    }
  }
  return { files, sources };
}

describe("@follicle/projection-core client boundary", () => {
  it("client entry dependency graph excludes node:crypto and server/idempotency", () => {
    const { files, sources } = walkClientGraph(CLIENT_ENTRY);

    assert.ok(files.includes(CLIENT_ENTRY), "client.ts must be visited");

    for (const [file, source] of sources) {
      assert.equal(
        /from\s+['"]node:crypto['"]/.test(source) ||
          /import\s*\(\s*['"]node:crypto['"]\s*\)/.test(source) ||
          /require\(\s*['"]node:crypto['"]\s*\)/.test(source),
        false,
        `${path.relative(PKG_ROOT, file)} must not import node:crypto`
      );
      assert.equal(
        /from\s+['"]server-only['"]/.test(source) || /import\s+['"]server-only['"]/.test(source),
        false,
        `${path.relative(PKG_ROOT, file)} must not import server-only`
      );
      assert.equal(
        /['"]\.\.\/server\/idempotency['"]|['"]\.\/server\/idempotency['"]/.test(source),
        false,
        `${path.relative(PKG_ROOT, file)} must not import server/idempotency`
      );
    }

    assert.equal(
      files.some((f) => /server[/\\]idempotency\.ts$/.test(f)),
      false,
      "server/idempotency.ts must not appear in the client graph"
    );
  });

  it("package root export is unavailable (force /client or /server)", () => {
    const pkg = JSON.parse(readFileSync(path.join(PKG_ROOT, "package.json"), "utf8")) as {
      exports: Record<string, string>;
    };
    assert.equal(pkg.exports["."], undefined);
    assert.ok(pkg.exports["./client"]);
    assert.ok(pkg.exports["./server"]);
    assert.equal(existsSync(path.join(PKG_ROOT, "index.ts")), false);
  });
});
