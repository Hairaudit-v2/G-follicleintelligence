/** PostgREST / Supabase error when a table is not in the remote schema cache yet. */
export function isSupabaseMissingRelationError(
  error: { message?: string } | null | undefined
): boolean {
  const m = (error?.message ?? "").toLowerCase();
  return (
    m.includes("does not exist") ||
    m.includes("schema cache") ||
    m.includes("could not find the table") ||
    (m.includes("relation") && m.includes("not exist"))
  );
}
