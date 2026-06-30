/** Public API error text for uncaught route exceptions (no internal detail in production). */
export function crmUnexpectedErrorPublicMessage(
  error: Error,
  nodeEnv: string | undefined = process.env.NODE_ENV
): string {
  if (nodeEnv === "production") return "An unexpected error occurred.";
  return error.message;
}