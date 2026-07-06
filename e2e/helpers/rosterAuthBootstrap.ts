import { requireE2eBaseUrl } from "../fixtures/baseUrl";

function requireSupabaseAdminEnv(): { url: string; serviceRoleKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for roster e2e magic-link bootstrap.",
    );
  }
  return { url, serviceRoleKey };
}

type GenerateLinkResponse = {
  action_link?: string;
  properties?: { action_link?: string };
};

/**
 * Issues a one-time Supabase magic link for roster permission e2e login.
 * Uses the admin REST API directly (no supabase-js client — avoids Node 20 WebSocket).
 */
export async function issueRosterE2eMagicLink(input: {
  email: string;
  tenantId: string;
  nextPath: string;
}): Promise<string> {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error("Roster e2e magic link requires email.");

  const baseUrl = requireE2eBaseUrl().replace(/\/$/, "");
  const nextPath = input.nextPath.startsWith("/") ? input.nextPath : `/${input.nextPath}`;
  const redirectTo = `${baseUrl}/follicle-intelligence/auth/confirm?next=${encodeURIComponent(nextPath)}`;

  const { url, serviceRoleKey } = requireSupabaseAdminEnv();
  const endpoint = `${url.replace(/\/$/, "")}/auth/v1/admin/generate_link`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "magiclink",
      email,
      options: { redirectTo },
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as GenerateLinkResponse & {
    msg?: string;
    error?: string;
    error_description?: string;
  };
  if (!response.ok) {
    const detail =
      payload.error_description ?? payload.msg ?? payload.error ?? `HTTP ${response.status}`;
    throw new Error(`Roster e2e magic link failed: ${detail}`);
  }

  const actionLink = payload.properties?.action_link?.trim() ?? payload.action_link?.trim();
  if (!actionLink) {
    throw new Error(`Roster e2e magic link missing action_link for ${email}.`);
  }
  return actionLink;
}