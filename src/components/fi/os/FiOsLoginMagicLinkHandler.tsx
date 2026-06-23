"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { createRecoveryBrowserClient } from "@/lib/supabase/client";
import {
  bootstrapSupabaseSessionFromAuthLink,
  readAuthLinkCredentialsFromUrl,
  resolvePostAuthLinkDestination,
  safeInternalPath,
  stripAuthParamsFromUrlKeepSearch,
} from "@/src/lib/supabase/authLinkBootstrap";

/**
 * Admin invite and magic-link emails redirect to /login with Supabase tokens in the URL hash.
 * This handler establishes the cookie session before the password form renders.
 */
export function FiOsLoginMagicLinkHandler({ safeNextPath }: { safeNextPath: string }) {
  const router = useRouter();
  const [active, setActive] = useState(false);

  useEffect(() => {
    const credentials = readAuthLinkCredentialsFromUrl();
    if (credentials.kind === "none") return;

    let cancelled = false;
    setActive(true);

    async function bootstrap() {
      const fallbackNext = safeInternalPath(safeNextPath, "/fi-admin");
      const authType = credentials.kind === "tokens" ? credentials.authType : null;

      try {
        const supabase = createRecoveryBrowserClient();
        const ok = await bootstrapSupabaseSessionFromAuthLink(supabase, credentials);
        if (cancelled) return;
        if (!ok) {
          setActive(false);
          return;
        }

        stripAuthParamsFromUrlKeepSearch();
        router.replace(resolvePostAuthLinkDestination(fallbackNext, authType));
      } catch {
        if (!cancelled) setActive(false);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [router, safeNextPath]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 px-6 text-sm text-slate-300">
      Signing you in…
    </div>
  );
}
