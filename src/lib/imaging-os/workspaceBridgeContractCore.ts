/**
 * FI-IMAGING-WORKSPACE-BRIDGE-CONTRACT-1 — parse named re-exports for contract enforcement.
 */

export type WorkspaceBridgeExportSurface = {
  values: string[];
  types: string[];
};

function splitExportClause(clause: string): { name: string; kind: "value" | "type" } | null {
  const trimmed = clause.trim();
  if (!trimmed) return null;
  const typeMatch = trimmed.match(/^type\s+([A-Za-z_$][\w$]*)$/);
  if (typeMatch) return { name: typeMatch[1]!, kind: "type" };
  if (/^type\s+/.test(trimmed)) return null;
  const name = trimmed.match(/^([A-Za-z_$][\w$]*)$/)?.[1];
  if (!name) return null;
  return { name, kind: "value" };
}

export function extractNamedReExportsFromSource(source: string): WorkspaceBridgeExportSurface {
  const values: string[] = [];
  const types: string[] = [];

  const blockPattern = /export\s+(type\s+)?\{([^}]+)\}\s+from\s+["'][^"']+["']/g;
  for (const match of source.matchAll(blockPattern)) {
    const blockIsTypeOnly = Boolean(match[1]);
    const body = match[2] ?? "";
    for (const clause of body.split(",")) {
      const parsed = splitExportClause(clause);
      if (!parsed) continue;
      if (blockIsTypeOnly || parsed.kind === "type") types.push(parsed.name);
      else values.push(parsed.name);
    }
  }

  return {
    values: [...new Set(values)].sort(),
    types: [...new Set(types)].sort(),
  };
}

export function hasBroadReExport(source: string): boolean {
  return /export\s+\*\s+from\s+["'][^"']+["']/.test(source);
}

export function flattenExportSurface(surface: WorkspaceBridgeExportSurface): string[] {
  return [...surface.values, ...surface.types].sort();
}