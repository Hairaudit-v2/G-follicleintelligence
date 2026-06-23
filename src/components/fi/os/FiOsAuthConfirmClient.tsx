"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { createRecoveryBrowserClient } from "@/lib/supabase/client";
import {
  bootstrapSupabaseSessionFromAuthLink,
  readAuthLinkCredentialsFromUrl,
  readAuthTypeFromUrl,
  resolvePostAuthLinkDestination,
  safeInternalPath,
  stripAuthParamsFromUrlKeepSearch,
} from "@/src/lib/supabase/authLinkBootstrap";

const DEFAULT_NEXT = "/fi-admin";

type FiOsAuthConfirmClientProps = {
  defaultNext?: string;
  invalidLinkMessage?: string;
  invalidLinkHref?: string;
  invalidLinkLabel?: string;
};

export function FiOsAuthConfirmClient({
  defaultNext = DEFAULT_NEXT,
  invalidLinkMessage = "This link is invalid or has expired.",
  invalidLinkHref = "/follicle-intelligence/login",
  invalidLinkLabel = "Back to sign in",
}: FiOsAuthConfirmClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const credentials = readAuthLinkCredentialsFromUrl();
    const next = safeInternalPath(searchParams.get("next"), defaultNext);
    const authType = credentials.kind === "tokens" ? credentials.authType : readAuthTypeFromUrl();

    async function confirm() {
      try {
        if (credentials.kind === "none") {
          const supabase = createRecoveryBrowserClient();
          const { data } = await supabase.auth.getSession();
          if (cancelled) return;
          if (data.session) {
            router.replace(resolvePostAuthLinkDestination(next, authType));
            return;
          }
          if (!cancelled) setError(invalidLinkMessage);
          return;
        }

        const supabase = createRecoveryBrowserClient();
        const ok = await bootstrapSupabaseSessionFromAuthLink(supabase, credentials);
        if (cancelled) return;
        if (!ok) {
          setError(invalidLinkMessage);
          return;
        }

        stripAuthParamsFromUrlKeepSearch();
        router.replace(resolvePostAuthLinkDestination(next, authType));
      } catch {
        if (!cancelled) setError("Could not confirm your link.");
      }
    }

    void confirm();
    return () => {
      cancelled = true;
    };
  }, [defaultNext, invalidLinkMessage, router, searchParams]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 px-6 text-center">
        <p role="alert" className="max-w-md text-sm text-rose-100">
          {error}
        </p>
        <Link href={invalidLinkHref} className="text-sm text-cyan-400/90 hover:underline">
          {invalidLinkLabel}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-sm text-slate-400">
      Confirming your link…
    </div>
  );
}
