import { escapeIlikePattern } from "@/src/lib/fi/foundation/search";

/**
 * PostgREST `.or()` filter fragments must apply `ilike` only to **text** values (e.g. `metadata->>key`),
 * never to the `jsonb` column itself (`metadata ~~*` raises `operator does not exist: jsonb ~~* unknown`).
 */

/** Double-quote a value for PostgREST `or` / `filter` strings when it contains reserved characters. */
export function quotePostgrestFilterValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** `%…%` ILIKE pattern with `%` / `_` / `\` escaped for the search fragment. */
export function patientDirectorySearchIlikePattern(searchTerm: string): string {
  const fragment = searchTerm.trim();
  const p = `%${escapeIlikePattern(fragment)}%`;
  return quotePostgrestFilterValue(p);
}

/**
 * OR of `ilike` predicates on text paths under `fi_persons.metadata` (top-level + `hubspot` object).
 * Suitable for `.or(buildFiPersonsMetadataSearchOrFilter(...))` on `fi_persons`.
 */
export function buildFiPersonsMetadataSearchOrFilter(quotedIlikePattern: string): string {
  const paths = [
    "metadata->>display_name",
    "metadata->>email_normalized",
    "metadata->>normalised_display_name",
    "metadata->>phone",
    "metadata->hubspot->>email",
    "metadata->hubspot->>phone_number",
    "metadata->hubspot->>first_name",
    "metadata->hubspot->>last_name",
  ];
  return paths.map((col) => `${col}.ilike.${quotedIlikePattern}`).join(",");
}
