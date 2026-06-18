/**
 * Validates environment variables when the Next.js server starts (and during production builds).
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertEnvOnStartup } = await import("@/src/lib/env/server");
    assertEnvOnStartup();
  }
}
