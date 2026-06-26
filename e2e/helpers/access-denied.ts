import { expect, type Page, type Response } from "@playwright/test";

/**
 * Asserts a protected FI OS route fails closed for an unauthenticated session.
 * Prefers URL/content signals over raw HTTP status — Next.js redirects often
 * surface as 200 navigations while the final URL is the login page.
 */
export async function expectProtectedRouteFailsClosed(
  page: Page,
  response: Response | null,
  protectedPathSegment: string,
): Promise<void> {
  expect(response, "expected a response").toBeTruthy();

  const status = response!.status();
  const finalUrl = page.url();
  const stillOnProtectedRoute = finalUrl.includes(protectedPathSegment);
  const onLoginSurface =
    /\/follicle-intelligence\/login/.test(finalUrl) ||
    (await page.getByRole("button", { name: /sign in to os/i }).count()) > 0;
  const failedClosed =
    !stillOnProtectedRoute || onLoginSurface || status === 401 || status === 403;

  expect(
    failedClosed,
    `expected redirect to login or 401/403 for unauthenticated ${protectedPathSegment}, got status ${status} at ${finalUrl}`,
  ).toBe(true);
  expect(
    stillOnProtectedRoute,
    `protected route must not render without a session (landed at ${finalUrl})`,
  ).toBe(false);
}
