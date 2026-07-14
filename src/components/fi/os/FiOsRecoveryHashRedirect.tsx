"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  buildFiOsUpdatePasswordRecoveryUrl,
  readAuthLinkCredentialsFromUrl,
  shouldRedirectAuthHashToUpdatePassword,
} from "@/src/lib/supabase/authLinkBootstrap";

/**
 * Supabase recovery emails may land on the Site URL root when redirect URLs are misconfigured.
 * Preserve hash tokens while routing to the FI OS update-password page.
 */
export function FiOsRecoveryHashRedirect() {
  const router = useRouter();
  const [active, setActive] = useState(false);

  useEffect(() => {
    const credentials = readAuthLinkCredentialsFromUrl();
    if (!shouldRedirectAuthHashToUpdatePassword(credentials, window.location.pathname)) return;

    setActive(true);
    const target = buildFiOsUpdatePasswordRecoveryUrl(window.location.hash, window.location.search);
    router.replace(target);
  }, [router]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 px-6 text-sm text-slate-300">
      Opening password reset…
    </div>
  );
}
